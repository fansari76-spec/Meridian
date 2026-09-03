// src/lib/itinerary.js
//
// Rule-based itinerary generation: no external AI call needed, so this
// works fully offline/in demo mode. Swap the `pickActivities` selection
// logic for a Claude API call later if you want generated (rather than
// templated) day plans — the shape of the output stays the same either
// way, so nothing downstream has to change.

const ACTIVITY_BANK = {
  "slow-mornings": [
    { time: "9:30a", name: "Late breakfast at a local café", desc: "No plans before 10 — settle in before the day starts." },
  ],
  "food-focused": [
    { time: "1:00p", name: "Food market crawl", desc: "Sample local specialties at the city's main market." },
    { time: "8:00p", name: "Dinner at a highly-rated local spot", desc: "Matched to your cuisine preference." },
  ],
  "museums-history": [
    { time: "10:00a", name: "Flagship history museum", desc: "Book the first entry slot to skip the midday lines." },
  ],
  "live-music": [
    { time: "9:00p", name: "Live music venue", desc: "Local performance — reservation recommended." },
  ],
  "hiking-outdoors": [
    { time: "8:00a", name: "Morning hike or coastal walk", desc: "Best light and cooler temps earlier in the day." },
  ],
  nightlife: [
    { time: "10:30p", name: "Rooftop bar or late spot", desc: "Popular with locals, not just tourists." },
  ],
  shopping: [
    { time: "3:00p", name: "Independent shops & design district", desc: "Skip the chain stores — local makers instead." },
  ],
};

const CUISINE_NOTE = {
  halal: "halal-certified menu confirmed",
  kosher: "kosher-certified menu confirmed",
  vegetarian: "vegetarian menu confirmed",
  vegan: "fully vegan menu confirmed",
  "gluten-free": "gluten-free options confirmed",
  pescatarian: "pescatarian-friendly menu confirmed",
};

/**
 * Builds a simple multi-day plan. `interests` is an array of keys from
 * ACTIVITY_BANK; `cuisine` is a key from CUISINE_NOTE or null.
 */
export function generateItinerary({ days = 3, interests = [], cuisine = null, startDate }) {
  const chosenInterests = interests.length ? interests : ["slow-mornings", "food-focused"];
  const plan = [];

  for (let i = 0; i < days; i++) {
    const dayActivities = [];
    // Rotate through chosen interests so each day gets variety rather
    // than repeating the same one every day.
    const interestForDay = chosenInterests[i % chosenInterests.length];
    const bankEntries = ACTIVITY_BANK[interestForDay] || [];

    bankEntries.forEach((activity) => {
      const isDining = activity.name.toLowerCase().includes("dinner") || activity.name.toLowerCase().includes("market");
      dayActivities.push({
        ...activity,
        desc: isDining && cuisine && CUISINE_NOTE[cuisine] ? `${activity.desc} — ${CUISINE_NOTE[cuisine]}.` : activity.desc,
        tag: interestForDay,
      });
    });

    if (dayActivities.length === 0) {
      dayActivities.push({
        time: "Open",
        name: "Nothing booked yet",
        desc: "Select a few interests above to fill this day in.",
        tag: null,
      });
    }

    const date = startDate ? shiftDate(startDate, i) : null;
    plan.push({ dayNumber: i + 1, date, activities: dayActivities });
  }

  return plan;
}

function shiftDate(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
