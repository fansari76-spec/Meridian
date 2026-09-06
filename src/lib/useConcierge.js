// src/lib/useConcierge.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useConcierge() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async ({ destination, currentPlan, message, history }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/concierge/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, currentPlan, message, history }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Ami couldn't respond.");
      return await res.json();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendMessage, loading, error };
}
