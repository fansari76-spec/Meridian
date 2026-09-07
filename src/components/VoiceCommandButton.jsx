// src/components/VoiceCommandButton.jsx
//
// A floating, always-visible mic button for hands-free app control —
// mounted once at the app root so it persists across every tab.
// Purely captures speech and hands the final transcript up via
// onTranscript; all the actual command dispatching lives in the
// parent, which already has access to every handler this needs to
// call (setActiveTab, search, setPrefs, etc.).
//
// Reuses the same continuous-listening Web Speech API pattern as the
// conversational trip entry box, with the same honest browser-support
// caveat (reliable in Chrome, spotty in Safari/iOS).

import { useState } from "react";

export default function VoiceCommandButton({ onTranscript, statusText }) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [unsupported, setUnsupported] = useState(false);

  const handleToggle = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUnsupported(true);
      setTimeout(() => setUnsupported(false), 4000);
      return;
    }
    if (isListening && recognition) {
      recognition.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false; // one command at a time, unlike the free-text dictation box
    rec.onresult = (event) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join(" ").trim();
      if (transcript) onTranscript(transcript);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
    setRecognition(rec);
    setIsListening(true);
  };

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      {(statusText || unsupported) && (
        <div
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "10px 16px",
            borderRadius: 12,
            fontFamily: "Inter, sans-serif",
            fontSize: "0.85rem",
            maxWidth: 280,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          {unsupported ? "Voice commands aren't supported in this browser — try Chrome." : statusText}
        </div>
      )}
      <button
        onClick={handleToggle}
        aria-label="Voice command"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: isListening ? "var(--gold)" : "var(--indigo)",
          color: "var(--paper)",
          fontSize: "1.4rem",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          transition: "background 0.2s, transform 0.2s",
          transform: isListening ? "scale(1.1)" : "scale(1)",
        }}
      >
        {isListening ? "🎙️" : "🎤"}
      </button>
    </div>
  );
}
