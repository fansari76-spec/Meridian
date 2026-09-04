// server/routes/itinerary.js
//
// POST /api/itinerary/generate
// body: { destination, days, interests, cuisine, faithTradition }
//
// If ANTHROPIC_API_KEY is set, generates a real day-by-day plan using
// Claude, tailored to the actual destination and preferences. If no
// key is set, falls back to a rule-based template generator that
// always fills morning/afternoon/evening so the itinerary tab still
// works fully with zero setup.
//
// Every activity carries an estimated per-person cost and a category
// (food / activity / free), so the frontend can total these up into
// the actual budget instead of using flat guesses.

import express from "express";

const router = express.Router();

function isLiveMode() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

router.post("/generate", async (req, res) => {
  const {
    destination,
    days = 3,
    interests = [],
    cuisine = null,
    faithTradition = null,
    travelParty = null,
    pace = null,
    budgetStyle = null,
    occasion = null,
    accessibilityNotes = null,
    otherNotes = null,
  } = req.body;

  if (!destination) {
    return res.status(400).json({ error: "destination is required." });
  }

  const prefs = { travelParty, pace, budgetStyle, occasion, accessibilityNotes, otherNotes };

  try {
    if (isLiveMode()) {
      const plan = await generateWithClaude({ destination, days, interests, cuisine, faithTradition, prefs });
      return res.json({ plan, usedAI: true });
    }
    const plan = generateWithTemplates({ days, interests, pace });
    return res.json({ plan, usedAI: false });
  } catch (err) {
    console.error(err);
    // Fall back gracefully rather than showing the user a broken tab
    // if the Claude call fails for any reason (bad key, rate limit, etc).
    const plan = generateWithTemplates({ days, interests, pace });
    return res.json({ plan, usedAI: false, warning: "AI generation failed, showing a template plan instead." });
  }
});

// ---------------------------------------------------------------------
// LIVE MODE — real Claude-generated itinerary
// ---------------------------------------------------------------------

async function generateWithClaude({ destination, days, interests, cuisine, faithTradition, prefs }) {
  const prompt = buildPrompt({ destination, days, interests, cuisine, faithTradition, prefs });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
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

function buildPrompt({ destination, days, interests, cuisine, faithTradition, prefs = {} }) {
  const { travelParty, pace, budgetStyle, occasion, accessibilityNotes, otherNotes } = prefs;
  const paceGuidance = {
    "Packed & efficient": "Pack each day with 4 activities — this traveler wants to see and do as much as possible.",
    "Slow & relaxed": "Keep each day to 2-3 unhurried activities with real downtime — this traveler wants a relaxed pace, not a checklist.",
  }[pace] || "Use a balanced pace — 3 activities per day is typical.";

  const budgetGuidance = {
    "Budget-conscious": "Favor free or low-cost options where reasonable; call out budget-friendly picks.",
    Luxury: "Feel free to recommend higher-end, splurge-worthy experiences.",
  }[budgetStyle] || "";

  return `You are a travel planner. Build a ${days}-day itinerary for a trip to ${destination}.

Traveler's stated interests: ${interests.length ? interests.join(", ") : "no strong preference, keep it balanced"}.
Dietary/cuisine preference: ${cuisine || "none specified"}.
${faithTradition ? `This is a pilgrimage-style trip for the ${faithTradition} tradition — prioritize relevant sacred sites and be mindful of appropriate pacing and any relevant observances.` : ""}
${travelParty ? `Who's traveling: ${travelParty} — tailor activity choices accordingly (e.g. family-friendly if kids are involved).` : ""}
${paceGuidance}
${budgetGuidance}
${occasion && occasion !== "None" ? `This trip is for a ${occasion} — include at least one fitting special-occasion moment.` : ""}
${accessibilityNotes ? `Accessibility needs to accommodate: ${accessibilityNotes}` : ""}
${otherNotes ? `Additional notes from the traveler: ${otherNotes}` : ""}

Respond with ONLY a JSON array (no markdown fences, no preamble), one object per day, in this exact shape:
[
  {
    "dayNumber": 1,
    "activities": [
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
  }
]

Rules:
- Each day MUST have at least one "morning", one "afternoon", and one "evening" activity, following the pace guidance above for how many total.
- "cost" is your best-effort estimate in whole US dollars, PER PERSON — use 0 for anything free (a park, a viewpoint, a walk), realistic numbers for paid entries, tours, or meals (a museum entry, a nice dinner, a guided tour), and be honest about typical prices in ${destination}.
- "category" is "food" for meals/dining, "activity" for anything else with a cost, or "free" for zero-cost stops.
- Times should progress logically through the day (morning before afternoon before evening) and not overlap.
- Use real, specific places and neighborhoods in ${destination} where you're confident they exist — don't invent implausible venues. Keep descriptions to one sentence each.`;
}

// ---------------------------------------------------------------------
// DEMO MODE — always fills morning/afternoon/evening, using whichever
// interests the traveler selected, with sensible defaults so every day
// is complete even with zero chips selected.
// ---------------------------------------------------------------------

const MORNING_BANK = {
  "slow-mornings": { time: "9:30a", name: "Late breakfast at a local café", desc: "No plans before 10 — settle in before the day starts.", category: "food", cost: 12 },
  "hiking-outdoors": { time: "7:30a", name: "Morning hike or coastal walk", desc: "Best light and cooler temps earlier in the day.", category: "free", cost: 0 },
  "museums-history": { time: "9:00a", name: "Flagship history museum", desc: "Book the first entry slot to skip the midday lines.", category: "activity", cost: 18 },
  default: { time: "9:00a", name: "Neighborhood walk with coffee", desc: "Get oriented in the area around your stay.", category: "food", cost: 6 },
};

const AFTERNOON_BANK = {
  shopping: { time: "2:00p", name: "Independent shops & design district", desc: "Skip the chain stores — local makers instead.", category: "activity", cost: 0 },
  "food-focused": { time: "1:00p", name: "Food market crawl", desc: "Sample local specialties at the city's main market.", category: "food", cost: 20 },
  "museums-history": { time: "1:30p", name: "Afternoon at a landmark or gallery", desc: "A second cultural stop, paced after lunch.", category: "activity", cost: 15 },
  default: { time: "1:30p", name: "Explore the old town on foot", desc: "Wander the main squares and side streets.", category: "free", cost: 0 },
};

const EVENING_BANK = {
  "live-music": { time: "9:00p", name: "Live music venue", desc: "Local performance — reservation recommended.", category: "activity", cost: 25 },
  nightlife: { time: "10:30p", name: "Rooftop bar or late spot", desc: "Popular with locals, not just tourists.", category: "food", cost: 30 },
  "food-focused": { time: "8:00p", name: "Dinner at a highly-rated local spot", desc: "Matched to your cuisine preference.", category: "food", cost: 35 },
  default: { time: "7:30p", name: "Dinner near your stay", desc: "A well-reviewed local spot, no reservation needed.", category: "food", cost: 28 },
};

function pickForSlot(bank, interests) {
  for (const interest of interests) {
    if (bank[interest]) return { ...bank[interest], tag: interest };
  }
  return { ...bank.default, tag: null };
}

function generateWithTemplates({ days, interests, pace }) {
  const plan = [];
  for (let i = 0; i < days; i++) {
    const activities = [
      { ...pickForSlot(MORNING_BANK, interests), period: "morning" },
      { ...pickForSlot(AFTERNOON_BANK, interests), period: "afternoon" },
      { ...pickForSlot(EVENING_BANK, interests), period: "evening" },
    ];
    if (pace === "Packed & efficient") {
      activities.splice(2, 0, { ...pickForSlot(AFTERNOON_BANK, interests.slice(1)), period: "afternoon", time: "4:00p" });
    }
    if (pace === "Slow & relaxed") {
      activities.pop(); // drop the evening slot for a lighter day
    }
    plan.push({ dayNumber: i + 1, activities });
  }
  return plan;
}

export default router;
