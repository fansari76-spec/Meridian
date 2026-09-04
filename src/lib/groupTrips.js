// src/lib/groupTrips.js
//
// A group trip is a shared, live-editable itinerary: an owner starts
// it from their current plan, invites friends, and everyone can RSVP
// per activity — "Going," "Not going," or "Maybe." Unlike the 1:1
// nearby-friend messages elsewhere in the app, RSVP responses are
// deliberately fully visible to everyone in the group (who answered
// what, and who hasn't answered yet) — that's the point of an RSVP
// for group logistics, unlike a private DM.

import { db, isFirebaseConfigured } from "./firebase";
import { doc, addDoc, collection, onSnapshot, updateDoc, serverTimestamp, query, where, orderBy, getDocs } from "firebase/firestore";

export async function createGroupTrip({ ownerId, ownerName, origin, destination, departDate, returnDate, travelers, itineraryPlan, memberIds = [], memberNames = {} }) {
  if (!isFirebaseConfigured) throw new Error("Sign in and connect Firebase to start a group trip.");
  const docRef = await addDoc(collection(db, "groupTrips"), {
    ownerId,
    origin,
    destination,
    departDate,
    returnDate,
    travelers,
    itineraryPlan,
    memberIds: [ownerId, ...memberIds],
    memberNames: { [ownerId]: ownerName, ...memberNames },
    rsvps: {}, // { "dayNumber-activityIndex": { [userId]: "going" | "not_going" | "maybe" } }
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeToGroupTrip(id, callback) {
  if (!isFirebaseConfigured || !id) return () => {};
  return onSnapshot(doc(db, "groupTrips", id), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function castRSVP(groupTripId, activityKey, userId, value) {
  if (!isFirebaseConfigured) return;
  await updateDoc(doc(db, "groupTrips", groupTripId), {
    [`rsvps.${activityKey}.${userId}`]: value,
  });
}

/**
 * Replaces the itinerary with a concierge-resolved version and clears
 * RSVPs so the group responds to the new plan fresh.
 */
export async function applyResolvedPlan(groupTripId, newPlan) {
  if (!isFirebaseConfigured) return;
  await updateDoc(doc(db, "groupTrips", groupTripId), { itineraryPlan: newPlan, rsvps: {} });
}

export async function listMyGroupTrips(userId) {
  if (!isFirebaseConfigured || !userId) return [];
  const q = query(collection(db, "groupTrips"), where("memberIds", "array-contains", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
