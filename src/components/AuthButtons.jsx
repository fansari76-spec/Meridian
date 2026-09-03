import { useState } from "react";
import {
  googleProvider,
  appleProvider,
  yahooProvider,
  signInWithProvider,
  isFirebaseConfigured,
} from "../lib/firebase";

const PROVIDERS = [
  { id: "google", label: "Continue with Google", provider: googleProvider },
  { id: "apple", label: "Continue with iCloud (Apple)", provider: appleProvider },
  { id: "yahoo", label: "Continue with Yahoo", provider: yahooProvider },
];

export default function AuthButtons({ onSignedIn }) {
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  async function handleSignIn(id, provider) {
    setError(null);
    setLoadingId(id);
    try {
      const user = await signInWithProvider(provider);
      onSignedIn?.(user);
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in was closed before finishing. Try again.");
      } else if (err.code === "auth/account-exists-with-different-credential") {
        setError("That email is already linked to a different sign-in method.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="signup-card">
      {!isFirebaseConfigured && (
        <div className="demo-note">
          Demo mode — sign-in is stubbed until you connect a Firebase project (see README.md).
        </div>
      )}
      {PROVIDERS.map(({ id, label, provider }) => (
        <button
          key={id}
          className="oauth-btn"
          disabled={loadingId !== null}
          onClick={() => handleSignIn(id, provider)}
          style={{ marginTop: id === "google" ? 12 : 0 }}
        >
          <span className={`oauth-dot oauth-dot--${id}`} />
          {loadingId === id ? "Opening sign-in…" : label}
        </button>
      ))}
      {error && (
        <p role="alert" style={{ color: "#B3261E", fontSize: "0.82rem", marginTop: "10px" }}>
          {error}
        </p>
      )}
      <p style={{ fontSize: "0.74rem", color: "#8A8F97", marginTop: "12px" }}>
        Free forever for planning. No card required.
      </p>
    </div>
  );
}
