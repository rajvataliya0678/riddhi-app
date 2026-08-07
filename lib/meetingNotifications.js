/**
 * meetingNotifications.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained utility for Capacitor Local Notifications.
 * Handles: permission request, notification channel creation,
 * scheduling meeting reminders, action button handling, and test notifications.
 *
 * Used by: components/TodaysMeetings.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Notification channel ID — must match what's used in schedule calls */
const CHANNEL_ID = 'meeting_reminders';

/** Action type ID for the two-button notification */
const ACTION_TYPE_ID = 'MEETING_ACTIONS';

/** Action IDs */
const ACTION_JOIN   = 'JOIN_MEETING';
const ACTION_CLOSE  = 'CLOSE';

/**
 * Base notification ID offset. Each meeting gets a unique ID derived from
 * a hash of its Firestore document ID so IDs stay stable across reschedules.
 */
const ID_OFFSET = 10000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true only when running inside the Capacitor native shell (Android/iOS) */
function isNative() {
  return Capacitor.isNativePlatform();
}

/**
 * Stable numeric ID from a Firestore doc ID string (simple djb2 hash).
 * Keeps IDs consistent so re-scheduling the same meeting replaces the old one.
 */
function idFromString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash % 90000) + ID_OFFSET;
}

/**
 * Build the display name used inside the notification body.
 * Matches the same logic as buildCustomizedZoomUrl in TodaysMeetings.js.
 */
function getDisplayName(user, userData) {
  const fullName = userData?.name || user?.displayName || 'Member';
  return fullName.trim().split(' ')[0] || 'Member';
}

// ── Notification Channel (Android 8+) ─────────────────────────────────────────

/**
 * Creates the high-importance notification channel used for meeting reminders.
 * Must be called once before scheduling any notifications.
 * Safe to call multiple times — Android silently ignores duplicate channel creation.
 */
export async function createNotificationChannel() {
  if (!isNative()) return;

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Meeting Reminders',
      description: 'Alerts when your Zoom session is about to start',
      importance: 5,          // IMPORTANCE_HIGH → heads-up / peek on lock screen
      sound: 'session_reminder', // References res/raw/session_reminder.mp3
      vibration: true,
      lights: true,
      lightColor: '#6366F1',  // Indigo accent matching app theme
      visibility: 1,          // VISIBILITY_PUBLIC — visible on lock screen
    });
  } catch (err) {
    console.warn('[MeetingNotif] Channel creation failed:', err);
  }
}

// ── Permission Request ─────────────────────────────────────────────────────────

/**
 * Requests notification permission from the OS.
 * On Android 13+, this shows the system permission dialog on first call.
 * Returns true if permission was granted, false otherwise.
 */
export async function requestNotificationPermission() {
  if (!isNative()) return false;

  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'granted') return true;

    const { display: result } = await LocalNotifications.requestPermissions();
    return result === 'granted';
  } catch (err) {
    console.warn('[MeetingNotif] Permission request failed:', err);
    return false;
  }
}

// ── Action Type Registration ───────────────────────────────────────────────────

/**
 * Registers the notification action type with two buttons:
 *   - "Join Meeting"  (opens the Zoom URL via actionPerformed listener)
 *   - "Close"         (dismisses the notification)
 *
 * Must be called once at app startup (before scheduling).
 */
export async function registerNotificationActionTypes() {
  if (!isNative()) return;

  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE_ID,
          actions: [
            {
              id: ACTION_JOIN,
              title: 'Join Meeting',
              foreground: true, // brings the app to foreground when tapped
            },
            {
              id: ACTION_CLOSE,
              title: 'Close',
              destructive: false,
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.warn('[MeetingNotif] Action type registration failed:', err);
  }
}

// ── Action Listener ───────────────────────────────────────────────────────────

/** Stored handle so we can remove the listener on component unmount */
let _actionListenerHandle = null;

/**
 * Sets up the actionPerformed listener that handles button taps on notifications.
 * - "Join Meeting" → opens the Zoom URL stored in notification.extra.meetingUrl
 * - "Close"        → no-op (notification is already dismissed by Android)
 *
 * Call once on component mount. Call the returned cleanup function on unmount.
 * @returns {Function} cleanup — removes the event listener
 */
export async function setupActionListener() {
  if (!isNative()) return () => {};

  // Remove any previous listener to avoid duplicates
  if (_actionListenerHandle) {
    _actionListenerHandle.remove();
    _actionListenerHandle = null;
  }

  try {
    _actionListenerHandle = await LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (result) => {
        const { actionId, notification } = result;
        const extra = notification?.extra || {};

        if (actionId === ACTION_JOIN) {
          const url = extra.meetingUrl || '';
          if (url) {
            if (extra.uid) {
              const todayStr = new Date().toISOString().split('T')[0];
              addDoc(collection(db, 'meeting_attendance'), {
                uid: extra.uid,
                customerName: extra.customerName || 'Member',
                coachId: extra.coachId || '',
                userRole: extra.userRole || 'customer',
                date: todayStr,
                sessionType: extra.sessionType || 'morning',
                meetingId: extra.meetingId || '',
                meetingTitle: extra.meetingTitle || 'Live Session',
                attendedAt: serverTimestamp(),
              }).catch(err => console.error('[NotifAttendance] Attendance error:', err));
            }
            if (typeof window !== 'undefined') {
              window.open(url, '_blank', 'noopener,noreferrer');
            }
          }
        }
        // ACTION_CLOSE → nothing to do; Android dismissed it already
      }
    );
  } catch (err) {
    console.warn('[MeetingNotif] Action listener setup failed:', err);
  }

  return () => {
    if (_actionListenerHandle) {
      _actionListenerHandle.remove();
      _actionListenerHandle = null;
    }
  };
}

// ── Schedule Meeting Reminders ─────────────────────────────────────────────────

/**
 * Cancels all previously scheduled meeting reminder notifications,
 * then schedules one notification per meeting that hasn't started yet today.
 *
 * @param {Array}  meetings  - Filtered array from fetchMeetings() in TodaysMeetings
 * @param {Object} user      - Firebase Auth user object
 * @param {Object} userData  - Firestore user profile (name, role, etc.)
 */
export async function scheduleMeetingReminders(meetings, user, userData) {
  if (!isNative()) return;
  if (!meetings || meetings.length === 0) return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    console.warn('[MeetingNotif] Notification permission denied — skipping schedule.');
    return;
  }

  // Cancel any previously scheduled reminders to avoid duplicates
  await cancelAllMeetingNotifications(meetings);

  const now     = new Date();
  const toSchedule = [];

  for (const meeting of meetings) {
    if (!meeting.time) continue;

    const [hours, minutes] = meeting.time.split(':').map(Number);

    // Build exact trigger Date for today at the meeting's time
    const triggerDate = new Date();
    triggerDate.setHours(hours, minutes, 0, 0);

    // Skip if the meeting time has already passed
    if (triggerDate <= now) continue;

    const notifId   = idFromString(meeting.id);
    const firstName = getDisplayName(user, userData);
    const targetUid = user?.uid || '';
    const sessionType = meeting.sessionType || (hours < 14 ? 'morning' : 'evening');

    toSchedule.push({
      id: notifId,
      title: 'Your session is starting 🎥',
      body: `${meeting.title} is starting now. Tap Join to enter the session!`,
      sound: 'session_reminder',  // → res/raw/session_reminder.mp3
      channelId: CHANNEL_ID,
      actionTypeId: ACTION_TYPE_ID,
      // extra is passed through to the actionPerformed listener
      extra: {
        meetingId:  meeting.id,
        meetingUrl: meeting.meetingUrl || '',
        meetingTitle: meeting.title || 'Live Session',
        firstName,
        uid: targetUid,
        customerName: userData?.name || user?.displayName || 'Member',
        coachId: userData?.coachId || '',
        userRole: userData?.role || 'customer',
        sessionType,
      },
      schedule: {
        at: triggerDate,
        allowWhileIdle: true, // fire even in Doze/battery-saver mode
      },
      // Android heads-up notification options
      smallIcon: 'ic_stat_icon_config_sample', // Capacitor default; replace with your own if desired
      iconColor: '#6366F1',
    });
  }

  if (toSchedule.length === 0) {
    console.log('[MeetingNotif] No upcoming meetings to schedule notifications for.');
    return;
  }

  try {
    await LocalNotifications.schedule({ notifications: toSchedule });
    console.log(`[MeetingNotif] Scheduled ${toSchedule.length} meeting reminder(s).`);
  } catch (err) {
    console.error('[MeetingNotif] Scheduling failed:', err);
  }
}

// ── Cancel Notifications ───────────────────────────────────────────────────────

/**
 * Cancels the scheduled notifications for the given meetings list.
 * If no meetings provided, tries to cancel all pending notifications.
 *
 * @param {Array} meetings - Same meetings array as scheduleMeetingReminders
 */
export async function cancelAllMeetingNotifications(meetings = []) {
  if (!isNative()) return;

  try {
    if (meetings.length > 0) {
      // Cancel by the specific IDs we would have scheduled
      const ids = meetings
        .filter(m => m.id)
        .map(m => ({ id: idFromString(m.id) }));

      if (ids.length > 0) {
        await LocalNotifications.cancel({ notifications: ids });
      }
    } else {
      // Fallback: cancel all pending
      const { notifications: pending } = await LocalNotifications.getPending();
      if (pending.length > 0) {
        await LocalNotifications.cancel({ notifications: pending });
      }
    }
  } catch (err) {
    console.warn('[MeetingNotif] Cancel failed:', err);
  }
}

// ── Test Notification ──────────────────────────────────────────────────────────

/**
 * Fires a test notification 5 seconds from now.
 * Useful for verifying sound + action buttons without waiting for a real meeting.
 *
 * @param {string} zoomUrl - Optional Zoom URL to test the Join Meeting action
 */
export async function fireTestNotification(zoomUrl = 'https://zoom.us/test') {
  if (!isNative()) {
    alert('Test notifications only work on an Android/iOS device (not in browser).');
    return;
  }

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    alert('Notification permission is required. Please grant it in Settings.');
    return;
  }

  const triggerAt = new Date(Date.now() + 5000); // 5 seconds from now

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 99999, // Fixed test ID
          title: 'Your session is starting 🎥',
          body: 'TEST: Daily Morning Fitness Club Zoom is starting now. Tap Join to enter!',
          sound: 'session_reminder',
          channelId: CHANNEL_ID,
          actionTypeId: ACTION_TYPE_ID,
          extra: {
            meetingId:  'test',
            meetingUrl: zoomUrl,
          },
          schedule: {
            at: triggerAt,
            allowWhileIdle: true,
          },
          iconColor: '#6366F1',
        },
      ],
    });
    console.log('[MeetingNotif] Test notification scheduled for', triggerAt.toLocaleTimeString());
  } catch (err) {
    console.error('[MeetingNotif] Test notification failed:', err);
  }
}
