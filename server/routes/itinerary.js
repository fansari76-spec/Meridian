// server/routes/itinerary.js
//
// POST /api/itinerary/generate
// body: { destination, days, interests, cuisine, faithTradition }
//
// If ANTHROPIC_API_KEY is set, generates a real day-by-day plan using
// Claude, tailored to the actual destination and preferences. If no
// key is set, falls back to the rule-based template generator so the
// itinerary tab still works with zero setup.

import express from "express";

const router = express.Router();

function isLiveMode() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

router.post("/generate", async (req, res) => {
  const { destination, days = 3, interests = [], cuisine = null, faithTradition = null } = req.body;

  if (!destination) {
    return res.status(400).json({ error: "destination is required." });
  }

  try {
    if (isLiveMode()) {
      const plan = await generateWithClaude({ destination, days, interests, cuisine, faithTradition });
      return res.json({ plan, usedAI: true });
    }
    const plan = generateWithTemplates({ days, interests, cuisine });
    return res.json({ plan, usedAI: false });
  } catch (err) {
    console.error(err);
    // Fall back gracefully rather than showing the user a broken tab
    // if the Claude call fails for any reason (bad key, rate limit, etc).
    const plan = generateWithTemplates({ days, interests, cuisine });
    return res.json({ plan, usedAI: false, warning: "AI generation failed, showing a template plan instead." });
  }
});

// ---------------------------------------------------------------------
// LIVE MODE — real Claude-generated itinerary
// ---------------------------------------------------------------------

async function generateWithClaude({ destination, days, interests, cuisine, faithTradition }) {
  const prompt = buildPrompt({ destination, days, interests, cuisine, faithTradition });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);

  const json = await response.json();
  const text = json.content?.map((block) => block.text || "").join("") || "";
  const cleaned = text.replace(/```json|```/g, "").trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Unexpected itinerary shape from Claude");
  return parsed;
}

function buildPrompt({ destination, days, interests, cuisine, faithTradition }) {
  return `You are a travel planner. Build a ${days}-day itinerary for a trip to ${destination}.

Traveler's stated interests: ${interests.length ? interests.join(", ") : "no strong preference, keep it balanced"}.
Dietary/cuisine preference: ${cuisine || "none specified"}.
${faithTradition ? `This is a pilgrimage-style trip for the ${faithTradition} tradition — prioritize relevant sacred sites and be mindful of appropriate pacing and any relevant observances.` : ""}

Respond with ONLY a JSON array (no markdown fences, no preamble), one object per day, in this exact shape:
[
  {
    "dayNumber": 1,
    "activities": [
      { "time": "9:00a", "name": "Short activity name", "desc": "One sentence description, specific to ${destination}.", "tag": "one of the traveler's interest keywords or null" }
    ]
  }
]

Each day should have 2-4 activities. Use real, specific places and neighborhoods in ${destination} where you're confident they exist — don't invent implausible venues. Keep descriptions to one sentence each.`;
}

// ---------------------------------------------------------------------
// DEMO MODE — same rule-based generator used on the frontend, so
// behavior is identical whether this runs client-side or server-side.
// ---------------------------------------------------------------------

const ACTIVITY_BANK = {
  "slow-mornings": [{ time: "9:30a", name: "Late breakfast at a local café", desc: "No plans before 10 — settle in before the day starts." }],
  "food-focused": [
    { time: "1:00p", name: "Food market crawl", desc: "Sample local specialties at the city's main market." },
    { time: "8:00p", name: "Dinner at a highly-rated local spot", desc: "Matched to your cuisine preference." },
  ],
  "museums-history": [{ time: "10:00a", name: "Flagship history museum", desc: "Book the first entry slot to skip the midday lines." }],
  "live-music": [{ time: "9:00p", name: "Live music venue", desc: "Local performance — reservation recommended." }],
  "hiking-outdoors": [{ time: "8:00a", name: "Morning hike or coastal walk", desc: "Best light and cooler temps earlier in the day." }],
  nightlife: [{ time: "10:30p", name: "Rooftop bar or late spot", desc: "Popular with locals, not just tourists." }],
  shopping: [{ time: "3:00p", name: "Independent shops & design district", desc: "Skip the chain stores — local makers instead." }],
};

function generateWithTemplates({ days, interests, cuisine }) {
  const chosen = interests.length ? interests : ["slow-mornings", "food-focused"];
  const plan = [];
  for (let i = 0; i < days; i++) {
    const key = chosen[i % chosen.length];
    const activities = (ACTIVITY_BANK[key] || []).map((a) => ({ ...a, tag: key }));
    plan.push({ dayNumber: i + 1, activities: activities.length ? activities : [{ time: "Open", name: "Nothing booked yet", desc: "Select a few interests to fill this day in.", tag: null }] });
  }
  return plan;
}

export default router;
