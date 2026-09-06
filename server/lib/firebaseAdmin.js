// server/lib/firebaseAdmin.js
//
// Server-side Firebase access (Firestore only, not Auth) — needed so
// scheduled jobs like price-drop checking can read saved trips and
// user emails without a browser tab open. Uses a service account key,
// base64-encoded into a single env var so it survives Render's
// environment variable UI cleanly.
//
// Uses firebase-admin's modular imports (firebase-admin/app,
// firebase-admin/firestore) rather than the default `admin` object —
// the default-export style doesn't interop reliably under Node's ESM
// mode and can silently return an incomplete object.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function isFirebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}

export function getFirebaseAdminFirestore() {
  if (!isFirebaseAdminConfigured()) return null;
  if (!getApps().length) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, "base64").toString("utf-8");
    const serviceAccount = JSON.parse(json);
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}
