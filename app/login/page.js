'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import LanguageToggle from '@/components/LanguageToggle';

export default function LoginPage() {
  const { loading: authLoading } = useAuthGuard();
  const { login, resetPassword, t } = useAuth();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot password state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail]         = useState('');
  const [resetLoading, setResetLoading]     = useState(false);
  const [resetMsg, setResetMsg]             = useState('');
  const [resetErr, setResetErr]             = useState('');

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMsg('');
    setResetErr('');
    if (!resetEmail.trim()) return;

    setResetLoading(true);
    const res = await resetPassword(resetEmail.trim());
    setResetLoading(false);

    if (res.success) {
      setResetMsg('✅ પાસવર્ડ રીસેટ લિંક તમારા ઇમેઇલ પર મોકલાઈ ગઈ છે. તમારું Email ઇનબોક્સ/સ્પેમ ચેક કરો.');
    } else {
      setResetErr('❌ ' + (res.error || 'Failed to send reset email. Verify your email.'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError(t.loginErrRequired);
      return;
    }

    setSubmitting(true);
    const result = await login(identifier, password);
    
    if (!result.success) {
      setError(result.error || 'Invalid credentials. Please check and try again.');
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="auth-wrapper">
        <div className="decor-gradient"></div>
        <p>{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="decor-gradient"></div>
      
      <div className="auth-card">
        {/* Language selector at top right */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <LanguageToggle />
        </div>

        <div className="brand-header">
          <span className="brand-logo" id="app-logo">{t.brandName}</span>
          <h2>{t.loginTitle}</h2>
          <p className="brand-subtitle">{t.loginSub}</p>
        </div>

        {error && (
          <div className="alert alert-danger" id="error-message">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">{t.mobileOrEmailLabel}</label>
            <input
              type="text"
              id="login-email"
              className="form-input"
              placeholder={t.mobileOrEmailPlaceholder}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">{t.passwordLabel}</label>
            <input
              type="password"
              id="login-password"
              className="form-input"
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              style={{
                background: 'none', border: 'none', color: '#2563eb', fontSize: '0.78rem',
                fontWeight: '700', cursor: 'pointer', textDecoration: 'underline'
              }}
              id="forgot-password-btn"
            >
              🔑 Forgot Password? / પાસવર્ડ ભૂલી ગયા છો?
            </button>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            id="login-submit"
            disabled={submitting}
          >
            {submitting ? t.loggingInBtn : t.loginBtn}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '16px' }}>
          {t.noAccountText}{' '}
          <Link href="/signup" id="link-to-signup" style={{ fontWeight: '800' }}>
            {t.signUpLink}
          </Link>
        </p>
      </div>

      {/* Forgot Password Reset Modal */}
      {showResetModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={e => e.target === e.currentTarget && setShowResetModal(false)}>
          <div className="modal-card" style={{ maxWidth: '420px', width: '92vw' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
                🔑 Reset Password / પાસવર્ડ રીસેટ
              </h3>
              <button onClick={() => setShowResetModal(false)} className="modal-close">&times;</button>
            </div>
            <form onSubmit={handleResetPassword} style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                તમારો ઇમેઇલ નાખો. અમે તમને પાસવર્ડ રીસેટ કરવાની લિંક મોકલીશું:
              </p>
              {resetMsg && <div className="alert alert-success" style={{ fontSize: '0.78rem' }}>{resetMsg}</div>}
              {resetErr && <div className="alert alert-danger" style={{ fontSize: '0.78rem' }}>{resetErr}</div>}
              <input
                type="email"
                className="form-input"
                placeholder="name@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" onClick={() => setShowResetModal(false)} className="btn btn-secondary" style={{ width: 'auto' }}>Close</button>
                <button type="submit" className="btn btn-primary" disabled={resetLoading} style={{ width: 'auto' }}>
                  {resetLoading ? '⏳ Sending...' : '📧 Send Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

