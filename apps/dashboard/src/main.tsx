import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./lib/theme";
import { SearchProvider } from "./lib/search";
import "./index.css";

// One-shot migration for users that ran an earlier build of the dashboard:
// clear the stale API key from localStorage (the BFF injects it server-side
// now) and clear any custom base URL that points at the old direct-API host
// so it falls back to the same-origin /api proxy.
try {
  localStorage.removeItem("hr.api.key");
  const stored = localStorage.getItem("hr.api.base");
  if (stored && stored !== "/api") {
    localStorage.removeItem("hr.api.base");
  }
} catch {
  // localStorage may be disabled (privacy mode); safe to ignore.
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element missing");

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <SearchProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SearchProvider>
    </ThemeProvider>
  </StrictMode>,
);
