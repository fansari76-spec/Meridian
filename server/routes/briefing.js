// server/routes/briefing.js
//
// POST /api/briefing/generate
// body: { destination, faithTradition, travelParty }
//
// Generates a short, practical safety and cultural-etiquette briefing
// for the destination — dress norms, common scams/safety notes,
// tipping customs, and (when relevant) pilgrimage-specific guidance
// like appropriate dress for religious sites or observance windows.
//
// Honest limitation: general knowledge, not a live travel-advisory
// feed — always worth checking official government travel advisories
// for anything safety-critical closer to departure.

import express from "express";

const router = express.Router();

function isLiveMode() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const TEMPLATE_SECTIONS = [
  { title: "General safety", content: "Keep copies of important documents separately from the originals. Use hotel safes for valuables. Stay aware of surroundings in crowded tourist areas, where pickpocketing is the most common issue worldwide." },
  { title: "Local etiquette", content: "Observe how locals dress and behave before assuming Western norms apply. When in doubt, dress modestly and ask politely rather than guess." },
  { title: "Money & tipping", content: "Research typical tipping norms before you go — they vary widely by country and are sometimes considered unnecessary or even rude." },
];

router.post("/generate", async (req, res) => {
  const { destination, faithTradition = null, travelParty = null } = req.body;

  if (!destination) {
    return res.status(400).json({ error: "destination is required." });
  }

  if (!isLiveMode()) {
    return res.json({ sections: TEMPLATE_SECTIONS, usedAI: false });
  }

  try {
    const sections = await generateWithClaude({ destination, faithTradition, travelParty });
    res.json({ sections, usedAI: true });
  } catch (err) {
    console.error(err);
    res.json({ sections: TEMPLATE_SECTIONS, usedAI: false, warning: `AI generation failed (${err.message}), showing general guidance instead.` });
  }
});

async function generateWithClaude({ destination, faithTradition, travelParty }) {
  const prompt = `Write a short, practical safety and etiquette briefing for a traveler visiting ${destination}.
${travelParty ? `They're traveling as: ${travelParty}.` : ""}
${faithTradition ? `This is a pilgrimage-style trip for the ${faithTradition} tradition — include a dedicated section on relevant religious-site etiquette, appropriate dress, and any observance-related guidance specific to ${destination}.` : ""}

Respond with ONLY a JSON array (no markdown fences, no preamble), in this exact shape:
[
  { "title": "Section title", "content": "2-4 sentences of specific, practical guidance." }
]

Include 4-6 sections covering: general safety notes specific to ${destination} (not generic advice), local dress norms and etiquette, money/tipping customs, common scams or areas to be cautious in, and (if applicable) the pilgrimage/religious-site section. Be specific to ${destination}, not generic travel advice that could apply anywhere. Keep each section to 2-4 sentences.`;

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
  if (!Array.isArray(parsed)) throw new Error("Unexpected briefing shape from Claude");
  return parsed;
}

export default router;
