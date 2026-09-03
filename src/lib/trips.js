// src/lib/trips.js
//
// Saves/loads a user's trips. Uses Firestore when Firebase is
// configured; otherwise falls back to an in-memory list so "Save this
// trip" is still fully clickable and testable in demo mode (it just
// won't persist across a page reload until Firebase is connected).

import { isFirebaseConfigured, db } from "./firebase";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

const memoryStore = [];

export async function saveTrip(userId, trip) {
  if (!isFirebaseConfigured) {
    const record = { id: String(memoryStore.length + 1), userId, ...trip, createdAt: new Date() };
    memoryStore.unshift(record);
    return record;
  }

  const docRef = await addDoc(collection(db, "trips"), {
    userId,
    ...trip,
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, userId, ...trip };
}

export async function loadTrips(userId) {
  if (!isFirebaseConfigured) {
    return memoryStore.filter((t) => t.userId === userId);
  }

  const q = query(collection(db, "trips"), where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
