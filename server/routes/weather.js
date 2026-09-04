// server/routes/weather.js
//
// GET /api/weather/forecast?destination=LIS&startDate=2026-10-12&endDate=2026-10-19
//
// Uses Open-Meteo — free, no API key or signup required, ever. Two
// real limitations worth knowing:
//
// 1. Open-Meteo only forecasts about 16 days ahead. Trips further out
//    than that will get "not available yet" rather than fake data.
// 2. Our destination field uses airport codes (LIS, JED), but weather
//    geocoding matches city names, not airport codes. We keep a
//    lookup table of common codes and fall back to trying the raw
//    text as a city name for anything not in the table.

import express from "express";

const router = express.Router();

// Common airport-code → city-name mappings so weather lookup works
// out of the box for the destinations most likely to be searched.
// Not exhaustive — anything missing falls back to trying the raw
// destination text as a city name, which works fine if the person
// typed a city instead of a code.
const AIRPORT_TO_CITY = {
  LIS: "Lisbon, Portugal", JFK: "New York, USA", LAX: "Los Angeles, USA",
  LHR: "London, UK", CDG: "Paris, France", FCO: "Rome, Italy",
  MAD: "Madrid, Spain", BCN: "Barcelona, Spain", AMS: "Amsterdam, Netherlands",
  DXB: "Dubai, UAE", JED: "Jeddah, Saudi Arabia", MED: "Medina, Saudi Arabia",
  RUH: "Riyadh, Saudi Arabia", IST: "Istanbul, Turkey", NRT: "Tokyo, Japan",
  HND: "Tokyo, Japan", BKK: "Bangkok, Thailand", SIN: "Singapore",
  HKG: "Hong Kong", ICN: "Seoul, South Korea", SYD: "Sydney, Australia",
  DEL: "Delhi, India", BOM: "Mumbai, India", CAI: "Cairo, Egypt",
  ATH: "Athens, Greece", VIE: "Vienna, Austria", BER: "Berlin, Germany",
  MUC: "Munich, Germany", ZRH: "Zurich, Switzerland", CPT: "Cape Town, South Africa",
  MEX: "Mexico City, Mexico", GRU: "Sao Paulo, Brazil", YYZ: "Toronto, Canada",
  ORD: "Chicago, USA", SFO: "San Francisco, USA", MIA: "Miami, USA",
  BOS: "Boston, USA", DFW: "Dallas, USA", SEA: "Seattle, USA",
};

router.get("/forecast", async (req, res) => {
  const { destination, startDate, endDate } = req.query;
  if (!destination) return res.status(400).json({ error: "destination is required." });

  try {
    const searchTerm = AIRPORT_TO_CITY[destination.toUpperCase()] || destination;
    const geo = await geocode(searchTerm);
    if (!geo) {
      return res.json({ available: false, reason: `Couldn't match "${destination}" to a location for weather.` });
    }

    const params = new URLSearchParams({
      latitude: geo.lat,
      longitude: geo.lng,
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode",
      timezone: "auto",
    });
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    const forecastRes = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!forecastRes.ok) throw new Error(`Open-Meteo error ${forecastRes.status}`);
    const data = await forecastRes.json();

    if (!data.daily?.time?.length) {
      return res.json({
        available: false,
        reason: "Forecast isn't available yet for these dates — weather forecasts only go out about 16 days. Check back closer to your trip.",
      });
    }

    const days = data.daily.time.map((date, i) => ({
      date,
      tempMaxC: data.daily.temperature_2m_max[i],
      tempMinC: data.daily.temperature_2m_min[i],
      precipitationMm: data.daily.precipitation_sum[i],
      weatherCode: data.daily.weathercode[i],
    }));

    res.json({ available: true, days, location: geo.label });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Couldn't fetch the weather forecast." });
  }
});

async function geocode(name) {
  const params = new URLSearchParams({ name, count: "1" });
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  if (!r.ok) return null;
  const data = await r.json();
  const first = data.results?.[0];
  if (!first) return null;
  return { lat: first.latitude, lng: first.longitude, label: `${first.name}, ${first.country}` };
}

export default router;
