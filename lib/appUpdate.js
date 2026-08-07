/**
 * appUpdate.js
 * ─────────────────────────────────────────────────────────────────────────────
 * In-App Update utility for Vriddhi Android app.
 *
 * How it works:
 *  1. Firestore 'app_config/version' document માં latest version info store છે
 *  2. App open થાય ત્યારે current version vs latest version compare કરે
 *  3. Update available હોય તો → UI component ને inform કરે
 *  4. User "Download" tap કરે → APK URL browser/download manager માં open કરે
 *
 * Firestore document structure (app_config/version):
 * {
 *   latestVersion: "1.2",           ← new version number (you update this)
 *   apkUrl: "https://...",          ← direct APK download link
 *   releaseNotes: "Bug fixes...",   ← what's new (shown in popup)
 *   forceUpdate: false,             ← true = cannot dismiss, must update
 *   minVersion: "1.0",              ← below this = force update automatically
 * }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Browser } from '@capacitor/browser';

// ── Current App Version ────────────────────────────────────────────────────────
// ⚠️  IMPORTANT: Every time you build a new APK, increment this number.
// Format: "major.minor" e.g. "1.0", "1.1", "2.0"
export const CURRENT_APP_VERSION = '1.1';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compares two version strings. Returns true if `latest` > `current`.
 * Supports "1.0", "1.2", "2.0" style version strings.
 */
function isNewerVersion(current, latest) {
  if (!current || !latest) return false;

  const parseParts = (v) => String(v).split('.').map(n => parseInt(n, 10) || 0);
  const cur = parseParts(current);
  const lat = parseParts(latest);

  for (let i = 0; i < Math.max(cur.length, lat.length); i++) {
    const c = cur[i] || 0;
    const l = lat[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false; // same version
}

// ── Main Function ─────────────────────────────────────────────────────────────

/**
 * Checks Firestore for a newer app version.
 *
 * @returns {Object|null}
 *   null  → no update needed
 *   { latestVersion, apkUrl, releaseNotes, forceUpdate } → update available
 */
export async function checkForUpdate() {
  try {
    // Only native Android APK shell needs APK update prompts; Web browser users are auto-updated.
    if (typeof window !== 'undefined' && window.Capacitor && !window.Capacitor.isNativePlatform()) {
      console.log('[AppUpdate] Web platform detected — skipping APK update prompt.');
      return null;
    }

    console.log('[AppUpdate] Checking for update... Current version:', CURRENT_APP_VERSION);
    const docRef = doc(db, 'app_config', 'version');
    const snap = await getDoc(docRef);
    let data = null;

    if (snap.exists()) {
      data = snap.data();
    } else {
      // Auto-initialize default app_config/version in Firestore if not created yet
      data = {
        latestVersion: '1.1',
        apkUrl: 'https://vriddhi-app-eight.vercel.app/vriddhi.apk',
        releaseNotes: 'નવા સુધારા અને સ્પીડ સાથે નવી વર્ઝન ઇન્સ્ટોલ કરો.',
        forceUpdate: true,
        minVersion: '1.1'
      };
      setDoc(docRef, data).catch(err => console.warn(err));
    }

    const { latestVersion, apkUrl, releaseNotes = '', forceUpdate = false, minVersion } = data;

    if (!latestVersion || !apkUrl) {
      console.log('[AppUpdate] Missing latestVersion or apkUrl field.');
      return null;
    }

    // Force update if current version is below minVersion or latestVersion
    const isBelowMin = minVersion && isNewerVersion(CURRENT_APP_VERSION, minVersion);
    const hasUpdate   = isNewerVersion(CURRENT_APP_VERSION, latestVersion);

    console.log('[AppUpdate] hasUpdate:', hasUpdate, '| isBelowMin:', isBelowMin);

    if (!hasUpdate && !isBelowMin) {
      console.log('[AppUpdate] Already up to date.');
      return null;
    }

    return {
      latestVersion,
      apkUrl,
      releaseNotes,
      forceUpdate: true, // Always force update when a newer version exists
      currentVersion: CURRENT_APP_VERSION,
    };
  } catch (err) {
    console.warn('[AppUpdate] Update check failed:', err);
    return null;
  }
}

/**
 * Opens the direct APK download URL.
 * On Android, this triggers the system download manager directly, prompting installation when complete.
 *
 * @param {string} apkUrl - Direct APK download URL
 */
export async function downloadAndInstall(apkUrl) {
  const directUrl = apkUrl || 'https://vriddhi-app-eight.vercel.app/vriddhi.apk';
  if (typeof window !== 'undefined') {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        await Browser.open({ url: directUrl });
      } catch (err) {
        console.warn('[AppUpdate] Browser.open failed, fallback to window.open:', err);
        window.open(directUrl, '_system');
      }
    } else {
      window.location.href = directUrl;
    }
  }
}
