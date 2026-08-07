'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import LanguageToggle from '@/components/LanguageToggle';

export default function LoginPage() {
  const { loading: authLoading } = useAuthGuard();
  const { login, t } = useAuth();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    </div>
  );
}

