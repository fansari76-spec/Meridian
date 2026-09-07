// server/routes/voiceCommand.js
//
// POST /api/voice-command/parse
// body: { transcript, context: { page, currentActivities? } }
//
// Classifies a spoken command into one of a FIXED set of app actions
// (not open-ended interpretation) so the frontend dispatcher can
// reliably execute whatever comes back. context.page tells the model
// which actions are even valid right now (e.g., RSVP only makes sense
// on the group trip page), and context.currentActivities (when on a
// group trip) lets it match "the museum" against real activity names
// instead of guessing.
//
// No web search here — this is fast intent classification, not
// research; speed matters more than grounding for a voice command
// that should feel instant.

import express from "express";
import { extractJsonObject } from "../lib/extractJson.js";

const router = express.Router();

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

router.post("/parse", async (req, res) => {
  const { transcript, context = {} } = req.body;
  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: "transcript is required." });
  }
  if (!isConfigured()) {
    return res.status(200).json({ success: false, error: "Voice commands aren't connected yet — add ANTHROPIC_API_KEY in server/.env." });
  }

  try {
    const result = await classifyWithClaude(transcript, context);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ success: false, error: `Couldn't understand that command: ${err.message}` });
  }
});

async function classifyWithClaude(transcript, context) {
  const prompt = buildPrompt(transcript, context);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);

  const json = await response.json();
  const text = json.content?.map((block) => block.text || "").join("") || "";
  return extractJsonObject(text);
}

function buildPrompt(transcript, context) {
  const { page = "main", currentActivities = [] } = context;
  const today = new Date().toISOString().slice(0, 10);

  const rsvpContext = currentActivities.length
    ? `\nCurrently visible activities on this page (match "the museum" etc. against these real names, using the exact dayNumber/activityIndex from this list):\n${currentActivities
        .map((a) => `- dayNumber ${a.dayNumber}, activityIndex ${a.activityIndex}: "${a.name}"`)
        .join("\n")}`
    : "";

  return `You're a voice command classifier for a travel app called TripAmi. Today's date is ${today}. The person is currently on the "${page}" page/context.

Classify their spoken command into EXACTLY ONE of these actions, extracting only the parameters relevant to that action. If nothing matches or the command is unclear, use "unknown".

1. "navigate" — switch to a different tab. params: { "tabId": one of "search"|"budget"|"itinerary"|"pilgrimage"|"group"|"health"|"nearby"|"account" }
2. "search_flights" — search for flights/a trip. params: { "destination": "City, Country or null", "airportCode": "3-letter IATA code if you can confidently determine one, else null", "departDate": "YYYY-MM-DD or null", "returnDate": "YYYY-MM-DD or null", "tripLengthDays": number or null }
3. "rsvp" — respond to a group activity. Only valid if activities are listed below. params: { "dayNumber": number, "activityIndex": number, "value": "going"|"not_going"|"maybe" }
4. "update_preferences" — change a travel preference. params, all optional, only fill what's mentioned: { "travelParty": "Solo"|"Couple"|"Family with kids"|"Friends group"|null, "pace": "Packed & efficient"|"Balanced"|"Slow & relaxed"|null, "budgetStyle": "Budget-conscious"|"Mid-range"|"Luxury"|null, "stayType": "Hotel"|"Airbnb / Vrbo"|"Boutique"|"Resort"|null, "flightPriority": "Cheapest fare"|"Fewest stops"|"Best departure times"|null, "occasion": "None"|"Honeymoon"|"Anniversary"|"Birthday"|"Pilgrimage"|null, "interests": array subset of ["slow-mornings","food-focused","museums-history","live-music","hiking-outdoors","nightlife","shopping"], "cuisine": "Halal"|"Kosher"|"Vegetarian"|"Vegan"|"Gluten-free"|"Pescatarian"|null }
5. "get_destination_ideas" — suggest destinations. params: { "budgetStyle": same enum as above or null, "month": "string or null", "region": "Anywhere"|"Domestic (US) only"|"International only", "continents": array subset of ["Europe","Asia","Latin America","Africa","Oceania","Middle East"], "interests": same array as above }
6. "connect_health" — connect Google Health. params: {}
${rsvpContext}

Their spoken command: "${transcript.replace(/"/g, '\\"')}"

Respond with ONLY a JSON object (no markdown fences, no preamble), in this exact shape:
{
  "action": "navigate" | "search_flights" | "rsvp" | "update_preferences" | "get_destination_ideas" | "connect_health" | "unknown",
  "params": { ...action-specific fields as defined above, or {} for connect_health/unknown },
  "confirmationText": "A short, natural spoken-style confirmation of what you understood, e.g. 'Searching flights to Tokyo' or 'Marking you as going to the museum' — one sentence.",
  "reason": "only if action is unknown — a short explanation of why nothing matched"
}`;
}

export default router;
