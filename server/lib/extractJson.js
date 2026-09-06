// server/lib/extractJson.js
//
// Claude sometimes wraps requested JSON in a little conversational
// text (e.g. after using web search: "Europe is a great choice!
// Here's the plan: {...}") even when explicitly told to respond with
// ONLY JSON. Rather than assume the whole response is clean JSON,
// these helpers find and parse just the JSON object/array wherever it
// sits in the text, ignoring anything before or after it.

export function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in the AI response");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export function extractJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON array found in the AI response");
  }
  return JSON.parse(text.slice(start, end + 1));
}
