// One place for all runtime settings.
//
// VITE_DEMO_MODE=true   -> no backend needed. The site runs on in-browser demo data.
// VITE_DEMO_MODE=false  -> the site talks to the real API at VITE_API_BASE_URL.
//                          Leave VITE_API_BASE_URL empty to use the same origin
//                          (that is what the Node gateway / Vite dev proxy expect).
//
// For a Vercel static deployment, the frontend has no Python/Node API running on the
// same host. Default to demo mode in production when no API URL is configured so the app
// does not spam failed fetches and console errors on load.
export const DEMO_MODE: boolean =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL);

// Strip any trailing slash so we can safely do `${API_BASE}/api/...`
export const API_BASE: string = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
