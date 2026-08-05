'use client';

import React, { useState, useEffect } from 'react';
import { checkForUpdate, downloadAndInstall } from '@/lib/appUpdate';

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
  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissed, setDismissed]   = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // Check for update once when component mounts (after login)
    let isMounted = true;

    async function run() {
      const info = await checkForUpdate();
      if (isMounted && info) setUpdateInfo(info);
    }

    // Slight delay so the dashboard renders first
    const t = setTimeout(run, 2000);
    return () => { isMounted = false; clearTimeout(t); };
  }, []);

  // Nothing to show
  if (!updateInfo || dismissed) return null;

  const { latestVersion, releaseNotes, apkUrl, forceUpdate } = updateInfo;

  const handleDownload = () => {
    setDownloading(true);
    downloadAndInstall(apkUrl);
    // After 3 seconds reset (in case they come back)
    setTimeout(() => setDownloading(false), 3000);
  };

  // ── Force Update: Full-screen blocking modal ──────────────────────────────
  if (forceUpdate) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{
          background: 'linear-gradient(145deg, #1e1b4b, #312e81)',
          borderRadius: '20px',
          padding: '32px 28px',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          border: '1px solid rgba(139,92,246,0.3)',
        }}>
          {/* Icon */}
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px', margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
          }}>
            🔄
          </div>

          <h2 style={{
            color: '#fff', fontSize: '1.3rem', fontWeight: '900',
            margin: '0 0 8px', letterSpacing: '-0.02em',
          }}>
            Update Required
          </h2>

          <p style={{ color: '#a5b4fc', fontSize: '0.82rem', margin: '0 0 4px' }}>
            Version {latestVersion} is required to continue.
          </p>

          <div style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: '12px',
            padding: '12px 16px', margin: '20px 0',
            border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'left',
          }}>
            <p style={{ color: '#e0e7ff', fontSize: '0.78rem', fontWeight: '700', margin: '0 0 6px' }}>
              🆕 What&apos;s New:
            </p>
            <p style={{ color: '#c7d2fe', fontSize: '0.77rem', lineHeight: '1.6', margin: 0 }}>
              {releaseNotes || 'Performance improvements and bug fixes.'}
            </p>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              background: downloading
                ? 'rgba(124,58,237,0.5)'
                : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: '#fff', border: 'none', cursor: downloading ? 'default' : 'pointer',
              fontSize: '0.95rem', fontWeight: '800', letterSpacing: '0.01em',
              boxShadow: downloading ? 'none' : '0 4px 16px rgba(124,58,237,0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {downloading ? '⏳ Opening Download...' : '⬇️ Download & Install'}
          </button>

          <p style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '12px', marginBottom: 0 }}>
            You must update to continue using Vriddhi.
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
