/**
 * Isolated-world script on the HTTPS board. Relays service-worker
 * {type:'picks-updated'} into a page event app.js already listens for.
 */
(() => {
  if (globalThis.__espnCompanionBoard) return;
  globalThis.__espnCompanionBoard = true;

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "picks-updated") return;
    try {
      window.dispatchEvent(new CustomEvent("espn-companion-picks-updated", { detail: msg }));
    } catch {
      /* ignore */
    }
  });
})();
