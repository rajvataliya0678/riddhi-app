'use client';

import React, { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function GlobalErrorPage({ error, reset }) {
  useEffect(() => {
    console.error('Global Application Error:', error);
  }, [error]);

  const handleLogoutAndLogin = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (err) {
      console.warn('Signout error:', err);
    }
    if (typeof window !== 'undefined') {
      localStorage.clear();
      window.location.href = '/login';
    } else {
      reset();
    }
  };

  const handleReset = () => {
    try {
      reset();
    } catch (_) {
      window.location.reload();
    }
  };

  return (
    <div className="auth-wrapper" style={{ padding: '24px' }}>
      <div className="decor-gradient"></div>
      <div className="auth-card" style={{ textAlign: 'center', maxWidth: '480px', width: '100%' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔄</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-main)' }}>
          એપ ફરી શરૂ કરો (Reload App)
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
          એપ્લિકેશન લોડ કરવામાં નાની સમસ્યા આવી છે. કૃપા કરીને નીચેનું બટન દબાવીને ફરી try કરો.
        </p>

        {error?.message && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.75rem',
            color: '#ef4444',
            textAlign: 'left',
            marginBottom: '16px',
            wordBreak: 'break-word',
            fontFamily: 'monospace'
          }}>
            <strong>Error Detail:</strong> {error.message}
          </div>
        )}

        {/* Primary: Try Again without logout */}
        <button
          onClick={handleReset}
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: '800', marginBottom: '10px', background: '#10b981' }}
        >
          🔄 ફરી Try કરો (Try Again)
        </button>

        {/* Secondary: Full logout */}
        <button
          onClick={handleLogoutAndLogin}
          className="btn btn-outline"
          style={{ width: '100%', padding: '10px', fontSize: '0.85rem', fontWeight: '700' }}
        >
          🚪 લોગ આઉટ અને ફરી લોગિન કરો (Logout & Login)
        </button>
      </div>
    </div>
  );
}
