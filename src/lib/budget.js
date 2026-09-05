// src/lib/budget.js
//
// Computes a full-trip budget from real selections (flight price,
// nightly stay rate, nights, travelers). Food and activities costs
// come from the actual itinerary when one is available — each planned
// activity carries its own estimated per-person cost, so the budget
// reflects what's really scheduled rather than a flat daily guess.
// Falls back to flat per-day estimates only if no itinerary is passed
// in (e.g. itinerary still loading).

const FALLBACK_DAILY_ESTIMATE_PER_PERSON = { food: 35, activities: 22 };
const TRANSPORT_PER_PERSON_PER_DAY = 7; // itinerary doesn't estimate local transport, so this stays flat
const BUFFER_RATE = 0.1;

/**
 * Sums food/activity costs from a generated itinerary plan and
 * averages them into a per-person-per-day figure, so a short
 * generated plan (e.g. 5 days) can be scaled across a longer trip.
 */
function summarizeItinerary(itineraryPlan) {
  if (!itineraryPlan || itineraryPlan.length === 0) return null;

  let foodTotal = 0;
  let activitiesTotal = 0;

  for (const day of itineraryPlan) {
    for (const activity of day.activities || []) {
      const cost = Number(activity.cost) || 0;
      if (activity.category === "food") foodTotal += cost;
      else if (activity.category === "activity") activitiesTotal += cost;
      // category "free" (or missing) contributes $0, intentionally
    }
  }

  const plannedDays = itineraryPlan.length;
  return {
    foodPerPersonPerDay: foodTotal / plannedDays,
    activitiesPerPersonPerDay: activitiesTotal / plannedDays,
  };
}

export function calculateBudget({ flightsTotal, nightlyRate, nights, travelers, itineraryPlan = null }) {
  const flights = flightsTotal;
  const stay = nightlyRate * nights;

  const fromItinerary = summarizeItinerary(itineraryPlan);
  const foodPerPersonPerDay = fromItinerary ? fromItinerary.foodPerPersonPerDay : FALLBACK_DAILY_ESTIMATE_PER_PERSON.food;
  const activitiesPerPersonPerDay = fromItinerary ? fromItinerary.activitiesPerPersonPerDay : FALLBACK_DAILY_ESTIMATE_PER_PERSON.activities;

  const food = foodPerPersonPerDay * nights * travelers;
  const activities = activitiesPerPersonPerDay * nights * travelers;
  const transport = TRANSPORT_PER_PERSON_PER_DAY * nights * travelers;

  const subtotal = flights + stay + food + activities + transport;
  const buffer = Math.round(subtotal * BUFFER_RATE);
  const total = subtotal + buffer;

  return {
    fromItinerary: Boolean(fromItinerary),
    lines: [
      { key: "flights", label: `Flights (${travelers} traveler${travelers > 1 ? "s" : ""})`, amount: Math.round(flights), color: "var(--indigo)" },
      { key: "stay", label: `Stay · ${nights} nights`, amount: Math.round(stay), color: "var(--teal)" },
      { key: "food", label: fromItinerary ? "Food & dining (from itinerary)" : "Food & dining (estimated)", amount: Math.round(food), color: "var(--gold)" },
      { key: "activities", label: fromItinerary ? "Activities & tours (from itinerary)" : "Activities & tours (estimated)", amount: Math.round(activities), color: "#F2B705" },
      { key: "transport", label: "Local transport (estimated)", amount: Math.round(transport), color: "#7EC8E3" },
      { key: "buffer", label: "Buffer (10%)", amount: buffer, color: "#F2A6C4" },
    ],
    total: Math.round(total),
    perPerson: Math.round(total / travelers),
  };
}
