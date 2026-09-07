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

import { useState, useEffect } from "react";

const VIEW_OPTIONS = ["Daily", "Weekly", "Trip"];

// Sample data — shaped like what the real API will eventually return,
// so swapping in live data later is a data-source change, not a
// redesign. "trend" is the % change vs the prior comparable period,
// purely illustrative until real history exists.
const DEMO_DATA = {
  Daily: {
    dayLabel: "Day 3 in Lisbon",
    steps: 14200,
    stepGoal: 10000,
    distanceKm: 9.8,
    distanceTrend: 12,
    floors: 12,
    floorsTrend: -3,
    calories: 620,
    caloriesTrend: 8,
    activeMinutes: 94,
    activeMinutesTrend: 15,
  },
  Weekly: {
    dayLabel: "This week in Lisbon",
    steps: 68400,
    stepGoal: 70000,
    distanceKm: 47.2,
    distanceTrend: 6,
    floors: 58,
    floorsTrend: 4,
    calories: 3140,
    caloriesTrend: 2,
    activeMinutes: 412,
    activeMinutesTrend: 9,
  },
  Trip: {
    dayLabel: "Whole trip, Portugal",
    steps: 112900,
    stepGoal: 100000,
    distanceKm: 78.6,
    distanceTrend: 18,
    floors: 96,
    floorsTrend: 22,
    calories: 5280,
    caloriesTrend: 11,
    activeMinutes: 690,
    activeMinutesTrend: 14,
  },
};

const DEMO_LEADERBOARD = [
  { name: "You", steps: 14200, initial: "F" },
  { name: "Amina", steps: 13400, initial: "A" },
  { name: "Deniz", steps: 11100, initial: "D" },
  { name: "Priya", steps: 9800, initial: "P" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

function StepRing({ steps, goal }) {
  const [animatedPct, setAnimatedPct] = useState(0);
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const targetPct = Math.min(steps / goal, 1);
  const goalHit = steps >= goal;

  useEffect(() => {
    setAnimatedPct(0);
    const t = setTimeout(() => setAnimatedPct(targetPct), 80);
    return () => clearTimeout(t);
  }, [steps, goal, targetPct]);

  const offset = circumference * (1 - animatedPct);

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={goalHit ? "var(--gold)" : "var(--teal)"} />
          <stop offset="100%" stopColor={goalHit ? "var(--gold-light)" : "var(--teal-light)"} />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r={radius} fill="none" strokeWidth="16" style={{ stroke: "var(--paper-dim)" }} />
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        strokeWidth="16"
        strokeLinecap="round"
        style={{
          stroke: "url(#ringGradient)",
          strokeDasharray: circumference,
          strokeDashoffset: offset,
          transform: "rotate(-90deg)",
          transformOrigin: "100px 100px",
          transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)",
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

function TrendBadge({ trend }) {
  const up = trend >= 0;
  return (
    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.72rem", fontWeight: 600, color: up ? "var(--teal)" : "var(--gold)", marginLeft: 6 }}>
      {up ? "↑" : "↓"} {Math.abs(trend)}%
    </span>
  );
}

function StatTile({ icon, label, value, unit, trend, size = "secondary" }) {
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
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.78rem", color: "var(--indigo)", marginBottom: 4 }}>
        <span style={{ marginRight: 5 }}>{icon}</span>
        {label}
      </div>
      <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: isPrimarySize ? "1.7rem" : "1.3rem", color: "var(--ink)" }}>
        {value}
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 400, fontSize: "0.85rem", color: "var(--indigo)", marginLeft: 4 }}>{unit}</span>
        <TrendBadge trend={trend} />
      </div>
    </div>
  );
}

function RouteMapPlaceholder() {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 14,
        padding: "40px 20px",
        textAlign: "center",
        overflow: "hidden",
        background: "linear-gradient(135deg, var(--teal-light), var(--gold-light))",
        border: "1px solid var(--paper-dim)",
        marginBottom: 28,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0, opacity: 0.35 }}
        viewBox="0 0 800 160"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 120 Q 100 40, 200 90 T 400 70 T 600 110 T 800 50"
          fill="none"
          stroke="var(--indigo)"
          strokeWidth="3"
          strokeDasharray="2 10"
          strokeLinecap="round"
        />
      </svg>
      <div style={{ position: "relative" }}>
        <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--ink)", marginBottom: 6 }}>
          Route map coming with real data
        </div>
        <p className="pref-hint" style={{ maxWidth: 420, margin: "0 auto" }}>
          Once connected, your tracked walks, runs, and hikes during this trip will show here as a real map.
        </p>
      </div>
    </div>
  );
}

export default function TripHealthDashboard() {
  const [view, setView] = useState("Daily");
  const data = DEMO_DATA[view];
  const sortedLeaderboard = [...DEMO_LEADERBOARD].sort((a, b) => b.steps - a.steps);
  const leader = sortedLeaderboard[0];
  const goalHit = data.steps >= data.stepGoal;

  const youIndex = sortedLeaderboard.findIndex((p) => p.name === "You");
  const personAhead = youIndex > 0 ? sortedLeaderboard[youIndex - 1] : null;

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

      {goalHit && (
        <div
          style={{
            background: "var(--gold-light)",
            border: "1px solid var(--gold)",
            borderRadius: 12,
            padding: "10px 16px",
            marginBottom: 20,
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            fontSize: "0.9rem",
            color: "var(--ink)",
          }}
        >
          🎉 Goal smashed! +{(data.steps - data.stepGoal).toLocaleString()} steps over target.
        </div>
      )}

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center", marginBottom: 28 }}>
        <div style={{ textAlign: "center" }}>
          <StepRing steps={data.steps} goal={data.stepGoal} />
          <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "1.1rem", color: "var(--ink)", marginTop: 4 }}>{data.dayLabel}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, flex: 1, minWidth: 260 }}>
          <StatTile icon="📏" label="Distance" value={data.distanceKm} unit="km" trend={data.distanceTrend} size="primary" />
          <StatTile icon="🏢" label="Floors climbed" value={data.floors} unit="floors" trend={data.floorsTrend} />
          <StatTile icon="🔥" label="Calories" value={data.calories.toLocaleString()} unit="kcal" trend={data.caloriesTrend} />
          <StatTile icon="⏱️" label="Active time" value={data.activeMinutes} unit="min" trend={data.activeMinutesTrend} />
        </div>
      </div>

      <RouteMapPlaceholder />

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "1.1rem", color: "var(--ink)", marginBottom: 4 }}>
          Trip crew — {leader.name} is leading
        </div>
        {personAhead && (
          <p className="pref-hint" style={{ marginBottom: 12 }}>
            Beat {personAhead.name} by {(personAhead.steps - DEMO_LEADERBOARD.find((p) => p.name === "You").steps + 1).toLocaleString()} steps — you've got this!
          </p>
        )}
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {sortedLeaderboard.map((person, i) => {
            const barPct = Math.round((person.steps / leader.steps) * 100);
            return (
              <div
                key={person.name}
                style={{
                  flex: "0 0 auto",
                  width: 150,
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
                  {MEDALS[i] && <span style={{ position: "absolute", top: -16, fontSize: "1.2rem" }}>{MEDALS[i]}</span>}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)" }}>{person.name}</div>
                <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--teal)", marginBottom: 6 }}>
                  {person.steps.toLocaleString()}
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "var(--paper-dim)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${barPct}%`, background: i === 0 ? "var(--gold)" : "var(--teal)", borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
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
