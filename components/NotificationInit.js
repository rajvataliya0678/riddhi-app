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
import { collection, getDocs, query, where, updateDoc, doc, arrayUnion, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import {
  requestNotificationPermission,
  createNotificationChannel,
  registerNotificationActionTypes,
  setupActionListener,
} from '@/lib/meetingNotifications';

// ── Broadcast Notification Checker ────────────────────────────────────────────
async function checkBroadcastNotifications(uid, userRole) {
  if (!Capacitor.isNativePlatform()) return;
  if (!uid) return;

  try {
    // Fetch last 10 broadcast notifications not yet read by this user
    const snap = await getDocs(
      query(
        collection(db, 'broadcast_notifications'),
        orderBy('sentAt', 'desc'),
        limit(10)
      )
    );

    const pending = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(n => {
        if (n.deleted) return false;
        if ((n.readBy || []).includes(uid)) return false; // already seen

        // Audience filter
        if (n.audience === 'all') return true;
        if (n.audience === 'coaches' && (userRole === 'coach' || userRole === 'admin')) return true;
        if (n.audience === 'customers' && userRole === 'customer') return true;
        return false;
      });

    if (pending.length === 0) return;

    // Show each as a local notification
    const notifications = pending.map((n, idx) => ({
      id: 20000 + idx,
      title: n.title,
      body: n.body,
      channelId: 'meeting_reminders',
      sound: 'session_reminder',
      extra: { link: n.link || '' },
      schedule: { at: new Date(Date.now() + (idx + 1) * 2000) }, // stagger by 2s each
    }));

    await LocalNotifications.schedule({ notifications });

    // Mark all as read by this user
    for (const n of pending) {
      await updateDoc(doc(db, 'broadcast_notifications', n.id), {
        readBy: arrayUnion(uid),
      });
    }
  } catch (err) {
    console.warn('[NotificationInit] Broadcast check failed:', err);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotificationInit({ uid, userRole }) {
  useEffect(() => {
    let cleanupFn = null;
    let mounted = true;

    async function init() {
      await requestNotificationPermission();
      await createNotificationChannel();
      await registerNotificationActionTypes();
      const cleanup = await setupActionListener();
      if (mounted) cleanupFn = cleanup;

      // Check for admin-sent broadcast notifications (after 3s to let auth settle)
      if (uid) {
        setTimeout(() => checkBroadcastNotifications(uid, userRole), 3000);
      }
    }

    init();

    return () => {
      mounted = false;
      if (cleanupFn) cleanupFn();
    };
  }, [uid, userRole]);

  return null;
}

