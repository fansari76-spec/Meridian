// src/lib/usePacking.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function usePacking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState(null);
  const [usedAI, setUsedAI] = useState(false);
  const [warning, setWarning] = useState(null);

  const generate = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/packing/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't build a packing list.");
      const data = await res.json();
      setCategories(data.categories);
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

  return { generate, loading, error, categories, usedAI, warning };
}
