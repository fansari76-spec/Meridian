// server/routes/concierge.js
//
// POST /api/concierge/chat
// body: { destination, currentPlan, message, history }
//
// A conversational way to adjust the itinerary — "swap day 2's dinner
// for something vegan," "make day 3 more relaxed," or just a question
// like "what's the best time to visit that market?" Claude decides
// whether the request needs an actual plan change or just an answer.
//
// Requires ANTHROPIC_API_KEY — there's no meaningful non-AI fallback
// for a free-form chat, so this returns a clear message instead of a
// broken feature when no key is set.

import express from "express";

const router = express.Router();

function isLiveMode() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

router.post("/chat", async (req, res) => {
  const { destination, currentPlan, message, history = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required." });
  }

  if (!isLiveMode()) {
    return res.json({
      reply: "Ami needs an Anthropic key connected to respond — add ANTHROPIC_API_KEY in server/.env. See README.md.",
      updatedPlan: null,
      usedAI: false,
    });
  }

  try {
    const result = await chatWithClaude({ destination, currentPlan, message, history });
    res.json({ ...result, usedAI: true });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Ami couldn't respond just now. Try again." });
  }
});

async function chatWithClaude({ destination, currentPlan, message, history }) {
  const systemPrompt = `You are Ami, a friendly, concise trip-planning companion for a trip to ${destination}. The traveler has a current itinerary (JSON below) and may ask questions or request specific changes.

Current itinerary JSON:
${JSON.stringify(currentPlan)}

Respond with ONLY a JSON object (no markdown fences, no preamble), in this exact shape:
{
  "reply": "A short, warm, conversational reply — 1 to 3 sentences, always present.",
  "updatedPlan": null
}

Rules:
- If the traveler asked a question with no requested change (e.g. "what's the best time to visit X?"), answer in "reply" and set "updatedPlan" to null.
- If they asked for a change (swap an activity, adjust pacing, replace a meal, add something), make the edit and return the FULL updated itinerary array in "updatedPlan", in the exact same shape as the input — same "dayNumber"/"activities" structure, each activity keeping "time", "period", "name", "desc", "tag", "category", "cost" fields. Only change what they asked for; leave everything else exactly as it was.
- Keep "reply" brief and natural, like a helpful local friend — not a formal assistant.`;

  const messages = [
    ...history.slice(-6).map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content: message },
  ];

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
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);

  const json = await response.json();
  const text = json.content?.map((b) => b.text || "").join("") || "";
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return { reply: parsed.reply, updatedPlan: parsed.updatedPlan || null };
}

export default router;
