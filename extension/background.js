import {
  fromMDraftDetail,
  indexPlayers,
  parsePickHistoryText,
} from "./picks.js";

const DEFAULT_API = "";
const DEFAULT_BOARD = "";

async function settings() {
  const data = await chrome.storage.sync.get({
    apiUrl: DEFAULT_API,
    boardUrl: DEFAULT_BOARD,
    secret: "",
    season: 2026,
  });
  return data;
}

function apiFromSettings(cfg) {
  const api = String(cfg.apiUrl || "").trim().replace(/\/$/, "");
  if (api) return api.endsWith("/picks") ? api : `${api}/api/picks`;
  const board = String(cfg.boardUrl || "").trim().replace(/\/$/, "");
  if (board) return `${board}/api/picks`;
  return "";
}

function playersUrl(cfg) {
  const board = String(cfg.boardUrl || "").trim().replace(/\/$/, "");
  const api = String(cfg.apiUrl || "").trim().replace(/\/$/, "");
  const origin = board || (api ? api.replace(/\/api\/picks$/, "") : "");
  return origin ? `${origin}/data/players.json` : "";
}

let playerIndex = null;
let playerIndexAt = 0;

async function loadIndex(cfg) {
  if (playerIndex && Date.now() - playerIndexAt < 10 * 60 * 1000) return playerIndex;
  const url = playersUrl(cfg);
  if (!url) {
    playerIndex = indexPlayers([]);
    return playerIndex;
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    playerIndex = indexPlayers([]);
    return playerIndex;
  }
  const data = await res.json();
  playerIndex = indexPlayers(data.players || []);
  playerIndexAt = Date.now();
  return playerIndex;
}

function normalize(payload, index) {
  const md = fromMDraftDetail(payload.mdraft, index);
  if (md.real > 0 && !md.stale) {
    return { picks: md.picks, source: "mdraft", detail: `${md.real} from mDraftDetail` };
  }
  const pasted = parsePickHistoryText(payload.historyText || "", index);
  if (pasted.length) {
    return { picks: pasted, source: "dom", detail: `${pasted.length} from Pick History` };
  }
  if (md.stale) {
    return { picks: [], source: "mdraft-stale", detail: "mDraftDetail has only unmade (-1) slots; Pick History was empty" };
  }
  return { picks: [], source: "empty", detail: payload.mdraftError || "no picks found" };
}

async function postPicks(cfg, picks, source, leagueId) {
  const url = apiFromSettings(cfg);
  if (!url) throw new Error("Set the board URL (or picks API) in extension options.");
  if (!cfg.secret) throw new Error("Set PICKS_SECRET in extension options.");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-picks-secret": cfg.secret,
    },
    body: JSON.stringify({
      picks,
      source,
      league_id: leagueId || null,
    }),
    credentials: "omit",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `API ${res.status}`);
  return body;
}

async function syncFromPayload(payload) {
  const cfg = await settings();
  const index = await loadIndex(cfg);
  const { picks, source, detail } = normalize(payload, index);
  if (!picks.length) {
    return { ok: false, total: 0, source, detail, error: detail };
  }
  const posted = await postPicks(cfg, picks, source, payload.leagueId);
  return {
    ok: true,
    total: posted.total || picks.length,
    merged: posted.merged,
    source,
    detail,
  };
}

function frameScore(url) {
  const u = String(url || "");
  if (/\/football\/draft/i.test(u)) return 0;
  if (/\/football\/waitingroom/i.test(u)) return 1;
  if (/fantasy\.espn\.com/i.test(u)) return 2;
  return 3;
}

async function injectCompanion(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["page-bridge.js"],
      world: "MAIN",
    });
  } catch {
    /* MAIN inject can fail on a blank iframe; isolated still needed */
  }
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["content.bundle.js"],
    world: "ISOLATED",
  });
}

async function collectFromTab(tabId) {
  await injectCompanion(tabId);
  let frames = [];
  try {
    frames = await chrome.webNavigation.getAllFrames({ tabId });
  } catch {
    frames = [];
  }
  const ordered = (frames || [])
    .filter((f) => /^https:\/\/fantasy\.espn\.com\//i.test(f.url || ""))
    .sort((a, b) => frameScore(a.url) - frameScore(b.url) || a.frameId - b.frameId);
  const attempts = ordered.length ? ordered : [{ frameId: undefined }];

  let lastErr = "content script not ready";
  for (const frame of attempts) {
    try {
      const opts = frame.frameId == null ? {} : { frameId: frame.frameId };
      const got = await chrome.tabs.sendMessage(tabId, { type: "espn-companion-collect" }, opts);
      if (got && got.ok) return got;
      lastErr = (got && got.error) || lastErr;
    } catch (err) {
      lastErr = err && err.message ? err.message : lastErr;
    }
  }
  throw new Error(lastErr);
}

async function syncActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !/^https:\/\/fantasy\.espn\.com\//i.test(tab.url || "")) {
    throw new Error("Open an ESPN draft or waiting-room tab first.");
  }
  const got = await collectFromTab(tab.id);
  if (!got || !got.ok) throw new Error((got && got.error) || "content script not ready");
  return syncFromPayload(got.payload);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "espn-companion-sync") {
    syncFromPayload(msg.payload)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message || "sync failed" }));
    return true;
  }
  if (msg.type === "espn-companion-sync-active") {
    syncActiveTab()
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message || "sync failed" }));
    return true;
  }
});
