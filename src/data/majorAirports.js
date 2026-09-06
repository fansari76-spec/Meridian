// src/data/majorAirports.js
//
// A compact set of major airports used only to guess a reasonable
// "From" default based on the traveler's device location — not a
// full aviation database. Picks the closest one by straight-line
// distance, which is good enough for defaulting a form field (the
// person can always change it manually).

export const MAJOR_AIRPORTS = [
  { code: "JFK", lat: 40.64, lng: -73.78 }, { code: "LAX", lat: 33.94, lng: -118.41 },
  { code: "ORD", lat: 41.98, lng: -87.90 }, { code: "SFO", lat: 37.62, lng: -122.38 },
  { code: "MIA", lat: 25.80, lng: -80.29 }, { code: "BOS", lat: 42.36, lng: -71.01 },
  { code: "DFW", lat: 32.90, lng: -97.04 }, { code: "SEA", lat: 47.45, lng: -122.31 },
  { code: "ATL", lat: 33.64, lng: -84.43 }, { code: "DEN", lat: 39.86, lng: -104.67 },
  { code: "YYZ", lat: 43.68, lng: -79.63 }, { code: "YVR", lat: 49.19, lng: -123.18 },
  { code: "MEX", lat: 19.44, lng: -99.07 }, { code: "GRU", lat: -23.43, lng: -46.47 },
  { code: "EZE", lat: -34.82, lng: -58.54 }, { code: "BOG", lat: 4.70, lng: -74.15 },
  { code: "LHR", lat: 51.47, lng: -0.45 }, { code: "CDG", lat: 49.01, lng: 2.55 },
  { code: "FCO", lat: 41.80, lng: 12.25 }, { code: "MAD", lat: 40.47, lng: -3.56 },
  { code: "BCN", lat: 41.30, lng: 2.08 }, { code: "AMS", lat: 52.31, lng: 4.76 },
  { code: "FRA", lat: 50.03, lng: 8.57 }, { code: "MUC", lat: 48.35, lng: 11.79 },
  { code: "ZRH", lat: 47.46, lng: 8.55 }, { code: "VIE", lat: 48.11, lng: 16.57 },
  { code: "IST", lat: 41.28, lng: 28.75 }, { code: "ATH", lat: 37.94, lng: 23.95 },
  { code: "LIS", lat: 38.77, lng: -9.14 }, { code: "DUB", lat: 53.43, lng: -6.27 },
  { code: "CPH", lat: 55.62, lng: 12.66 }, { code: "ARN", lat: 59.65, lng: 17.92 },
  { code: "WAW", lat: 52.17, lng: 20.97 }, { code: "CAI", lat: 30.11, lng: 31.41 },
  { code: "DXB", lat: 25.25, lng: 55.36 }, { code: "JED", lat: 21.68, lng: 39.16 },
  { code: "RUH", lat: 24.96, lng: 46.70 }, { code: "TLV", lat: 32.01, lng: 34.89 },
  { code: "AMM", lat: 31.72, lng: 35.99 }, { code: "DOH", lat: 25.27, lng: 51.61 },
  { code: "DEL", lat: 28.56, lng: 77.10 }, { code: "BOM", lat: 19.09, lng: 72.87 },
  { code: "VNS", lat: 25.45, lng: 82.86 }, { code: "KTM", lat: 27.70, lng: 85.36 },
  { code: "BKK", lat: 13.69, lng: 100.75 }, { code: "SIN", lat: 1.36, lng: 103.99 },
  { code: "HKG", lat: 22.31, lng: 113.91 }, { code: "ICN", lat: 37.46, lng: 126.44 },
  { code: "NRT", lat: 35.77, lng: 140.39 }, { code: "SYD", lat: -33.95, lng: 151.18 },
  { code: "MEL", lat: -37.67, lng: 144.84 }, { code: "AKL", lat: -37.01, lng: 174.79 },
  { code: "JNB", lat: -26.14, lng: 28.24 }, { code: "CPT", lat: -33.97, lng: 18.60 },
  { code: "LOS", lat: 6.58, lng: 3.32 }, { code: "NBO", lat: -1.32, lng: 36.93 },
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestAirportCode(lat, lng) {
  let best = null;
  let bestDist = Infinity;
  for (const airport of MAJOR_AIRPORTS) {
    const dist = haversineKm(lat, lng, airport.lat, airport.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = airport;
    }
  }
  return best?.code || null;
}
