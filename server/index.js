// server/index.js
//
// Run with: npm run dev  (from inside /server)
// Works with zero configuration — no DUFFEL_API_KEY needed to try it,
// it just returns realistic demo data until you add one.

import "dotenv/config";
import express from "express";
import cors from "cors";
import flightsRouter from "./routes/flights.js";
import staysRouter from "./routes/stays.js";
import itineraryRouter from "./routes/itinerary.js";
import conciergeRouter from "./routes/concierge.js";
import packingRouter from "./routes/packing.js";
import briefingRouter from "./routes/briefing.js";
import weatherRouter from "./routes/weather.js";

const app = express();

// In production, restrict CORS to your deployed frontend URL (set
// FRONTEND_URL as an env var on Render). Falls back to allowing
// everything in local development.
const allowedOrigin = process.env.FRONTEND_URL || "*";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.use("/api/flights", flightsRouter);
app.use("/api/stays", staysRouter);
app.use("/api/itinerary", itineraryRouter);
app.use("/api/concierge", conciergeRouter);
app.use("/api/packing", packingRouter);
app.use("/api/briefing", briefingRouter);
app.use("/api/weather", weatherRouter);

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    flights: process.env.DUFFEL_API_KEY ? "live" : "demo",
    stays: process.env.GOOGLE_PLACES_API_KEY ? "live" : "demo",
    itinerary: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  const flags = [
    process.env.DUFFEL_API_KEY ? "flights:LIVE" : "flights:demo",
    process.env.GOOGLE_PLACES_API_KEY ? "stays:LIVE" : "stays:demo",
    process.env.ANTHROPIC_API_KEY ? "itinerary:LIVE" : "itinerary:demo",
  ];
  console.log(`TripAmi API listening on http://localhost:${PORT} — ${flags.join(", ")}`);
});
