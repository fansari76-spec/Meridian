// src/pages/SharedTripPage.jsx
//
// Public, read-only view of a shared trip at /trip/:id. No sign-in
// required. Reuses the same CSS classes as the main app so a shared
// trip looks like a natural extension of the product, not a
// stripped-down export.

import { useEffect, useState } from "react";
import { getSharedTrip } from "../lib/sharedTrips.js";

const PERIOD_LABELS = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const PERIOD_ORDER = ["morning", "afternoon", "evening", "unscheduled"];

function groupByPeriod(activities) {
  const buckets = { morning: [], afternoon: [], evening: [], unscheduled: [] };
  for (const a of activities || []) {
    const key = PERIOD_LABELS[a.period] ? a.period : "unscheduled";
    buckets[key].push(a);
  }
  return PERIOD_ORDER.filter((k) => buckets[k].length > 0).map((k) => [k, buckets[k]]);
}

export default function SharedTripPage({ tripId }) {
  const [trip, setTrip] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | notfound | error

  useEffect(() => {
    getSharedTrip(tripId)
      .then((data) => {
        if (!data) setStatus("notfound");
        else {
          setTrip(data);
          setStatus("ok");
        }
      })
      .catch(() => setStatus("error"));
  }, [tripId]);

  if (status === "loading") {
    return (
      <div className="wrap" style={{ padding: "100px 28px", textAlign: "center", color: "#5A5F68" }}>
        <span className="spinner" style={{ marginRight: 10 }} />
        Loading trip…
      </div>
    );
  }

  if (status === "notfound" || status === "error") {
    return (
      <div className="wrap" style={{ padding: "100px 28px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: "1.6rem" }}>
          {status === "notfound" ? "Trip not found" : "Something went wrong"}
        </h2>
        <p style={{ color: "#5A5F68", marginTop: 8 }}>
          {status === "notfound" ? "This link may be broken, or the trip was removed." : "Try refreshing the page."}
        </p>
        <a className="book-btn" style={{ marginTop: 20, display: "inline-block" }} href="/">
          Plan your own trip →
        </a>
      </div>
    );
  }

  return (
    <>
      <header className="top">
        <div className="topbar">
          <a href="/" className="brand" style={{ textDecoration: "none" }}>
            <span className="brand-mark" />Meridian
          </a>
          <a className="signin-btn" href={`/?duplicate=${trip.id}`}>
            Plan your own trip →
          </a>
        </div>
      </header>

      <section className="hero wrap" style={{ paddingBottom: 20 }}>
        <div className="eyebrow-plain">A trip planned on Meridian</div>
        <h1>{trip.destination} trip</h1>
        <p className="lede">
          {trip.origin} → {trip.destination} · {trip.departDate} to {trip.returnDate} ·{" "}
          {trip.travelers} traveler{trip.travelers > 1 ? "s" : ""}
        </p>
      </section>

      {trip.budget && (
        <section className="panel wrap">
          <div className="panel-head">
            <div>
              <h2>Budget</h2>
              <p>What this trip is estimated to cost.</p>
            </div>
          </div>
          <div className="budget-grid">
            <div>
              {trip.budget.lines?.map((line) => (
                <div className="budget-line" key={line.key}>
                  <div className="budget-cat">
                    <span className="cat-dot" style={{ background: line.color }} />
                    {line.label}
                  </div>
                  <div className="budget-amt">${line.amount?.toLocaleString?.() ?? line.amount}</div>
                </div>
              ))}
            </div>
            <div className="budget-total">
              <div className="label">
                Estimated total, {trip.travelers} traveler{trip.travelers > 1 ? "s" : ""}
              </div>
              <div className="num">${trip.budget.total?.toLocaleString?.() ?? trip.budget.total}</div>
              <div className="per-person">≈ ${trip.budget.perPerson?.toLocaleString?.() ?? trip.budget.perPerson} per person</div>
            </div>
          </div>
        </section>
      )}

      {trip.itineraryPlan?.length > 0 && (
        <section className="panel wrap">
          <div className="panel-head">
            <div>
              <h2>Day-by-day plan</h2>
              <p>The itinerary for this trip.</p>
            </div>
          </div>
          <div className="itinerary">
            {trip.itineraryPlan.map((day) => (
              <div className="day-block" key={day.dayNumber}>
                <div className="day-title">Day {day.dayNumber}</div>
                {groupByPeriod(day.activities).map(([period, acts]) => (
                  <div key={period} className="period-group">
                    {period !== "unscheduled" && <div className="period-label">{PERIOD_LABELS[period] || period}</div>}
                    {acts.map((a, i) => (
                      <div className="activity" key={i}>
                        <div className="activity-time">{a.time}</div>
                        <div style={{ flex: 1 }}>
                          <div className="activity-name-row">
                            <div className="activity-name">
                              {a.category === "food" ? "🍽️ " : a.category === "activity" ? "🎟️ " : ""}
                              {a.name}
                            </div>
                            {Number(a.cost) > 0 ? (
                              <span className="activity-cost">${a.cost}/pp</span>
                            ) : (
                              <span className="activity-cost activity-cost--free">Free</span>
                            )}
                          </div>
                          <div className="activity-desc">{a.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <a className="book-btn" style={{ marginTop: 24, display: "inline-block" }} href={`/?duplicate=${trip.id}`}>
            Duplicate this trip and customize it →
          </a>
        </section>
      )}

      <footer>
        Planned with Meridian — <a href="/" style={{ color: "var(--teal)" }}>plan your own trip</a>.
      </footer>
    </>
  );
}
