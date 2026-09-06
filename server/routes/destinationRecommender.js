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

const router = express.Router();

function isLiveMode() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

router.post("/recommend", async (req, res) => {
  const {
    budgetStyle = null,
    month = null,
    region = "Anywhere",
    interests = [],
    cuisine = null,
    travelParty = null,
    pace = null,
    dietaryRestrictions = [],
  } = req.body;

  try {
    if (isLiveMode()) {
      const destinations = await recommendWithClaude({ budgetStyle, month, region, interests, cuisine, travelParty, pace, dietaryRestrictions });
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

async function recommendWithClaude({ budgetStyle, month, region, interests, cuisine, travelParty, pace, dietaryRestrictions }) {
  const prompt = buildPrompt({ budgetStyle, month, region, interests, cuisine, travelParty, pace, dietaryRestrictions });

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
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);

  const json = await response.json();
  const text = json.content?.map((block) => block.text || "").join("") || "";
  const cleaned = text.replace(/```json|```/g, "").trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Unexpected recommendation shape from Claude");
  return parsed;
}

function buildPrompt({ budgetStyle, month, region, interests, cuisine, travelParty, pace, dietaryRestrictions }) {
  return `Recommend 4 real, specific travel destinations for someone who doesn't know where to go yet.

Budget style: ${budgetStyle || "no strong preference"}.
Travel timing: ${month || "flexible, no specific month"}.
Region preference: ${region}.
Stated interests: ${interests.length ? interests.join(", ") : "no strong preference, suggest a good variety"}.
Cuisine preference: ${cuisine || "none specified"}.
${travelParty ? `Traveling as: ${travelParty} — factor this into suitability.` : ""}
${pace ? `Preferred pace: ${pace}.` : ""}
${dietaryRestrictions?.length ? `Dietary restrictions to consider for food-culture fit: ${dietaryRestrictions.join(", ")}.` : ""}

Use web search to verify: each destination's actual best-time-to-visit window makes sense for the stated travel timing (don't recommend somewhere in its rainy/off season without saying so), and that any specific claim about cost or climate is current and accurate. Do not invent specific prices — use only a rough cost tier.

Respond with ONLY a JSON array (no markdown fences, no preamble), in this exact shape:
[
  {
    "name": "City, Country",
    "airportCode": "3-letter IATA code of that city's main international airport, verified via search",
    "matchReason": "1-2 sentences on why this fits what they asked for, specific to their actual inputs, not generic.",
    "bestTimeToVisit": "Real, verified best-time-to-visit window for this destination.",
    "costTier": "$" | "$$" | "$$$",
    "highlights": ["short highlight 1", "short highlight 2", "short highlight 3"]
  }
]

Make the 4 destinations genuinely varied from each other (different regions/continents/vibes), not 4 similar cities.`;
}

function fallbackDestinations() {
  return [
    { name: "Lisbon, Portugal", airportCode: "LIS", matchReason: "A reliable pick for first-time international travelers — walkable, affordable, and welcoming.", bestTimeToVisit: "March–May or September–October", costTier: "$$", highlights: ["Historic trams & viewpoints", "Fresh seafood", "Easy day trips to Sintra"] },
    { name: "Kyoto, Japan", airportCode: "KIX", matchReason: "For travelers wanting culture and craft over nightlife.", bestTimeToVisit: "March–April (cherry blossoms) or November (fall colors)", costTier: "$$$", highlights: ["Historic temples", "Traditional tea houses", "Bamboo groves"] },
    { name: "Mexico City, Mexico", airportCode: "MEX", matchReason: "Big-city energy with strong food culture and good value.", bestTimeToVisit: "March–May", costTier: "$", highlights: ["World-class museums", "Street food", "Vibrant neighborhoods"] },
    { name: "Queenstown, New Zealand", airportCode: "ZQN", matchReason: "For travelers who want outdoor adventure as the centerpiece of the trip.", bestTimeToVisit: "December–February (summer) or June–August (ski season)", costTier: "$$$", highlights: ["Hiking & adventure sports", "Lake & mountain scenery", "Nearby wine country"] },
  ];
}

export default router;
