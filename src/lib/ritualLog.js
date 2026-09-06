// src/lib/ritualLog.js
//
// Persists ritual completions (Tawaf, Sa'i, kora, parikrama, and
// simple checklist items) to the user's account, permanently — this
// is what "how many times have I performed this" is built on. Photos
// attach to a completion via Firebase Storage.

import { db, storage, isFirebaseConfigured } from "./firebase";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function logRitualCompletion(userId, { traditionId, stepId, stepName, count = null, unit = null, photoUrls = [] }) {
  if (!isFirebaseConfigured || !userId) return null;
  const docRef = await addDoc(collection(db, "users", userId, "ritualCompletions"), {
    traditionId,
    stepId,
    stepName,
    count,
    unit,
    photoUrls,
    completedAt: serverTimestamp(),
  });
  return { id: docRef.id, traditionId, stepId, stepName, count, unit, photoUrls };
}

export async function listRitualHistory(userId) {
  if (!isFirebaseConfigured || !userId) return [];
  const q = query(collection(db, "users", userId, "ritualCompletions"), orderBy("completedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function lifetimeCountFor(history, traditionId, stepId) {
  return history.filter((h) => h.traditionId === traditionId && h.stepId === stepId).length;
}

export async function uploadRitualPhoto(userId, file) {
  if (!isFirebaseConfigured || !userId) throw new Error("Sign in to upload photos.");
  const path = `ritualPhotos/${userId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
