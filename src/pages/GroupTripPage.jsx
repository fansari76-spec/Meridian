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
import { subscribeToGroupTrip, castRSVP, applyResolvedPlan, markGroupTripBooked } from "../lib/groupTrips.js";
import { subscribeToGroupPosts, createGroupPost, markPostSeen, uploadGroupMedia } from "../lib/groupPosts.js";
import { shareLocationInGroup, stopSharingLocationInGroup, subscribeToGroupLocations, distanceMiles, getBrowserLocation } from "../lib/groupLocation.js";
import { sendGroupMessage, subscribeToGroupMessages } from "../lib/groupChat.js";
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

// Parses times like "9:00a" / "7:30p" into a real Date, by combining
// the trip's departure date with (dayNumber - 1) days offset. Used
// only to show an in-app "starting soon" banner while this page is
// open — this is not a push notification or email, since that needs
// a background service this app doesn't have yet (see the note in the
// UI itself).
function activityDateTime(departDate, dayNumber, timeStr) {
  if (!departDate || !timeStr) return null;
  const match = /^(\d{1,2}):(\d{2})(a|p)$/i.exec(timeStr.trim());
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const isPM = match[3].toLowerCase() === "p";
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;
  const d = new Date(departDate);
  d.setDate(d.getDate() + (dayNumber - 1));
  d.setHours(hour, minute, 0, 0);
  return d;
}

function findUpcomingActivities(trip) {
  if (!trip?.itineraryPlan) return [];
  const now = new Date();
  const upcoming = [];
  for (const day of trip.itineraryPlan) {
    for (const activity of day.activities || []) {
      const when = activityDateTime(trip.departDate, day.dayNumber, activity.time);
      if (!when) continue;
      const hoursUntil = (when - now) / 3600000;
      if (hoursUntil > 0 && hoursUntil <= 24) {
        upcoming.push({ ...activity, dayNumber: day.dayNumber, when, hoursUntil });
      }
    }
  }
  return upcoming.sort((a, b) => a.when - b.when);
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

  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [markingBooked, setMarkingBooked] = useState(false);

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
  useEffect(() => subscribeToGroupMessages(tripId, setMessages), [tripId]);

  async function handleSendChat(e) {
    e.preventDefault();
    if (!user || !chatText.trim()) return;
    await sendGroupMessage(tripId, { senderId: user.uid, senderName: user.displayName || user.email, text: chatText });
    setChatText("");
  }

  async function handleMarkBooked() {
    setMarkingBooked(true);
    await markGroupTripBooked(tripId, true);
    setMarkingBooked(false);
  }

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
        <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: "1.6rem" }}>Group trip not found</h2>
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
  const upcomingActivities = findUpcomingActivities(trip);

  return (
    <>
      <header className="top">
        <div className="topbar">
          <a href="/" className="brand" style={{ textDecoration: "none" }}>
            <img src="/logo.png" alt="TripAmi" className="brand-logo-img" />
          </a>
          <span className="signin-btn" style={{ background: "var(--teal)", borderColor: "var(--teal)" }}>
            {memberCount} traveler{memberCount === 1 ? "" : "s"} in this group
          </span>
        </div>
      </header>

      <section className="hero wrap" style={{ paddingBottom: 20 }}>
        <div className="eyebrow-plain">A group trip on TripAmi</div>
        {trip.booked ? (
          <>
            <h1>🎉 All Aboard!</h1>
            <p className="lede">{trip.origin} → {trip.destination} · {trip.departDate} to {trip.returnDate} — it's booked, this trip is happening.</p>
          </>
        ) : (
          <>
            <h1>{trip.destination} — group plan</h1>
            <p className="lede">{trip.origin} → {trip.destination} · {trip.departDate} to {trip.returnDate}</p>
          </>
        )}
        {!user && (
          <div className="demo-note" style={{ marginTop: 16, maxWidth: 480 }}>
            Sign in on the main site to RSVP, post updates, or share your location — you can still view everything without signing in.
          </div>
        )}
        {trip.rosterSnapshot && (
          <p className="pref-hint" style={{ marginTop: 10 }}>
            From "{trip.rosterSnapshot.name}" — {trip.rosterSnapshot.total} total ({trip.rosterSnapshot.adults} adults, {trip.rosterSnapshot.children} children), {trip.memberIds?.length || 1} chatting here.
          </p>
        )}
        {user && !trip.booked && (
          <button className="book-btn secondary" style={{ marginTop: 16 }} onClick={handleMarkBooked} disabled={markingBooked}>
            {markingBooked ? "Marking…" : "Mark this trip as booked ✓"}
          </button>
        )}
        {user && !trip.booked && (
          <p className="pref-hint" style={{ marginTop: 8, maxWidth: 480 }}>
            We can't detect a real booking automatically — flights and hotels are booked on the airline/hotel's own site, not here. This is a self-reported flag once everyone's actually checked out.
          </p>
        )}
      </section>

      {/* ---------- Chat & upcoming activity reminders ---------- */}
      <section className="panel wrap" style={{ paddingBottom: 24 }}>
        <div className="panel-head">
          <div>
            <h2 style={{ fontSize: "1.4rem" }}>Let's get this Trip Started 🎉</h2>
            <p>Chat with the group, and see what's coming up next.</p>
          </div>
        </div>

        {upcomingActivities.length > 0 && (
          <div className="reminder-banner">
            <strong>Coming up:</strong>{" "}
            {upcomingActivities.map((a, i) => (
              <span key={i}>
                {a.name} {a.hoursUntil < 1.5 ? "starting soon" : `in about ${Math.round(a.hoursUntil)}h`}
                {i < upcomingActivities.length - 1 ? " · " : ""}
              </span>
            ))}
            <p className="pref-hint" style={{ marginTop: 6 }}>
              This only shows while someone has this page open — real push or email reminders while the app is closed need backend infrastructure that isn't built yet.
            </p>
          </div>
        )}

        {user ? (
          <>
            <div className="group-chat-thread">
              {messages.length === 0 && <p className="pref-hint">No messages yet — say hi to the group.</p>}
              {messages.map((m) => (
                <div key={m.id} className={`group-chat-msg ${m.senderId === user.uid ? "mine" : ""}`}>
                  <div className="group-chat-sender">{m.senderId === user.uid ? "You" : m.senderName}</div>
                  <div className="group-chat-bubble">{m.text}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                type="text"
                placeholder="Message the group…"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", fontSize: "0.9rem" }}
              />
              <button className="book-btn" type="submit" style={{ margin: 0 }}>Send</button>
            </form>
          </>
        ) : (
          <p className="pref-hint">Sign in on the main site to join the chat.</p>
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
        Planned with TripAmi — <a href="/" style={{ color: "var(--teal)" }}>plan your own trip</a>.
      </footer>
    </>
  );
}
