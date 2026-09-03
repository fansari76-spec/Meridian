// src/lib/firebase.js
//
// Initializes Firebase Auth + Firestore. If no Firebase config is
// present (no .env.local yet), the app runs in "demo mode": sign-in
// buttons show a clear message instead of crashing, and trip-saving
// falls back to browser memory. This means the app is fully clickable
// and testable before you've created a Firebase project.

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app, auth, db;
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}
export { auth, db };

export const googleProvider = isFirebaseConfigured ? new GoogleAuthProvider() : null;

// "Sign in with Apple" — this is what powers the iCloud button, since
// Apple accounts are the underlying identity for iCloud email addresses.
export const appleProvider = isFirebaseConfigured ? new OAuthProvider("apple.com") : null;
if (appleProvider) {
  appleProvider.addScope("email");
  appleProvider.addScope("name");
}

// Yahoo — add as a generic OpenID Connect provider in the Firebase
// console (Authentication > Sign-in method > Add new provider), using
// Yahoo's OIDC endpoint. Provider ID must match what's set there.
export const yahooProvider = isFirebaseConfigured ? new OAuthProvider("oidc.yahoo") : null;

export async function signInWithProvider(provider) {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase isn't connected yet. Add your project's keys to .env.local — see README.md."
    );
  }
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser() {
  if (!isFirebaseConfigured) return;
  await signOut(auth);
}

export function subscribeToAuthChanges(callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
