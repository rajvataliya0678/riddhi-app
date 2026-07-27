'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function SignupPage() {
  // Protect route: if already logged in and completed diagnosis, redirects to dashboard
  const { loading: authLoading } = useAuthGuard();
  
  const { signUp } = useAuth();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validations
    if (!name.trim() || !phone.trim() || !email.trim() || !password) {
      setError('Please fill in all the fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    const result = await signUp(email, password, name, phone);
    
    if (!result.success) {
      setError(result.error || 'Failed to create an account. Please try again.');
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
          <h2>Create Account</h2>
          <p className="brand-subtitle">Start your personalized fitness and coaching journey</p>
        </div>

        {error && (
          <div className="alert alert-danger" id="error-message">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} id="signup-form">
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full Name</label>
            <input
              type="text"
              id="signup-name"
              className="form-input"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-phone">Phone Number</label>
            <input
              type="tel"
              id="signup-phone"
              className="form-input"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email Address</label>
            <input
              type="email"
              id="signup-email"
              className="form-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <input
              type="password"
              id="signup-password"
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
            id="signup-submit"
            disabled={submitting}
          >
            {submitting ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.9rem' }}>
          Already have an account?{' '}
          <Link href="/login" id="link-to-login">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
