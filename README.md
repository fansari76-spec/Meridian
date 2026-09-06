# TripAmi — full app

This is a complete, runnable app: React frontend + Express backend,
covering sign-in, flight search, hotel/stay browsing, a live budget
calculator, a rule-based itinerary generator, and the pilgrimage
category. It works out of the box in **demo mode** (realistic mock
data, no API keys needed) and upgrades to **live mode** the moment you
add your own free Firebase and Duffel keys — no code changes required,
just environment variables.

## Run it (demo mode, 2 minutes, no signup needed)

You'll need [Node.js](https://nodejs.org) installed (v18+).

**Terminal 1 — backend:**
```bash
cd server
npm install
npm run dev
```
You should see: `TripAmi API listening on http://localhost:4000 — mode: DEMO`

**Terminal 2 — frontend:**
```bash
npm install
npm run dev
```
Open the URL it prints (usually `http://localhost:5173`).

At this point: search works (mock fares that vary sensibly by date),
hotel sort/filter works, budget calculates live, itinerary rebuilds as
you toggle interests, pilgrimage tab is fully populated, and sign-in
shows a clear "demo mode" note instead of crashing.

## Upgrade to live mode

### Real flight search (Duffel)
1. Sign up free at [duffel.com](https://duffel.com), grab a **test**
   API key from the dashboard (no approval wait — test mode is
   instant and returns realistic offers).
2. Create `server/.env` (copy `.env.example`), set `DUFFEL_API_KEY=`.
3. Restart the backend — the console will now say `flights:LIVE`.
4. **Note:** test-mode prices are still not real. To get real, current
   fares, activate your Duffel account to live mode from the dashboard
   (requires identity + payment verification), then use a
   `duffel_live_` key instead.

### Real hotel listings (Google Places)
1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project, enable the **Places API**, create an API key under Credentials — instant, no approval wait.
2. Add `GOOGLE_PLACES_API_KEY=` to `server/.env`.
3. Restart the backend — `stays:LIVE`. You'll get real hotel names, addresses, ratings, and photos. Note: Places doesn't expose real nightly rates or booking, so prices shown are an estimate based on Google's price-level bucket — for real bookable rates, the next step is Booking.com's Affiliate API.

### AI-generated itineraries (Claude)
1. Get an API key at [console.anthropic.com](https://console.anthropic.com).
2. Add `ANTHROPIC_API_KEY=` to `server/.env`.
3. Restart the backend — `itinerary:LIVE`. The itinerary tab now generates a real, destination-specific plan instead of picking from templates.

### Real sign-in + saved trips (Firebase)
1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) (free).
2. Authentication → Sign-in method → enable **Google**, **Apple**
   (this is what powers the "iCloud" button), and add **Yahoo** as a
   generic OpenID Connect provider.
3. Firestore Database → Create database (start in test mode for
   development).
4. Project settings → General → "Your apps" → copy the config values
   into a `.env.local` file in the project root (copy `.env.example`).
5. Restart the frontend. Sign-in buttons now open real provider
   popups, and "Save this trip" writes to Firestore instead of memory.

### Email invites (Resend)
1. Sign up at [resend.com](https://resend.com) (free tier is generous).
2. Add and verify a domain you own under Domains — this adds a couple
   of DNS records (SPF/DKIM) and is the single biggest factor in
   invite emails landing in the inbox instead of spam.
3. Create an API key, add `RESEND_API_KEY=` to `server/.env` (or
   Render's environment variables in production).
4. Add `INVITE_FROM_EMAIL=` — a verified address on that domain, e.g.
   `invites@yourdomain.com`.
5. Restart the backend — `emailInvites:live` on `/health`. Family
   invites in My Groups now send a real email instead of a "not
   connected" message.

### SMS invites (Twilio)
1. Sign up at [twilio.com](https://twilio.com), buy a phone number.
2. In the US, sending business SMS at real volume requires
   registering for A2P 10DLC through Twilio's console — a
   carrier-required anti-spam step, separate from the API key itself.
3. Add `TWILIO_ACCOUNT_SID=`, `TWILIO_AUTH_TOKEN=`, and
   `TWILIO_FROM_NUMBER=` (your Twilio number, e.g. `+15551234567`) to
   `server/.env` / Render's environment variables.
4. Restart the backend — `smsInvites:live` on `/health`.

## What's genuinely complete vs. what's next

**Complete and working today:**
- Flight search with sort/filter and a real flexible-date scan
- Hotel/Airbnb/Vrbo-styled results with working sort (rating, price, distance, safety)
- Budget calculator, computed live from your actual selections
- Rule-based itinerary generator, rebuilds instantly from selected interests + cuisine
- Pilgrimage category, all 6 traditions with real timing/logistics/dietary content
- Auth (Google/Apple/Yahoo) and trip-saving — real once Firebase is connected, stubbed gracefully before that

**Deliberately not built yet (see the earlier roadmap doc for why):**
- Native 1-click checkout — "book" buttons link out to the airline/hotel's own site
- Live Airbnb/Vrbo inventory — no public booking API exists for either; v1 uses styled demo listings you can later wire to Booking.com's affiliate API for real hotel data
- Deploying this to a live domain — that's a `vite build` + hosting step (Vercel or Firebase Hosting both work well) once you're ready to go live

## Project structure

```
src/
  App.jsx                 Main app — all 5 tabs, all state
  index.css                 Full design system
  lib/
    firebase.js              Auth init, demo-mode fallback
    trips.js                  Save/load trips (Firestore or in-memory)
    useFlightSearch.js        Frontend hook for the search API
    itinerary.js               Rule-based day-plan generator
    budget.js                   Budget math
  components/
    AuthButtons.jsx           Sign-in buttons
  data/
    pilgrimage.js               The 6 pilgrimage destination entries
server/
  index.js                  Express entry point
  routes/flights.js          Search route — live Duffel or demo fallback
```
