// src/lib/useHealthConnect.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useHealthConnect() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkStatus = useCallback(async (userId) => {
    if (!userId) return false;
    try {
      const res = await fetch(`${API_BASE}/api/health-connect/status?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      return Boolean(data.connected);
    } catch {
      return false;
    }
  }, []);

  const startConnect = useCallback((userId) => {
    window.location.href = `${API_BASE}/api/health-connect/start?userId=${encodeURIComponent(userId)}`;
  }, []);

  const disconnectAccount = useCallback(async (userId) => {
    await fetch(`${API_BASE}/api/health-connect/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  }, []);

  const fetchActivity = useCallback(async (userId, startDate, endDate) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ userId, startDate, endDate });
      const res = await fetch(`${API_BASE}/api/health-connect/activity?${params.toString()}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
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

  return { checkStatus, startConnect, disconnectAccount, fetchActivity, loading, error };
}
