// src/lib/groupChat.js
//
// A simple real-time text chat thread scoped to one group trip —
// everyone on the trip sees the same thread, in order, live.

import { db, isFirebaseConfigured } from "./firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";

export async function sendGroupMessage(tripId, { senderId, senderName, text }) {
  if (!isFirebaseConfigured || !text?.trim()) return;
  await addDoc(collection(db, "groupTrips", tripId, "messages"), {
    senderId,
    senderName,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}

export function subscribeToGroupMessages(tripId, callback) {
  if (!isFirebaseConfigured || !tripId) return () => {};
  const q = query(collection(db, "groupTrips", tripId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
