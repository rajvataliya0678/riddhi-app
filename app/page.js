'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function IndexPage() {
  const { user, loading } = useAuthGuard();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [loading, user, router]);

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
