// server/routes/packing.js
//
// POST /api/packing/generate
// body: { destination, days, departDate, returnDate, interests, faithTradition, travelParty, itineraryPlan }
//
// Generates a categorized packing list tailored to the actual trip —
// destination, season (inferred from dates), planned activities, and
// pilgrimage-specific needs (e.g. ihram, modest dress) when relevant.
//
// Honest limitation: this uses Claude's general knowledge of typical
// weather/customs for the destination and time of year — it is NOT
// live weather data. Good enough for "what season is this, roughly,"
// not precise enough to skip checking an actual forecast closer to
// the trip.

import express from "express";

const router = express.Router();

function isLiveMode() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const TEMPLATE_LIST = [
  { category: "Documents", items: ["Passport", "Travel insurance info", "Printed/digital boarding passes", "Hotel confirmations", "Emergency contact list"] },
  { category: "Clothing", items: ["Comfortable walking shoes", "Weather-appropriate outerwear", "Daily outfits for trip length", "Sleepwear", "Underwear & socks"] },
  { category: "Toiletries", items: ["Toothbrush & toothpaste", "Sunscreen", "Basic medications", "Deodorant", "Travel-size shampoo/soap"] },
  { category: "Electronics", items: ["Phone charger", "Universal power adapter", "Portable battery pack", "Headphones"] },
  { category: "Miscellaneous", items: ["Reusable water bottle", "Daypack for excursions", "Snacks for transit", "Copy of itinerary"] },
];

router.post("/generate", async (req, res) => {
  const { destination, days = 3, departDate, returnDate, interests = [], faithTradition = null, travelParty = null, itineraryPlan = [] } = req.body;

  if (!destination) {
    return res.status(400).json({ error: "destination is required." });
  }

  if (!isLiveMode()) {
    return res.json({ categories: TEMPLATE_LIST, usedAI: false });
  }

  try {
    const categories = await generateWithClaude({ destination, days, departDate, returnDate, interests, faithTradition, travelParty, itineraryPlan });
    res.json({ categories, usedAI: true });
  } catch (err) {
    console.error(err);
    res.json({ categories: TEMPLATE_LIST, usedAI: false, warning: `AI generation failed (${err.message}), showing a general list instead.` });
  }
});

async function generateWithClaude({ destination, days, departDate, returnDate, interests, faithTradition, travelParty, itineraryPlan }) {
  const activitySummary = itineraryPlan
    .flatMap((day) => (day.activities || []).map((a) => a.name))
    .slice(0, 20)
    .join(", ");

  const prompt = `Build a packing list for a ${days}-day trip to ${destination}, traveling ${departDate || "soon"} to ${returnDate || "soon"}.

${travelParty ? `Traveling as: ${travelParty}.` : ""}
${interests.length ? `Planned interests: ${interests.join(", ")}.` : ""}
${activitySummary ? `Some planned activities: ${activitySummary}.` : ""}
${faithTradition ? `This is a pilgrimage-style trip for the ${faithTradition} tradition — include any relevant items (e.g. appropriate dress, ihram if applicable, prayer items) as their own category.` : ""}

Use your general knowledge of typical weather and customs for ${destination} around these dates to inform clothing choices — note this is a general estimate, not live weather.

Respond with ONLY a JSON array (no markdown fences, no preamble), in this exact shape:
[
  { "category": "Documents", "items": ["Passport", "..."] },
  { "category": "Clothing", "items": ["...", "..."] }
]

Include 4-7 categories total (Documents, Clothing, Toiletries, Electronics always apply; add destination/activity-specific categories like "Beach essentials," "Hiking gear," or pilgrimage-specific items where relevant). Keep each category to 4-8 concrete, specific items — not generic filler.`;

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
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);

  const json = await response.json();
  const text = json.content?.map((b) => b.text || "").join("") || "";
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Unexpected packing list shape from Claude");
  return parsed;
}

export default router;
