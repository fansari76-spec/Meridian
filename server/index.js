// server/index.js
//
// Run with: npm run dev  (from inside /server)
// Works with zero configuration — no DUFFEL_API_KEY needed to try it,
// it just returns realistic demo data until you add one.

import "dotenv/config";
import express from "express";
import cors from "cors";
import flightsRouter from "./routes/flights.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/flights", flightsRouter);

app.get("/health", (req, res) => {
  res.json({ ok: true, mode: process.env.DUFFEL_API_KEY ? "live" : "demo" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  const mode = process.env.DUFFEL_API_KEY ? "LIVE (Duffel key found)" : "DEMO (no DUFFEL_API_KEY set — using mock fares)";
  console.log(`Meridian API listening on http://localhost:${PORT} — mode: ${mode}`);
});
