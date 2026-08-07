'use client';

import React, { useState, useEffect } from 'react';
import { checkForUpdate, downloadAndInstall } from '@/lib/appUpdate';
import { useAuth } from '@/context/AuthContext';

/**
 * UpdatePrompt
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows a bottom-sheet style update prompt when a new APK version is available.
 *
 * - forceUpdate = true  → full-screen modal, cannot dismiss
 * - forceUpdate = false → dismissible bottom banner
 *
 * Place this inside the dashboard layout so it only checks after login.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function UpdatePrompt() {
  const { language } = useAuth();
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function run() {
      const info = await checkForUpdate();
      if (isMounted && info) setUpdateInfo(info);
    }

    run();
  }, []);

  // Nothing to show if up-to-date
  if (!updateInfo) return null;

  const { latestVersion, releaseNotes, apkUrl, forceUpdate, currentVersion } = updateInfo;

  const handleDownload = async () => {
    setDownloading(true);
    await downloadAndInstall(apkUrl);
    setTimeout(() => setDownloading(false), 8000);
  };

  const isGu = language !== 'en'; // Default to Gujarati for senior citizens & user preference

  // ── Force Update: Full-screen blocking modal ──────────────────────────────
  if (forceUpdate) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999999,
        background: '#090d16',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto',
      }}>
        <div style={{
          background: 'linear-gradient(145deg, #1e1b4b, #312e81)',
          borderRadius: '24px',
          padding: '36px 28px',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 25px 70px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.35)',
        }}>
          {/* Brand Logo / Icon */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '24px', margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.4rem',
            boxShadow: '0 10px 30px rgba(124,58,237,0.5)',
          }}>
            📲
          </div>

          <div style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
            background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', fontSize: '0.75rem', fontWeight: '800', marginBottom: '14px'
          }}>
            ⚠️ {isGu ? 'જૂનું વર્ઝન બંધ થઈ ગયું છે' : 'Update Required'}
          </div>

          <h2 style={{
            color: '#fff', fontSize: '1.4rem', fontWeight: '900',
            margin: '0 0 10px', letterSpacing: '-0.02em', lineHeight: '1.3'
          }}>
            {isGu ? 'એપ સ્ટાર્ટ કરવા માટે નવી અપડેટ ડાઉનલોડ કરો' : 'Download Update to Start App'}
          </h2>

          <p style={{ color: '#c7d2fe', fontSize: '0.85rem', margin: '0 0 16px', lineHeight: '1.5' }}>
            {isGu
              ? `તમારી પાસે જૂનું વર્ઝન (${currentVersion || '1.0'}) છે. નવી વર્ઝન બિલ્ડ (v${latestVersion}) ઇન્સ્ટોલ કર્યા પછી જ વૃદ્ધિ એપ ચાલુ થશે.`
              : `You are using an older version (${currentVersion || '1.0'}). Version v${latestVersion} is required to use Vriddhi.`}
          </p>

          <div style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
            padding: '14px 16px', margin: '20px 0',
            border: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'left',
          }}>
            <p style={{ color: '#e0e7ff', fontSize: '0.8rem', fontWeight: '800', margin: '0 0 6px' }}>
              🆕 {isGu ? 'નવા સુધારા (What\'s New):' : 'What\'s New:'}
            </p>
            <p style={{ color: '#a5b4fc', fontSize: '0.78rem', lineHeight: '1.6', margin: 0 }}>
              {releaseNotes || (isGu ? 'નવા ફીચર્સ અને સ્પીડ સુધારા સાથે નવી એપ તૈયાર છે.' : 'Performance improvements and bug fixes.')}
            </p>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              width: '100%', padding: '16px', borderRadius: '14px',
              background: downloading
                ? 'rgba(124,58,237,0.5)'
                : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff', border: 'none', cursor: downloading ? 'default' : 'pointer',
              fontSize: '1.05rem', fontWeight: '900', letterSpacing: '0.01em',
              boxShadow: downloading ? 'none' : '0 6px 20px rgba(16,185,129,0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {downloading ? (isGu ? '⏳ ડાઉનલોડ ઓપન થાય છે...' : '⏳ Opening Download...') : (isGu ? '⬇️ નવી એપ ડાઉનલોડ અને ઇન્સ્ટોલ કરો' : '⬇️ Download & Install Update')}
          </button>

          <p style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '12px', marginBottom: 0 }}>
            {isGu ? 'વૃદ્ધિ એપનો ઉપયોગ ચાલુ રાખવા માટે નવી એપ ડાઉનલોડ કરવી જરૂરી છે.' : 'You must update to continue using Vriddhi.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Optional Update: Dismissible bottom banner ────────────────────────────
  return (
    <div style={{
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999,
      width: 'calc(100% - 32px)', maxWidth: '480px',
      background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
      borderRadius: '16px',
      padding: '16px 18px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(139,92,246,0.25)',
      display: 'flex', flexDirection: 'column', gap: '12px',
      animation: 'slideUpIn 0.35s ease',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>🔄</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: '800', fontSize: '0.9rem', margin: '0 0 3px' }}>
            Update Available — v{latestVersion}
          </p>
          <p style={{ color: '#a5b4fc', fontSize: '0.76rem', margin: 0, lineHeight: '1.5' }}>
            {releaseNotes || 'A new version of Vriddhi is ready to install.'}
          </p>
        </div>
        {/* Dismiss X */}
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', width: '28px', height: '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.5)', cursor: 'pointer', flexShrink: 0,
            fontSize: '0.85rem', fontWeight: '700',
          }}
          title="Remind me later"
        >
          ✕
        </button>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setDismissed(true)}
          style={{
            flex: 1, padding: '10px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#a5b4fc', cursor: 'pointer',
            fontSize: '0.82rem', fontWeight: '700',
          }}
        >
          Later
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            flex: 2, padding: '10px', borderRadius: '10px',
            background: downloading
              ? 'rgba(124,58,237,0.5)'
              : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            border: 'none', color: '#fff', cursor: downloading ? 'default' : 'pointer',
            fontSize: '0.85rem', fontWeight: '800',
            boxShadow: downloading ? 'none' : '0 4px 12px rgba(124,58,237,0.35)',
            transition: 'all 0.2s ease',
          }}
        >
          {downloading ? '⏳ Opening...' : '⬇️ Download Update'}
        </button>
      </div>

      <style>{`
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
