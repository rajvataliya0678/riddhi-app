'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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
  const signUp = async (email, password, name, phone) => {
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

  // Login function
  const login = async (email, password) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const data = await fetchUserData(uid);
      setUser(userCredential.user);
      return { success: true, userData: data };
    } catch (error) {
      setLoading(false);
      return { success: false, error: error.message };
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

  return (
    <AuthContext.Provider value={{ user, userData, loading, signUp, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
