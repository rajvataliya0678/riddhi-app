'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch user Firestore document
  const fetchUserData = async (uid) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data());
        return docSnap.data();
      }
    } catch (error) {
      console.error("Error fetching user data from Firestore:", error);
    }
    return null;
  };

  useEffect(() => {
    // If Firebase isn't configured, we bypass active auth listeners to avoid runtime errors
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser.uid);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign Up function
  const signUp = async (email, password, name, phone, language = 'en') => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Store custom fields in Firestore user document
      const newUserData = {
        uid,
        name,
        email,
        phone,
        preferredLanguage: language || 'en',
        role: 'customer',
        registrationCompleted: false,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', uid), newUserData);
      setUserData(newUserData);
      setUser(userCredential.user);
      return { success: true };
    } catch (error) {
      setLoading(false);
      return { success: false, error: error.message };
    }
  };

  // Change Language function
  const changeLanguage = async (lang) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        preferredLanguage: lang
      });
      setUserData(prev => prev ? { ...prev, preferredLanguage: lang } : null);
    } catch (err) {
      console.error('Error updating language preference:', err);
    }
  };

  // Login function (Supports Mobile Number OR Email)
  const login = async (identifier, password) => {
    setLoading(true);
    try {
      let emailToUse = identifier.trim();

      // Check if identifier is NOT an email (doesn't contain '@')
      if (!emailToUse.includes('@')) {
        const cleanPhone = emailToUse.replace(/[^0-9]/g, '');

        // Query users by phone
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('phone', '==', emailToUse));
        let snap = await getDocs(q);

        if (snap.empty && cleanPhone) {
          const allUsersSnap = await getDocs(usersRef);
          const found = allUsersSnap.docs.find(d => {
            const p = (d.data().phone || '').replace(/[^0-9]/g, '');
            return p && (p === cleanPhone || p.endsWith(cleanPhone) || cleanPhone.endsWith(p));
          });
          if (found) {
            emailToUse = found.data().email;
          } else {
            setLoading(false);
            return { success: false, error: 'No account found with this mobile number. Please check or sign up.' };
          }
        } else if (!snap.empty) {
          emailToUse = snap.docs[0].data().email;
        } else {
          setLoading(false);
          return { success: false, error: 'No account found with this mobile number. Please check or sign up.' };
        }
      }

      if (!emailToUse) {
        setLoading(false);
        return { success: false, error: 'Please enter a valid mobile number or email.' };
      }

      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
      const uid = userCredential.user.uid;
      const data = await fetchUserData(uid);
      setUser(userCredential.user);
      return { success: true, userData: data };
    } catch (error) {
      setLoading(false);
      let errMsg = error.message;
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/invalid-email'
      ) {
        errMsg = 'Incorrect mobile number / email or password. Please try again.';
      }
      return { success: false, error: errMsg };
    }
  };

  // Logout function
  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Force reload user profile data (used after diagnosis form completion)
  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.uid);
    }
  };

  const language = userData?.preferredLanguage || 'en';

  return (
    <AuthContext.Provider value={{ user, userData, loading, language, changeLanguage, signUp, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
