// src/lib/invites.js
import { useState, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export function useInvites() {
  const [sending, setSending] = useState(false);

  const sendInvite = useCallback(async ({ method, destination, inviterName, groupName }) => {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/invites/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, destination, inviterName, groupName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send the invite.");
      return data; // { sent: true } or { sent: false, reason }
    } catch (err) {
      return { sent: false, reason: err.message };
    } finally {
      setSending(false);
    }
  }, []);

  return { sendInvite, sending };
}

// Simple heuristic so one input field can accept either an email or a
// phone number and route to the right sending method.
export function detectContactMethod(value) {
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "email";
  if (/^\+?[0-9()\-.\s]{7,}$/.test(trimmed)) return "sms";
  return null;
}
