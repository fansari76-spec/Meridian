// src/lib/useFlightSearch.js
//
// Calls the backend's /api/flights/search endpoint. Works whether the
// backend is running in live mode (real Duffel key) or demo mode (no
// key set) — the backend itself decides which, and flags it in the
// response so the UI can show a small "demo data" note.

import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useFlightSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const search = useCallback(async ({ origin, destination, departDate, returnDate, travelers, passengers, flexDays = 14 }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/flights/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, departDate, returnDate, travelers, passengers, flexDays }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Search failed (${res.status})`);
      }
      const data = await res.json();
      setResults(data);
      return data;
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Can't reach the search server. Is it running? See README.md."
          : err.message
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { search, loading, error, results };
}
