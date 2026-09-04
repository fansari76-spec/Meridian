// src/lib/groupLocation.js
//
// Location sharing scoped to one group trip, not global. Each member
// controls their own toggle — only people who've explicitly turned it
// on for THIS trip are visible to the rest of the group, and it's
// foreground-only (same real limitation as the nearby-friends
// feature: reliable background tracking needs a native app).

import { db, isFirebaseConfigured } from "./firebase";
import { doc, setDoc, deleteDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";

export async function shareLocationInGroup(groupTripId, userId, { lat, lng }) {
  if (!isFirebaseConfigured) throw new Error("Sign in and connect Firebase to share your location.");
  await setDoc(doc(db, "groupTrips", groupTripId, "locations", userId), {
    lat,
    lng,
    updatedAt: serverTimestamp(),
  });
}

export async function stopSharingLocationInGroup(groupTripId, userId) {
  if (!isFirebaseConfigured) return;
  await deleteDoc(doc(db, "groupTrips", groupTripId, "locations", userId));
}

export function subscribeToGroupLocations(groupTripId, callback) {
  if (!isFirebaseConfigured || !groupTripId) return () => {};
  return onSnapshot(collection(db, "groupTrips", groupTripId, "locations"), (snap) => {
    const locations = {};
    snap.forEach((d) => (locations[d.id] = d.data()));
    callback(locations);
  });
}

// Haversine distance in miles between two {lat, lng} points.
export function distanceMiles(a, b) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser doesn't support location sharing."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Couldn't get your location.")),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}
