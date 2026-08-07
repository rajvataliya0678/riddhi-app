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

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotificationInit({ uid, userRole, userCreatedAt }) {
  useEffect(() => {
    let cleanupAction = null;
    let unsubscribeNotif = null;
    let mounted = true;

    async function init() {
      await requestNotificationPermission();
      await createNotificationChannel();
      await registerNotificationActionTypes();
      const cleanup = await setupActionListener();
      if (mounted) cleanupAction = cleanup;

      // Subscribe to real-time instant broadcast notifications
      if (uid && mounted) {
        unsubscribeNotif = subscribeBroadcastNotifications(uid, userRole, userCreatedAt);
      }
    }

    init();

    return () => {
      mounted = false;
      if (cleanupAction) cleanupAction();
      if (unsubscribeNotif) unsubscribeNotif();
    };
  }, [uid, userRole, userCreatedAt]);

  return null;
}

