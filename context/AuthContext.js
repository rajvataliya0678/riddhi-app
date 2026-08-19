'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

import { translations } from '@/lib/translations';
import { CURRENT_APP_VERSION } from '@/lib/appUpdate';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localLang, setLocalLang] = useState('en'); // Default to English for first-time users

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vriddhi_lang');
      if (saved) setLocalLang(saved);
    }
  }, []);

  // Helper to fetch user Firestore document & log app version telemetry
  const fetchUserData = async (uid) => {
    try {
      const currentUser = auth.currentUser;
      const userEmail = currentUser?.email?.toLowerCase().trim() || '';

      // 1. Direct getDoc by UID
      const docRef = doc(db, 'users', uid);
      let docSnap = await getDoc(docRef);
      let data = docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
      let matchedDocId = docSnap.exists() ? docSnap.id : null;

      // 2. Search all users for matching UID, Email (case-insensitive) or Phone
      if (!data) {
        try {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          const foundDoc = allUsersSnap.docs.find(d => {
            const dData = d.data();
            if (d.id === uid || dData.uid === uid) return true;
            if (userEmail && dData.email && dData.email.toLowerCase().trim() === userEmail) return true;
            return false;
          });

          if (foundDoc) {
            data = { id: foundDoc.id, ...foundDoc.data() };
            matchedDocId = foundDoc.id;
          }
        } catch (e) {
          console.warn('Error fetching all users snap:', e);
        }
      }

      if (data) {
        const oldDocId = matchedDocId || data.id || data.uid;

        // Ensure UID field & registrationCompleted is set
        data.uid = uid;
        data.registrationCompleted = true;

        const targetRef = doc(db, 'users', uid);
        await setDoc(targetRef, data, { merge: true }).catch(err => console.warn(err));

        // Re-link diagnosis & weight history records if oldDocId differed from current Auth UID
        if (oldDocId && oldDocId !== uid) {
          try {
            const [diagSnap, weightSnap] = await Promise.all([
              getDocs(query(collection(db, 'diagnosis'), where('uid', '==', oldDocId))),
              getDocs(query(collection(db, 'weight_history'), where('uid', '==', oldDocId)))
            ]);
            for (const dd of diagSnap.docs) {
              await updateDoc(doc(db, 'diagnosis', dd.id), { uid });
            }
            for (const wd of weightSnap.docs) {
              await updateDoc(doc(db, 'weight_history', wd.id), { uid });
            }
          } catch (linkErr) {
            console.warn('Error re-linking user records:', linkErr);
          }
        }

        setUserData(data);

        const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
        const platformStr = isNative ? 'Android App' : 'Web Browser';

        updateDoc(targetRef, {
          appVersion: CURRENT_APP_VERSION,
          platform: platformStr,
          lastActiveAt: serverTimestamp()
        }).catch(err => console.warn("App telemetry log failed:", err));

        if (data.preferredLanguage && typeof window !== 'undefined') {
          localStorage.setItem('vriddhi_lang', data.preferredLanguage);
          setLocalLang(data.preferredLanguage);
        } else if (typeof window !== 'undefined') {
          const currentLang = localStorage.getItem('vriddhi_lang') || localLang || 'en';
          updateDoc(targetRef, { preferredLanguage: currentLang }).catch(err => console.warn(err));
        }
        return data;
      } else {
        // Fallback profile if user document does not exist in Firestore
        const fallbackData = {
          uid,
          email: currentUser?.email || '',
          role: 'customer',
          registrationCompleted: true,
        };
        setUserData(fallbackData);
        return fallbackData;
      }
    } catch (error) {
      console.error("Error fetching user data from Firestore:", error);
      const fallbackData = {
        uid,
        role: 'customer',
        registrationCompleted: true,
      };
      setUserData(fallbackData);
      return fallbackData;
    }
  };

  useEffect(() => {
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
  const signUp = async (email, password, name, phone, languageParam = 'en') => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      const langToUse = languageParam || localLang || 'en';

      if (typeof window !== 'undefined') {
        localStorage.setItem('vriddhi_lang', langToUse);
      }
      setLocalLang(langToUse);

      const newUserData = {
        uid,
        name,
        email,
        phone,
        preferredLanguage: langToUse,
        role: 'customer',
        registrationCompleted: false,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', uid), newUserData);
      setUserData(newUserData);
      setUser(userCredential.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Change Language function
  const changeLanguage = async (lang) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vriddhi_lang', lang);
    }
    setLocalLang(lang);
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          preferredLanguage: lang
        });
        setUserData(prev => prev ? { ...prev, preferredLanguage: lang } : null);
      } catch (err) {
        console.error('Error updating language preference:', err);
      }
    }
  };

  // Login function
  const login = async (identifier, password) => {
    setLoading(true);
    try {
      let emailToUse = identifier.trim();
      let foundUserDoc = null;

      if (!emailToUse.includes('@')) {
        const cleanPhone = emailToUse.replace(/[^0-9]/g, '');
        try {
          const usersRef = collection(db, 'users');
          const allUsersSnap = await getDocs(usersRef);

          const found = allUsersSnap.docs.find(d => {
            const rawPhone = d.data().phone;
            const p = String(rawPhone || '').replace(/[^0-9]/g, '');
            return p && cleanPhone && (p === cleanPhone || p.endsWith(cleanPhone) || cleanPhone.endsWith(p));
          });

          if (found) {
            foundUserDoc = found;
            emailToUse = found.data().email || `${cleanPhone}@vriddhi.local`;
          } else {
            return { success: false, error: 'No account found with this mobile number. Please check or sign up.' };
          }
        } catch (phoneErr) {
          console.warn('Phone lookup query error:', phoneErr);
          emailToUse = `${cleanPhone}@vriddhi.local`;
        }
      }

      if (!emailToUse) {
        setLoading(false);
        return { success: false, error: 'Please enter a valid mobile number or email.' };
      }

      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
      } catch (authErr) {
        // If user profile exists in Firestore (e.g. converted from CRM) but Firebase Auth account isn't provisioned yet
        if (
          foundUserDoc &&
          (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential')
        ) {
          try {
            userCredential = await createUserWithEmailAndPassword(auth, emailToUse, password);
            const newUid = userCredential.user.uid;
            const existingData = foundUserDoc.data();
            const oldDocUid = foundUserDoc.id || existingData.uid;

            // Preserve existing profile data & link to new Auth UID
            const mergedProfile = {
              ...existingData,
              uid: newUid,
              email: emailToUse,
              registrationCompleted: true,
              updatedAt: serverTimestamp(),
            };

            await setDoc(doc(db, 'users', newUid), mergedProfile);

            // Re-point diagnosis & weight history records if oldDocUid differed
            if (oldDocUid && oldDocUid !== newUid) {
              const [diagSnap, weightSnap] = await Promise.all([
                getDocs(query(collection(db, 'diagnosis'), where('uid', '==', oldDocUid))),
                getDocs(query(collection(db, 'weight_history'), where('uid', '==', oldDocUid)))
              ]);
              for (const dd of diagSnap.docs) {
                await updateDoc(doc(db, 'diagnosis', dd.id), { uid: newUid });
              }
              for (const wd of weightSnap.docs) {
                await updateDoc(doc(db, 'weight_history', wd.id), { uid: newUid });
              }
            }
          } catch (createAuthErr) {
            console.error('Provisioning Auth account failed:', createAuthErr);
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }

      const uid = userCredential.user.uid;
      const data = await fetchUserData(uid);
      setUser(userCredential.user);
      return { success: true, userData: data };
    } catch (error) {
      let errMsg = error.message;
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/invalid-email'
      ) {
        errMsg = 'Incorrect mobile number / email or password. Please check and try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errMsg = 'ખોટો પાસવર્ડ વધારે વાર નાખવાને કારણે આ એકાઉન્ટ સિક્યોરિટી માટે લોક થયું છે. કૃપા કરીને થોડીવાર (૧૫-૩૦ મિનિટ) પછી ફરી પ્રયાસ કરો અથવા પાસવર્ડ રીસેટ કરો. (Account temporarily locked due to multiple failed login attempts. Please try again later or reset password.)';
      }
      return { success: false, error: errMsg };
    } finally {
      setLoading(false);
    }
  };

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

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.uid);
    }
  };

  const language = localLang || userData?.preferredLanguage || 'en';
  const t = translations[language] || translations.en;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('data-lang', language);
    }
  }, [language]);

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (err) {
      console.error('Password reset error:', err);
      return { success: false, error: err.message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, language, changeLanguage, t, signUp, login, logout, refreshProfile, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}
