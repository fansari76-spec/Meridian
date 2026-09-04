import { useState, useEffect, useMemo } from "react";
import AuthButtons from "./components/AuthButtons.jsx";
import { PILGRIMAGE_SITES } from "./data/pilgrimage.js";
import { calculateBudget } from "./lib/budget.js";
import { useFlightSearch } from "./lib/useFlightSearch.js";
import { useStaySearch } from "./lib/useStaySearch.js";
import { useItinerary } from "./lib/useItinerary.js";
import { subscribeToAuthChanges, signOutUser, isFirebaseConfigured } from "./lib/firebase.js";
import { saveTrip, loadTrips } from "./lib/trips.js";
import { saveSharedTrip, getSharedTrip } from "./lib/sharedTrips.js";

const TABS = [
  { id: "search", label: "Flights & Stays" },
  { id: "preferences", label: "Preferences" },
  { id: "budget", label: "Budget" },
  { id: "itinerary", label: "Itinerary" },
  { id: "pilgrimage", label: "Pilgrimage" },
  { id: "account", label: "Account" },
];

const INTEREST_OPTIONS = [
  { id: "slow-mornings", label: "Slow mornings" },
  { id: "food-focused", label: "Food-focused" },
  { id: "museums-history", label: "Museums & history" },
  { id: "live-music", label: "Live music" },
  { id: "hiking-outdoors", label: "Hiking / outdoors" },
  { id: "nightlife", label: "Nightlife" },
  { id: "shopping", label: "Shopping" },
];

const CUISINE_OPTIONS = ["Halal", "Kosher", "Vegetarian", "Vegan", "Gluten-free", "Pescatarian"];

const DIETARY_OPTIONS = ["Halal", "Kosher", "Vegetarian", "Vegan", "Gluten-free", "Pescatarian", "Nut allergy", "Dairy-free"];
const CUISINE_TYPE_OPTIONS = ["Italian", "Japanese", "Mexican", "Indian", "Thai", "Mediterranean", "French", "Chinese", "Middle Eastern", "American"];

// Every field here is optional — no question is required to search,
// book, or get an itinerary. Answers just sharpen the recommendations.
const PREFERENCE_QUESTIONS = [
  { key: "travelParty", label: "Who's traveling?", options: ["Solo", "Couple", "Family with kids", "Friends group"] },
  { key: "pace", label: "How do you like to move through a day?", options: ["Packed & efficient", "Balanced", "Slow & relaxed"] },
  { key: "budgetStyle", label: "What's your budget style?", options: ["Budget-conscious", "Mid-range", "Luxury"] },
  { key: "stayType", label: "Preferred place to stay?", options: ["Hotel", "Airbnb / Vrbo", "Boutique", "Resort"] },
  { key: "flightPriority", label: "What matters most for flights?", options: ["Cheapest fare", "Fewest stops", "Best departure times"] },
  { key: "occasion", label: "Special occasion?", options: ["None", "Honeymoon", "Anniversary", "Birthday", "Pilgrimage"] },
];

function toggleSingleAnswer(prefs, setPrefs, key, value) {
  setPrefs((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
}

// Multi-select toggle: adds to the end of the array if not present
// (preserving click order — used for "rank your favorites"), removes
// it if it's already there.
function toggleMultiAnswer(setPrefs, key, value) {
  setPrefs((prev) => {
    const current = prev[key] || [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    return { ...prev, [key]: next };
  });
}

function answeredCount(prefs) {
  let count = 0;
  for (const q of PREFERENCE_QUESTIONS) if (prefs[q.key]) count++;
  if (prefs.dietaryRestrictions?.length) count++;
  if (prefs.favoriteCuisines?.length) count++;
  if (prefs.accessibilityNotes?.trim()) count++;
  if (prefs.otherNotes?.trim()) count++;
  return count;
}

// --- Top-pick scoring — uses whatever preferences were answered,
// falls back to sensible defaults (best value / highest rated) when
// a question was left blank. ---

function pickTopFlightId(offers, prefs) {
  if (!offers?.length) return null;
  if (prefs.flightPriority === "Cheapest fare") {
    return [...offers].sort((a, b) => a.totalAmount - b.totalAmount)[0].id;
  }
  if (prefs.flightPriority === "Fewest stops") {
    return [...offers].sort((a, b) => (a.slices[0]?.stops ?? 9) - (b.slices[0]?.stops ?? 9) || a.totalAmount - b.totalAmount)[0].id;
  }
  if (prefs.flightPriority === "Best departure times") {
    const isDaytime = (iso) => {
      const h = new Date(iso).getHours();
      return h >= 8 && h <= 20;
    };
    const daytime = offers.filter((o) => isDaytime(o.slices[0]?.departure));
    return (daytime.length ? daytime : offers).sort((a, b) => a.totalAmount - b.totalAmount)[0].id;
  }
  return offers[0].id; // already sorted best-value by the backend
}

function pickTopStayId(stays, prefs) {
  if (!stays?.length) return null;
  let candidates = stays;
  if (prefs.stayType) {
    const matched = stays.filter((s) => s.source && prefs.stayType.toLowerCase().includes(s.source.toLowerCase()));
    if (matched.length) candidates = matched;
  }
  if (prefs.budgetStyle === "Budget-conscious") {
    return [...candidates].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0].id;
  }
  if (prefs.budgetStyle === "Luxury") {
    return [...candidates].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0].id;
  }
  return [...candidates].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0].id;
}

const PERIOD_LABELS = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const PERIOD_ORDER = ["morning", "afternoon", "evening", "unscheduled"];

function groupByPeriod(activities) {
  const buckets = { morning: [], afternoon: [], evening: [], unscheduled: [] };
  for (const a of activities) {
    const key = PERIOD_LABELS[a.period] ? a.period : "unscheduled";
    buckets[key].push(a);
  }
  return PERIOD_ORDER.filter((key) => buckets[key].length > 0).map((key) => [key, buckets[key]]);
}

export default function App() {
  const [activeTab, setActiveTab] = useState("search");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [form, setForm] = useState({
    origin: "JFK",
    destination: "LIS",
    departDate: "2026-10-12",
    returnDate: "2026-10-19",
    travelers: 2,
  });
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedFlexOffset, setSelectedFlexOffset] = useState(null);
  const [selectedStay, setSelectedStay] = useState(null);
  const [staySortBy, setStaySortBy] = useState("rating");
  const [cuisine, setCuisine] = useState("Halal");
  const [interests, setInterests] = useState(["slow-mornings", "food-focused", "live-music"]);
  const [selectedFaith, setSelectedFaith] = useState(null);
  const [prefs, setPrefs] = useState({
    travelParty: null,
    pace: null,
    budgetStyle: null,
    stayType: null,
    flightPriority: null,
    occasion: null,
    dietaryRestrictions: [],
    favoriteCuisines: [],
    accessibilityNotes: "",
    otherNotes: "",
  });
  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [saveStatus, setSaveStatus] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [shareStatus, setShareStatus] = useState(null);

  const { search, loading, error, results } = useFlightSearch();
  const { search: searchStays, loading: staysLoading, stays: fetchedStays, usedMockData: staysUsedMock } = useStaySearch();
  const { generate: generateItineraryAI, loading: itineraryLoading, plan: aiPlan, usedAI } = useItinerary();

  useEffect(() => {
    const unsub = subscribeToAuthChanges((u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (user) loadTrips(user.uid).then(setTrips);
  }, [user]);

  // If this page was opened via a "Duplicate this trip" link
  // (?duplicate=<id>), pre-fill the search form and preferences from
  // that shared trip so the visitor starts from a real starting point
  // instead of a blank form.
  useEffect(() => {
    const dupId = new URLSearchParams(window.location.search).get("duplicate");
    if (!dupId) return;
    getSharedTrip(dupId).then((trip) => {
      if (!trip) return;
      setForm((f) => ({
        ...f,
        origin: trip.origin || f.origin,
        destination: trip.destination || f.destination,
        departDate: trip.departDate || f.departDate,
        returnDate: trip.returnDate || f.returnDate,
        travelers: trip.travelers || f.travelers,
      }));
      if (trip.interests) setInterests(trip.interests);
      if (trip.cuisine) setCuisine(trip.cuisine);
      if (trip.prefs) setPrefs((p) => ({ ...p, ...trip.prefs }));
      setSaveStatus("Loaded from a shared trip — search above to get real flights and hotels for these dates.");
      setActiveTab("itinerary");
    });
  }, []);

  // Fetch stays once on load and whenever the destination or dates change.
  useEffect(() => {
    searchStays(form.destination, {
      checkIn: form.departDate,
      checkOut: form.returnDate,
      travelers: form.travelers,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.destination, form.departDate, form.returnDate, form.travelers]);

  // Regenerate the itinerary whenever destination, interests, cuisine,
  // preferences, or trip length change — debounced slightly so rapid
  // chip-toggling doesn't fire a request per click.
  useEffect(() => {
    const timeout = setTimeout(() => {
      generateItineraryAI({
        destination: form.destination,
        days: Math.min(nightsFromDates(form.departDate, form.returnDate), 5),
        interests,
        cuisine: cuisine || null,
        faithTradition: selectedFaith?.name || null,
        travelParty: prefs.travelParty,
        pace: prefs.pace,
        budgetStyle: prefs.budgetStyle,
        occasion: prefs.occasion,
        dietaryRestrictions: prefs.dietaryRestrictions,
        favoriteCuisines: prefs.favoriteCuisines,
        accessibilityNotes: prefs.accessibilityNotes || null,
        otherNotes: prefs.otherNotes || null,
      });
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.destination, interests, cuisine, form.departDate, form.returnDate, selectedFaith, prefs]);

  // Once stays load (demo or real), default-select the first one so
  // the budget calculator has something to work with immediately.
  useEffect(() => {
    if (fetchedStays?.length && !selectedStay) {
      setSelectedStay(fetchedStays[0]);
    }
  }, [fetchedStays, selectedStay]);

  async function handleSearch(e) {
    e.preventDefault();
    const data = await search(form);
    if (data?.primary?.offers?.length) {
      setSelectedFlight(data.primary.offers[0]);
      setSelectedFlexOffset(null);
    }
  }

  function toggleInterest(id) {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const nights = useMemo(() => nightsFromDates(form.departDate, form.returnDate), [form.departDate, form.returnDate]);

  const flightPricePerPerson = selectedFlight
    ? selectedFlight.totalAmount / (form.travelers || 1)
    : 209; // demo fallback so budget/itinerary work before any search runs

  const itineraryPlan = aiPlan || [];

  const budget = useMemo(
    () =>
      calculateBudget({
        flightPricePerPerson,
        nightlyRate: selectedStay?.price ?? 140,
        nights,
        travelers: Number(form.travelers) || 1,
        itineraryPlan,
      }),
    [flightPricePerPerson, selectedStay, nights, form.travelers, itineraryPlan]
  );

  const sortedStays = useMemo(() => {
    const list = [...(fetchedStays || [])];
    if (staySortBy === "rating") list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (staySortBy === "price") list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    if (staySortBy === "distance") list.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    if (staySortBy === "safety") list.sort((a, b) => (b.safety ?? 0) - (a.safety ?? 0));
    return list;
  }, [staySortBy, fetchedStays]);

  const cheapestFlex = useMemo(() => {
    if (!results?.flexResults?.length) return null;
    return results.flexResults.reduce((min, r) => (r.cheapestTotal < (min?.cheapestTotal ?? Infinity) ? r : min), null);
  }, [results]);

  const topFlightId = useMemo(() => pickTopFlightId(results?.primary?.offers, prefs), [results, prefs]);
  const topStayId = useMemo(() => pickTopStayId(sortedStays, prefs), [sortedStays, prefs]);
  const topFlight = useMemo(() => results?.primary?.offers?.find((o) => o.id === topFlightId) || null, [results, topFlightId]);
  const topStay = useMemo(() => sortedStays.find((s) => s.id === topStayId) || null, [sortedStays, topStayId]);

  function topFlightReason() {
    if (prefs.flightPriority === "Cheapest fare") return "the lowest total fare";
    if (prefs.flightPriority === "Fewest stops") return "the fewest stops";
    if (prefs.flightPriority === "Best departure times") return "a daytime departure";
    return "the best overall value";
  }
  function topStayReason() {
    if (prefs.budgetStyle === "Budget-conscious") return "the lowest price that matched your stay type";
    if (prefs.budgetStyle === "Luxury") return "your luxury preference";
    if (prefs.stayType) return `matching your preferred ${prefs.stayType.toLowerCase()} stay`;
    return "the highest rating";
  }

  async function handleSaveTrip() {
    if (!user) {
      setSaveStatus("Sign in first (Account tab) so your trip is saved to your account.");
      setActiveTab("account");
      return;
    }
    const trip = await saveTrip(user.uid, {
      origin: form.origin,
      destination: form.destination,
      departDate: form.departDate,
      returnDate: form.returnDate,
      travelers: form.travelers,
      total: budget.total,
    });
    setTrips((prev) => [trip, ...prev]);
    setSaveStatus("Trip saved.");
  }

  async function handleShareTrip() {
    setShareStatus("Creating your shareable link…");
    try {
      const id = await saveSharedTrip({
        origin: form.origin,
        destination: form.destination,
        departDate: form.departDate,
        returnDate: form.returnDate,
        travelers: Number(form.travelers) || 1,
        budget,
        itineraryPlan,
        interests,
        cuisine,
        prefs,
      });
      const url = `${window.location.origin}/trip/${id}`;
      setShareUrl(url);
      setShareStatus(null);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).catch(() => {});
        setShareStatus("Link copied to your clipboard.");
      }
    } catch (err) {
      setShareUrl(null);
      setShareStatus(err.message || "Couldn't create a share link.");
    }
  }

  return (
    <>
      <header className="top">
        <div className="topbar">
          <div className="brand"><span className="brand-mark" />Meridian</div>
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={activeTab === t.id ? "active" : ""} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="topbar-right">
            <button className="signin-btn" onClick={() => setActiveTab("account")}>
              {user ? "Account" : "Sign up free"}
            </button>
            <button className="mobile-menu-btn" aria-label="Open menu" onClick={() => setMobileNavOpen((v) => !v)}>
              {mobileNavOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <nav className="mobile-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={activeTab === t.id ? "active" : ""}
                onClick={() => {
                  setActiveTab(t.id);
                  setMobileNavOpen(false);
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <section className="hero wrap">
        <div className="hero-grid">
          <div>
            <div className="eyebrow-plain">One trip, every piece, in one place</div>
            <h1>Plan a trip the way a well-traveled friend would.</h1>
            <p className="lede">Flights, stays, food, budget, and a day-by-day plan — built around how you actually like to travel, including pilgrimage and faith-based journeys.</p>
          </div>
          <div className="hero-side">
            <div className="stat">{nights}</div>
            <div className="stat-label">nights in this trip, budget updates as you change dates</div>
            <div className="stat">±14 days</div>
            <div className="stat-label">flexible date scan to catch cheaper fares nearby</div>
          </div>
        </div>

        <form className="search-card" onSubmit={handleSearch}>
          <div className="search-row">
            <div className="field">
              <label>From → To (airport codes)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value.toUpperCase() })} maxLength={3} style={{ width: 70 }} />
                <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value.toUpperCase() })} maxLength={3} style={{ width: 70 }} />
              </div>
            </div>
            <div className="field">
              <label>Depart</label>
              <input type="date" value={form.departDate} onChange={(e) => setForm({ ...form, departDate: e.target.value })} />
            </div>
            <div className="field">
              <label>Return</label>
              <input type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} />
            </div>
            <div className="field">
              <label>Travelers</label>
              <select value={form.travelers} onChange={(e) => setForm({ ...form, travelers: Number(e.target.value) })}>
                <option value={1}>1 adult</option>
                <option value={2}>2 adults</option>
                <option value={3}>3 travelers</option>
                <option value={4}>Family (4)</option>
              </select>
            </div>
            <button className="search-btn" type="submit" disabled={loading}>
              {loading ? "Searching…" : "Search trip"}
            </button>
          </div>
          {error && <div className="search-error">{error}</div>}
          {results?.usedMockData && <div className="demo-note">Demo data — connect a Duffel API key in server/.env for live fares. See README.md.</div>}
        </form>
      </section>

      {/* ===================== FLIGHTS + STAYS ===================== */}
      <section className="panel wrap" id="panel-search" style={{ display: activeTab === "search" ? "block" : "none" }}>
        <div className="panel-head">
          <div>
            <h2>Flights to {form.destination}</h2>
            <p>Results from your search above — sorted best-value by default.</p>
          </div>
        </div>

        {(topFlight || topStay) && (
          <div className="top-picks">
            <div className="top-picks-label">⭐ Your top picks{answeredCount(prefs) > 0 ? ", based on your preferences" : ""}</div>
            <div className="top-picks-grid">
              {topFlight && (
                <div className="top-pick-card">
                  <div className="top-pick-kind">Flight {results?.usedMockData === false && <span className="live-dot">● Live price</span>}</div>
                  <div className="top-pick-name">{topFlight.airline || "Selected airline"}</div>
                  <div className="top-pick-why">Picked for {topFlightReason()}</div>
                  <div className="top-pick-price">${Math.round(topFlight.totalAmount)} <span>round trip / traveler</span></div>
                </div>
              )}
              {topStay && (
                <div className="top-pick-card">
                  <div className="top-pick-kind">Stay {!staysUsedMock && <span className="live-dot">● Real hotel</span>}</div>
                  <div className="top-pick-name">{topStay.name}</div>
                  <div className="top-pick-why">Picked for {topStayReason()}</div>
                  <div className="top-pick-price">${topStay.price} <span>/night{staysUsedMock ? "" : " (rough estimate)"}</span></div>
                  {!staysUsedMock && <a href={topStay.url} target="_blank" rel="noreferrer" className="top-pick-real-link">See the real, current rate →</a>}
                </div>
              )}
            </div>
            {answeredCount(prefs) === 0 && (
              <div className="top-picks-hint">Answer a few quick questions in the Preferences tab and these picks will match you more closely.</div>
            )}
          </div>
        )}

        {!results && !loading && <p style={{ color: "#5A5F68", fontSize: "0.9rem" }}>Run a search above to see flight options here.</p>}

        {results?.primary?.offers?.length > 0 && (
          <div className="flight-list">
            {results.primary.offers.map((offer) => (
              <div className="flight-card" key={offer.id}>
                <div className="airline-badge">{(offer.airline || "??").slice(0, 3).toUpperCase()}</div>
                <div>
                  <div className="flight-route">
                    <div className="flight-time">{formatTime(offer.slices[0]?.departure)}</div>
                    <div className="flight-mid">
                      {offer.slices[0]?.stops === 0 ? "Nonstop" : `${offer.slices[0]?.stops} stop`}
                      <div className="line" />
                      {formatDuration(offer.slices[0]?.duration)}
                    </div>
                    <div className="flight-time">{formatTime(offer.slices[0]?.arrival)}</div>
                  </div>
                  <div className="flight-tags">
                    {offer === results.primary.offers[0] && <span className="tag">Best value</span>}
                    {offer.id === topFlightId && <span className="tag tag--pick">⭐ Top pick</span>}
                    <span className="tag">{offer.currency} total</span>
                  </div>
                </div>
                <div className="flight-price">
                  <div className="amt">${Math.round(offer.totalAmount)}</div>
                  <div className="per">round trip / traveler</div>
                </div>
                <a className="book-btn" href={offer.bookingUrl} target="_blank" rel="noreferrer" onClick={() => setSelectedFlight(offer)}>
                  View & book →
                </a>
              </div>
            ))}
          </div>
        )}

        {results?.flexResults?.length > 0 && (
          <div className="flex-strip">
            {results.flexResults
              .sort((a, b) => a.offsetDays - b.offsetDays)
              .map((r) => (
                <div
                  key={r.offsetDays}
                  className={`flex-day ${r === cheapestFlex ? "cheapest" : ""} ${selectedFlexOffset === r.offsetDays ? "selected" : ""}`}
                  onClick={() => setSelectedFlexOffset(r.offsetDays)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="d">{r.departDate}</div>
                  <div className="p">${Math.round(r.cheapestTotal)}</div>
                  {r === cheapestFlex && <div className="save">Cheapest nearby</div>}
                </div>
              ))}
          </div>
        )}

        <div style={{ marginTop: 44 }}>
          <div className="panel-head" style={{ marginBottom: 20 }}>
            <div>
              <h2>Places to stay</h2>
              <p>{staysUsedMock ? "Demo listings across hotel, Airbnb, and Vrbo styles — sort to see ranking update live." : `Real hotels near ${form.destination}, ranked by rating — prices are estimates until a rates provider is connected.`}</p>
            </div>
          </div>
          <div className="filter-bar">
            <select value={staySortBy} onChange={(e) => setStaySortBy(e.target.value)}>
              <option value="rating">Sort: Highest rated</option>
              <option value="price">Sort: Price, low to high</option>
              {sortedStays.some((s) => s.distance != null) && <option value="distance">Sort: Closest to center</option>}
              {sortedStays.some((s) => s.safety != null) && <option value="safety">Sort: Safest neighborhood</option>}
            </select>
          </div>
          {staysUsedMock && <div className="demo-note" style={{ marginBottom: 16 }}>Demo listings — add GOOGLE_PLACES_API_KEY in server/.env for real hotels. See README.md.</div>}
          {staysLoading && <p className="loading-line"><span className="spinner" />Searching hotels near {form.destination}…</p>}
          <div className="stay-grid">
            {sortedStays.map((s) => (
              <div className="stay-card" key={s.id} style={{ outline: selectedStay?.id === s.id ? "2px solid var(--teal)" : "none" }}>
                <div className="stay-photo" style={{ backgroundImage: `url(${s.photo || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=60"})` }} />
                <div className="stay-body">
                  <div className="stay-source">{s.source}</div>
                  <div className="stay-name">{s.name}{s.id === topStayId && <span className="tag tag--pick" style={{ marginLeft: 8 }}>⭐ Top pick</span>}</div>
                  <div className="stay-meta">{s.area}{s.distance != null ? ` · ${s.distance} mi from center` : ""}</div>
                  <div className="stay-scores">
                    {s.rating != null && <div className="score">★ {s.rating}{s.ratingCount ? ` (${s.ratingCount})` : ""}</div>}
                    {s.safety != null && <div className="score">Safety {s.safety}</div>}
                  </div>
                  <div className="stay-foot">
                    <div className="stay-price">${s.price} <span>/night{staysUsedMock ? "" : " (est.)"}</span></div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="book-btn secondary" style={{ margin: 0 }} onClick={() => setSelectedStay(s)}>
                        {selectedStay?.id === s.id ? "Selected" : "Use this"}
                      </button>
                      {!staysUsedMock && s.url && (
                        <a className="book-btn" style={{ margin: 0 }} href={s.url} target="_blank" rel="noreferrer">
                          View & book →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 44 }}>
          <div className="panel-head" style={{ marginBottom: 16 }}>
            <div><h2>Food, matched to how you eat</h2><p>Pick one — restaurant picks in your itinerary adjust automatically.</p></div>
          </div>
          <div className="chip-grid">
            {CUISINE_OPTIONS.map((c) => (
              <div key={c} className={`chip ${cuisine === c ? "active" : ""}`} onClick={() => setCuisine(c)} style={{ cursor: "pointer" }}>
                {c}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PREFERENCES ===================== */}
      <section className="panel wrap" style={{ display: activeTab === "preferences" ? "block" : "none" }}>
        <div className="panel-head">
          <div>
            <h2>Tell us how you like to travel</h2>
            <p>Every question here is optional — skip anything you'd rather not answer. The more you share, the more we can tailor your flights, stays, cuisine, and itinerary to you.</p>
          </div>
        </div>
        <div className="prefs-progress">{answeredCount(prefs)} of {PREFERENCE_QUESTIONS.length + 2} answered</div>

        {PREFERENCE_QUESTIONS.map((q) => (
          <div key={q.key} className="pref-question">
            <div className="pref-label">{q.label}</div>
            <div className="chip-grid">
              {q.options.map((opt) => (
                <div
                  key={opt}
                  className={`chip ${prefs[q.key] === opt ? "active" : ""}`}
                  onClick={() => toggleSingleAnswer(prefs, setPrefs, q.key, opt)}
                  style={{ cursor: "pointer" }}
                >
                  {opt}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="pref-question">
          <div className="pref-label">Any dietary restrictions? (select all that apply)</div>
          <div className="chip-grid">
            {DIETARY_OPTIONS.map((opt) => (
              <div
                key={opt}
                className={`chip ${prefs.dietaryRestrictions.includes(opt) ? "active" : ""}`}
                onClick={() => toggleMultiAnswer(setPrefs, "dietaryRestrictions", opt)}
                style={{ cursor: "pointer" }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>

        <div className="pref-question">
          <div className="pref-label">Favorite cuisines — click in order, favorite first (optional)</div>
          <div className="chip-grid">
            {CUISINE_TYPE_OPTIONS.map((opt) => {
              const rank = prefs.favoriteCuisines.indexOf(opt);
              return (
                <div
                  key={opt}
                  className={`chip ${rank > -1 ? "active" : ""}`}
                  onClick={() => toggleMultiAnswer(setPrefs, "favoriteCuisines", opt)}
                  style={{ cursor: "pointer" }}
                >
                  {rank > -1 && <span className="chip-rank">{rank + 1}</span>}
                  {opt}
                </div>
              );
            })}
          </div>
          {prefs.favoriteCuisines.length > 0 && (
            <div className="pref-hint">In order: {prefs.favoriteCuisines.join(" → ")}</div>
          )}
        </div>

        <div className="pref-question">
          <div className="pref-label">Any accessibility needs we should plan around? (optional)</div>
          <textarea
            className="pref-textarea"
            placeholder="e.g. wheelchair-accessible venues, limited walking distance…"
            value={prefs.accessibilityNotes}
            onChange={(e) => setPrefs({ ...prefs, accessibilityNotes: e.target.value })}
          />
        </div>

        <div className="pref-question">
          <div className="pref-label">Anything else we should know? (optional)</div>
          <textarea
            className="pref-textarea"
            placeholder="e.g. traveling with a toddler, celebrating a milestone, avoiding early mornings…"
            value={prefs.otherNotes}
            onChange={(e) => setPrefs({ ...prefs, otherNotes: e.target.value })}
          />
        </div>

        <button className="book-btn" onClick={() => setActiveTab("itinerary")}>See your updated itinerary →</button>
      </section>

      {/* ===================== BUDGET ===================== */}
      <section className="panel wrap" style={{ display: activeTab === "budget" ? "block" : "none" }}>
        <div className="panel-head">
          <div><h2>Full trip budget</h2><p>Built live from your flight, stay, and trip length above.</p></div>
        </div>
        <div className="budget-grid">
          <div>
            {budget.lines.map((line) => (
              <div className="budget-line" key={line.key}>
                <div className="budget-cat"><span className="cat-dot" style={{ background: line.color }} />{line.label}</div>
                <div className="budget-amt">${line.amount.toLocaleString()}</div>
              </div>
            ))}
            {cheapestFlex && cheapestFlex.cheapestTotal < (selectedFlight?.totalAmount ?? Infinity) && (
              <div className="save-callout">
                <span style={{ fontSize: "1.1rem" }}>💡</span>
                <div>
                  Shift your departure to <strong>{cheapestFlex.departDate}</strong> and save roughly{" "}
                  <strong>${Math.round((selectedFlight?.totalAmount ?? 0) - cheapestFlex.cheapestTotal)}</strong> per traveler on airfare.
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button className="book-btn" style={{ marginTop: 0 }} onClick={handleSaveTrip}>
                Save this trip
              </button>
              <button className="book-btn secondary" style={{ marginTop: 0 }} onClick={handleShareTrip}>
                Share this trip →
              </button>
            </div>
            {saveStatus && <p style={{ fontSize: "0.82rem", color: "#5A5F68", marginTop: 8 }}>{saveStatus}</p>}
            {shareStatus && <p style={{ fontSize: "0.82rem", color: "#5A5F68", marginTop: 8 }}>{shareStatus}</p>}
            {shareUrl && (
              <div className="share-link-box">
                <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                <a href={shareUrl} target="_blank" rel="noreferrer" className="book-btn secondary" style={{ margin: 0 }}>
                  Open →
                </a>
              </div>
            )}
          </div>
          <div className="budget-total">
            <div className="label">Estimated total, {form.travelers} traveler{form.travelers > 1 ? "s" : ""}</div>
            <div className="num">${budget.total.toLocaleString()}</div>
            <div className="per-person">≈ ${budget.perPerson.toLocaleString()} per person · {nights} nights</div>
            <div className="bar">
              {budget.lines.map((line) => (
                <span key={line.key} style={{ width: `${(line.amount / budget.total) * 100}%`, background: line.color }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== ITINERARY ===================== */}
      <section className="panel wrap" style={{ display: activeTab === "itinerary" ? "block" : "none" }}>
        <div className="panel-head">
          <div><h2>Your day-by-day plan</h2><p>Toggle what you like — the plan below rebuilds automatically, and its cost feeds straight into your budget.</p></div>
        </div>
        <div className="chip-grid" style={{ marginBottom: 30 }}>
          {INTEREST_OPTIONS.map((opt) => (
            <div key={opt.id} className={`chip ${interests.includes(opt.id) ? "active" : ""}`} onClick={() => toggleInterest(opt.id)} style={{ cursor: "pointer" }}>
              {opt.label}
            </div>
          ))}
        </div>
        {!usedAI && itineraryPlan.length > 0 && (
          <div className="demo-note" style={{ marginBottom: 20 }}>Template plan — add ANTHROPIC_API_KEY in server/.env for AI-generated, destination-specific itineraries. See README.md.</div>
        )}
        {itineraryLoading && <p className="loading-line" style={{ marginBottom: 16 }}><span className="spinner" />Building your {form.destination} itinerary…</p>}
        <div className="itinerary">
          {itineraryPlan.map((day) => {
            const dayTotalPerPerson = (day.activities || []).reduce((sum, a) => sum + (Number(a.cost) || 0), 0);
            const groups = groupByPeriod(day.activities || []);
            return (
              <div className="day-block" key={day.dayNumber}>
                <div className="day-title">
                  Day {day.dayNumber}
                  {dayTotalPerPerson > 0 && (
                    <span className="sub"> — ~${dayTotalPerPerson} per person planned</span>
                  )}
                </div>
                {groups.map(([period, acts]) => (
                  <div key={period} className="period-group">
                    {period !== "unscheduled" && <div className="period-label">{PERIOD_LABELS[period] || period}</div>}
                    {acts.map((a, i) => (
                      <div className="activity" key={i}>
                        <div className="activity-time">{a.time}</div>
                        <div style={{ flex: 1 }}>
                          <div className="activity-name-row">
                            <div className="activity-name">
                              {a.category === "food" ? "🍽️ " : a.category === "activity" ? "🎟️ " : ""}
                              {a.name}
                            </div>
                            {Number(a.cost) > 0 ? (
                              <span className="activity-cost">${a.cost}/pp</span>
                            ) : (
                              <span className="activity-cost activity-cost--free">Free</span>
                            )}
                          </div>
                          <div className="activity-desc">{a.desc}</div>
                          {a.tag && <span className="activity-tag">{a.tag.replace("-", " ")}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================== PILGRIMAGE ===================== */}
      <section className="panel wrap" style={{ display: activeTab === "pilgrimage" ? "block" : "none" }}>
        <div className="panel-head">
          <div><h2>Pilgrimage & sacred journeys</h2><p>A dedicated trip category — tap any tradition for timing, logistics, and dietary notes.</p></div>
        </div>
        <div className="faith-grid">
          {PILGRIMAGE_SITES.map((site) => (
            <div
              key={site.id}
              className={`faith-card ${selectedFaith?.id === site.id ? "selected" : ""}`}
              onClick={() => setSelectedFaith(site)}
              style={{ cursor: "pointer" }}
            >
              <div className="icon">{site.icon}</div>
              <h3>{site.name}</h3>
              <p>{site.summary}</p>
              <div className="dest">{site.dest}</div>
            </div>
          ))}
        </div>
        {selectedFaith && (
          <div className="faith-detail">
            <h3>{selectedFaith.icon} {selectedFaith.name} — {selectedFaith.dest}</h3>
            <h4>Timing</h4>
            <p>{selectedFaith.timing}</p>
            <h4>Logistics</h4>
            <p>{selectedFaith.logistics}</p>
            <h4>Dietary & lodging</h4>
            <p>{selectedFaith.dietary}</p>
          </div>
        )}
        <p style={{ marginTop: 18, fontSize: "0.85rem", color: "#5A5F68" }}>
          Other traditions — Sikh, Jain, Baháʼí, Shinto, and more — are searchable directly; this grid shows the most requested starting points.
        </p>
      </section>

      {/* ===================== ACCOUNT ===================== */}
      <section className="panel wrap" style={{ display: activeTab === "account" ? "block" : "none" }}>
        <div className="account-panel">
          <div>
            <h2 style={{ fontSize: "1.8rem", fontWeight: 600 }}>{user ? `Welcome back` : "Save this trip in 10 seconds."}</h2>
            <p style={{ color: "#5A5F68", marginTop: 12, maxWidth: "44ch" }}>
              {user
                ? "Your saved trips are listed here."
                : "Sign up free with the email you already use. No new password, no charge to plan."}
            </p>
            {user && (
              <div style={{ marginTop: 16 }}>
                {trips.length === 0 && <p style={{ fontSize: "0.85rem", color: "#8A8F97" }}>No trips saved yet — build one on the Budget tab.</p>}
                {trips.map((t) => (
                  <div className="trip-row" key={t.id}>
                    <span>{t.origin} → {t.destination}</span>
                    <span>${t.total?.toLocaleString?.() ?? t.total}</span>
                  </div>
                ))}
                <button className="book-btn secondary" style={{ marginTop: 16 }} onClick={signOutUser}>Sign out</button>
              </div>
            )}
          </div>
          {!user && (
            <AuthButtons
              onSignedIn={(u) => {
                setUser(u);
                setSaveStatus(null);
              }}
            />
          )}
        </div>
      </section>

      <footer>Meridian — {isFirebaseConfigured ? "connected to your Firebase project" : "running in demo mode"}.</footer>
    </>
  );
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDuration(iso8601Duration) {
  if (!iso8601Duration) return "—";
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso8601Duration);
  if (!match) return iso8601Duration;
  const h = match[1] || 0;
  const m = match[2] || 0;
  return `${h}h ${m}m`;
}

function nightsFromDates(departDate, returnDate) {
  const d1 = new Date(departDate);
  const d2 = new Date(returnDate);
  return Math.max(1, Math.round((d2 - d1) / 86400000));
}
