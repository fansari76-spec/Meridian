// src/components/TripHealthDashboard.jsx
//
// "My Trip Health" — real activity stats (steps, distance, floors,
// calories) via a connected Google Health account, viewable Daily /
// Weekly / Trip-wide, plus a group leaderboard (still demo/preview
// for now — that needs every group member connected individually).
//
// Falls back to clearly-labeled sample data whenever there's no
// connected account yet, so the page is never blank — same honest-
// demo-mode pattern used everywhere else in this app.

import { useState, useEffect } from "react";
import { useHealthConnect } from "../lib/useHealthConnect.js";

const VIEW_OPTIONS = ["Daily", "Weekly", "Trip"];

const DEMO_DATA = {
  Daily: { dayLabel: "Day 3 in Lisbon", steps: 14200, stepGoal: 10000, distanceMiles: 6.1, distanceTrend: 12, floors: 12, floorsTrend: -3, calories: 620, caloriesTrend: 8, activeMinutes: 94, activeMinutesTrend: 15 },
  Weekly: { dayLabel: "This week in Lisbon", steps: 68400, stepGoal: 70000, distanceMiles: 29.3, distanceTrend: 6, floors: 58, floorsTrend: 4, calories: 3140, caloriesTrend: 2, activeMinutes: 412, activeMinutesTrend: 9 },
  Trip: { dayLabel: "Whole trip, Portugal", steps: 112900, stepGoal: 100000, distanceMiles: 48.8, distanceTrend: 18, floors: 96, floorsTrend: 22, calories: 5280, caloriesTrend: 11, activeMinutes: 690, activeMinutesTrend: 14 },
};

const DEMO_LEADERBOARD = [
  { name: "You", steps: 14200, initial: "F" },
  { name: "Amina", steps: 13400, initial: "A" },
  { name: "Deniz", steps: 11100, initial: "D" },
  { name: "Priya", steps: 9800, initial: "P" },
];

const MEDALS = ["🥇", "🥈", "🥉"];
const STEP_GOAL_DEFAULT = 10000;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Defensive parsing — the Google Health API's exact response shape
// for dailyRollup isn't something we can fully verify without a real
// connected account to test against, so this tries the documented
// field names and falls back gracefully rather than crashing the
// whole dashboard if a field is named slightly differently than
// expected.
// Real Google Health dailyRollUp response shape (per official docs):
// { "dailyRollupDataPoints": [ { "steps": { "countSum": "41" } }, ... ] }
// — the value is nested under the data type's own field name, and
// each metric uses its own value key (countSum for steps/floors,
// metersSum for distance, kcalSum for calories). This tries the
// documented shape first and falls back defensively in case Google
// adjusts field names as this API matures.
function sumRollup(rollupResponse, dataTypeKey, valueKeys) {
  if (!rollupResponse) return 0;
  const entries = rollupResponse.dailyRollupDataPoints || rollupResponse.rollupDataPoints || rollupResponse.dailyRollup || [];
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((sum, entry) => {
    const nested = entry?.[dataTypeKey] || entry?.value || entry || {};
    let val = 0;
    for (const key of valueKeys) {
      if (nested[key] != null) {
        val = nested[key];
        break;
      }
    }
    return sum + (Number(val) || 0);
  }, 0);
}

function StepRing({ steps, goal }) {
  const [animatedPct, setAnimatedPct] = useState(0);
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const targetPct = Math.min(steps / goal, 1);
  const goalHit = steps >= goal;

  useEffect(() => {
    setAnimatedPct(0);
    const t = setTimeout(() => setAnimatedPct(targetPct), 80);
    return () => clearTimeout(t);
  }, [steps, goal, targetPct]);

  const offset = circumference * (1 - animatedPct);
  const size = 200;
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={goalHit ? "var(--gold)" : "var(--teal)"} />
          <stop offset="100%" stopColor={goalHit ? "var(--gold-light)" : "var(--teal-light)"} />
        </linearGradient>
      </defs>
      <circle cx={center} cy={center} r={radius} fill="none" strokeWidth="20" style={{ stroke: "var(--paper-dim)" }} />
      <circle
        cx={center} cy={center} r={radius} fill="none" strokeWidth="20" strokeLinecap="round"
        style={{ stroke: "url(#ringGradient)", strokeDasharray: circumference, strokeDashoffset: offset, transform: "rotate(-90deg)", transformOrigin: `${center}px ${center}px`, transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
      <text x={center} y={center - 6} textAnchor="middle" style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: "34px", fill: "var(--ink)" }}>{steps.toLocaleString()}</text>
      <text x={center} y={center + 18} textAnchor="middle" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fill: "var(--indigo)" }}>of {goal.toLocaleString()} steps</text>
    </svg>
  );
}

function TrendBadge({ trend }) {
  if (trend == null) return null;
  const up = trend >= 0;
  return <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.72rem", fontWeight: 600, color: up ? "var(--teal)" : "var(--gold)", marginLeft: 6 }}>{up ? "↑" : "↓"} {Math.abs(trend)}%</span>;
}

function StatTile({ icon, label, value, unit, trend }) {
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--paper-dim)", borderRadius: 14, padding: "12px 14px", flex: "1 1 130px", textAlign: "center" }}>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.78rem", color: "var(--indigo)", marginBottom: 4 }}><span style={{ marginRight: 5 }}>{icon}</span>{label}</div>
      <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: "1.3rem", color: "var(--ink)" }}>
        {value}<span style={{ fontFamily: "Inter, sans-serif", fontWeight: 400, fontSize: "0.85rem", color: "var(--indigo)", marginLeft: 4 }}>{unit}</span>
        <TrendBadge trend={trend} />
      </div>
    </div>
  );
}

function RouteMapPlaceholder() {
  return (
    <div style={{ position: "relative", borderRadius: 14, padding: "26px 20px", textAlign: "center", overflow: "hidden", background: "linear-gradient(135deg, var(--teal-light), var(--gold-light))", border: "1px solid var(--paper-dim)", marginBottom: 20 }}>
      <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, opacity: 0.35 }} viewBox="0 0 800 160" preserveAspectRatio="none">
        <path d="M 0 120 Q 100 40, 200 90 T 400 70 T 600 110 T 800 50" fill="none" stroke="var(--indigo)" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
      </svg>
      <div style={{ position: "relative" }}>
        <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--ink)", marginBottom: 6 }}>Route map coming soon</div>
        <p className="pref-hint" style={{ maxWidth: 420, margin: "0 auto" }}>Tracked walks, runs, and hikes recorded as workouts will show here as a real map in a future update.</p>
      </div>
    </div>
  );
}

export default function TripHealthDashboard({ user }) {
  const { checkStatus, startConnect, disconnectAccount, fetchActivity, loading: fetchLoading, error: fetchError } = useHealthConnect();
  const [view, setView] = useState("Daily");
  const [connected, setConnected] = useState(null); // null = still checking
  const [realData, setRealData] = useState(null);
  const [connectMessage, setConnectMessage] = useState("");

  // Handle the ?health_connect=success|error redirect from the OAuth callback.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("health_connect");
    if (result === "success") {
      setConnectMessage("Connected ✓ — pulling your real activity data now…");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (result === "error") {
      const reason = params.get("reason") || "unknown";
      setConnectMessage(`Couldn't connect Google Health (${reason}). Try again, or make sure your account is added as a test user in Google Cloud Console.`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setConnected(false);
      return;
    }
    checkStatus(user.uid).then(setConnected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!connected || !user) return;
    const ranges = { Daily: [todayStr(), todayStr()], Weekly: [daysAgoStr(6), todayStr()], Trip: [daysAgoStr(29), todayStr()] };
    const [startDate, endDate] = ranges[view];
    fetchActivity(user.uid, startDate, endDate).then((data) => {
      if (data) setRealData(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, view, user]);

  const usingReal = connected && realData;
  const data = usingReal
    ? {
        dayLabel: view === "Daily" ? "Today" : view === "Weekly" ? "Last 7 days" : "Last 30 days",
        steps: sumRollup(realData.steps, "steps", ["countSum", "count"]),
        stepGoal: STEP_GOAL_DEFAULT * (view === "Weekly" ? 7 : view === "Trip" ? 30 : 1),
        distanceMiles: Math.round((sumRollup(realData.distance, "distance", ["metersSum", "meters"]) / 1609.34) * 10) / 10,
        distanceTrend: null,
        floors: sumRollup(realData.floors, "floors", ["countSum", "count"]),
        floorsTrend: null,
        calories: Math.round(sumRollup(realData.calories, "totalCalories", ["kcalSum", "kcal"])),
        caloriesTrend: null,
        activeMinutes: 0,
        activeMinutesTrend: null,
      }
    : DEMO_DATA[view];

  const sortedLeaderboard = [...DEMO_LEADERBOARD].sort((a, b) => b.steps - a.steps);
  const leader = sortedLeaderboard[0];
  const goalHit = data.steps >= data.stepGoal;
  const youIndex = sortedLeaderboard.findIndex((p) => p.name === "You");
  const personAhead = youIndex > 0 ? sortedLeaderboard[youIndex - 1] : null;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {connected === false && (
        <div style={{ background: "var(--teal-light)", border: "1px solid var(--teal)", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, marginBottom: 6 }}>Connect your Google Health account</div>
          <p className="pref-hint" style={{ marginBottom: 12 }}>
            See your real steps, distance, floors, and calories for this trip instead of the sample numbers below. Requires a Fitbit, Pixel Watch, or the Google Health app tracking your activity.
          </p>
          <button className="book-btn" onClick={() => user && startConnect(user.uid)} disabled={!user}>
            Connect Google Health →
          </button>
          {!user && <p className="pref-hint" style={{ marginTop: 8 }}>Sign in first (Account tab) to connect.</p>}
        </div>
      )}

      {connected === true && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span className="pref-hint">✓ Google Health connected</span>
          <button className="book-btn secondary" style={{ margin: 0, padding: "6px 14px", fontSize: "0.8rem" }} onClick={() => user && disconnectAccount(user.uid).then(() => setConnected(false))}>
            Disconnect
          </button>
        </div>
      )}

      {connectMessage && <p className="pref-hint" style={{ marginBottom: 16 }}>{connectMessage}</p>}
      {fetchError && <p className="pref-hint" style={{ marginBottom: 16, color: "var(--gold)" }}>{fetchError}</p>}

      <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--paper-dim)", borderRadius: 999, marginBottom: 16 }}>
        {VIEW_OPTIONS.map((opt) => (
          <button key={opt} onClick={() => setView(opt)} style={{ border: "none", borderRadius: 999, padding: "8px 20px", fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", background: view === opt ? "var(--indigo)" : "transparent", color: view === opt ? "var(--paper)" : "var(--ink)" }}>
            {opt}
          </button>
        ))}
      </div>

      {fetchLoading && <p className="pref-hint" style={{ marginBottom: 16 }}>Loading your real activity data…</p>}

      {!usingReal && (
        <p className="pref-hint" style={{ marginBottom: 16 }}>
          {connected === false ? "Preview — sample data shown below." : ""}
        </p>
      )}

      {goalHit && (
        <div style={{ background: "var(--gold-light)", border: "1px solid var(--gold)", borderRadius: 12, padding: "10px 16px", marginBottom: 16, fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)", textAlign: "center" }}>
          🎉 Goal smashed! +{(data.steps - data.stepGoal).toLocaleString()} steps over target.
        </div>
      )}

      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <StepRing steps={data.steps} goal={data.stepGoal} />
        <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "1.1rem", color: "var(--ink)", marginTop: 6 }}>{data.dayLabel}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <StatTile icon="📏" label="Distance" value={data.distanceMiles} unit="mi" trend={data.distanceTrend} />
        <StatTile icon="🏢" label="Floors climbed" value={data.floors} unit="floors" trend={data.floorsTrend} />
        <StatTile icon="🔥" label="Calories" value={data.calories.toLocaleString()} unit="kcal" trend={data.caloriesTrend} />
        <StatTile icon="⏱️" label="Active time" value={data.activeMinutes} unit="min" trend={data.activeMinutesTrend} />
      </div>

      <RouteMapPlaceholder />

      <div>
        <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, fontSize: "0.95rem", color: "var(--ink)", marginBottom: 4 }}>Trip crew — {leader.name} is leading <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "var(--indigo)" }}>(preview)</span></div>
        {personAhead && (
          <p className="pref-hint" style={{ marginBottom: 10, fontSize: "0.82rem" }}>
            Beat {personAhead.name} by {(personAhead.steps - DEMO_LEADERBOARD.find((p) => p.name === "You").steps + 1).toLocaleString()} steps — you've got this!
          </p>
        )}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {sortedLeaderboard.map((person, i) => {
            const barPct = Math.round((person.steps / leader.steps) * 100);
            return (
              <div key={person.name} style={{ flex: "0 0 auto", width: 108, background: i === 0 ? "var(--gold-light)" : "var(--paper)", border: `1px solid ${i === 0 ? "var(--gold)" : "var(--paper-dim)"}`, borderRadius: 12, padding: 10, textAlign: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--indigo)", color: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: "0.8rem", margin: "0 auto 6px", position: "relative" }}>
                  {person.initial}
                  {MEDALS[i] && <span style={{ position: "absolute", top: -12, fontSize: "0.9rem" }}>{MEDALS[i]}</span>}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.78rem", color: "var(--ink)" }}>{person.name}</div>
                <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "var(--teal)", marginBottom: 5 }}>{person.steps.toLocaleString()}</div>
                <div style={{ height: 4, borderRadius: 2, background: "var(--paper-dim)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${barPct}%`, background: i === 0 ? "var(--gold)" : "var(--teal)", borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button className="book-btn" disabled style={{ marginTop: 24 }}>Share to Group Chat →</button>
      <p className="pref-hint" style={{ marginTop: 16 }}>
        Trip crew leaderboard is still preview data — real group comparison needs everyone in the group to connect their own account (coming later).
      </p>
    </div>
  );
}
