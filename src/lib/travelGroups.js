// src/lib/travelGroups.js
//
// A "travel group" is a named roster of people you're planning a trip
// for — e.g. "Thailand Trip" made up of 3 families with different
// adult/children counts and ages. Unlike Group Trips (which invites
// real Meridian friends to RSVP/vote), a travel group doesn't require
// anyone to have an account — it's just a headcount + ages you define
// yourself, so you can search flights (and later, once a real hotel
// booking API is connected, hotel rooms) for the whole party at once.

import { db, isFirebaseConfigured } from "./firebase";
import { doc, addDoc, collection, getDocs, deleteDoc, query, orderBy } from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";

function summarize(families) {
  let adults = 0;
  let children = 0;
  for (const f of families) {
    adults += Number(f.adults) || 0;
    children += (f.childrenAges || []).length;
  }
  return { adults, children, total: adults + children };
}

export async function createTravelGroup(userId, { name, families }) {
  if (!isFirebaseConfigured) throw new Error("Sign in and connect Firebase to save a group.");
  const totals = summarize(families);
  const docRef = await addDoc(collection(db, "users", userId, "travelGroups"), {
    name,
    families,
    ...totals,
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, name, families, ...totals };
}

export async function listTravelGroups(userId) {
  if (!isFirebaseConfigured || !userId) return [];
  const q = query(collection(db, "users", userId, "travelGroups"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteTravelGroup(userId, groupId) {
  if (!isFirebaseConfigured) return;
  await deleteDoc(doc(db, "users", userId, "travelGroups", groupId));
}
