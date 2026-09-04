import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import SharedTripPage from "./pages/SharedTripPage.jsx";
import "./index.css";

// Minimal routing — no router library needed for just one extra
// route. If the URL is /trip/:id, render the public shared-trip page;
// otherwise render the main app as usual.
const tripMatch = window.location.pathname.match(/^\/trip\/([a-zA-Z0-9_-]+)/);

function Root() {
  if (tripMatch) return <SharedTripPage tripId={tripMatch[1]} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
