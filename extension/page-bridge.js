/**
 * Runs in the ESPN page world so mDraftDetail is fetched with the user's
 * ESPN session cookies. Cookies never leave this page.
 * Pick History scraping lives in the isolated content script (scrapeHistoryText).
 */
(() => {
  if (window.__espnCompanionBridge) return;
  window.__espnCompanionBridge = true;

  window.addEventListener("message", async (ev) => {
    if (ev.source !== window) return;
    const msg = ev.data;
    if (!msg || msg.type !== "espn-companion-fetch-mdraft") return;
    const { id, url } = msg;
    if (!url || !/^https:\/\/([a-z0-9-]+\.)*espn\.com\//i.test(url)) {
      window.postMessage({ type: "espn-companion-mdraft", id, ok: false, error: "blocked url" }, "*");
      return;
    }
    try {
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
      const json = await res.json();
      window.postMessage({ type: "espn-companion-mdraft", id, ok: res.ok, status: res.status, json }, "*");
    } catch (err) {
      window.postMessage({
        type: "espn-companion-mdraft",
        id,
        ok: false,
        error: err && err.message ? err.message : "fetch failed",
      }, "*");
    }
  });
})();
