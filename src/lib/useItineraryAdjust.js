// src/lib/useItineraryAdjust.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useItineraryAdjust() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const adjustDay = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/itinerary/adjust-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Couldn't adjust today's plan.");
        return null;
      }
      return data.activities;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { adjustDay, loading, error };
}
