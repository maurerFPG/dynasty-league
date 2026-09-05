import {
  fromMDraftDetail,
  indexPlayers,
  parsePickHistoryText,
  picksFingerprint,
  shouldSkipIdenticalPost,
} from "./picks.js";

const DEFAULT_API = "";
const DEFAULT_BOARD = "";
const LIVE_ALARM = "espn-companion-live";
const LIVE_MS = 1000;
const LAST_FP_KEY = "lastPostedFingerprint";
const LAST_FP_TOTAL_KEY = "lastPostedTotal";

async function settings() {
  const data = await chrome.storage.sync.get({
    apiUrl: DEFAULT_API,
    boardUrl: DEFAULT_BOARD,
    secret: "",
    season: 2026,
    liveSync: true,
  });
  return data;
}

function liveEnabled(cfg) {
  return cfg.liveSync !== false;
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

async function lastPosted() {
  const data = await chrome.storage.session.get({
    [LAST_FP_KEY]: "",
    [LAST_FP_TOTAL_KEY]: 0,
  });
  return {
    fingerprint: data[LAST_FP_KEY] || "",
    total: data[LAST_FP_TOTAL_KEY] || 0,
  };
}

async function rememberPosted(fingerprint, total) {
  await chrome.storage.session.set({
    [LAST_FP_KEY]: fingerprint,
    [LAST_FP_TOTAL_KEY]: total,
  });
}

async function rememberSync(result, { auto } = {}) {
  const now = Date.now();
  const patch = {
    lastSyncAt: now,
    lastSyncTotal: result.total || 0,
    lastSyncSource: result.source || "",
    lastSyncOk: !!result.ok,
    lastSyncSkipped: !!result.skipped,
    lastSyncError: result.error || "",
    lastSyncDetail: result.detail || "",
  };
  if (auto) {
    patch.lastAutoSyncAt = now;
    patch.lastAutoSyncTotal = result.total || 0;
  }
  await chrome.storage.local.set(patch);
}

function isDraftHref(url) {
  return /\/football\/(draft|waitingroom)/i.test(String(url || ""));
}

function isCompanionBoardUrl(url, boardUrl) {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return false;
    const configured = String(boardUrl || "").trim();
    if (configured) {
      try {
        if (u.origin === new URL(configured).origin) return true;
      } catch {
        /* ignore bad options URL */
      }
    }
    if (/\.vercel\.app$/i.test(u.hostname) && /dynasty-league/i.test(u.hostname)) return true;
    if (/github\.io$/i.test(u.hostname) && /dynasty-league/i.test(u.pathname + u.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

async function notifyBoardTabs() {
  const cfg = await settings();
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    tabs = [];
  }
  const targets = tabs.filter((t) => t.id && isCompanionBoardUrl(t.url, cfg.boardUrl));
  for (const tab of targets) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "picks-updated" });
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["board.js"],
        });
        await chrome.tabs.sendMessage(tab.id, { type: "picks-updated" });
      } catch {
        /* tab may not allow injection */
      }
    }
  }
}

async function syncFromPayload(payload, { force = false, auto = false } = {}) {
  const cfg = await settings();
  const index = await loadIndex(cfg);
  const { picks, source, detail } = normalize(payload, index);
  if (!picks.length) {
    const empty = { ok: false, total: 0, source, detail, error: detail, skipped: false };
    await rememberSync(empty, { auto });
    return empty;
  }
  const fingerprint = picksFingerprint(picks);
  const prev = await lastPosted();
  if (!force && shouldSkipIdenticalPost(prev.fingerprint, picks)) {
    const skipped = {
      ok: true,
      skipped: true,
      total: prev.total || picks.length,
      source,
      detail: "unchanged",
      fingerprint,
    };
    await rememberSync(skipped, { auto });
    return skipped;
  }
  const posted = await postPicks(cfg, picks, source, payload.leagueId);
  const total = posted.total || picks.length;
  await rememberPosted(fingerprint, total);
  const changed = fingerprint !== prev.fingerprint;
  if (changed || force) {
    await notifyBoardTabs();
  }
  const result = {
    ok: true,
    skipped: false,
    total,
    merged: posted.merged,
    source,
    detail,
    fingerprint,
  };
  await rememberSync(result, { auto });
  return result;
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
  return syncFromPayload(got.payload, { force: true, auto: false });
}

async function draftTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://fantasy.espn.com/*" });
    return tabs.filter((t) => t.id && isDraftHref(t.url));
  } catch {
    return [];
  }
}

let lastContentAutoAt = 0;
let autoBusy = false;

async function liveTickFromBackground() {
  const cfg = await settings();
  if (!liveEnabled(cfg)) return;
  if (Date.now() - lastContentAutoAt < 2000) return;
  if (autoBusy) return;
  const tabs = await draftTabs();
  if (!tabs.length) return;
  const tab = [...tabs].sort((a, b) => frameScore(a.url) - frameScore(b.url))[0];
  autoBusy = true;
  try {
    const got = await collectFromTab(tab.id);
    if (got && got.ok) await syncFromPayload(got.payload, { force: false, auto: true });
  } catch {
    /* draft page may still be loading */
  } finally {
    autoBusy = false;
  }
}

async function syncLiveAlarm() {
  const cfg = await settings();
  const on = liveEnabled(cfg) && (await draftTabs()).length > 0;
  if (on) {
    await chrome.alarms.create(LIVE_ALARM, {
      delayInMinutes: LIVE_MS / 60000,
      periodInMinutes: LIVE_MS / 60000,
    });
  } else {
    await chrome.alarms.clear(LIVE_ALARM);
  }
}

async function syncStatus() {
  const cfg = await settings();
  const local = await chrome.storage.local.get({
    lastSyncAt: 0,
    lastSyncTotal: 0,
    lastSyncSource: "",
    lastSyncOk: false,
    lastSyncSkipped: false,
    lastSyncError: "",
    lastSyncDetail: "",
    lastAutoSyncAt: 0,
    lastAutoSyncTotal: 0,
  });
  return {
    ok: true,
    liveSync: liveEnabled(cfg),
    ...local,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "espn-companion-sync") {
    syncFromPayload(msg.payload, { force: true, auto: false })
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message || "sync failed" }));
    return true;
  }
  if (msg.type === "espn-companion-autosync") {
    lastContentAutoAt = Date.now();
    if (autoBusy) {
      sendResponse({ ok: true, skipped: true, reason: "busy" });
      return;
    }
    autoBusy = true;
    Promise.resolve()
      .then(async () => {
        const cfg = await settings();
        if (!liveEnabled(cfg)) return { ok: true, skipped: true, reason: "live-off" };
        return syncFromPayload(msg.payload, { force: false, auto: true });
      })
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message || "sync failed" }))
      .finally(() => {
        autoBusy = false;
      });
    return true;
  }
  if (msg.type === "espn-companion-sync-active") {
    syncActiveTab()
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message || "sync failed" }));
    return true;
  }
  if (msg.type === "espn-companion-status") {
    syncStatus().then(sendResponse).catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === LIVE_ALARM) liveTickFromBackground();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.liveSync) syncLiveAlarm();
});

chrome.tabs.onUpdated.addListener(() => {
  syncLiveAlarm();
});
chrome.tabs.onRemoved.addListener(() => {
  syncLiveAlarm();
});

try {
  chrome.webNavigation.onCompleted.addListener(
    () => {
      syncLiveAlarm();
    },
    { url: [{ hostSuffix: "fantasy.espn.com" }] }
  );
} catch {
  /* webNavigation filter optional */
}

syncLiveAlarm();
