// ==UserScript==
// @name         ESPN redraft picks → local board
// @namespace    maurerFPG
// @version      0.2.0
// @description  Forward ESPN draft picks and the room ranking list to the local dashboard. Does not send cookies or passwords.
// @match        https://fantasy.espn.com/football/draft*
// @match        https://fantasy.espn.com/*draft*
// @updateURL    https://maurerfpg.github.io/dynasty-league/espn-picks.user.js
// @downloadURL  https://maurerfpg.github.io/dynasty-league/espn-picks.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  const LOCAL_PICKS = "http://127.0.0.1:8765/picks";
  const LOCAL_RANKS = "http://127.0.0.1:8765/ranks";
  const POLL_MS = 2000;
  const RANK_MS = 8000;
  let lastKey = "";
  let lastRankKey = "";

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function rec(pick_no, espn_id, name, position, team, draft_slot) {
    if (!pick_no) return null;
    return {
      pick_no,
      espn_id: espn_id != null && espn_id !== "" ? String(espn_id) : null,
      name: name || "",
      position: position || "",
      team: team || "",
      draft_slot: draft_slot != null ? num(draft_slot) : null,
    };
  }

  function fromEspnPick(p) {
    if (!p || typeof p !== "object") return null;
    const pick_no = num(p.overallPickNumber || p.pick_no || p.overall || p.pickNo);
    const espn_id = p.playerId != null ? p.playerId : p.espn_id;
    const player = p.player || (p.playerPoolEntry && p.playerPoolEntry.player) || {};
    const name =
      p.name ||
      p.playerName ||
      player.fullName ||
      [player.firstName, player.lastName].filter(Boolean).join(" ") ||
      "";
    const position =
      p.position || p.pos || player.defaultPosition || player.position || "";
    const team =
      p.team || p.proTeam || player.proTeamAbbreviation || player.proTeam || "";
    const slot = p.teamId || p.draft_slot || p.draftSlot;
    return rec(pick_no, espn_id, name, position, team, slot);
  }

  function fromDetail(detail) {
    if (!detail) return [];
    const raw = detail.picks || (detail.draftDetail && detail.draftDetail.picks) || [];
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const p of raw) {
      const r = fromEspnPick(p);
      if (r) out.push(r);
    }
    return out;
  }

  function walk(obj, depth) {
    if (!obj || typeof obj !== "object" || depth > 6) return [];
    if (Array.isArray(obj.picks) && obj.picks.length && obj.picks[0] && (obj.picks[0].overallPickNumber || obj.picks[0].playerId)) {
      return fromDetail(obj);
    }
    if (obj.draftDetail) {
      const d = fromDetail(obj.draftDetail);
      if (d.length) return d;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const d = walk(item, depth + 1);
        if (d.length) return d;
      }
      return [];
    }
    for (const k of ["espnDraft", "draft", "drafts", "gamecast", "fantasy", "props", "pageProps", "store"]) {
      if (obj[k]) {
        const d = walk(obj[k], depth + 1);
        if (d.length) return d;
      }
    }
    return [];
  }

  function picksFromPageState() {
    const roots = [window.espnDraft, window.espn, window.__NEXT_DATA__, window.espnDraftRoom];
    for (const r of roots) {
      const d = walk(r, 0);
      if (d.length) return d;
    }
    return [];
  }

  function picksFromDom() {
    const out = [];
    const seen = new Set();
    const nodes = document.querySelectorAll(
      '[class*="pick-history"] li, [class*="pickHistory"] li, [class*="DraftPick"], [class*="draftPick"], .pick-message, [data-pick], [class*="PickCard"]'
    );
    nodes.forEach((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      const m = text.match(/(?:^|\b)(\d{1,3})\s*[.)\-–]\s+([A-Za-z][A-Za-z.'\- ]+?)\s+(QB|RB|WR|TE|K|D\/ST|DST|DEF)\b/i);
      let pick_no = num(el.getAttribute("data-pick") || el.getAttribute("data-overall"));
      let name = "";
      let position = "";
      if (m) {
        pick_no = pick_no || num(m[1]);
        name = m[2].trim();
        position = m[3];
      }
      if (!pick_no || seen.has(pick_no)) return;
      seen.add(pick_no);
      out.push(rec(pick_no, null, name, position, "", null));
    });
    return out;
  }

  async function postPicks(picks) {
    if (!picks || !picks.length) return;
    const key = picks.map((p) => p.pick_no + ":" + (p.espn_id || p.name || "")).join("|");
    if (key === lastKey) return;
    lastKey = key;
    try {
      await fetch(LOCAL_PICKS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: picks }),
        mode: "cors",
        credentials: "omit",
      });
    } catch (e) {
      /* local server not running */
    }
  }

  async function pollEspnApi() {
    const url = "/apis/v3/games/ffl/seasons/2026/segments/0/leagues/1030576?view=mDraftDetail";
    try {
      const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const picks = fromDetail(data.draftDetail || data);
      if (picks.length) postPicks(picks);
    } catch (e) { /* page may not expose this path */ }
  }

  function posFromId(id) {
    const map = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DEF" };
    return map[Number(id)] || "";
  }

  function ranksFromKona(data) {
    const players = (data && data.players) || [];
    const out = [];
    for (const pe of players) {
      const pl = pe.player || pe;
      const id = pl.id != null ? pl.id : pe.id;
      const dr = pl.draftRanksByRankType || {};
      const rank =
        num((dr.STANDARD && dr.STANDARD.rank) || (dr.PPR && dr.PPR.rank) || pe.rank);
      if (!id || !rank) continue;
      out.push({
        rank,
        espn_id: String(id),
        name: pl.fullName || [pl.firstName, pl.lastName].filter(Boolean).join(" ") || "",
        pos: posFromId(pl.defaultPositionId) || pl.defaultPosition || "",
        team: pl.proTeamAbbreviation || "",
      });
    }
    out.sort((a, b) => a.rank - b.rank);
    return out;
  }

  async function pullKona(rankType) {
    const filter = JSON.stringify({
      players: {
        limit: 500,
        sortDraftRanks: { sortPriority: 1, sortAsc: true, value: rankType },
      },
    });
    const url =
      "/apis/v3/games/ffl/seasons/2026/segments/0/leagues/1030576?view=kona_player_info";
    const res = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Fantasy-Filter": filter },
    });
    if (!res.ok) return [];
    return ranksFromKona(await res.json());
  }

  function ranksFromDom() {
    const out = [];
    const seen = new Set();
    const rows = document.querySelectorAll(
      '[class*="available"] tr, [class*="player-list"] tr, [class*="PlayersTable"] tr, tbody tr'
    );
    rows.forEach((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      const m = text.match(/^(\d{1,3})\s+([A-Za-z][A-Za-z.'\- ]+?)\s+(QB|RB|WR|TE|K|D\/ST|DST|DEF)\b/i);
      if (!m) return;
      const rank = num(m[1]);
      const name = m[2].trim();
      if (!rank || seen.has(rank)) return;
      seen.add(rank);
      out.push({ rank, espn_id: null, name, pos: m[3], team: "" });
    });
    return out;
  }

  async function postRanks(ranks) {
    if (!ranks || ranks.length < 20) return;
    const key = ranks
      .slice(0, 40)
      .map((r) => r.rank + ":" + (r.espn_id || r.name || ""))
      .join("|");
    if (key === lastRankKey) return;
    lastRankKey = key;
    try {
      await fetch(LOCAL_RANKS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ranks }),
        mode: "cors",
        credentials: "omit",
      });
    } catch (e) {
      /* local server not running */
    }
  }

  async function tickRanks() {
    try {
      let ranks = await pullKona("STANDARD");
      if (ranks.length < 50) ranks = await pullKona("PPR");
      if (ranks.length < 20) {
        const dom = ranksFromDom();
        if (dom.length > ranks.length) ranks = dom;
      }
      if (ranks.length) postRanks(ranks);
    } catch (e) { /* ignore */ }
  }

  function tick() {
    const fromState = picksFromPageState();
    if (fromState.length) {
      postPicks(fromState);
      return;
    }
    pollEspnApi();
    const fromDom = picksFromDom();
    if (fromDom.length) postPicks(fromDom);
  }

  tick();
  tickRanks();
  setInterval(tick, POLL_MS);
  setInterval(tickRanks, RANK_MS);
})();
