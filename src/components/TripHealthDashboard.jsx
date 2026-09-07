// src/components/TripHealthDashboard.jsx
//
// "My Trip Health" — a dashboard of activity stats (steps, distance,
// floors, calories) for the current trip, viewable Daily / Weekly /
// Trip-wide, plus a group leaderboard to turn walking around a
// destination into a friendly competition.
//
// PREVIEW MODE: everything here is sample data. Real data requires
// connecting a Google Health account (see project notes) — that
// wiring comes in a follow-up pass once this design is approved.
// Every number here is clearly a placeholder, not a real reading.

import { useState } from "react";

const VIEW_OPTIONS = ["Daily", "Weekly", "Trip"];

// Sample data — shaped like what the real API will eventually return,
// so swapping in live data later is a data-source change, not a
// redesign.
const DEMO_DATA = {
  Daily: {
    dayLabel: "Day 3 in Lisbon",
    steps: 14200,
    stepGoal: 10000,
    distanceKm: 9.8,
    floors: 12,
    calories: 620,
    activeMinutes: 94,
  },
  Weekly: {
    dayLabel: "This week in Lisbon",
    steps: 68400,
    stepGoal: 70000,
    distanceKm: 47.2,
    floors: 58,
    calories: 3140,
    activeMinutes: 412,
  },
  Trip: {
    dayLabel: "Whole trip, Portugal",
    steps: 112900,
    stepGoal: 100000,
    distanceKm: 78.6,
    floors: 96,
    calories: 5280,
    activeMinutes: 690,
  },
};

const DEMO_LEADERBOARD = [
  { name: "You", steps: 14200, initial: "F" },
  { name: "Amina", steps: 13400, initial: "A" },
  { name: "Deniz", steps: 11100, initial: "D" },
  { name: "Priya", steps: 9800, initial: "P" },
];

function StepRing({ steps, goal }) {
  const pct = Math.min(steps / goal, 1);
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r={radius} fill="none" strokeWidth="16" style={{ stroke: "var(--paper-dim)" }} />
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        strokeWidth="16"
        strokeLinecap="round"
        style={{
          stroke: "var(--teal)",
          strokeDasharray: circumference,
          strokeDashoffset: offset,
          transform: "rotate(-90deg)",
          transformOrigin: "100px 100px",
          transition: "stroke-dashoffset 0.6s ease",
        }}
      />
      <text x="100" y="94" textAnchor="middle" style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: "34px", fill: "var(--ink)" }}>
        {steps.toLocaleString()}
      </text>
      <text x="100" y="118" textAnchor="middle" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fill: "var(--indigo)" }}>
        of {goal.toLocaleString()} steps
      </text>
    </svg>
  );
}

function StatTile({ label, value, unit, size = "secondary" }) {
  const isPrimarySize = size === "primary";
  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--paper-dim)",
        borderRadius: 14,
        padding: isPrimarySize ? "20px 22px" : "14px 16px",
        flex: isPrimarySize ? "1 1 200px" : "1 1 130px",
      }}
    >
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.78rem", color: "var(--indigo)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: isPrimarySize ? "1.7rem" : "1.3rem", color: "var(--ink)" }}>
        {value}
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 400, fontSize: "0.85rem", color: "var(--indigo)", marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  );
}

export default function TripHealthDashboard() {
  const [view, setView] = useState("Daily");
  const data = DEMO_DATA[view];
  const sortedLeaderboard = [...DEMO_LEADERBOARD].sort((a, b) => b.steps - a.steps);
  const leader = sortedLeaderboard[0];

  return (
    <div>
      <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--paper-dim)", borderRadius: 999, marginBottom: 24 }}>
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => setView(opt)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "8px 20px",
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              background: view === opt ? "var(--indigo)" : "transparent",
              color: view === opt ? "var(--paper)" : "var(--ink)",
            }}
          >
            {opt}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center", marginBottom: 28 }}>
        <div style={{ textAlign: "center" }}>
          <StepRing steps={data.steps} goal={data.stepGoal} />
          <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "1.1rem", color: "var(--ink)", marginTop: 4 }}>{data.dayLabel}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, flex: 1, minWidth: 260 }}>
          <StatTile label="Distance" value={data.distanceKm} unit="km" size="primary" />
          <StatTile label="Floors climbed" value={data.floors} unit="floors" />
          <StatTile label="Calories" value={data.calories.toLocaleString()} unit="kcal" />
          <StatTile label="Active time" value={data.activeMinutes} unit="min" />
        </div>
      </div>

      <div
        style={{
          borderRadius: 14,
          padding: "40px 20px",
          textAlign: "center",
          background: "linear-gradient(135deg, var(--teal-light), var(--gold-light))",
          border: "1px solid var(--paper-dim)",
          marginBottom: 28,
        }}
      >
        <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--ink)", marginBottom: 6 }}>
          Route map coming with real data
        </div>
        <p className="pref-hint" style={{ maxWidth: 420, margin: "0 auto" }}>
          Once connected, your tracked walks, runs, and hikes during this trip will show here as a real map.
        </p>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "1.1rem", color: "var(--ink)", marginBottom: 12 }}>
          Trip crew — {leader.name} is leading
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {sortedLeaderboard.map((person, i) => (
            <div
              key={person.name}
              style={{
                flex: "0 0 auto",
                width: 140,
                background: i === 0 ? "var(--gold-light)" : "var(--paper)",
                border: `1px solid ${i === 0 ? "var(--gold)" : "var(--paper-dim)"}`,
                borderRadius: 14,
                padding: 14,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "var(--indigo)",
                  color: "var(--paper)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Sora, sans-serif",
                  fontWeight: 700,
                  margin: "0 auto 8px",
                  position: "relative",
                }}
              >
                {person.initial}
                {i === 0 && <span style={{ position: "absolute", top: -14, fontSize: "1.1rem" }}>👑</span>}
              </div>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)" }}>{person.name}</div>
              <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--teal)" }}>{person.steps.toLocaleString()}</div>
              {i > 0 && (
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.72rem", color: "var(--indigo)" }}>
                  {(sortedLeaderboard[0].steps - person.steps).toLocaleString()} behind
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <button className="book-btn" disabled>
        Share to Group Chat →
      </button>
      <p className="pref-hint" style={{ marginTop: 16 }}>
        Preview — sample data shown above. Connecting a real Google Health account and enabling this for your group are coming in the next build pass.
      </p>
    </div>
  );
}
