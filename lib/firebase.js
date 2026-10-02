import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB43bSIFmTRt8gkHCcbPaM8Fp-t97rJHv0",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "vriddhi-76142.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vriddhi-76142",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "vriddhi-76142.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "371041839212",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:371041839212:web:d6f62dbdf69952ee611049",
};

const app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

if (typeof window !== 'undefined') {
  try {
    setPersistence(auth, indexedDBLocalPersistence).catch(() => {
      setPersistence(auth, browserLocalPersistence).catch(console.warn);
    });
  } catch (e) {
    console.warn('Auth persistence init error:', e);
  }
}

let db;
if (typeof window !== 'undefined') {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch (_) {
    db = getFirestore(app);
  }
} else {
  db = getFirestore(app);
}

const isFirebaseConfigured = true;

export { app, auth, db, isFirebaseConfigured };
