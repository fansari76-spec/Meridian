// server/routes/conversationalTrip.js
//
// POST /api/conversational-trip/parse
// body: { message: string }
//
// The "describe your trip in plain language" entry point — Claude
// extracts every field the app already knows how to use (destination,
// dates, party size, and every Preferences-tab field) from one free-
// text description, mapped onto this app's REAL enum values (not
// invented ones), so the resulting chips/selects highlight correctly
// rather than silently failing to match anything.
//
// If no destination is named ("somewhere warm and relaxing"),
// destinationKnown comes back false — the frontend then calls the
// existing /api/destinations/recommend endpoint using whatever
// preference signals were extracted, reusing the recommender we just
// built rather than duplicating that logic here.
//
// Uses the same real-web-search grounding as itinerary generation and
// the destination recommender, so airport codes and date resolution
// are checked rather than guessed from pure model memory.

import express from "express";
import { extractJsonObject } from "../lib/extractJson.js";

const router = express.Router();

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

router.post("/parse", async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "message is required." });
  }
  if (!isConfigured()) {
    return res.status(200).json({
      success: false,
      error: "Conversational trip building isn't connected yet — add ANTHROPIC_API_KEY in server/.env. See README.md.",
    });
  }

  try {
    const trip = await parseWithClaude(message);
    return res.json({ success: true, trip });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ success: false, error: `Couldn't understand that — try rephrasing: ${err.message}` });
  }
});

async function parseWithClaude(message) {
  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildPrompt(message, today);

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
  return extractJsonObject(text);
}

function buildPrompt(message, today) {
  return `Today's date is ${today}. A traveler described their trip in their own words below. Extract structured trip data from it, mapping their free-text description onto ONLY the exact allowed values listed for each enum field — never invent a value outside these lists.

Their description: "${message.replace(/"/g, '\\"')}"

Allowed values (use EXACTLY these strings, or null if not mentioned/unclear):
- travelParty: "Solo" | "Couple" | "Family with kids" | "Friends group"
- pace: "Packed & efficient" | "Balanced" | "Slow & relaxed"
- budgetStyle: "Budget-conscious" | "Mid-range" | "Luxury"
- stayType: "Hotel" | "Airbnb / Vrbo" | "Boutique" | "Resort"
- flightPriority: "Cheapest fare" | "Fewest stops" | "Best departure times"
- occasion: "None" | "Honeymoon" | "Anniversary" | "Birthday" | "Pilgrimage"
- interests (array, subset of): "slow-mornings", "food-focused", "museums-history", "live-music", "hiking-outdoors", "nightlife", "shopping"
- cuisine (single, one of): "Halal", "Kosher", "Vegetarian", "Vegan", "Gluten-free", "Pescatarian"
- dietaryRestrictions (array, subset of): "Halal", "Kosher", "Vegetarian", "Vegan", "Gluten-free", "Pescatarian", "Nut allergy", "Dairy-free"
- favoriteCuisines (array, subset of, in the order mentioned): "Italian", "Japanese", "Mexican", "Indian", "Thai", "Mediterranean", "French", "Chinese", "Middle Eastern", "American"
- continents (array, subset of, ONLY if they named a broad region/continent without a specific city — e.g. "somewhere in Europe" or "maybe Asia"): "Europe", "Asia", "Latin America", "Africa", "Oceania", "Middle East"
- region: "Domestic (US) only" | "International only" | "Anywhere" — infer from context if they said something like "somewhere in the US" or "I want to leave the country", otherwise "Anywhere"

Use web search to verify any named destination is real and to find its main international airport's 3-letter IATA code, and to resolve relative dates (e.g. "the second week of November", "next month") against today's actual date into real YYYY-MM-DD dates.

IMPORTANT on destinationKnown vs namedExamples: distinguish a FIRM decision from NAMED EXAMPLES offered alongside real openness to alternatives.
- Set destinationKnown to TRUE only for a firm, singular decision with no hedging language ("I want to go to Interlaken", "we're going to Interlaken").
- If they name one OR MORE specific real places while ALSO signaling openness to alternatives ("Interlaken or somewhere else", "maybe Bali, or Paris, or somewhere similar"), set destinationKnown to FALSE, and put EVERY specific real place they named (that they didn't explicitly rule out) into "namedExamples" as an array — this guarantees each one gets included as one of several real options to compare, rather than being silently discarded.
- If they explicitly rule a place OUT ("besides Paris", "not Paris", "anywhere but Paris"), put that place in "excludedDestinations" instead, and do NOT include it in namedExamples even if they also mentioned it earlier in the same message.
- Only leave namedExamples empty when truly no specific place was mentioned at all (e.g. "somewhere warm", "I don't know where to go").

Respond with ONLY a JSON object (no markdown fences, no preamble), in this exact shape:
{
  "destinationKnown": boolean,
  "destinationName": "City, Country, or null if not named/decided",
  "airportCode": "3-letter IATA code if destinationKnown is true, else null",
  "origin": "3-letter IATA code if they mentioned where they're flying FROM, else null",
  "departDate": "YYYY-MM-DD or null if not determinable",
  "returnDate": "YYYY-MM-DD or null if not determinable",
  "tripLengthDays": number or null (use this if they gave a duration like 'a week' but no exact dates),
  "travelers": number or null,
  "travelParty": null or one allowed value,
  "pace": null or one allowed value,
  "budgetStyle": null or one allowed value,
  "stayType": null or one allowed value,
  "flightPriority": null or one allowed value,
  "occasion": null or one allowed value,
  "interests": [],
  "cuisine": null or one allowed value,
  "dietaryRestrictions": [],
  "favoriteCuisines": [],
  "accessibilityNotes": "string or null, only if explicitly mentioned",
  "otherNotes": "string or null — anything meaningful they said that doesn't fit another field",
  "continents": [],
  "region": "Anywhere",
  "namedExamples": [],
  "excludedDestinations": []
}

Only fill a field if you're genuinely confident it was expressed or clearly implied — leave everything else null/empty rather than guessing.`;
}

export default router;
