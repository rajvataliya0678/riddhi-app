'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function useAuthGuard() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // User is NOT logged in
      if (pathname !== '/login' && pathname !== '/signup') {
        router.push('/login');
      }
    } else {
      // User IS logged in
      const role = userData?.role || 'customer';
      const isRegistrationCompleted = userData?.registrationCompleted;

      // Only regular customers are required to fill diagnosis questionnaire
      if (role === 'customer' && isRegistrationCompleted === false) {
        if (pathname !== '/diagnosis') {
          router.push('/diagnosis');
        }
      } else {
        // Coach, Admin, or completed customer
        if (pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname === '/diagnosis') {
          router.push('/dashboard');
        }
      }
    }
  }, [user, userData, loading, pathname, router]);

  return { user, userData, loading };
}
