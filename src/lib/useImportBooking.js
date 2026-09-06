// src/lib/useImportBooking.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useImportBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const importBooking = useCallback(async (files) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      files.forEach((f) => { if (f) formData.append("files", f); });
      const res = await fetch(`${API_BASE}/api/import-booking/extract`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Couldn't read that confirmation.");
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

  return { importBooking, loading, error };
}
