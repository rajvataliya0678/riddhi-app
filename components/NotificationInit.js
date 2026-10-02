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
import { collection, onSnapshot, query, updateDoc, doc, arrayUnion, orderBy, limit, getDocs, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import {
  requestNotificationPermission,
  createNotificationChannel,
  registerNotificationActionTypes,
  setupActionListener,
} from '@/lib/meetingNotifications';

// Helper: Robust timestamp parser for Firestore Timestamps, Date objects, ISO strings, etc.
function parseTimestamp(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

// ── Real-Time Broadcast Notification Listener (0-Second Instant Delivery) ──────
function subscribeBroadcastNotifications(uid, userRole, userCreatedAt, clubId = 'main') {
  if (!uid) return () => {};

  const regDate = parseTimestamp(userCreatedAt);

  const q = query(
    collection(db, 'broadcast_notifications'),
    orderBy('sentAt', 'desc'),
    limit(20)
  );

  const unsubscribe = onSnapshot(q, async (snap) => {
    try {
      const pending = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(n => {
          if (n.deleted) return false;
          if ((n.clubId || 'main') !== (clubId || 'main')) return false;
          if ((n.readBy || []).includes(uid)) return false; // already seen

          // Registration time filter: ONLY push notifications sent AFTER user registered
          const sentDate = parseTimestamp(n.sentAt);
          if (regDate && sentDate && sentDate.getTime() < (regDate.getTime() - 60000)) {
            return false;
          }

          // Audience filter
          if (n.audience === 'all') return true;
          if (n.audience === 'coaches' && (userRole === 'coach' || userRole === 'admin')) return true;
          if (n.audience === 'customers' && userRole === 'customer') return true;
          // Targeted notification (e.g. absence alert for a specific coach)
          if (n.audience === 'targeted' && n.targetUid === uid) return true;
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
          schedule: { at: new Date(Date.now() + 100) }, // Instant 0.1s trigger
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
  let currentDocs = [];

  const checkAndNotify = () => {
    if (!currentDocs || currentDocs.length === 0) return;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    currentDocs.forEach(d => {
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
              schedule: { at: new Date(Date.now() + 100) },
            }]
          }).catch(err => console.warn('[AutoMeetingNotif] Schedule error:', err));
        }
      }
    });
  };

  const unsubscribe = onSnapshot(q, (snap) => {
    currentDocs = snap.docs;
    checkAndNotify();
  }, (err) => console.warn('[NotificationInit] Meeting snapshot error:', err));

  // Check every 10 seconds for exact minute match without re-subscribing!
  const timer = setInterval(checkAndNotify, 10000);

  return () => {
    unsubscribe();
    clearInterval(timer);
  };
}

// ── Absence Notification: Customer missed session → notify their Coach ──────────
// Session windows: Morning 11:00–12:00 AM, Evening 19:45–20:45
// We check ONCE after the window closes (12:05 and 20:50) if customer was absent
// Coach absence does NOT trigger owner/admin notification (removed by design)
const _absenceCheckedToday = new Set(); // prevent duplicate checks per session per day

async function checkAndNotifyAbsence(uid, userData) {
  if (!uid || !userData) return;
  const role = userData.role || 'customer';

  // Only notify for customers (not coaches/admin)
  if (role !== 'customer') return;

  const coachId = userData.coachId || userData.coachUid || '';
  if (!coachId) return; // no assigned coach — nothing to notify

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Morning session: 11:00–12:00 → check window 12:05–12:30 (725–750 min)
  // Evening session: 19:45–20:45 → check window 20:50–21:15 (1250–1275 min)
  const checkWindows = [
    { session: 'morning', start: 725, end: 750 },
    { session: 'evening', start: 1250, end: 1275 },
  ];

  for (const window of checkWindows) {
    if (nowMin < window.start || nowMin > window.end) continue;

    const checkKey = `${uid}_${todayStr}_${window.session}`;
    if (_absenceCheckedToday.has(checkKey)) continue;
    _absenceCheckedToday.add(checkKey);

    try {
      // Check if this customer attended this session today
      const attSnap = await getDocs(
        query(
          collection(db, 'meeting_attendance'),
          where('uid', '==', uid),
          where('date', '==', todayStr),
          where('sessionType', '==', window.session)
        )
      );

      if (attSnap.empty) {
        // Customer was ABSENT — notify their coach
        const sessionLabel = window.session === 'morning' ? 'Morning (11:00 AM)' : 'Evening (7:45 PM)';
        const customerName = userData.name || 'A customer';

        // Write a targeted notification for the coach
        await addDoc(collection(db, 'broadcast_notifications'), {
          title: '⚠️ Session Absentee Alert',
          body: `${customerName} missed today's ${sessionLabel} session.`,
          audience: 'targeted',
          targetUid: coachId, // only this coach will see it
          sentBy: 'system',
          sentAt: serverTimestamp(),
          readBy: [],
          type: 'absence_alert',
          absentUid: uid,
          absentName: customerName,
          session: window.session,
          date: todayStr,
        });

        console.log(`[AbsenceNotif] Coach ${coachId} notified: ${customerName} absent from ${window.session} session.`);
      }
    } catch (err) {
      console.warn('[AbsenceNotif] Error checking attendance:', err);
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotificationInit({ uid, userRole, userCreatedAt, userData, clubId = 'main' }) {
  useEffect(() => {
    let cleanupAction = null;
    let unsubscribeNotif = null;
    let unsubscribeMeeting = null;
    let absenceTimer = null;
    let mounted = true;

    async function init() {
      await requestNotificationPermission();
      await createNotificationChannel();
      await registerNotificationActionTypes();
      const cleanup = await setupActionListener();
      if (mounted) cleanupAction = cleanup;

      // Subscribe to real-time instant broadcast notifications & auto meeting notifications
      if (uid && mounted) {
        unsubscribeNotif = subscribeBroadcastNotifications(uid, userRole, userCreatedAt, clubId);
        unsubscribeMeeting = subscribeMeetingAutoBroadcast(uid, userRole);

        // Check for customer absence every 60 seconds after session windows
        // (only relevant for 'customer' role; coaches/admins skip silently)
        if (userRole === 'customer' && userData) {
          absenceTimer = setInterval(() => {
            checkAndNotifyAbsence(uid, userData);
          }, 60000); // every 60 seconds

          // Also run immediately on mount in case user opens app during check window
          checkAndNotifyAbsence(uid, userData);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      if (cleanupAction) cleanupAction();
      if (unsubscribeNotif) unsubscribeNotif();
      if (unsubscribeMeeting) unsubscribeMeeting();
      if (absenceTimer) clearInterval(absenceTimer);
    };
  }, [uid, userRole, userCreatedAt, userData]);

  return null;
}

