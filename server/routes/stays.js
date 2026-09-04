// server/routes/stays.js
//
// POST /api/stays/search
// body: { location, checkIn, checkOut }
//
// If GOOGLE_PLACES_API_KEY is set, searches real hotels/lodging near
// the given location using Google Places. Note: Places gives real
// names, ratings, addresses, and photos — but NOT live nightly rates
// or booking (Google doesn't expose that). We estimate a price range
// from Places' own price_level field and link out to Google Maps for
// the listing, consistent with the "search + link out" model used for
// flights. For actual bookable rates, the next step up is Booking.com's
// Affiliate API (see README) — this route is written so swapping that
// in later only touches this one file.
//
// If no key is set, falls back to fixed demo listings so the app stays
// fully clickable without setup.

import express from "express";

const router = express.Router();

const DEMO_STAYS = [
  { id: "s1", source: "Hotel", name: "Casa Alfama Boutique", area: "Alfama", distance: 0.4, rating: 4.8, price: 142, photo: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=500&q=60", url: "https://www.booking.com" },
  { id: "s2", source: "Airbnb", name: "Sunlit Loft, Príncipe Real", area: "Príncipe Real", distance: 0.9, rating: 4.95, price: 118, photo: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=500&q=60", url: "https://www.airbnb.com" },
  { id: "s3", source: "Vrbo", name: "Riverside 2BR with Terrace", area: "Belém", distance: 2.1, rating: 4.7, price: 164, photo: "https://images.unsplash.com/photo-1541971875076-8f970d573be6?w=500&q=60", url: "https://www.vrbo.com" },
];

function isLiveMode() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

router.post("/search", async (req, res) => {
  const { location, checkIn, checkOut, travelers = 2 } = req.body;

  if (!isLiveMode()) {
    return res.json({ stays: DEMO_STAYS, usedMockData: true });
  }

  if (!location) {
    return res.status(400).json({ error: "location is required." });
  }

  try {
    const stays = await searchRealHotels(location, { checkIn, checkOut, travelers });
    res.json({ stays, usedMockData: false });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Hotel search failed. Please try again." });
  }
});

async function searchRealHotels(location, { checkIn, checkOut, travelers }) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const url = `https://places.googleapis.com/v1/places:searchText`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.googleMapsUri",
    },
    body: JSON.stringify({
      textQuery: `hotels in ${location}`,
      maxResultCount: 12,
    }),
  });

  if (!response.ok) throw new Error(`Places API error ${response.status}: ${await response.text()}`);

  const json = await response.json();
  const places = json.places || [];

  return places.map((place) => ({
    id: place.id,
    source: "Hotel",
    name: place.displayName?.text || "Unnamed hotel",
    area: place.formattedAddress || "",
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? 0,
    price: estimatePriceFromLevel(place.priceLevel),
    photo: buildPhotoUrl(place.photos?.[0], key),
    url: buildBookingComSearchUrl(place.displayName?.text, location, { checkIn, checkOut, travelers }),
  }));
}

// Links to Booking.com's own live search, pre-filled with this hotel's
// name and the traveler's dates — the same "search + link out" model
// used for flights. The customer sees Booking.com's real, current
// price and books directly on their site. No API or approval needed.
function buildBookingComSearchUrl(hotelName, location, { checkIn, checkOut, travelers }) {
  const params = new URLSearchParams({
    ss: hotelName ? `${hotelName}, ${location}` : location,
  });
  if (checkIn) params.set("checkin", checkIn);
  if (checkOut) params.set("checkout", checkOut);
  if (travelers) params.set("group_adults", String(travelers));
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

// Google's priceLevel is a rough 1-4 bucket, not a real nightly rate.
// This turns it into a ballpark number so the budget calculator has
// something to work with until a real rates API (e.g. Booking.com) is wired in.
function estimatePriceFromLevel(level) {
  const map = { PRICE_LEVEL_INEXPENSIVE: 90, PRICE_LEVEL_MODERATE: 150, PRICE_LEVEL_EXPENSIVE: 260, PRICE_LEVEL_VERY_EXPENSIVE: 420 };
  return map[level] || 150;
}

function buildPhotoUrl(photo, key) {
  if (!photo?.name) return null;
  return `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=500&key=${key}`;
}

export default router;
