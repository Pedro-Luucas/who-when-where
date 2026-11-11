"use client";

import { useSyncExternalStore } from "react";

// The last resort: the root layout itself failed. This replaces the whole
// document, so it brings its own <html>, <body> and plain inline styles (the
// site's stylesheets are not loaded here). It reads the player's language from
// the same place the site does.

const STRINGS = {
  en: {
    title: "Something went wrong",
    lead: "The page could not start. Your saved games are safe on this device.",
    retry: "Try again",
  },
  pt: {
    title: "Algo deu errado",
    lead: "A página não conseguiu iniciar. Seus jogos salvos continuam seguros neste aparelho.",
    retry: "Tentar de novo",
  },
};

function language(): "en" | "pt" {
  try {
    const stored = JSON.parse(window.localStorage.getItem("www:locale") ?? "null");
    if (stored === "en" || stored === "pt") return stored;
  } catch {
    // fall through
  }
  return navigator.language.toLowerCase().startsWith("pt") ? "pt" : "en";
}

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  void error;
  // English while rendering on the server; the player's language right after.
  const text = STRINGS[useSyncExternalStore<"en" | "pt">(() => () => {}, language, () => "en")];
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#060b16",
          color: "#eef5ff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420 }} role="alert">
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 8px" }}>{text.title}</h1>
          <p style={{ color: "#a9bdd4", lineHeight: 1.5 }}>{text.lead}</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 12,
              minHeight: 44,
              padding: "0 20px",
              border: 0,
              borderRadius: 8,
              background: "#2f6fe0",
              color: "#fff",
              font: "inherit",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {text.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
