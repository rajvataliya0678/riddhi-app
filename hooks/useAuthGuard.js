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
      // Redirect to /login if they try to access protected screens
      if (pathname !== '/login' && pathname !== '/signup') {
        router.push('/login');
      }
    } else {
      // User IS logged in
      const isRegistrationCompleted = userData?.registrationCompleted;

      if (isRegistrationCompleted === false) {
        // User has not filled the Diagnosis form yet
        if (pathname !== '/diagnosis') {
          router.push('/diagnosis');
        }
      } else if (isRegistrationCompleted === true) {
        // User has completed registration
        // Redirect to dashboard if they try to access auth pages or the diagnosis questionnaire
        if (pathname === '/login' || pathname === '/signup' || pathname === '/diagnosis') {
          router.push('/dashboard');
        }
      }
    }
  }, [user, userData, loading, pathname, router]);

  return { user, userData, loading };
}
