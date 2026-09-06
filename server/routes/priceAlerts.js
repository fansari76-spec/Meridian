// server/routes/priceAlerts.js
//
// POST /api/alerts/check-prices
//
// Meant to be called on a schedule by a Render Cron Job, not by the
// frontend. Re-checks every saved trip's flight price against what
// was saved at trip-save time, and emails the owner via Resend if the
// price has dropped by a meaningful amount. Protected by a shared
// secret header so it can't be triggered by random internet traffic.

import express from "express";
import { getFirebaseAdmin, isFirebaseAdminConfigured } from "../lib/firebaseAdmin.js";
import { searchOneDatePairLive, searchOneDatePairMock, isLiveMode } from "./flights.js";

const router = express.Router();
const DROP_THRESHOLD_PERCENT = 5; // only alert on a real drop, not noise

router.post("/check-prices", async (req, res) => {
  const providedSecret = req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  if (!isFirebaseAdminConfigured()) {
    return res.status(500).json({ error: "FIREBASE_SERVICE_ACCOUNT_KEY isn't set." });
  }
  if (!process.env.RESEND_API_KEY || !process.env.INVITE_FROM_EMAIL) {
    return res.status(500).json({ error: "RESEND_API_KEY / INVITE_FROM_EMAIL aren't set." });
  }

  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const tripsSnap = await db.collection("trips").get();

  let checked = 0;
  let alertsSent = 0;
  const errors = [];

  for (const doc of tripsSnap.docs) {
    const trip = { id: doc.id, ...doc.data() };
    checked++;
    try {
      const passengers = Array.from({ length: trip.travelers || 1 }, () => ({ type: "adult" }));
      const searchParams = { origin: trip.origin, destination: trip.destination, departDate: trip.departDate, returnDate: trip.returnDate, passengers };
      const result = isLiveMode() ? await searchOneDatePairLive(searchParams) : searchOneDatePairMock(searchParams);
      const newPrice = result.cheapestTotal;
      const oldPrice = trip.flightTotal;

      await doc.ref.update({ lastCheckedAt: new Date().toISOString(), lastCheckedPrice: newPrice });

      if (oldPrice && newPrice && newPrice < oldPrice * (1 - DROP_THRESHOLD_PERCENT / 100)) {
        const userSnap = await db.collection("users").doc(trip.userId).get();
        const email = userSnap.exists ? userSnap.data().email : null;
        if (email) {
          await sendPriceDropEmail({ to: email, trip, oldPrice, newPrice });
          alertsSent++;
        }
      }
    } catch (err) {
      errors.push({ tripId: trip.id, error: err.message });
    }
  }

  res.json({ checked, alertsSent, errors });
});

async function sendPriceDropEmail({ to, trip, oldPrice, newPrice }) {
  const savedPct = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
  const tripUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",")[0] : "https://tripami.ai";
  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;"><tr>
<td style="font-size:16px;line-height:1.6;color:#1F2937;">
<p style="margin:0 0 16px;">Good news —</p>
<p style="margin:0 0 16px;">Your saved trip <strong>${trip.origin} → ${trip.destination}</strong> dropped from $${oldPrice} to <strong>$${newPrice}</strong> (about ${savedPct}% less).</p>
<p style="margin:0 0 24px;"><a href="${tripUrl}" style="display:inline-block;background:#24578A;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">View on TripAmi</a></p>
<p style="margin:0;font-size:13px;color:#6B7280;">We check your saved trips periodically and only email you when there's a real drop.</p>
</td></tr></table></td></tr></table></body></html>`.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: process.env.INVITE_FROM_EMAIL, to, subject: `Price drop: ${trip.origin} → ${trip.destination} is now $${newPrice}`, html }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

export default router;
