/**
 * appUpdate.js — Disabled update check to allow all users seamless app access.
 */

export const CURRENT_APP_VERSION = '1.1';

export async function checkForUpdate() {
  return null;
}

export function downloadAndInstall(apkUrl) {
  return;
}
