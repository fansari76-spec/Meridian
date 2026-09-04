// src/pages/GroupTripPage.jsx
//
// Live, multi-person hub for a group trip at /group/:id:
// - RSVP per activity (Going / Not going / Maybe), with everyone's
//   name shown next to their answer — fully visible on purpose, since
//   the point of an RSVP is knowing who's actually confirmed.
// - A photo/video/text update feed, with visible "seen by" tracking
//   (again, deliberately visible here, unlike 1:1 nearby messages).
// - Opt-in, per-trip location sharing — each member controls their
//   own toggle; only people sharing are visible to the group.
// - "Resolve with concierge" for activities where RSVPs conflict.

import { useEffect, useState } from "react";
import { subscribeToGroupTrip, castRSVP, applyResolvedPlan } from "../lib/groupTrips.js";
import { subscribeToGroupPosts, createGroupPost, markPostSeen, uploadGroupMedia } from "../lib/groupPosts.js";
import { shareLocationInGroup, stopSharingLocationInGroup, subscribeToGroupLocations, distanceMiles, getBrowserLocation } from "../lib/groupLocation.js";
import { subscribeToAuthChanges } from "../lib/firebase.js";
import { useConcierge } from "../lib/useConcierge.js";

const PERIOD_LABELS = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const PERIOD_ORDER = ["morning", "afternoon", "evening", "unscheduled"];
const RSVP_OPTIONS = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Not going" },
];

function groupByPeriod(activities) {
  const buckets = { morning: [], afternoon: [], evening: [], unscheduled: [] };
  for (const a of activities || []) {
    const key = PERIOD_LABELS[a.period] ? a.period : "unscheduled";
    buckets[key].push(a);
  }
  return PERIOD_ORDER.filter((k) => buckets[k].length > 0).map((k) => [k, buckets[k]]);
}

function activityKey(dayNumber, index) {
  return `${dayNumber}-${index}`;
}

export default function GroupTripPage({ tripId }) {
  const [trip, setTrip] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const { sendMessage: sendConciergeMessage, loading: resolving } = useConcierge();
  const [resolveNote, setResolveNote] = useState(null);

  const [posts, setPosts] = useState([]);
  const [postText, setPostText] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [posting, setPosting] = useState(false);

  const [locations, setLocations] = useState({});
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState(null);

  useEffect(() => subscribeToAuthChanges(setUser), []);

  useEffect(() => {
    const unsub = subscribeToGroupTrip(tripId, (data) => {
      setTrip(data);
      setStatus(data ? "ok" : "notfound");
    });
    return unsub;
  }, [tripId]);

  useEffect(() => subscribeToGroupPosts(tripId, setPosts), [tripId]);
  useEffect(() => subscribeToGroupLocations(tripId, setLocations), [tripId]);

  // Mark all currently-visible posts as seen by this user — the
  // visible-seen-by list updates for the whole group in real time.
  useEffect(() => {
    if (!user || !posts.length) return;
    posts.forEach((p) => {
      if (!p.seenBy?.includes(user.uid)) markPostSeen(tripId, p.id, user.uid);
    });
  }, [user, posts, tripId]);

  if (status === "loading") {
    return (
      <div className="wrap" style={{ padding: "100px 28px", textAlign: "center", color: "#5A5F68" }}>
        <span className="spinner" style={{ marginRight: 10 }} />
        Loading group trip…
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="wrap" style={{ padding: "100px 28px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: "1.6rem" }}>Group trip not found</h2>
        <p style={{ color: "#5A5F68", marginTop: 8 }}>This link may be broken, or the trip was removed.</p>
        <a className="book-btn" style={{ marginTop: 20, display: "inline-block" }} href="/">Plan your own trip →</a>
      </div>
    );
  }

  const memberCount = trip.memberIds?.length || 0;
  const memberName = (uid) => trip.memberNames?.[uid] || "A traveler";

  function rsvpsFor(key) {
    return trip.rsvps?.[key] || {};
  }

  async function handleRSVP(key, value) {
    if (!user) return;
    const current = trip.rsvps?.[key]?.[user.uid];
    await castRSVP(trip.id, key, user.uid, current === value ? null : value);
  }

  async function handleResolve() {
    setResolveNote(null);
    const conflicts = [];
    trip.itineraryPlan.forEach((day) => {
      (day.activities || []).forEach((a, i) => {
        const r = rsvpsFor(activityKey(day.dayNumber, i));
        const going = Object.values(r).filter((v) => v === "going").length;
        const notGoing = Object.values(r).filter((v) => v === "not_going").length;
        if (going > 0 && notGoing > 0) conflicts.push(`Day ${day.dayNumber}: "${a.name}" (${going} going, ${notGoing} not)`);
      });
    });

    if (!conflicts.length) {
      setResolveNote("No real disagreements right now — RSVPs are aligned, nothing to resolve.");
      return;
    }

    const message = `The group RSVP'd on this itinerary and disagrees on a few things: ${conflicts.join("; ")}. Can you suggest alternatives for the activities people disagreed on, trying to find something the whole group would enjoy?`;
    const result = await sendConciergeMessage({ destination: trip.destination, currentPlan: trip.itineraryPlan, message, history: [] });

    if (result?.updatedPlan) {
      await applyResolvedPlan(trip.id, result.updatedPlan);
      setResolveNote(`Resolved — ${result.reply}`);
    } else if (result) {
      setResolveNote(result.reply);
    } else {
      setResolveNote("Couldn't reach the concierge just now — try again.");
    }
  }

  async function handlePost() {
    if (!user) return;
    if (!postText.trim() && !postFile) return;
    setPosting(true);
    try {
      let mediaUrl = null;
      let mediaType = null;
      if (postFile) {
        mediaUrl = await uploadGroupMedia(tripId, postFile);
        mediaType = postFile.type.startsWith("video") ? "video" : "image";
      }
      await createGroupPost(tripId, {
        authorId: user.uid,
        authorName: user.displayName || user.email,
        text: postText,
        mediaUrl,
        mediaType,
      });
      setPostText("");
      setPostFile(null);
    } catch (err) {
      setLocationStatus(null);
      alert(err.message || "Couldn't post that update.");
    } finally {
      setPosting(false);
    }
  }

  async function handleToggleLocationSharing() {
    if (!user) return;
    if (sharingLocation) {
      await stopSharingLocationInGroup(tripId, user.uid);
      setSharingLocation(false);
      setLocationStatus("You stopped sharing your location with this group.");
      return;
    }
    setLocationStatus("Getting your location…");
    try {
      const coords = await getBrowserLocation();
      await shareLocationInGroup(tripId, user.uid, coords);
      setSharingLocation(true);
      setLocationStatus("Sharing your location with this group — turn this off any time.");
    } catch (err) {
      setLocationStatus(err.message);
    }
  }

  const myLocation = user ? locations[user.uid] : null;
  const otherSharing = Object.entries(locations).filter(([uid]) => uid !== user?.uid);

  return (
    <>
      <header className="top">
        <div className="topbar">
          <a href="/" className="brand" style={{ textDecoration: "none" }}>
            <span className="brand-mark" />Meridian
          </a>
          <span className="signin-btn" style={{ background: "var(--teal)", borderColor: "var(--teal)" }}>
            {memberCount} traveler{memberCount === 1 ? "" : "s"} in this group
          </span>
        </div>
      </header>

      <section className="hero wrap" style={{ paddingBottom: 20 }}>
        <div className="eyebrow-plain">A group trip on Meridian</div>
        <h1>{trip.destination} — group plan</h1>
        <p className="lede">{trip.origin} → {trip.destination} · {trip.departDate} to {trip.returnDate}</p>
        {!user && (
          <div className="demo-note" style={{ marginTop: 16, maxWidth: 480 }}>
            Sign in on the main site to RSVP, post updates, or share your location — you can still view everything without signing in.
          </div>
        )}
      </section>

      {/* ---------- Location sharing ---------- */}
      <section className="panel wrap" style={{ paddingBottom: 24 }}>
        <div className="panel-head">
          <div>
            <h2 style={{ fontSize: "1.4rem" }}>Find each other</h2>
            <p>Opt-in only — nobody sees your location unless you turn this on yourself. Works while this page is open in your browser.</p>
          </div>
        </div>
        {user && (
          <button className={`book-btn ${sharingLocation ? "secondary" : ""}`} onClick={handleToggleLocationSharing}>
            {sharingLocation ? "Stop sharing my location" : "Share my location with this group"}
          </button>
        )}
        {locationStatus && <p className="pref-hint" style={{ marginTop: 10 }}>{locationStatus}</p>}
        {otherSharing.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {otherSharing.map(([uid, loc]) => (
              <div key={uid} className="friend-row">
                <div className="friend-email">{memberName(uid)}</div>
                <div className="friend-nearby-badge">
                  📍 {myLocation ? `~${distanceMiles(myLocation, loc).toFixed(1)} mi away` : "Sharing now"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- RSVPs / itinerary ---------- */}
      <section className="panel wrap">
        <div className="panel-head">
          <div>
            <h2>RSVP to the plan</h2>
            <p>Everyone's response is visible to the whole group — that's the point of an RSVP.</p>
          </div>
        </div>

        <button className="book-btn" onClick={handleResolve} disabled={resolving} style={{ marginBottom: 20 }}>
          {resolving ? "Resolving…" : "Resolve disagreements with concierge"}
        </button>
        {resolveNote && <p className="pref-hint" style={{ marginBottom: 20 }}>{resolveNote}</p>}

        <div className="itinerary">
          {trip.itineraryPlan.map((day) => (
            <div className="day-block" key={day.dayNumber}>
              <div className="day-title">Day {day.dayNumber}</div>
              {groupByPeriod(day.activities).map(([period, acts]) => (
                <div key={period} className="period-group">
                  {period !== "unscheduled" && <div className="period-label">{PERIOD_LABELS[period] || period}</div>}
                  {acts.map((a) => {
                    const idx = day.activities.indexOf(a);
                    const key = activityKey(day.dayNumber, idx);
                    const responses = rsvpsFor(key);
                    const mine = user ? responses[user.uid] : null;
                    return (
                      <div className="activity" key={key}>
                        <div className="activity-time">{a.time}</div>
                        <div style={{ flex: 1 }}>
                          <div className="activity-name-row">
                            <div className="activity-name">{a.name}</div>
                            {Number(a.cost) > 0 ? <span className="activity-cost">${a.cost}/pp</span> : <span className="activity-cost activity-cost--free">Free</span>}
                          </div>
                          <div className="activity-desc">{a.desc}</div>
                          <div className="vote-row">
                            {RSVP_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                className={`vote-btn ${mine === opt.value ? `vote-btn--active-${opt.value}` : ""}`}
                                onClick={() => handleRSVP(key, opt.value)}
                                disabled={!user}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {Object.keys(responses).length > 0 && (
                            <div className="rsvp-names">
                              {RSVP_OPTIONS.map((opt) => {
                                const names = Object.entries(responses).filter(([, v]) => v === opt.value).map(([uid]) => memberName(uid));
                                if (!names.length) return null;
                                return (
                                  <span key={opt.value} className="rsvp-name-group">
                                    <strong>{opt.label}:</strong> {names.join(", ")}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Group updates feed ---------- */}
      <section className="panel wrap">
        <div className="panel-head">
          <div>
            <h2>Group updates</h2>
            <p>Share photos, videos, or a quick note with everyone. Seen-by is visible to the group.</p>
          </div>
        </div>

        {user && (
          <div className="compose-box" style={{ marginTop: 0, marginBottom: 24 }}>
            <textarea
              className="pref-textarea"
              placeholder="Share an update with the group…"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
            />
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <input type="file" accept="image/*,video/*" onChange={(e) => setPostFile(e.target.files?.[0] || null)} />
              <button className="book-btn" onClick={handlePost} disabled={posting}>
                {posting ? "Posting…" : "Post update"}
              </button>
            </div>
          </div>
        )}

        {posts.length === 0 && <p className="pref-hint">No updates yet — be the first to share something.</p>}
        {posts.map((p) => (
          <div key={p.id} className="ping-card" style={{ marginBottom: 14 }}>
            <div className="ping-from">{p.authorName}</div>
            {p.text && <div className="ping-message" style={{ marginTop: 4 }}>{p.text}</div>}
            {p.mediaUrl && p.mediaType === "image" && (
              <img src={p.mediaUrl} alt="Shared update" style={{ marginTop: 10, borderRadius: 10, maxWidth: "100%", maxHeight: 360 }} />
            )}
            {p.mediaUrl && p.mediaType === "video" && (
              <video src={p.mediaUrl} controls style={{ marginTop: 10, borderRadius: 10, maxWidth: "100%", maxHeight: 360 }} />
            )}
            <div className="pref-hint" style={{ marginTop: 8 }}>
              Seen by: {p.seenBy?.length ? p.seenBy.map((uid) => memberName(uid)).join(", ") : "just them"}
            </div>
          </div>
        ))}
      </section>

      <footer>
        Planned with Meridian — <a href="/" style={{ color: "var(--teal)" }}>plan your own trip</a>.
      </footer>
    </>
  );
}
