// server/lib/firebaseAdmin.js
//
// Server-side Firebase access (Firestore only, not Auth) — needed so
// scheduled jobs like price-drop checking can read saved trips and
// user emails without a browser tab open. Uses a service account key,
// base64-encoded into a single env var so it survives Render's
// environment variable UI cleanly.

import admin from "firebase-admin";

export function isFirebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}

export function getFirebaseAdmin() {
  if (!isFirebaseAdminConfigured()) return null;
  if (!admin.apps.length) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, "base64").toString("utf-8");
    const serviceAccount = JSON.parse(json);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}
