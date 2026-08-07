'use client';

import React from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAuth } from '@/context/AuthContext';

export default function IndexPage() {
  useAuthGuard();
  const { t } = useAuth();

  return (
    <div className="auth-wrapper">
      <div className="decor-gradient"></div>
      <div style={{ textAlign: 'center' }}>
        <span className="brand-logo" style={{ marginBottom: '16px' }}>{t.brandName}</span>
        <p style={{ fontSize: '1.1rem' }}>{t.loading}</p>
      </div>
    </div>
  );
}

