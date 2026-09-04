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
import { doc, setDoc, getDocs, query, collection, where, orderBy, limit, serverTimestamp } from "firebase/firestore";
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
      displayNameLower: (user.displayName || "").toLowerCase(),
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

/**
 * Searches registered Meridian accounts by the start of their email
 * or display name — powers the "recommendations while typing" search
 * used when inviting people to a group trip. Firestore doesn't do
 * substring search, so this is a prefix match (searching "jo" matches
 * "john@..." or "Jordan", not "mojo@...").
 */
export async function searchUsersByPrefix(term) {
  if (!isFirebaseConfigured || !term || term.trim().length < 2) return [];
  const t = term.trim().toLowerCase();
  const end = t + "\uf8ff"; // Firestore's standard prefix-range trick

  const [emailSnap, nameSnap] = await Promise.all([
    getDocs(query(collection(db, "users"), orderBy("email"), where("email", ">=", t), where("email", "<", end), limit(8))),
    getDocs(query(collection(db, "users"), orderBy("displayNameLower"), where("displayNameLower", ">=", t), where("displayNameLower", "<", end), limit(8))),
  ]);

  const byUid = new Map();
  emailSnap.forEach((d) => byUid.set(d.id, { uid: d.id, ...d.data() }));
  nameSnap.forEach((d) => byUid.set(d.id, { uid: d.id, ...d.data() }));
  return [...byUid.values()].slice(0, 8);
}
