'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import LanguageToggle from '@/components/LanguageToggle';

export default function SignupPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuthGuard();
  const { signUp, language, changeLanguage, t } = useAuth();
  
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !phone.trim() || !email.trim() || !password) {
      setError(t.signupErrAllFields);
      return;
    }

    if (password.length < 6) {
      setError(t.signupErrPasswordLength);
      return;
    }

    setSubmitting(true);
    const result = await signUp(email, password, name, phone, language);
    
    if (!result.success) {
      setError(result.error || 'Failed to create an account. Please try again.');
      setSubmitting(false);
    } else {
      router.replace('/diagnosis');
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
          <h2>{t.signupTitle}</h2>
          <p className="brand-subtitle">{t.signupSub}</p>
        </div>

        {error && (
          <div className="alert alert-danger" id="error-message">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} id="signup-form">
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">{t.fullNameLabel}</label>
            <input
              type="text"
              id="signup-name"
              className="form-input"
              placeholder={t.fullNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-phone">{t.phoneLabel}</label>
            <input
              type="tel"
              id="signup-phone"
              className="form-input"
              placeholder={t.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">{t.emailLabel}</label>
            <input
              type="email"
              id="signup-email"
              className="form-input"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">{t.passwordLabel}</label>
            <input
              type="password"
              id="signup-password"
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
            id="signup-submit"
            disabled={submitting}
          >
            {submitting ? t.creatingAccountBtn : t.signupBtn}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '16px' }}>
          {t.alreadyAccountText}{' '}
          <Link href="/login" id="link-to-login" style={{ fontWeight: '800' }}>
            {t.logInLink}
          </Link>
        </p>
      </div>
    </div>
  );
}

