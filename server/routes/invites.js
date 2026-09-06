// server/routes/invites.js
//
// POST /api/invites/send
// body: { method: "email" | "sms", destination, inviterName, groupName }
//
// Sends a real invite to join a trip on TripAmi — email via Resend,
// SMS via Twilio. Both need real accounts and API keys; there is no
// meaningful demo fallback for actually delivering a message to
// someone's inbox or phone, so this returns a clear, honest "not
// configured yet" response instead of pretending to send anything.
//
// Uses plain fetch against each provider's REST API directly (same
// pattern as every other integration in this app), so no extra
// npm packages are needed.

import express from "express";

const router = express.Router();

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.INVITE_FROM_EMAIL);
}

function isSmsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

router.post("/send", async (req, res) => {
  const { method, destination, inviterName, groupName } = req.body;

  if (!method || !destination || !inviterName) {
    return res.status(400).json({ error: "method, destination, and inviterName are required." });
  }

  const signupUrl = `${process.env.FRONTEND_URL || "https://tripami.app"}/?invited_to=${encodeURIComponent(groupName || "")}`;

  try {
    if (method === "email") {
      if (!isEmailConfigured()) {
        return res.json({
          sent: false,
          reason: "Email isn't connected yet — add RESEND_API_KEY and INVITE_FROM_EMAIL (a verified sending address on your Resend domain) in Render's environment variables. See README.md.",
        });
      }
      await sendInviteEmail({ to: destination, inviterName, groupName, signupUrl });
      return res.json({ sent: true });
    }

    if (method === "sms") {
      if (!isSmsConfigured()) {
        return res.json({
          sent: false,
          reason: "SMS isn't connected yet — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in Render's environment variables. See README.md.",
        });
      }
      await sendInviteSms({ to: destination, inviterName, groupName, signupUrl });
      return res.json({ sent: true });
    }

    return res.status(400).json({ error: "method must be 'email' or 'sms'." });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: `Couldn't send the invite: ${err.message}` });
  }
});

// ---------------------------------------------------------------------
// Email — Resend
// ---------------------------------------------------------------------

async function sendInviteEmail({ to, inviterName, groupName, signupUrl }) {
  const html = buildInviteEmailHtml({ inviterName, groupName, signupUrl });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.INVITE_FROM_EMAIL,
      to,
      subject: `${inviterName} invited you on a trip${groupName ? ` — ${groupName}` : ""}`,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

// Deliberately plain: minimal HTML, one clear link, no marketing
// styling, no tracking pixels, no urgency language — the things that
// most commonly trip spam filters and that make a personal invite
// feel like a mass email.
function buildInviteEmailHtml({ inviterName, groupName, signupUrl }) {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#ffffff; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <tr>
              <td style="font-size:16px; line-height:1.6; color:#1F2937;">
                <p style="margin:0 0 16px;">Hi,</p>
                <p style="margin:0 0 16px;">
                  ${inviterName} is planning a trip${groupName ? ` — <strong>${groupName}</strong>` : ""} — and added you.
                </p>
                <p style="margin:0 0 24px;">
                  TripAmi is where the group can see flights, hotels, and the day-by-day plan together in one place.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${signupUrl}" style="display:inline-block; background:#24578A; color:#ffffff; text-decoration:none; padding:12px 22px; border-radius:8px; font-weight:600;">
                    Join the trip
                  </a>
                </p>
                <p style="margin:0; font-size:13px; color:#6B7280;">
                  If you weren't expecting this, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

// ---------------------------------------------------------------------
// SMS — Twilio
// ---------------------------------------------------------------------

async function sendInviteSms({ to, inviterName, groupName, signupUrl }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const body = `${inviterName} invited you on a trip${groupName ? ` (${groupName})` : ""} on TripAmi. Create an account to join: ${signupUrl}`;

  const params = new URLSearchParams({
    To: to,
    From: process.env.TWILIO_FROM_NUMBER,
    Body: body,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${accountSid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
    },
    body: params,
  });
  if (!res.ok) throw new Error(`Twilio error ${res.status}: ${await res.text()}`);
}

export default router;
