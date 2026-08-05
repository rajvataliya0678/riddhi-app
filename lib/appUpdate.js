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
import { Capacitor } from '@capacitor/core';

// ── Current App Version ────────────────────────────────────────────────────────
// ⚠️  IMPORTANT: Every time you build a new APK, increment this number.
// Format: "major.minor" e.g. "1.0", "1.1", "2.0"
export const CURRENT_APP_VERSION = '1.0';

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
  // Only run inside the native Android/iOS shell
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const snap = await getDoc(doc(db, 'app_config', 'version'));
    if (!snap.exists()) return null;

    const data = snap.data();
    const { latestVersion, apkUrl, releaseNotes = '', forceUpdate = false, minVersion } = data;

    if (!latestVersion || !apkUrl) return null;

    // Force update if current version is below minVersion
    const isBelowMin = minVersion && isNewerVersion(CURRENT_APP_VERSION, minVersion);
    const hasUpdate   = isNewerVersion(CURRENT_APP_VERSION, latestVersion);

    if (!hasUpdate && !isBelowMin) return null; // already up to date

    return {
      latestVersion,
      apkUrl,
      releaseNotes,
      forceUpdate: forceUpdate || isBelowMin, // force if admin set it OR below minVersion
      currentVersion: CURRENT_APP_VERSION,
    };
  } catch (err) {
    // Silently fail — never block the app due to update check error
    console.warn('[AppUpdate] Update check failed:', err);
    return null;
  }
}

/**
 * Opens the APK download URL.
 * On Android, this triggers the download manager which then prompts to install.
 *
 * @param {string} apkUrl - Direct APK download URL
 */
export function downloadAndInstall(apkUrl) {
  if (!apkUrl) return;

  // Android handles APK download + install prompt automatically
  // when you open a direct .apk link
  if (typeof window !== 'undefined') {
    window.open(apkUrl, '_blank');
  }
}
