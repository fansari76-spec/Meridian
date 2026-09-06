// src/lib/presence.js
//
// Foreground-only "I'm nearby" presence. While the tab is open and a
// user has opted in, their approximate location is stored with an
// expiry — anyone checking a friend's presence sees nothing once it
// expires or they've turned it off. This is intentionally foreground-
// only (no background tracking); a native app is what would extend
// this to work when TripAmi isn't actively open.

import { db, isFirebaseConfigured } from "./firebase";
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const PRESENCE_TTL_HOURS = 12;

export async function setNearby(userId, { lat, lng, label }) {
  if (!isFirebaseConfigured) throw new Error("Sign in and connect Firebase to use this.");
  const expiresAt = Date.now() + PRESENCE_TTL_HOURS * 60 * 60 * 1000;
  await setDoc(doc(db, "presence", userId), { lat, lng, label, expiresAt, updatedAt: serverTimestamp() });
}

export async function clearNearby(userId) {
  if (!isFirebaseConfigured) return;
  await deleteDoc(doc(db, "presence", userId));
}

export async function getPresence(userId) {
  if (!isFirebaseConfigured || !userId) return null;
  const snap = await getDoc(doc(db, "presence", userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.expiresAt && data.expiresAt < Date.now()) return null; // expired, treat as not-nearby
  return data;
}

// Haversine distance in miles between two {lat, lng} points.
export function distanceMiles(a, b) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser doesn't support location sharing."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Couldn't get your location.")),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}
