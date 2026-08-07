/**
 * appUpdate.js — Disabled update check to allow all users seamless app access.
 */

export const CURRENT_APP_VERSION = '1.0';

export async function checkForUpdate() {
  return null;
}

export function downloadAndInstall(apkUrl) {
  return;
}
