// server/lib/airportCities.js
//
// Shared airport-code → city-name lookup. Both weather (Open-Meteo
// geocoding) and hotel search (Google Places text search) need a real
// place name, not a 3-letter IATA code — neither API reliably
// resolves raw codes like "MED" or "VNS" on their own, and Places in
// particular can return unrelated fuzzy matches for an unrecognized
// code (e.g. "MED" partial-matching "Mediterranean" in listing names).
//
// Not exhaustive — anything missing falls back to trying the raw
// destination text, which works fine if the person typed a city
// instead of a code.

export const AIRPORT_TO_CITY = {
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
  // Pilgrimage gateway cities
  TLV: "Tel Aviv, Israel", VNS: "Varanasi, India", GAY: "Gaya, India",
  KTM: "Kathmandu, Nepal", AMM: "Amman, Jordan",
};

export function airportToCityName(code) {
  if (!code) return code;
  return AIRPORT_TO_CITY[code.toUpperCase()] || code;
}
