'use client';

import React from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function IndexPage() {
  // useAuthGuard automatically redirects the user depending on their login/profile state
  const { loading } = useAuthGuard();

  return (
    <div className="auth-wrapper">
      <div className="decor-gradient"></div>
      <div style={{ textAlign: 'center' }}>
        <span className="brand-logo" style={{ marginBottom: '16px' }}>Vriddhi</span>
        <p style={{ fontSize: '1.1rem' }}>Loading application...</p>
      </div>
    </div>
  );
}
