import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import SharedTripPage from "./pages/SharedTripPage.jsx";
import GroupTripPage from "./pages/GroupTripPage.jsx";
import "./index.css";

// Minimal routing — no router library needed for just two extra
// routes. /trip/:id is a public read-only shared trip; /group/:id is
// a live, votable group trip. Anything else renders the main app.
const tripMatch = window.location.pathname.match(/^\/trip\/([a-zA-Z0-9_-]+)/);
const groupMatch = window.location.pathname.match(/^\/group\/([a-zA-Z0-9_-]+)/);

function Root() {
  if (tripMatch) return <SharedTripPage tripId={tripMatch[1]} />;
  if (groupMatch) return <GroupTripPage tripId={groupMatch[1]} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
