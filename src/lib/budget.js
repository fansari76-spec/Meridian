// src/lib/budget.js
//
// Computes a full-trip budget from real selections (flight price,
// nightly stay rate, nights, travelers) plus reasonable per-day
// estimates for food/activities/transport. These estimate multipliers
// are the one part worth tuning once you have real usage data.

const DAILY_ESTIMATE_PER_PERSON = {
  food: 35,
  activities: 22,
  transport: 7,
};
const BUFFER_RATE = 0.1;

export function calculateBudget({ flightPricePerPerson, nightlyRate, nights, travelers }) {
  const flights = flightPricePerPerson * travelers;
  const stay = nightlyRate * nights;
  const food = DAILY_ESTIMATE_PER_PERSON.food * nights * travelers;
  const activities = DAILY_ESTIMATE_PER_PERSON.activities * nights * travelers;
  const transport = DAILY_ESTIMATE_PER_PERSON.transport * nights * travelers;

  const subtotal = flights + stay + food + activities + transport;
  const buffer = Math.round(subtotal * BUFFER_RATE);
  const total = subtotal + buffer;

  return {
    lines: [
      { key: "flights", label: `Flights (${travelers} traveler${travelers > 1 ? "s" : ""})`, amount: Math.round(flights), color: "var(--indigo)" },
      { key: "stay", label: `Stay · ${nights} nights`, amount: Math.round(stay), color: "var(--teal)" },
      { key: "food", label: "Food & dining", amount: Math.round(food), color: "var(--gold)" },
      { key: "activities", label: "Activities & tours", amount: Math.round(activities), color: "#8A6A2A" },
      { key: "transport", label: "Local transport", amount: Math.round(transport), color: "#B5C4C0" },
      { key: "buffer", label: "Buffer (10%)", amount: buffer, color: "#D8CBAE" },
    ],
    total: Math.round(total),
    perPerson: Math.round(total / travelers),
  };
}
