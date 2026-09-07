// server/routes/itineraryAdjust.js
//
// POST /api/itinerary/adjust-day
// body: { destination, dayNumber, originalActivities, weatherSummary, interests, cuisine }
//
// Powers "Living Itinerary" — when someone returns to a Saved Trip
// while it's actually happening and the weather has turned bad for a
// day that was planned assuming good weather, this regenerates just
// THAT day's activities as sensible weather-appropriate alternatives,
// leaving every other day of the trip untouched.
//
// Reuses the same real-web-search grounding and JSON extraction as
// full itinerary generation, so replacement activities are just as
// factually grounded as the original plan — not a lower-quality
// fallback just because it's a smaller, faster request.

import express from "express";
import { extractJsonArray } from "../lib/extractJson.js";

const router = express.Router();

function isLiveMode() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

router.post("/adjust-day", async (req, res) => {
  const { destination, dayNumber, originalActivities = [], weatherSummary, interests = [], cuisine = null } = req.body;

  if (!destination || !weatherSummary) {
    return res.status(400).json({ error: "destination and weatherSummary are required." });
  }

  if (!isLiveMode()) {
    return res.status(200).json({
      success: false,
      error: "Living itinerary adjustments need ANTHROPIC_API_KEY connected. See README.md.",
    });
  }

  try {
    const activities = await adjustDayWithClaude({ destination, dayNumber, originalActivities, weatherSummary, interests, cuisine });
    return res.json({ success: true, activities });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ success: false, error: `Couldn't adjust today's plan: ${err.message}` });
  }
});

async function adjustDayWithClaude({ destination, dayNumber, originalActivities, weatherSummary, interests, cuisine }) {
  const originalSummary = originalActivities
    .map((a) => `- ${a.time} (${a.period}): ${a.name} — ${a.desc}${a.category === "free" ? " [outdoor/free]" : ""}`)
    .join("\n");

  const prompt = `A traveler in ${destination} had this day planned (Day ${dayNumber} of their trip):
${originalSummary || "(no activities recorded for this day)"}

The actual weather today is: ${weatherSummary}

This weather makes some of the above a bad idea (e.g. outdoor walks, viewpoints, anything better enjoyed in good weather). Build a REPLACEMENT plan for today that keeps the same overall interests and spirit of the day, but swaps anything weather-vulnerable for genuinely good indoor or weather-appropriate alternatives — real, specific places in ${destination}, not vague filler like "explore indoors."

Traveler's stated interests: ${interests.length ? interests.join(", ") : "no strong preference"}.
Cuisine preference: ${cuisine || "none specified"}.

Use web search to verify any specific named place is real and currently operating.

Respond with ONLY a JSON array (no markdown fences, no preamble) of activities for this one day, in this exact shape:
[
  {
    "time": "9:00a",
    "period": "morning",
    "name": "Short activity name",
    "desc": "One sentence description, specific to ${destination}.",
    "tag": "one of the traveler's interest keywords or null",
    "category": "food | activity | free",
    "cost": 0
  }
]

Rules:
- Cover morning, afternoon, and evening, matching roughly the same number of activities as the original day.
- "cost" is your best-effort estimate in whole US dollars, per person.
- Keep descriptions to one sentence each, using real, specific, currently-operating places.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);

  const json = await response.json();
  const text = json.content?.map((block) => block.text || "").join("") || "";
  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) throw new Error("Unexpected shape from Claude");
  return parsed;
}

export default router;
