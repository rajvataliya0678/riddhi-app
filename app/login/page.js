'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function LoginPage() {
  // Protect route: redirects to dashboard if already logged in and completed diagnosis
  const { loading: authLoading } = useAuthGuard();
  
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setSubmitting(true);
    const result = await login(email, password);
    
    if (!result.success) {
      setError(result.error || 'Invalid credentials. Please check and try again.');
      setSubmitting(false);
    }
    // Success will trigger useAuthGuard redirect automatically
  };

  if (authLoading) {
    return (
      <div className="auth-wrapper">
        <div className="decor-gradient"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="decor-gradient"></div>
      
      <div className="auth-card">
        <div className="brand-header">
          <span className="brand-logo" id="app-logo">Vriddhi</span>
          <h2>Welcome Back</h2>
          <p className="brand-subtitle">Log in to track your fitness goals</p>
        </div>

        {error && (
          <div className="alert alert-danger" id="error-message">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              type="email"
              id="login-email"
              className="form-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              className="form-input"
              placeholder="••••••••"
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
            {submitting ? 'Logging In...' : 'Log In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.9rem' }}>
          Don't have an account?{' '}
          <Link href="/signup" id="link-to-signup">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
