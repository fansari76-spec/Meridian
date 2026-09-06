// server/routes/destinationRecommender.js
//
// POST /api/destinations/recommend
// body: { budgetStyle, month, region, interests, cuisine, travelParty, pace, dietaryRestrictions }
//
// For "I don't know where to go" — suggests 3-4 real destinations
// matched to budget, season, interests, and travel party, instead of
// requiring the traveler to already have a destination in mind.
//
// Uses the same real-web-search grounding as itinerary generation, so
// "best time to visit" claims and cost tiers are checked against
// current information rather than pure model recall — the same fix
// we just applied after finding hallucinated venue details.
//
// If ANTHROPIC_API_KEY isn't set, falls back to a small fixed list of
// well-known destinations (clearly not personalized) so the feature
// is still clickable with zero setup, matching every other
// integration's honest-fallback pattern in this app.

import express from "express";
import { extractJsonArray } from "../lib/extractJson.js";

const router = express.Router();

function isLiveMode() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

router.post("/recommend", async (req, res) => {
  const {
    budgetStyle = null,
    month = null,
    region = "Anywhere",
    continents = [],
    interests = [],
    cuisine = null,
    travelParty = null,
    pace = null,
    dietaryRestrictions = [],
  } = req.body;

  try {
    if (isLiveMode()) {
      const destinations = await recommendWithClaude({ budgetStyle, month, region, continents, interests, cuisine, travelParty, pace, dietaryRestrictions });
      return res.json({ destinations, usedAI: true });
    }
    return res.json({ destinations: fallbackDestinations(), usedAI: false });
  } catch (err) {
    console.error(err);
    return res.json({
      destinations: fallbackDestinations(),
      usedAI: false,
      warning: `AI recommendation failed (${err.message}), showing general picks instead.`,
    });
  }
});

async function recommendWithClaude({ budgetStyle, month, region, continents, interests, cuisine, travelParty, pace, dietaryRestrictions }) {
  const prompt = buildPrompt({ budgetStyle, month, region, continents, interests, cuisine, travelParty, pace, dietaryRestrictions });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);

  const json = await response.json();
  const text = json.content?.map((block) => block.text || "").join("") || "";
  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) throw new Error("Unexpected recommendation shape from Claude");
  return parsed;
}

function buildPrompt({ budgetStyle, month, region, continents = [], interests, cuisine, travelParty, pace, dietaryRestrictions }) {
  const isDomestic = region === "Domestic (US) only";
  const continentConstraint = !isDomestic && continents.length
    ? `Only suggest destinations on these continents: ${continents.join(", ")}.`
    : !isDomestic
      ? `No continent restriction — actively spread the picks across at least 4 different continents/regions of the world. Do not cluster them in one part of the globe.`
      : "";

  return `Recommend 5-6 real, specific travel destinations for someone who doesn't know where to go yet.

Budget style: ${budgetStyle || "no strong preference"}.
Travel timing: ${month || "flexible, no specific month"}.
Region preference: ${region}.
${continentConstraint}
Stated interests: ${interests.length ? interests.join(", ") : "no strong preference, suggest a good variety"}.
Cuisine preference: ${cuisine || "none specified"}.
${travelParty ? `Traveling as: ${travelParty} — factor this into suitability.` : ""}
${pace ? `Preferred pace: ${pace}.` : ""}
${dietaryRestrictions?.length ? `Dietary restrictions to consider for food-culture fit: ${dietaryRestrictions.join(", ")}.` : ""}

Use web search to verify facts, and prioritize TIMING, not just avoiding a bad season: for the stated travel timing, actively favor destinations that have a genuine, specific reason to visit right then — a festival, a weather sweet spot, shoulder-season pricing, a seasonal natural event (cherry blossoms, fall color, dry season, etc.) — over destinations that are merely "fine" then. If a destination is only mediocre for the stated timing, leave it out even if it would otherwise fit the other criteria. Do not invent specific prices — use only a rough cost tier.

Respond with ONLY a JSON array (no markdown fences, no preamble), in this exact shape:
[
  {
    "name": "City, Country",
    "airportCode": "3-letter IATA code of that city's main international airport, verified via search",
    "matchReason": "1-2 sentences on why this fits what they asked for, specific to their actual inputs, not generic.",
    "bestTimeToVisit": "Real, verified best-time-to-visit window for this destination.",
    "whyNow": "1 short sentence on specifically why THIS time frame is a good one for this destination — the concrete seasonal reason, not a generic restatement of bestTimeToVisit.",
    "costTier": "$" | "$$" | "$$$",
    "highlights": ["short highlight 1", "short highlight 2", "short highlight 3"]
  }
]

Make the destinations genuinely varied from each other in vibe (not just location) — don't suggest 6 similar big cities.`;
}

function fallbackDestinations() {
  return [
    { name: "Lisbon, Portugal", airportCode: "LIS", matchReason: "A reliable pick for first-time international travelers — walkable, affordable, and welcoming.", bestTimeToVisit: "March–May or September–October", whyNow: "Shoulder season means fewer crowds and lower prices than summer.", costTier: "$$", highlights: ["Historic trams & viewpoints", "Fresh seafood", "Easy day trips to Sintra"] },
    { name: "Kyoto, Japan", airportCode: "KIX", matchReason: "For travelers wanting culture and craft over nightlife.", bestTimeToVisit: "March–April (cherry blossoms) or November (fall colors)", whyNow: "Cherry blossom and fall foliage windows are short and specific.", costTier: "$$$", highlights: ["Historic temples", "Traditional tea houses", "Bamboo groves"] },
    { name: "Mexico City, Mexico", airportCode: "MEX", matchReason: "Big-city energy with strong food culture and good value.", bestTimeToVisit: "March–May", whyNow: "Dry season with mild temperatures before summer rains.", costTier: "$", highlights: ["World-class museums", "Street food", "Vibrant neighborhoods"] },
    { name: "Queenstown, New Zealand", airportCode: "ZQN", matchReason: "For travelers who want outdoor adventure as the centerpiece of the trip.", bestTimeToVisit: "December–February (summer) or June–August (ski season)", whyNow: "Peak summer hiking or peak ski season, depending on when you go.", costTier: "$$$", highlights: ["Hiking & adventure sports", "Lake & mountain scenery", "Nearby wine country"] },
    { name: "Marrakech, Morocco", airportCode: "RAK", matchReason: "For travelers wanting a striking change of scenery and strong food culture.", bestTimeToVisit: "March–May or September–November", whyNow: "Avoids the extreme summer heat while keeping days pleasantly warm.", costTier: "$", highlights: ["Historic medina", "Souks & markets", "Day trips to the Atlas Mountains"] },
    { name: "Cape Town, South Africa", airportCode: "CPT", matchReason: "For travelers who want nature, coastline, and city in one trip.", bestTimeToVisit: "November–March", whyNow: "Southern hemisphere summer — warm, dry, and clear for coastal views.", costTier: "$$", highlights: ["Table Mountain", "Coastal drives", "Wine country nearby"] },
  ];
}

export default router;
