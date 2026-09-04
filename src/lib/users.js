// src/lib/users.js
//
// Maintains a public-ish `users` collection keyed by uid, so people
// can be found by email to add as a friend. Only stores what's needed
// for that — email and display name, nothing sensitive.

import { db, isFirebaseConfigured } from "./firebase";
import { doc, setDoc, getDocs, query, collection, where, serverTimestamp } from "firebase/firestore";

export async function upsertUserProfile(user) {
  if (!isFirebaseConfigured || !user) return;
  await setDoc(
    doc(db, "users", user.uid),
    {
      email: (user.email || "").toLowerCase(),
      displayName: user.displayName || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function findUserByEmail(email) {
  if (!isFirebaseConfigured || !email) return null;
  const q = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}
