// src/lib/useStaySearch.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useStaySearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stays, setStays] = useState(null);
  const [usedMockData, setUsedMockData] = useState(true);

  const search = useCallback(async (location, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/stays/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, ...options }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Stay search failed");
      const data = await res.json();
      setStays(data.stays);
      setUsedMockData(data.usedMockData);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { search, loading, error, stays, usedMockData };
}
