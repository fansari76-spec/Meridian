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
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    const json = Buffer.from(raw, "base64").toString("utf-8");
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(json);
    } catch (err) {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY diagnostic — env var length:", raw.length, "decoded length:", json.length, "decoded starts:", JSON.stringify(json.slice(0, 30)), "decoded ends:", JSON.stringify(json.slice(-30)));
      throw err;
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}
