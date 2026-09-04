// src/lib/groupPosts.js
//
// Text/photo/video updates posted to a group trip. Unlike the 1:1
// nearby-friend messages, "seen by" here is intentionally visible to
// everyone — the whole point of a group update during a trip is
// knowing who's actually seen the latest plan change or photo.
//
// Requires Firebase Storage to be enabled for photo/video uploads
// (Firestore alone only stores text). Text-only posts work with just
// Firestore.

import { db, storage, isFirebaseConfigured } from "./firebase";
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadGroupMedia(groupTripId, file) {
  if (!isFirebaseConfigured) throw new Error("Sign in and connect Firebase to share photos or videos.");
  const path = `groupTrips/${groupTripId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function createGroupPost(groupTripId, { authorId, authorName, text, mediaUrl, mediaType }) {
  if (!isFirebaseConfigured) throw new Error("Sign in and connect Firebase to post an update.");
  await addDoc(collection(db, "groupTrips", groupTripId, "posts"), {
    authorId,
    authorName,
    text: text || "",
    mediaUrl: mediaUrl || null,
    mediaType: mediaType || null, // "image" | "video" | null
    seenBy: [authorId], // the author has, by definition, seen their own post
    createdAt: serverTimestamp(),
  });
}

export function subscribeToGroupPosts(groupTripId, callback) {
  if (!isFirebaseConfigured || !groupTripId) return () => {};
  const q = query(collection(db, "groupTrips", groupTripId, "posts"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/**
 * Marks a post as seen by this user — visible to everyone else in
 * the group, by design, unlike the private nearby-message inbox.
 */
export async function markPostSeen(groupTripId, postId, userId) {
  if (!isFirebaseConfigured) return;
  await updateDoc(doc(db, "groupTrips", groupTripId, "posts", postId), {
    seenBy: arrayUnion(userId),
  });
}
