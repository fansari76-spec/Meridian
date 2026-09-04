// src/lib/users.js
//
// Two ways people get found here, with two different privacy models:
//
// 1. "Add by email" — the user explicitly types someone's email they
//    already know. Looked up by plain email, since typing an email
//    is an intentional, specific action (not scanning a whole
//    contact list).
//
// 2. "Find contacts on Meridian" — matches against a device's full
//    contact list. For this, we NEVER store or query plain emails —
//    only a SHA-256 hash, computed on-device, so the server never
//    sees anyone's real contact info, including for the person doing
//    the matching.

import { db, isFirebaseConfigured } from "./firebase";
import { doc, setDoc, getDocs, query, collection, where, serverTimestamp } from "firebase/firestore";
import { sha256Hex } from "./hash.js";

export async function upsertUserProfile(user) {
  if (!isFirebaseConfigured || !user) return;
  const email = (user.email || "").toLowerCase();
  await setDoc(
    doc(db, "users", user.uid),
    {
      email,
      emailHash: email ? await sha256Hex(email) : null,
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

/**
 * Given a list of already-hashed contact identifiers (computed
 * on-device, never raw), finds which of them belong to real Meridian
 * accounts. Firestore's `in` operator caps at 10 values per query, so
 * this chunks larger contact lists automatically.
 */
export async function findUsersByEmailHashes(hashes) {
  if (!isFirebaseConfigured || !hashes?.length) return [];
  const unique = [...new Set(hashes)];
  const chunks = [];
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));

  const results = [];
  for (const chunk of chunks) {
    const q = query(collection(db, "users"), where("emailHash", "in", chunk));
    const snap = await getDocs(q);
    snap.forEach((d) => results.push({ uid: d.id, ...d.data() }));
  }
  return results;
}
