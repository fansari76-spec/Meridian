// src/data/pilgrimage.js
//
// Each tradition now carries booking-ready defaults: a primary
// gateway airport, a suggested dietary filter, and a typical
// city-by-city itinerary template modeled on how established tour
// operators structure these trips (nights per city, not just a list
// of names). "Plan this pilgrimage" on the Pilgrimage tab uses these
// to pre-fill the flight search and to steer the AI itinerary
// generator toward the real, standard circuit instead of a generic
// guess.

export function totalPilgrimageNights(site) {
  return site.typicalItinerary.reduce((sum, stop) => sum + stop.nights, 0);
}

export const PILGRIMAGE_SITES = [
  {
    id: "buddhist",
    icon: "☸️",
    name: "Buddhism",
    summary: "The four great sites of the Buddha's life, plus monastery stays and silent retreats.",
    dest: "Bodh Gaya, Sarnath, Lumbini",
    timing: "October–March avoids the hottest/monsoon months. Buddha Purnima is most significant but most crowded, especially at Bodh Gaya.",
    logistics: "Spans India and Nepal — flag border/visa needs. Group Bodh Gaya–Sarnath–Kushinagar as one leg, Lumbini as a separate Nepal add-on.",
    dietary: "Vegetarian is the default suggestion, in keeping with practice, though not strictly required. Monastery guesthouses are a low-cost lodging option.",
    airportCode: "VNS",
    suggestedDietary: ["Vegetarian"],
    typicalItinerary: [
      { city: "Bodh Gaya", nights: 2, highlights: ["Mahabodhi Temple, where the Buddha attained enlightenment", "Bodhi Tree and the Great Buddha Statue", "International monasteries (Thai, Tibetan, Japanese temples)"] },
      { city: "Sarnath (via Varanasi)", nights: 1, highlights: ["Dhamek Stupa, site of the Buddha's first sermon", "Sarnath Archaeological Museum"] },
      { city: "Kushinagar", nights: 1, highlights: ["Mahaparinirvana Temple, site of the Buddha's death", "Ramabhar Stupa"] },
      { city: "Lumbini, Nepal", nights: 1, highlights: ["Maya Devi Temple, the Buddha's birthplace", "Sacred Garden and the Ashoka Pillar"] },
    ],
  },
  {
    id: "catholic",
    icon: "🕎",
    name: "Catholicism",
    summary: "Vatican access, Marian shrines, and Camino routes with pace built for walking pilgrims.",
    dest: "Vatican City, Lourdes, Santiago",
    timing:
      "Vatican & Lourdes: year-round, busiest at Holy Week. Camino: April–October for weather; it's walking-paced (10–25 km/day), not a city-visit itinerary.",
    logistics: "Papal audience tickets are free but need advance reservation. Camino has multiple starting routes — treat as its own pace/length decision.",
    dietary: "Standard cuisine filters apply. Camino albergues (pilgrim hostels) are a distinct budget lodging type.",
    airportCode: "FCO",
    suggestedDietary: [],
    typicalItinerary: [
      { city: "Rome & Vatican City", nights: 3, highlights: ["St. Peter's Basilica and the Vatican Museums", "Sistine Chapel", "Papal general audience (Wed, when scheduled)"] },
      { city: "Assisi", nights: 1, highlights: ["Basilica of San Francesco", "Basilica of Santa Chiara"] },
      { city: "Lourdes, France", nights: 2, highlights: ["Sanctuary of Our Lady of Lourdes", "The Grotto of Massabielle", "Torchlight Marian procession (evenings)"] },
    ],
    optionalExtension: "The Camino de Santiago is typically its own 5–10 day walking trip rather than an add-on — worth planning as a separate itinerary if walking the full route.",
  },
  {
    id: "christianity",
    icon: "✝️",
    name: "Christianity",
    summary: "Holy Land routes tracing the New Testament, from Nazareth to the Sea of Galilee.",
    dest: "Jerusalem, Bethlehem, Nazareth",
    timing: "Year-round; Easter week and Christmas in Bethlehem are most significant and most crowded.",
    logistics:
      "Bethlehem is in the West Bank — check current entry requirements before finalizing dates. A private driver or guided tour helps cover the Galilee–Jerusalem spread.",
    dietary: "No tradition-specific requirement; standard cuisine filters apply. Religious-order guesthouses are a popular lodging category.",
    airportCode: "TLV",
    suggestedDietary: [],
    typicalItinerary: [
      { city: "Nazareth & Galilee", nights: 2, highlights: ["Basilica of the Annunciation", "Sea of Galilee boat ride", "Capernaum and the Mount of Beatitudes"] },
      { city: "Jerusalem", nights: 3, highlights: ["Church of the Holy Sepulchre", "Via Dolorosa", "Garden of Gethsemane and the Mount of Olives"] },
      { city: "Bethlehem (day trip)", nights: 0, highlights: ["Church of the Nativity"] },
    ],
  },
  {
    id: "hindu",
    icon: "🕉️",
    name: "Hinduism",
    summary: "River Ganges rites at Varanasi and the Char Dham circuit, timed to festival calendars.",
    dest: "Varanasi, Char Dham",
    timing:
      "Varanasi: year-round, best October–March. Char Dham: strictly seasonal, roughly May–Oct/Nov due to Himalayan winter closures — block dates outside this window.",
    logistics: "Char Dham involves major elevation change and multi-day road travel — physically demanding; ask about fitness/pace before planning.",
    dietary: "Vegetarian is standard and widely available across both regions.",
    airportCode: "VNS",
    suggestedDietary: ["Vegetarian"],
    typicalItinerary: [
      { city: "Varanasi", nights: 3, highlights: ["Dashashwamedh Ghat evening Ganga Aarti", "Sunrise boat ride on the Ganges", "Kashi Vishwanath Temple"] },
      { city: "Sarnath (day trip)", nights: 0, highlights: ["Dhamek Stupa and deer park"] },
    ],
    optionalExtension: "The Char Dham circuit (Yamunotri, Gangotri, Kedarnath, Badrinath) is typically its own 8–10 day mountain circuit, strictly May–October — plan separately from a Varanasi trip.",
  },
  {
    id: "islam",
    icon: "☪️",
    name: "Islam",
    summary: "Hajj & Umrah planning — visa windows, group logistics, and halal dining throughout.",
    dest: "Mecca & Medina, Saudi Arabia",
    timing:
      "Hajj falls on fixed lunar-calendar dates that shift ~11 days earlier each Gregorian year. Umrah has no fixed season; many prefer Ramadan despite higher cost and crowds.",
    logistics:
      "Requires a dedicated Hajj/Umrah visa, usually processed through an authorized group operator due to country quotas. Ihram and specific rites are prep items, not itinerary stops.",
    dietary: "Halal is the default across Mecca and Medina — no special filtering needed locally.",
    airportCode: "MED",
    suggestedDietary: ["Halal"],
    typicalItinerary: [
      { city: "Medina", nights: 4, highlights: ["Al-Masjid an-Nabawi (the Prophet's Mosque)", "Quba Mosque", "Mount Uhud"] },
      { city: "Mecca", nights: 5, highlights: ["Masjid al-Haram and Umrah rites", "Mount Arafat and Mina (Hajj season only)", "Jabal al-Nour (Cave of Hira)"] },
    ],
  },
  {
    id: "judaism",
    icon: "✡️",
    name: "Judaism",
    summary: "Heritage and holy-site travel with kosher stays and Shabbat-aware scheduling.",
    dest: "Jerusalem & the Western Wall",
    timing:
      "Year-round; Jewish holidays (Sukkot, Passover, Rosh Hashanah) draw large crowds and carry religious significance — book months ahead for High Holy Days.",
    logistics:
      "Shabbat (Friday sundown–Saturday night) affects transport and shops — schedule lighter, walking-only activity during this window for observant travelers.",
    dietary: "Kosher-certified restaurants and hotels are widely available; filter for certification, not just vegetarian.",
    airportCode: "TLV",
    suggestedDietary: ["Kosher"],
    typicalItinerary: [
      { city: "Jerusalem", nights: 4, highlights: ["The Western Wall and the Old City", "Yad Vashem", "Mount of Olives and the Jewish Quarter"] },
      { city: "Dead Sea & Masada (day trip)", nights: 1, highlights: ["Masada at sunrise", "Floating in the Dead Sea"] },
    ],
  },
];
