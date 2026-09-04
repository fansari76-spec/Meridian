// src/lib/useItinerary.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useItinerary() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [usedAI, setUsedAI] = useState(false);
  const [warning, setWarning] = useState(null);

  const generate = useCallback(async ({ destination, days, interests, cuisine, faithTradition, travelParty, pace, budgetStyle, occasion, dietaryRestrictions, favoriteCuisines, accessibilityNotes, otherNotes }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/itinerary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, days, interests, cuisine, faithTradition, travelParty, pace, budgetStyle, occasion, dietaryRestrictions, favoriteCuisines, accessibilityNotes, otherNotes }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Itinerary generation failed");
      const data = await res.json();
      setPlan(data.plan);
      setUsedAI(data.usedAI);
      setWarning(data.warning || null);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error, plan, usedAI, warning };
}
