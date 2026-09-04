// src/lib/pings.js
//
// Messages sent to a nearby friend. The key privacy property: opening
// or viewing a message in the inbox NEVER changes its status or
// notifies the sender. The sender only ever learns something happened
// if the recipient chooses to reply — dismissing/ignoring a message
// stays completely private to the recipient. There is deliberately no
// "read" field that gets set on view.

import { db, isFirebaseConfigured } from "./firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";

export async function sendPing({ fromUserId, fromName, toUserId, message }) {
  if (!isFirebaseConfigured) throw new Error("Sign in and connect Firebase to send messages.");
  if (!message?.trim()) throw new Error("Write a message first.");
  await addDoc(collection(db, "pings"), {
    fromUserId,
    fromName: fromName || "A Meridian friend",
    toUserId,
    message: message.trim(),
    createdAt: serverTimestamp(),
    status: "sent", // sent -> replied (never set to "read" on open)
    reply: null,
  });
}

/**
 * Live-subscribes to messages sent TO this user, newest first. The
 * caller decides what to show — this does not mutate anything, so
 * subscribing/viewing has no side effects on the sender's side.
 */
export function subscribeToInbox(userId, callback) {
  if (!isFirebaseConfigured || !userId) return () => {};
  const q = query(collection(db, "pings"), where("toUserId", "==", userId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/**
 * Live-subscribes to messages this user SENT, so they can see replies
 * if any come in — this is the only way a sender learns anything,
 * and only reflects an explicit reply, never a "seen" state.
 */
export function subscribeToSent(userId, callback) {
  if (!isFirebaseConfigured || !userId) return () => {};
  const q = query(collection(db, "pings"), where("fromUserId", "==", userId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function replyToPing(pingId, replyText) {
  if (!replyText?.trim()) return;
  await updateDoc(doc(db, "pings", pingId), {
    status: "replied",
    reply: replyText.trim(),
    repliedAt: serverTimestamp(),
  });
}

/**
 * Dismissing hides a message from the recipient's own inbox view
 * only — it does not update anything the sender can see, matching
 * the "no read receipt, no pressure" design goal.
 */
export async function dismissPing(pingId) {
  await updateDoc(doc(db, "pings", pingId), { dismissedByRecipient: true });
}
