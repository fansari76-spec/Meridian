// server/routes/flights.js
//
// POST /api/flights/search
// body: { origin, destination, departDate, returnDate, passengers, flexDays }
//
// `passengers` is an array like [{type:"adult"}, {type:"adult"}, {age:8}, {age:1}] —
// each entry is either an adult or a specific age, matching Duffel's
// real passenger schema (an entry can specify type OR age; Duffel
// derives the correct fare — infant/child/adult — from age itself).
// If `passengers` isn't provided, falls back to `travelers` (a flat
// count, treated as all-adult) for backward compatibility.
//
// If DUFFEL_API_KEY is set, calls Duffel's real search API (their test
// keys return realistic mock offers with no live airline connection
// needed — good for building against before requesting production
// access). If no key is set, this route generates deterministic demo
// data itself, so the whole app is clickable with zero setup — demo
// pricing now also respects age (children discounted, infants free),
// matching how real airline fares actually work.

import express from "express";

const router = express.Router();
const DUFFEL_API = "https://api.duffel.com/air/offer_requests";
const DUFFEL_VERSION = "v2";

function isLiveMode() {
  return Boolean(process.env.DUFFEL_API_KEY);
}

function normalizePassengers({ passengers, travelers }) {
  if (Array.isArray(passengers) && passengers.length > 0) return passengers;
  return Array.from({ length: travelers || 1 }, () => ({ type: "adult" }));
}

router.post("/search", async (req, res) => {
  const { origin, destination, departDate, returnDate, flexDays = 0 } = req.body;
  const passengers = normalizePassengers(req.body);

  if (!origin || !destination || !departDate || !returnDate) {
    return res.status(400).json({ error: "origin, destination, departDate, and returnDate are required." });
  }

  try {
    if (isLiveMode()) {
      const primary = await searchOneDatePairLive({ origin, destination, departDate, returnDate, passengers });
      const flexResults = flexDays > 0 ? await scanFlexDatesLive({ origin, destination, departDate, returnDate, passengers, flexDays }) : [];
      return res.json({ primary, flexResults, usedMockData: false, passengerCount: passengers.length });
    }

    const primary = searchOneDatePairMock({ origin, destination, departDate, returnDate, passengers });
    const flexResults = flexDays > 0 ? scanFlexDatesMock({ origin, destination, departDate, returnDate, passengers, flexDays }) : [];
    return res.json({ primary, flexResults, usedMockData: true, passengerCount: passengers.length });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Flight search failed. Please try again." });
  }
});

// ---------------------------------------------------------------------
// LIVE MODE — real Duffel API calls
// ---------------------------------------------------------------------

function duffelHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
    "Duffel-Version": DUFFEL_VERSION,
  };
}

function buildOfferRequestBody({ origin, destination, departDate, returnDate, passengers }) {
  return {
    data: {
      slices: [
        { origin, destination, departure_date: departDate },
        { origin: destination, destination: origin, departure_date: returnDate },
      ],
      passengers,
      cabin_class: "economy",
    },
  };
}

async function searchOneDatePairLive(params) {
  const res = await fetch(DUFFEL_API, {
    method: "POST",
    headers: duffelHeaders(),
    body: JSON.stringify(buildOfferRequestBody(params)),
  });
  if (!res.ok) throw new Error(`Duffel error ${res.status}: ${await res.text()}`);

  const json = await res.json();
  // Duffel returns total_amount already computed for the WHOLE passenger
  // list we sent, correctly reflecting any child/infant fare rules —
  // this is a real party total, not a per-person rate.
  const offers = (json.data?.offers ?? []).map((offer) => simplifyOffer(offer, params));
  offers.sort((a, b) => a.totalAmount - b.totalAmount);

  return { departDate: params.departDate, cheapestTotal: offers[0]?.totalAmount ?? null, currency: offers[0]?.currency ?? null, offers: offers.slice(0, 5) };
}

function simplifyOffer(offer, params) {
  return {
    id: offer.id,
    airline: offer.owner?.name,
    totalAmount: Number(offer.total_amount),
    currency: offer.total_currency,
    slices: offer.slices.map((slice) => ({
      duration: slice.duration,
      stops: slice.segments.length - 1,
      departure: slice.segments[0]?.departing_at,
      arrival: slice.segments[slice.segments.length - 1]?.arriving_at,
    })),
    bookingUrl: buildFallbackBookingUrl(params),
  };
}

async function scanFlexDatesLive({ origin, destination, departDate, returnDate, passengers, flexDays }) {
  const offsets = buildDateOffsets(flexDays);
  const results = await Promise.all(
    offsets.map(async (offsetDays) => {
      try {
        const result = await searchOneDatePairLive({
          origin,
          destination,
          departDate: shiftDate(departDate, offsetDays),
          returnDate: shiftDate(returnDate, offsetDays),
          passengers,
        });
        return { offsetDays, ...result };
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

// ---------------------------------------------------------------------
// DEMO MODE — deterministic mock data, no API key required
// ---------------------------------------------------------------------

const MOCK_AIRLINES = [
  { name: "TAP Air Portugal", base: 418 },
  { name: "Delta", base: 379 },
  { name: "United", base: 462 },
];

// Rough real-world fare structure: children (2-11) fly at a discount,
// infants under 2 (flying as a lap infant, no seat) fly free — this
// mirrors how airlines actually price a mixed-age party, even though
// it's simulated here rather than a live carrier's real fare rules.
function fareMultiplierFor(passenger) {
  if (passenger.type === "adult" || passenger.age == null) return 1;
  if (passenger.age < 2) return 0;
  if (passenger.age < 12) return 0.75;
  return 1;
}

/** Simple deterministic "randomness" seeded by date + route, so the
 * same search always returns the same demo numbers rather than
 * jumping around on every request. */
function seededVariance(seedString, range) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) hash = (hash * 31 + seedString.charCodeAt(i)) >>> 0;
  return (hash % range) - range / 2;
}

function searchOneDatePairMock({ origin, destination, departDate, returnDate, passengers }) {
  const seed = `${origin}${destination}${departDate}${returnDate}`;
  const offers = MOCK_AIRLINES.map((airline, i) => {
    const variance = seededVariance(seed + i, 80);
    const perAdultFare = Math.max(180, Math.round(airline.base + variance));
    const totalAmount = passengers.reduce((sum, p) => sum + Math.round(perAdultFare * fareMultiplierFor(p)), 0);
    return {
      id: `mock-${seed}-${i}`,
      airline: airline.name,
      totalAmount,
      perAdultFare,
      currency: "USD",
      slices: [
        {
          duration: `PT${6 + (i % 3)}H${(i * 17) % 60}M`,
          stops: i === 1 ? 1 : 0,
          departure: `${departDate}T${18 + i}:00:00`,
          arrival: `${returnDate}T0${7 + i}:00:00`,
        },
      ],
      bookingUrl: buildFallbackBookingUrl({ origin, destination, departDate, returnDate }),
    };
  });
  offers.sort((a, b) => a.totalAmount - b.totalAmount);
  return { departDate, cheapestTotal: offers[0].totalAmount, currency: "USD", offers };
}

function scanFlexDatesMock({ origin, destination, departDate, returnDate, passengers, flexDays }) {
  const offsets = buildDateOffsets(flexDays);
  return offsets.map((offsetDays) => {
    const shiftedDepart = shiftDate(departDate, offsetDays);
    const shiftedReturn = shiftDate(returnDate, offsetDays);
    const result = searchOneDatePairMock({ origin, destination, departDate: shiftedDepart, returnDate: shiftedReturn, passengers });
    return { offsetDays, ...result };
  });
}

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

function buildFallbackBookingUrl({ origin, destination, departDate, returnDate }) {
  const qs = new URLSearchParams({
    hl: "en",
    q: `flights from ${origin} to ${destination} on ${departDate} through ${returnDate}`,
  });
  return `https://www.google.com/travel/flights?${qs.toString()}`;
}

function buildDateOffsets(flexDays) {
  const step = 3;
  const offsets = [];
  for (let d = -flexDays; d <= flexDays; d += step) {
    if (d !== 0) offsets.push(d);
  }
  return offsets;
}

function shiftDate(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default router;
export { searchOneDatePairLive, searchOneDatePairMock, isLiveMode };
