// src/lib/useConversationalTrip.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useConversationalTrip() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const parse = useCallback(async (message) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/conversational-trip/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Couldn't understand that — try rephrasing.");
        return null;
      }
      return data.trip;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { parse, loading, error };
}
