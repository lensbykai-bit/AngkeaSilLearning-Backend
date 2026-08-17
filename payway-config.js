/*
 * Angkea Sil Learning — PayWay API URL
 *
 * Local test:
 *   http://localhost:5500 -> http://localhost:3000
 *
 * GitHub Pages:
 *   Replace PRODUCTION_BACKEND_URL after the backend is deployed to HTTPS.
 */
(() => {
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  const PRODUCTION_BACKEND_URL = "https://angkeasillearning-backend.onrender.com";

  window.ASL_PAYWAY_API = localHosts.has(window.location.hostname)
    ? "http://localhost:3000"
    : PRODUCTION_BACKEND_URL;
})();
