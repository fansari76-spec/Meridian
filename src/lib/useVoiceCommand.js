// src/lib/useVoiceCommand.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useVoiceCommand() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const classify = useCallback(async (transcript, context) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/voice-command/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, context }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Couldn't understand that command.");
        return null;
      }
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { classify, loading, error };
}
