// server/routes/importBooking.js
//
// POST /api/import-booking/extract
// multipart/form-data, field name "files" — accepts 1 or 2 files
// (PDF confirmation or a photo/screenshot of one). Each file might be
// a flight confirmation, a hotel confirmation, or a combined
// itinerary email that has both — Claude reads whichever is present
// and we merge the results, so this works whether someone uploads one
// combined document or two separate ones.
//
// Requires ANTHROPIC_API_KEY (same key already used for itinerary
// generation). If it's not set, this feature can't work at all — there's
// no meaningful "demo mode" for reading someone's real booking, so we
// return a clear, honest "not configured" message instead.

import express from "express";
import multer from "multer";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file, plenty for a PDF/photo
});

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

router.post("/extract", upload.array("files", 2), async (req, res) => {
  if (!isConfigured()) {
    return res.status(200).json({
      success: false,
      error: "Importing bookings isn't connected yet — add ANTHROPIC_API_KEY in server/.env. See README.md.",
    });
  }

  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ success: false, error: "Upload at least one file (PDF or photo of your confirmation)." });
  }

  try {
    const extractions = await Promise.all(files.map((file) => extractOneFile(file)));
    const merged = mergeExtractions(extractions);

    if (!merged.destination && !merged.hotelName) {
      return res.json({
        success: false,
        error: "Couldn't confidently read a destination or hotel from what you uploaded. Try a clearer photo, or the original PDF if you have it.",
      });
    }

    return res.json({ success: true, trip: merged });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ success: false, error: `Couldn't read that confirmation: ${err.message}` });
  }
});

// ---------------------------------------------------------------------
// Per-file extraction via Claude (vision for images, document for PDFs)
// ---------------------------------------------------------------------

async function extractOneFile(file) {
  const isPdf = file.mimetype === "application/pdf";
  const isImage = file.mimetype.startsWith("image/");
  if (!isPdf && !isImage) {
    throw new Error(`Unsupported file type: ${file.mimetype}. Upload a PDF, JPG, or PNG.`);
  }

  const base64 = file.buffer.toString("base64");
  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: file.mimetype, data: base64 } };

  const prompt = `This is a travel booking confirmation (flight, hotel, or both). Extract the trip details as JSON only, no markdown fences, no preamble, in exactly this shape:

{
  "type": "flight" | "hotel" | "both" | "unknown",
  "origin": "3-letter airport code or null",
  "destination": "3-letter airport code, or city name if no airport code is shown, or null",
  "departDate": "YYYY-MM-DD or null",
  "returnDate": "YYYY-MM-DD or null",
  "travelers": number or null,
  "airline": "string or null",
  "confirmationNumber": "string or null",
  "hotelName": "string or null",
  "checkIn": "YYYY-MM-DD or null",
  "checkOut": "YYYY-MM-DD or null",
  "hotelAddress": "string or null"
}

Rules:
- Only fill fields you're actually confident about from the document. Use null for anything unclear or not present — never guess or invent a value.
- If it's a round-trip flight, "returnDate" is the return flight's date. If one-way or not applicable, null.
- If it's a hotel-only confirmation, leave the flight fields null and fill checkIn/checkOut/hotelName/hotelAddress instead.
- "travelers" is the total passenger/guest count if shown, otherwise null.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);

  const json = await response.json();
  const text = json.content?.map((block) => block.text || "").join("") || "";
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// Merges 1-2 per-file extractions into one trip object — later files
// only fill in fields the earlier file left null, never overwrite a
// value that's already been confidently found.
function mergeExtractions(extractions) {
  const merged = {
    origin: null, destination: null, departDate: null, returnDate: null,
    travelers: null, airline: null, confirmationNumber: null,
    hotelName: null, checkIn: null, checkOut: null, hotelAddress: null,
  };
  for (const ext of extractions) {
    for (const key of Object.keys(merged)) {
      if (merged[key] == null && ext[key] != null) merged[key] = ext[key];
    }
  }
  // If we got hotel dates but no flight dates, use the hotel stay as
  // the trip's date range — still useful for itinerary/packing/weather.
  if (!merged.departDate && merged.checkIn) merged.departDate = merged.checkIn;
  if (!merged.returnDate && merged.checkOut) merged.returnDate = merged.checkOut;
  return merged;
}

export default router;
