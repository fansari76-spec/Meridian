// server/lib/extractJson.js
//
// Claude sometimes wraps requested JSON in a little conversational
// text (e.g. after using web search: "Europe is a great choice!
// Here's the plan: {...}") even when explicitly told to respond with
// ONLY JSON. The naive fix — grab everything from the first bracket to
// the LAST bracket in the whole response — breaks if any trailing
// prose after the JSON also happens to contain a stray "]" or "}"
// (a citation, an aside, anything), since that pulls in extra text
// past the real end of the JSON and fails to parse.
//
// This instead tracks actual bracket depth character-by-character
// (correctly ignoring brackets that appear inside quoted strings, so
// something like "a hidden gem [rated 9/10]" in a description field
// doesn't get miscounted) to find the exact matching closing bracket
// for the first opening one — the real end of the JSON, regardless of
// whatever text comes after it.

function findBalancedJson(text, openChar, closeChar) {
  const start = text.indexOf(openChar);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // never balanced — likely truncated
}

export function extractJsonObject(text) {
  const slice = findBalancedJson(text, "{", "}");
  if (!slice) throw new Error("No complete JSON object found in the AI response (it may have been cut off)");
  return JSON.parse(slice);
}

export function extractJsonArray(text) {
  const slice = findBalancedJson(text, "[", "]");
  if (!slice) throw new Error("No complete JSON array found in the AI response (it may have been cut off)");
  return JSON.parse(slice);
}
