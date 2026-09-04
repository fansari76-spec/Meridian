// src/lib/useWeather.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useWeather() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(null);
  const [available, setAvailable] = useState(null);
  const [reason, setReason] = useState(null);

  const fetchForecast = useCallback(async ({ destination, startDate, endDate }) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ destination, startDate: startDate || "", endDate: endDate || "" });
      const res = await fetch(`${API_BASE}/api/weather/forecast?${params.toString()}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't fetch weather.");
      const data = await res.json();
      setAvailable(data.available);
      setDays(data.available ? data.days : null);
      setReason(data.reason || null);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchForecast, loading, error, days, available, reason };
}
