// src/lib/friends.js
//
// Each user has their own `friends` subcollection — adding a friend
// is one-directional here for simplicity (you add someone you know;
// a mutual-confirmation flow is a reasonable next step but not
// required for the core nearby-messaging feature to work).

import { db, isFirebaseConfigured } from "./firebase";
import { doc, setDoc, getDocs, collection, deleteDoc } from "firebase/firestore";

export async function addFriend(userId, friend) {
  if (!isFirebaseConfigured) throw new Error("Sign in and connect Firebase to add friends.");
  await setDoc(doc(db, "users", userId, "friends", friend.uid), {
    email: friend.email,
    displayName: friend.displayName || null,
    addedAt: new Date().toISOString(),
  });
}

export async function listFriends(userId) {
  if (!isFirebaseConfigured || !userId) return [];
  const snap = await getDocs(collection(db, "users", userId, "friends"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function removeFriend(userId, friendUid) {
  if (!isFirebaseConfigured) return;
  await deleteDoc(doc(db, "users", userId, "friends", friendUid));
}
