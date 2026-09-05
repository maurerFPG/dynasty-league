/**
 * Isolated-world content script on fantasy.espn.com.
 * Asks the page world for mDraftDetail (cookies stay on ESPN),
 * scrapes Pick History if that payload is empty/stale, then
 * hands normalized-ready payloads to the service worker.
 */
import { scrapeHistoryText } from "./picks.js";

{
  const DEFAULT_LEAGUE = "1030576";
  const DEFAULT_SEASON = 2026;

  function leagueId() {
    try {
      const u = new URL(location.href);
      return u.searchParams.get("leagueId") || u.searchParams.get("league_id") || DEFAULT_LEAGUE;
    } catch {
      return DEFAULT_LEAGUE;
    }
  }

  function season() {
    try {
      const u = new URL(location.href);
      const s = Number(u.searchParams.get("seasonId") || u.searchParams.get("season"));
      return Number.isFinite(s) && s >= 2018 ? s : DEFAULT_SEASON;
    } catch {
      return DEFAULT_SEASON;
    }
  }

  function mDraftUrls(id, yr) {
    return [
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${yr}/segments/0/leagues/${id}?view=mDraftDetail`,
      `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${yr}/segments/0/leagues/${id}?view=mDraftDetail`,
    ];
  }

  function fetchMDraft(url) {
    const id = "md-" + Math.random().toString(36).slice(2);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMsg);
        resolve({ ok: false, error: "timeout" });
      }, 12000);
      function onMsg(ev) {
        if (ev.source !== window) return;
        const msg = ev.data;
        if (!msg || msg.type !== "espn-companion-mdraft" || msg.id !== id) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        resolve(msg);
      }
      window.addEventListener("message", onMsg);
      window.postMessage({ type: "espn-companion-fetch-mdraft", id, url }, "*");
    });
  }

  function onDraftPage() {
    return /\/football\/(draft|waitingroom)/i.test(location.pathname);
  }

  async function collect() {
    const id = leagueId();
    const yr = season();
    const urls = mDraftUrls(id, yr);
    let mdraft = null;
    let mdraftError = null;
    for (const url of urls) {
      const res = await fetchMDraft(url);
      if (res && res.ok && res.json) {
        mdraft = res.json;
        break;
      }
      mdraftError = (res && (res.error || res.status)) || "mDraftDetail failed";
    }
    return {
      leagueId: id,
      season: yr,
      href: location.href,
      mdraft,
      mdraftError,
      historyText: scrapeHistoryText(document),
    };
  }

  function ensureButton() {
    if (!onDraftPage()) return;
    if (document.getElementById("espn-companion-sync")) return;
    const btn = document.createElement("button");
    btn.id = "espn-companion-sync";
    btn.type = "button";
    btn.textContent = "Sync picks";
    btn.title = "Push made picks to the redraft companion. Does not click Draft.";
    Object.assign(btn.style, {
      position: "fixed",
      right: "12px",
      bottom: "12px",
      zIndex: "2147483646",
      padding: "8px 12px",
      borderRadius: "8px",
      border: "1px solid #3d5a80",
      background: "#0b1830",
      color: "#f4f7fb",
      font: "600 12px/1 system-ui,sans-serif",
      cursor: "pointer",
      boxShadow: "0 4px 16px rgba(0,0,0,.35)",
    });
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Syncing…";
      try {
        const payload = await collect();
        const res = await chrome.runtime.sendMessage({ type: "espn-companion-sync", payload });
        btn.textContent = res && res.ok ? `Synced ${res.total || 0}` : "Sync failed";
        btn.title = (res && (res.error || res.detail)) || btn.title;
      } catch (err) {
        btn.textContent = "Sync failed";
        btn.title = err && err.message ? err.message : "sync failed";
      }
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "Sync picks";
      }, 2500);
    });
    document.documentElement.appendChild(btn);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "espn-companion-collect") return;
    collect()
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((err) => sendResponse({ ok: false, error: err && err.message }));
    return true;
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureButton);
  } else {
    ensureButton();
  }
}
