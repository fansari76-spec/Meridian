// src/data/ritualChecklists.js
//
// Checklist of milestone rituals per tradition. Steps with
// `counter: {target, unit}` get the automated Start/Track/Complete
// flow (motion-based step counting → estimated circuit count); steps
// without a counter are simple photo/complete checklist items.
//
// For any step with `duaLink`, we link out to a well-established,
// trusted source for the actual supplication text rather than
// generating it ourselves — precise wording and authentic sourcing of
// anything attributed to the Prophet ﷺ (or any tradition's recommended
// prayers) is not something to guess at.

export const RITUAL_CHECKLISTS = {
  islam: [
    { id: "ihram", name: "Enter Ihram", note: "Intention (niyyah) and the state of ihram begin before crossing the miqat boundary." },
    {
      id: "tawaf",
      name: "Tawaf al-Umrah — circling the Ka'aba",
      counter: { target: 7, unit: "circuit", avgDistanceMeters: 350 },
      duaLink: "https://sunnah.com/search?q=tawaf+dua",
      note: "Each circuit starts and ends at the Black Stone (Hajar al-Aswad).",
    },
    {
      id: "sai",
      name: "Sa'i — between Safa and Marwah",
      counter: { target: 7, unit: "pass", avgDistanceMeters: 450 },
      duaLink: "https://sunnah.com/search?q=sai+safa+marwah+dua",
      note: "Starting at Safa counts as pass 1; ending at Marwah completes pass 7.",
    },
    {
      id: "hair",
      name: "Cutting or shaving the hair",
      note: "Halq (fully shaving) is more rewarded than taqsir (trimming) for men; women trim a small, symbolic portion.",
    },
  ],
  buddhist: [
    { id: "arrival", name: "Arrival & quiet reflection at the site" },
    {
      id: "kora",
      name: "Circumambulation (kora) of the stupa or temple",
      counter: { target: 3, unit: "circuit", avgDistanceMeters: 120 },
      note: "Walk clockwise. Three circuits is traditional; some pilgrims do 108 — adjust the target for your own practice.",
    },
    { id: "offering", name: "Offering (butter lamp, incense, or flowers)" },
  ],
  catholic: [
    { id: "mass", name: "Attend Mass at the basilica or shrine" },
    { id: "confession", name: "Confession, if desired" },
    { id: "relic", name: "Visit the principal relic or shrine site" },
    { id: "candle", name: "Light a votive candle" },
  ],
  christianity: [
    { id: "site", name: "Visit the principal site (e.g. Church of the Holy Sepulchre)" },
    { id: "communion", name: "Take communion, if desired" },
    { id: "reflection", name: "Quiet prayer or reflection at the site" },
  ],
  hindu: [
    { id: "darshan", name: "Darshan (viewing the deity) at the temple" },
    {
      id: "parikrama",
      name: "Parikrama — circumambulation of the temple or ghat",
      counter: { target: 3, unit: "circuit", avgDistanceMeters: 100 },
      note: "Three circuits is common practice; some traditions call for more — adjust the target for your own practice.",
    },
    { id: "aarti", name: "Attend an aarti ceremony" },
    { id: "ganga-snan", name: "Ritual bathing (if at Varanasi/Ganges)" },
  ],
  judaism: [
    { id: "kotel", name: "Visit the Western Wall" },
    { id: "note", name: "Place a written note in the Wall" },
    { id: "prayer", name: "Prayer at the Wall" },
  ],
};
