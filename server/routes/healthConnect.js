// server/routes/healthConnect.js
//
// Google Health OAuth connect flow + real activity data fetching.
//
// GET  /api/health-connect/start?userId=<uid>   — redirects to Google's consent screen
// GET  /api/health-connect/callback             — Google redirects back here with a code
// GET  /api/health-connect/status?userId=<uid>  — is this user connected?
// POST /api/health-connect/disconnect           — clears stored tokens
// GET  /api/health-connect/activity?userId=<uid>&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//      — real steps/distance/floors/calories for the date range
//
// Requires GOOGLE_HEALTH_CLIENT_ID and GOOGLE_HEALTH_CLIENT_SECRET.
// Note: while the OAuth consent screen is in "Testing" mode (sensitive
// scope, unverified app), only accounts added as test users in Google
// Cloud Console can actually complete this flow — everyone else will
// see a Google warning screen. That's expected until app verification
// is submitted and approved.

import express from "express";
import { saveTokens, getValidAccessToken, isConnected, disconnect } from "../lib/googleHealthTokens.js";

const router = express.Router();

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";

function isConfigured() {
  return Boolean(process.env.GOOGLE_HEALTH_CLIENT_ID && process.env.GOOGLE_HEALTH_CLIENT_SECRET);
}

function frontendUrl() {
  return process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",")[0].trim() : "https://tripami.ai";
}

function redirectUri() {
  // Must exactly match what's registered in Google Cloud Console.
  return `https://meridian-op1u.onrender.com/api/health-connect/callback`;
}

router.get("/start", (req, res) => {
  const { userId } = req.query;
  if (!isConfigured()) {
    return res.status(500).send("Google Health isn't configured on the server yet.");
  }
  if (!userId) {
    return res.status(400).send("Missing userId.");
  }

  const state = Buffer.from(JSON.stringify({ userId, nonce: Math.random().toString(36).slice(2) })).toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // needed to get a refresh token
    prompt: "consent", // forces a fresh refresh token even on repeat connects
    state,
  });

  res.redirect(`${AUTH_URL}?${params.toString()}`);
});

router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const fe = frontendUrl();

  if (error) {
    return res.redirect(`${fe}/?health_connect=error&reason=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(`${fe}/?health_connect=error&reason=missing_code`);
  }

  let userId;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    userId = decoded.userId;
  } catch {
    return res.redirect(`${fe}/?health_connect=error&reason=bad_state`);
  }
  if (!userId) {
    return res.redirect(`${fe}/?health_connect=error&reason=no_user`);
  }

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_HEALTH_CLIENT_ID,
        client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri(),
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
    const tokenJson = await tokenRes.json();

    await saveTokens(userId, {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      expiresIn: tokenJson.expires_in,
    });

    return res.redirect(`${fe}/?health_connect=success`);
  } catch (err) {
    console.error(err);
    return res.redirect(`${fe}/?health_connect=error&reason=token_exchange_failed`);
  }
});

router.get("/status", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId is required." });
  const connected = await isConnected(userId);
  res.json({ connected });
});

router.post("/disconnect", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required." });
  await disconnect(userId);
  res.json({ success: true });
});

router.get("/activity", async (req, res) => {
  const { userId, startDate, endDate } = req.query;
  if (!userId || !startDate || !endDate) {
    return res.status(400).json({ error: "userId, startDate, and endDate are required." });
  }

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return res.status(200).json({ connected: false, error: "Not connected to Google Health." });
  }

  try {
    const [steps, distance, floors, calories] = await Promise.all([
      fetchDailyRollup(accessToken, "steps", startDate, endDate),
      fetchDailyRollup(accessToken, "distance", startDate, endDate),
      fetchDailyRollup(accessToken, "floors", startDate, endDate),
      fetchDailyRollup(accessToken, "totalCalories", startDate, endDate),
    ]);
    res.json({ connected: true, steps, distance, floors, calories });
  } catch (err) {
    console.error(err);
    res.status(502).json({ connected: true, error: `Couldn't fetch activity data: ${err.message}` });
  }
});

async function fetchDailyRollup(accessToken, dataType, startDate, endDate) {
  const url = `https://healthapi.googleapis.com/v1/users/me/dataTypes/${dataType}/dailyRollup?startDate=${startDate}&endDate=${endDate}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`${dataType} fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export default router;
