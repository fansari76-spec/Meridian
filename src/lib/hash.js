// src/lib/hash.js
//
// SHA-256 hashing done entirely in the browser via the Web Crypto
// API. Used so contact info (emails/phone numbers) is never sent to
// the server in plain text — only the hash is ever transmitted or
// stored, matching how Signal/WhatsApp do contact matching.

export async function sha256Hex(input) {
  const normalized = (input || "").trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
