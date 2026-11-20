import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/app";
import "@/scss/main.scss";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Makes the app installable and lets it open offline (see public/sw.js). Production
// only: in development a cached page would hide your latest changes.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err: unknown) => {
      console.error("Service worker registration failed:", err);
    });
  });
}
