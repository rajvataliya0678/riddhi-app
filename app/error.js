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

  return (
    <div className="auth-wrapper" style={{ padding: '24px' }}>
      <div className="decor-gradient"></div>
      <div className="auth-card" style={{ textAlign: 'center', maxWidth: '480px', width: '100%' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔄</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-main)' }}>
          એપ ફરી શરૂ કરો (Reload App)
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
          એપ્લિકેશન લોડ કરવામાં નાની સમસ્યા આવી છે. કૃપા કરીને નીચેનું બટન દબાવીને લોગઆઉટ કરીને ફરી લોગિન કરો.
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

        <button
          onClick={handleLogoutAndLogin}
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: '800', background: 'var(--accent-danger, #ef4444)' }}
        >
          🚪 લોગ આઉટ અને ફરી લોગિન કરો (Logout & Login)
        </button>
      </div>
    </div>
  );
}
