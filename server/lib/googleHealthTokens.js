// server/lib/googleHealthTokens.js
//
// Stores and refreshes a user's Google Health OAuth tokens in
// Firestore (server-side, via firebase-admin — never exposed to the
// browser). Access tokens expire after about an hour; this
// automatically refreshes using the stored refresh token whenever a
// request needs one, so the frontend never has to think about it.

import { getFirebaseAdminFirestore } from "./firebaseAdmin.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function saveTokens(userId, { accessToken, refreshToken, expiresIn }) {
  const db = getFirebaseAdminFirestore();
  const expiresAt = Date.now() + expiresIn * 1000 - 60000; // refresh 1 min early
  await db.collection("users").doc(userId).set(
    {
      googleHealth: {
        accessToken,
        refreshToken,
        expiresAt,
        connectedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );
}

export async function getValidAccessToken(userId) {
  const db = getFirebaseAdminFirestore();
  const snap = await db.collection("users").doc(userId).get();
  const googleHealth = snap.exists ? snap.data().googleHealth : null;
  if (!googleHealth) return null;

  if (Date.now() < googleHealth.expiresAt) {
    return googleHealth.accessToken;
  }

  // Expired — use the refresh token to get a new access token.
  if (!googleHealth.refreshToken) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET,
      refresh_token: googleHealth.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();

  await saveTokens(userId, {
    accessToken: json.access_token,
    refreshToken: googleHealth.refreshToken, // refresh tokens don't rotate on this grant
    expiresIn: json.expires_in,
  });
  return json.access_token;
}

export async function isConnected(userId) {
  const db = getFirebaseAdminFirestore();
  const snap = await db.collection("users").doc(userId).get();
  return Boolean(snap.exists && snap.data().googleHealth);
}

export async function disconnect(userId) {
  const db = getFirebaseAdminFirestore();
  await db.collection("users").doc(userId).set({ googleHealth: null }, { merge: true });
}
