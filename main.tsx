import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Guard } from "./components/Guard";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

/* Offline support. Registered after load so it never competes with
   the first paint, and silent on failure since the app works without
   it — a file opened from disk has no service worker at all. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(root).render(
  <StrictMode>
    <Guard>
      <App />
    </Guard>
  </StrictMode>,
);
