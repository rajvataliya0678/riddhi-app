'use client';

/**
 * NotificationInit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * App open થાય ત્યારે immediately:
 *   1. Notification permission માટે OS popup show કરે
 *   2. Meeting reminder channel create + action types register
 *   3. Firestore broadcast_notifications check — admin sent notifications
 *      show as local notifications (once per user)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { useEffect } from 'react';
import { collection, onSnapshot, query, updateDoc, doc, arrayUnion, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import {
  requestNotificationPermission,
  createNotificationChannel,
  registerNotificationActionTypes,
  setupActionListener,
} from '@/lib/meetingNotifications';

// ── Real-Time Broadcast Notification Listener (0-Second Instant Delivery) ──────
function subscribeBroadcastNotifications(uid, userRole, userCreatedAt) {
  if (!uid) return () => {};

  const regDate = userCreatedAt?.toDate
    ? userCreatedAt.toDate()
    : userCreatedAt
      ? new Date(userCreatedAt)
      : new Date(0);

  const q = query(
    collection(db, 'broadcast_notifications'),
    orderBy('sentAt', 'desc'),
    limit(10)
  );

  const unsubscribe = onSnapshot(q, async (snap) => {
    try {
      const pending = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(n => {
          if (n.deleted) return false;
          if ((n.readBy || []).includes(uid)) return false; // already seen

          // Registration time filter: ONLY push notifications sent AFTER user registered
          const sentDate = n.sentAt?.toDate ? n.sentAt.toDate() : new Date(n.sentAt || 0);
          if (sentDate < regDate) return false;

          // Audience filter
          if (n.audience === 'all') return true;
          if (n.audience === 'coaches' && (userRole === 'coach' || userRole === 'admin')) return true;
          if (n.audience === 'customers' && userRole === 'customer') return true;
          return false;
        });

      if (pending.length === 0) return;

      if (Capacitor.isNativePlatform()) {
        // Instant delivery on Android/iOS app shell
        const notifications = pending.map((n, idx) => ({
          id: 20000 + (idx % 1000),
          title: n.title,
          body: n.body,
          channelId: 'meeting_reminders',
          sound: 'session_reminder',
          extra: { link: n.link || '' },
          schedule: { at: new Date(Date.now() + 200) }, // Instant 0s trigger
        }));

        await LocalNotifications.schedule({ notifications });
      }

      // Mark as read by this user
      for (const n of pending) {
        updateDoc(doc(db, 'broadcast_notifications', n.id), {
          readBy: arrayUnion(uid),
        }).catch(err => console.warn('[NotifReadUpdate] Error:', err));
      }
    } catch (err) {
      console.warn('[NotificationInit] Realtime broadcast listener error:', err);
    }
  }, (err) => console.warn('[NotificationInit] Snapshot error:', err));

  return unsubscribe;
}

// ── Real-Time Auto Meeting Notification Listener ────────────────────────────────
function subscribeMeetingAutoBroadcast(uid, userRole) {
  if (!uid) return () => {};

  const q = query(collection(db, 'meetings'));
  const todayStr = new Date().toISOString().split('T')[0];
  const notifiedMeetings = new Set();

  const checkAndNotify = (snapDocs) => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    snapDocs.forEach(d => {
      const m = { id: d.id, ...d.data() };
      if (!m.time) return;

      const isToday = m.recurrence === 'daily' || m.date === todayStr;
      if (!isToday) return;

      // Check target audience
      let canSee = false;
      if (m.visibleTo === 'customers' || m.visibleTo === 'all' || !m.visibleTo) canSee = true;
      if (m.visibleTo === 'coaches' && (userRole === 'coach' || userRole === 'admin')) canSee = true;
      if (!canSee) return;

      let hours = 0, minutes = 0;
      const ampmMatch = m.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (ampmMatch) {
        hours = parseInt(ampmMatch[1]);
        minutes = parseInt(ampmMatch[2]);
        const period = ampmMatch[3].toUpperCase();
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
      } else {
        const parts = m.time.split(':');
        hours = parseInt(parts[0]) || 0;
        minutes = parseInt(parts[1]) || 0;
      }

      const meetingMinutes = hours * 60 + minutes;
      const key = `${m.id}_${todayStr}_${hours}_${minutes}`;

      // Trigger if meeting time has arrived (within 0 to 5 mins window) and not yet notified
      if (nowMinutes >= meetingMinutes && nowMinutes <= meetingMinutes + 5 && !notifiedMeetings.has(key)) {
        notifiedMeetings.add(key);

        if (Capacitor.isNativePlatform()) {
          LocalNotifications.schedule({
            notifications: [{
              id: 30000 + (Math.abs(d.id.hashCode ? d.id.hashCode() : 1) % 10000),
              title: 'Your session is starting 🎥',
              body: `${m.title || 'Live Session'} is starting now. Tap Join to enter!`,
              sound: 'session_reminder',
              channelId: 'meeting_reminders',
              actionTypeId: 'MEETING_ACTIONS',
              extra: { meetingUrl: m.meetingUrl || '' },
              schedule: { at: new Date(Date.now() + 200) },
            }]
          }).catch(err => console.warn('[AutoMeetingNotif] Schedule error:', err));
        }
      }
    });
  };

  const unsubscribe = onSnapshot(q, (snap) => {
    checkAndNotify(snap.docs);
  }, (err) => console.warn('[NotificationInit] Meeting snapshot error:', err));

  // Check every 30 seconds for exact minute match
  const timer = setInterval(() => {
    onSnapshot(q, (snap) => checkAndNotify(snap.docs))();
  }, 30000);

  return () => {
    unsubscribe();
    clearInterval(timer);
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotificationInit({ uid, userRole, userCreatedAt }) {
  useEffect(() => {
    let cleanupAction = null;
    let unsubscribeNotif = null;
    let unsubscribeMeeting = null;
    let mounted = true;

    async function init() {
      await requestNotificationPermission();
      await createNotificationChannel();
      await registerNotificationActionTypes();
      const cleanup = await setupActionListener();
      if (mounted) cleanupAction = cleanup;

      // Subscribe to real-time instant broadcast notifications & auto meeting notifications
      if (uid && mounted) {
        unsubscribeNotif = subscribeBroadcastNotifications(uid, userRole, userCreatedAt);
        unsubscribeMeeting = subscribeMeetingAutoBroadcast(uid, userRole);
      }
    }

    init();

    return () => {
      mounted = false;
      if (cleanupAction) cleanupAction();
      if (unsubscribeNotif) unsubscribeNotif();
      if (unsubscribeMeeting) unsubscribeMeeting();
    };
  }, [uid, userRole, userCreatedAt]);

  return null;
}

