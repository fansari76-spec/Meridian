// src/lib/sharedTrips.js
//
// Saves a read-only snapshot of a planned trip (budget + itinerary +
// search params) to a public Firestore collection, and loads one back
// by its share ID. This is what powers /trip/:id pages — anyone with
// the link can view it, no sign-in required.
//
// Note: the current Firestore rules (test mode) allow open read/write
// to any collection, which is fine while testing. Before real launch,
// tighten rules so `sharedTrips` stays publicly READABLE but only
// writable by the app (e.g. via a Cloud Function) or by signed-in
// users for their own trips — open write access on a public
// collection is fine for a demo, not for production.

import { db, isFirebaseConfigured } from "./firebase";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";

export async function saveSharedTrip(snapshot) {
  if (!isFirebaseConfigured) {
    throw new Error("Sharing needs Firebase connected — see README.md.");
  }
  const docRef = await addDoc(collection(db, "sharedTrips"), {
    ...snapshot,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getSharedTrip(id) {
  if (!isFirebaseConfigured || !id) return null;
  const snap = await getDoc(doc(db, "sharedTrips", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
