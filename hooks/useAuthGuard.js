'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function useAuthGuard() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. Wait for Firebase Auth state to initialize
    if (loading) return;

    // 2. Unauthenticated user → redirect to login if not already on auth pages
    if (!user) {
      if (pathname !== '/login' && pathname !== '/signup') {
        router.replace('/login');
      }
      return;
    }

    // 3. User is logged in — wait until Firestore user document is fetched
    if (userData === null) return;

    const role = userData.role || 'customer';
    const isRegistrationCompleted = userData.registrationCompleted;

    // 4. Incomplete customer profile → force /diagnosis questionnaire
    if (role === 'customer' && isRegistrationCompleted === false) {
      if (pathname !== '/diagnosis') {
        router.replace('/diagnosis');
      }
      return;
    }

    // 5. Active user (Coach, Admin, or completed Customer) → redirect away from auth/entry pages to /dashboard
    if (
      pathname === '/' ||
      pathname === '/login' ||
      pathname === '/signup' ||
      (pathname === '/diagnosis' && isRegistrationCompleted === true)
    ) {
      router.replace('/dashboard');
    }
  }, [user, userData, loading, pathname, router]);

  return { user, userData, loading };
}

