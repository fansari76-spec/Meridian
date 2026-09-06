// src/lib/useDestinationRecommender.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useDestinationRecommender() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const recommend = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/destinations/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't get destination ideas.");
      const data = await res.json();
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { recommend, loading, error };
}
