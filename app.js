/* Dynasty league — remaining-name glance. No pick recommender. */
(() => {
  const TARGETS_KEY = "nasty-draft-hq-targets-v1";
  const BOARD_H_KEY = "nasty-ui-board-h-v1";
  const CARD_H_KEY = "nasty-ui-card-h-v5";
  const POLL_MS = 30000;
  const ROB_USER = "469299052404535296";
  const DRAFT_END = 300;
  const UNDRAFTED = 301;


  const TEAM_NAMES = {
    ARI: ["arizona", "cardinals", "arizona cardinals"],
    ATL: ["atlanta", "falcons", "atlanta falcons"],
    BAL: ["baltimore", "ravens", "baltimore ravens"],
    BUF: ["buffalo", "bills", "buffalo bills"],
    CAR: ["carolina", "panthers", "carolina panthers"],
    CHI: ["chicago", "bears", "chicago bears"],
    CIN: ["cincinnati", "bengals", "cincinnati bengals"],
    CLE: ["cleveland", "browns", "cleveland browns"],
    DAL: ["dallas", "cowboys", "dallas cowboys"],
    DEN: ["denver", "broncos", "denver broncos"],
    DET: ["detroit", "lions", "detroit lions"],
    GB: ["green bay", "packers", "green bay packers"],
    HOU: ["houston", "texans", "houston texans"],
    IND: ["indianapolis", "colts", "indianapolis colts"],
    JAX: ["jacksonville", "jaguars", "jacksonville jaguars"],
    JAC: ["jacksonville", "jaguars", "jacksonville jaguars"],
    KC: ["kansas city", "chiefs", "kansas city chiefs"],
    LV: ["las vegas", "raiders", "las vegas raiders"],
    LAC: ["los angeles", "chargers", "los angeles chargers"],
    LAR: ["los angeles", "rams", "los angeles rams"],
    MIA: ["miami", "dolphins", "miami dolphins"],
    MIN: ["minnesota", "vikings", "minnesota vikings"],
    NE: ["new england", "patriots", "new england patriots"],
    NO: ["new orleans", "saints", "new orleans saints"],
    NYG: ["new york", "giants", "new york giants"],
    NYJ: ["new york", "jets", "new york jets"],
    PHI: ["philadelphia", "eagles", "philadelphia eagles"],
    PIT: ["pittsburgh", "steelers", "pittsburgh steelers"],
    SEA: ["seattle", "seahawks", "seattle seahawks"],
    SF: ["san francisco", "49ers", "san francisco 49ers"],
    TB: ["tampa", "tampa bay", "buccaneers", "tampa bay buccaneers"],
    TEN: ["tennessee", "titans", "tennessee titans"],
    WAS: ["washington", "commanders", "washington commanders"],
  };

  const state = {
    players: [],
    byId: new Map(),
    draft: null,
    sources: {},
    match: {},
    picks: [],
    draftedIds: new Set(),
    pickByOverall: new Map(),
    robTaken: [],
    selectedId: null,
    filterPos: new Set(),
    filterTargets: false,
    filterSteals: false,
    filterRookies: false,
    filterYoung: false,
    filterAvailableFo: false,
    filterAvailableFp: false,
    search: "",
    targets: new Set(),
    lastPoll: null,
    pollError: null,
    draftStatus: "pre_draft",
    draftLive: null,
    research: { key: null, status: "idle", headlines: [], error: null },
    altsCache: { key: null, list: [] },
    goneModel: { key: "", byId: new Map(), availById: new Map(), label: "", thenLabel: "" },
  };

  const $ = (id) => document.getElementById(id);

  function loadTargets() {
    try {
      const raw = JSON.parse(localStorage.getItem(TARGETS_KEY) || "[]");
      state.targets = new Set((raw || []).map(String));
    } catch {
      state.targets = new Set();
    }
  }
  function saveTargets() {
    localStorage.setItem(TARGETS_KEY, JSON.stringify([...state.targets]));
  }

  function loadLayout() {
    const h = Number(localStorage.getItem(BOARD_H_KEY));
    const ch = Number(localStorage.getItem(CARD_H_KEY));
    if (Number.isFinite(h) && h >= 120) {
      document.documentElement.style.setProperty("--board-h", Math.round(h) + "px");
    }
    if (Number.isFinite(ch) && ch >= 88) {
      document.documentElement.style.setProperty("--card-h", Math.round(ch) + "px");
    }
  }

  function bindSplitters() {
    const hs = $("split-h");
    const hsc = $("split-h-card");
    const pane = $("board-pane");
    const cardPane = $("card-pane");

    function bind(el, paneEl, onMove, onEnd) {
      if (!el || !paneEl) return;
      el.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        el.setPointerCapture(ev.pointerId);
        el.classList.add("dragging");
        document.body.classList.add("resizing-h");
        const startY = ev.clientY;
        const startH = paneEl.getBoundingClientRect().height;
        const move = (e) => onMove(e, startY, startH);
        const up = (e) => {
          try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
          el.classList.remove("dragging");
          document.body.classList.remove("resizing-h");
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
          el.removeEventListener("pointercancel", up);
          onEnd();
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
      });
    }

    bind(hs, pane, (e, startY, startH) => {
      const max = Math.floor(window.innerHeight * 0.7);
      const newH = Math.min(Math.max(startH + (startY - e.clientY), 120), max);
      document.documentElement.style.setProperty("--board-h", newH + "px");
    }, () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--board-h").trim();
      const px = raw.endsWith("px") ? parseFloat(raw) : pane.getBoundingClientRect().height;
      if (Number.isFinite(px)) localStorage.setItem(BOARD_H_KEY, String(Math.round(px)));
    });

    bind(hsc, cardPane, (e, startY, startH) => {
      const max = Math.floor(window.innerHeight * 0.55);
      const newH = Math.min(Math.max(startH + (startY - e.clientY), 88), max);
      document.documentElement.style.setProperty("--card-h", newH + "px");
    }, () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--card-h").trim();
      const px = raw.endsWith("px") ? parseFloat(raw) : cardPane.getBoundingClientRect().height;
      if (Number.isFinite(px)) localStorage.setItem(CARD_H_KEY, String(Math.round(px)));
    });

  }

  function lastName(full) {
    if (!full) return "";
    const suf = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
    const parts = full.replace(/,/g, "").trim().split(/\s+/);
    while (parts.length > 1 && suf.has(parts[parts.length - 1].toLowerCase().replace(/\./g, ""))) {
      parts.pop();
    }
    if (parts.length >= 2 && /^st\.?$/i.test(parts[parts.length - 2])) {
      return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
    }
    return parts[parts.length - 1] || full;
  }
  function boardName(full) {
    const last = lastName(full);
    if (!full) return last;
    const first = full.replace(/,/g, "").trim().split(/\s+/)[0] || "";
    const init = first.replace(/[^A-Za-z]/g, "").charAt(0);
    if (!init) return last;
    return init.toUpperCase() + ". " + last;
  }
  function cardName(p) {
    const full = String((p && p.name) || "").trim();
    if (full.length <= 13) return full;
    return boardName(full);
  }

  function fmtAdp(v) {
    if (v == null || Number.isNaN(Number(v))) return "—";
    return String(Math.round(Number(v)));
  }
  function fmtFoRank(v) {
    if (v == null) return "—";
    return String(v);
  }
  function fmtRank(v) {
    if (v == null) return "—";
    return String(v);
  }
  function gapClass(gap) {
    if (gap == null || Number.isNaN(Number(gap))) return "flat";
    const n = Math.round(Number(gap));
    if (n >= 8) return "steal";
    if (n <= -8) return "reach";
    return "flat";
  }
  function gapLabel(gap) {
    if (gap == null || Number.isNaN(Number(gap))) return "—";
    const n = Math.round(Number(gap));
    if (n === 0) return "0";
    return n > 0 ? `+${n}` : `${n}`;
  }
  function fmtPts(v) {
    if (v == null || Number.isNaN(Number(v))) return "—";
    return String(Math.round(Number(v)));
  }
  function fmtAge(v) {
    if (v == null || Number.isNaN(Number(v))) return "—";
    return String(Math.round(Number(v)));
  }
  function playerKey(p) {
    return p.id != null ? String(p.id) : `name:${p.name}`;
  }
  function remaining(p) {
    return !p.id || !state.draftedIds.has(String(p.id));
  }

  function stealScore(p) {
    if (p.fo_rank == null || p.fp_rank == null) return null;
    const fp_rank = Number(p.fp_rank);
    const fo_rank = Number(p.fo_rank);
    if (!Number.isFinite(fp_rank) || !Number.isFinite(fo_rank)) return null;
    const sl_eff = Math.min(fo_rank, UNDRAFTED);
    const fp_round = (fp_rank - 1) / 12 + 1;
    const sl_round = (sl_eff - 1) / 12 + 1;
    const score = (sl_round - fp_round) / Math.sqrt(fp_round);
    return Number.isFinite(score) ? score : null;
  }
  function stealQualifies(p) {
    const score = stealScore(p);
    if (score == null) return false;
    const sl_eff = Math.min(Number(p.fo_rank), UNDRAFTED);
    return sl_eff > Number(p.fp_rank) && Number(p.fp_rank) <= 324 && score >= 0.35;
  }
  function stealTip(p) {
    const score = stealScore(p);
    if (score == null) return "";
    return ` title="steal ${score.toFixed(2)}"`;
  }
  function matchesFilter(p, side) {
    if (side === "fo" && state.filterAvailableFo && !remaining(p)) return false;
    if (side === "fp" && state.filterAvailableFp && !remaining(p)) return false;
    if (state.filterPos.size && !state.filterPos.has(p.pos)) return false;
    if (state.filterTargets && (!p.id || !state.targets.has(String(p.id)))) return false;
    if (state.filterRookies && !p.is_rookie) return false;
    if (state.filterYoung && !(p.age != null && Number(p.age) <= 25)) return false;
    if (state.filterSteals && !stealQualifies(p)) return false;
    const q = state.search.trim().toLowerCase();
    if (!q) return true;
    if ((p.name || "").toLowerCase().includes(q)) return true;
    if ((p.pos || "").toLowerCase() === q) return true;
    const abbr = String(p.team || p.team_abbr || "").trim();
    const abbrL = abbr.toLowerCase();
    if (abbrL && (abbrL === q || abbrL.includes(q))) return true;
    if (p.team_abbr && String(p.team_abbr).toLowerCase().includes(q)) return true;
    const aliases = TEAM_NAMES[abbr.toUpperCase()] || [];
    for (const a of aliases) {
      if (a === q || a.includes(q) || q.includes(a)) return true;
    }
    return false;
  }

  function teamLogoUrl(team) {
    if (!team || team === "FA") return null;
    return `https://sleepercdn.com/images/team_logos/nfl/${String(team).toLowerCase()}.png`;
  }
  function logoHtml(team) {
    const url = teamLogoUrl(team);
    if (!url) return `<span class="logo ph" aria-hidden="true"></span>`;
    return `<img class="logo" src="${esc(url)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" />`;
  }
  function headshotHtml(id) {
    if (!id) return `<span class="headshot ph" aria-hidden="true"></span>`;
    const url = `https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`;
    return `<img class="headshot" src="${esc(url)}" alt="" onerror="this.onerror=null;this.classList.add('ph');this.removeAttribute('src')" />`;
  }

  function heatMark(p) {
    if (p.hot) return `<span class="heat fire" title="Trending add or rising public buzz">🔥</span>`;
    if (p.cold) return `<span class="heat ice" title="Trending drop (48h)">🧊</span>`;
    return "";
  }
  function rookieChip(p) {
    if (!p.is_rookie) return "";
    const rnd = Number(p.nfl_draft_round);
    const known = Number.isFinite(rnd) && rnd > 0;
    const lab = known ? "R" + rnd : "UDFA";
    const title = known ? `2026 rookie · NFL draft round ${rnd}` : "2026 rookie · undrafted free agent";
    return `<span class="rchip" title="${esc(title)}">${esc(lab)}</span>`;
  }
  function rookieCell(p) {
    return rookieChip(p) || `<span class="rchip empty" aria-hidden="true"></span>`;
  }
  function injuryAbbrev(status) {
    const s = String(status || "").trim();
    if (!s) return "";
    const map = {
      Questionable: "Q",
      Doubtful: "D",
      Out: "O",
      IR: "IR",
      PUP: "PUP",
      NA: "NA",
      Sus: "Sus",
      DNR: "DNR",
    };
    return map[s] || s;
  }
  function injuryTone(status) {
    const s = String(status || "").trim().toLowerCase();
    if (s === "questionable") return "q";
    if (s === "out" || s === "ir" || s === "doubtful") return "out";
    return "other";
  }
  function injuryBadge(p) {
    const st = String(p.injury_status || "").trim();
    if (!st) return "";
    const abbr = injuryAbbrev(st);
    if (!abbr) return "";
    const bits = [st];
    if (p.injury_body_part) bits.push(p.injury_body_part);
    return `<span class="ichip ${injuryTone(st)}" title="${esc(bits.join(" · "))}">${esc(abbr)}</span>`;
  }
  function injuryLine(p) {
    const st = String(p.injury_status || "").trim();
    if (!st) return `<div class="inj-cell empty" aria-hidden="true"></div>`;
    const bits = [st];
    if (p.injury_body_part) bits.push(p.injury_body_part);
    const title = p.injury_notes ? bits.concat(p.injury_notes).join(" · ") : bits.join(" · ");
    const part = p.injury_body_part ? `<span class="inj-part">${esc(p.injury_body_part)}</span>` : "";
    return `<div class="inj-cell ${injuryTone(st)}" title="${esc(title)}">${injuryBadge(p)}${part}</div>`;
  }
  function nameCell(p) {
    const rook = p.is_rookie ? " rookie" : "";
    return `<span class="c-who"><span class="c-name${rook}">${esc(p.name)}</span>${heatMark(p)}${injuryBadge(p)}</span>`;
  }

  function nextEmptyPick() {
    const map = state.draft?.pick_map || [];
    for (const cell of map) {
      if (!state.pickByOverall.has(cell.overall)) return cell;
    }
    return null;
  }
  function nextRobPick() {
    const map = state.draft?.pick_map || [];
    for (const cell of map) {
      if (cell.is_rob && !state.pickByOverall.has(cell.overall)) return cell;
    }
    return null;
  }

  function currentOverall() {
    let max = 0;
    for (const pk of state.picks) {
      const n = Number(pk.pick_no || pk.pickNo);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max > 0 ? max + 1 : 1;
  }

  function robRemainingPicks() {
    const map = state.draft?.pick_map || [];
    return map.filter((c) => c.is_rob && !state.pickByOverall.has(c.overall));
  }

  function pickLineMarks() {
    const rob = robRemainingPicks();
    const current = currentOverall();
    const marks = [];
    let cum = 0;
    for (let i = 0; i < rob.length; i++) {
      const n = i === 0 ? rob[i].overall - current : rob[i].overall - rob[i - 1].overall - 1;
      if (n <= 0) continue;
      cum += n;
      marks.push({ after: cum, label: "before " + rob[i].label });
    }
    return marks;
  }

  function remainingRanked(side) {
    if (side === "fo") {
      return state.players
        .filter((p) => remaining(p) && p.fo_adp != null)
        .sort((a, b) => (a.fo_rank || 9999) - (b.fo_rank || 9999) || a.fo_adp - b.fo_adp);
    }
    return state.players
      .filter((p) => remaining(p) && p.fp_rank != null)
      .sort((a, b) => a.fp_rank - b.fp_rank);
  }

  function pickLineEl(label) {
    const el = document.createElement("div");
    el.className = "pick-line";
    el.setAttribute("role", "separator");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<span class="pick-line-lab">${esc(label)}</span>`;
    return el;
  }

  function listNodes(rows, side) {
    const marks = pickLineMarks();
    const ranked = remainingRanked(side);
    const visible = new Set(rows.map((p) => playerKey(p)));
    const byAfter = new Map();
    for (const m of marks) {
      const afterVisible = ranked.slice(0, m.after).filter((p) => visible.has(playerKey(p))).length;
      if (!byAfter.has(afterVisible)) byAfter.set(afterVisible, []);
      byAfter.get(afterVisible).push(m);
    }
    const nodes = [];
    const top = byAfter.get(0);
    if (top) {
      for (const m of top) nodes.push(pickLineEl(m.label));
    }
    let remainingSeen = 0;
    rows.forEach((p) => {
      nodes.push(rowEl(p, side));
      if (!remaining(p)) return;
      remainingSeen += 1;
      const at = byAfter.get(remainingSeen);
      if (at) {
        for (const m of at) nodes.push(pickLineEl(m.label));
      }
    });
    return nodes;
  }

  function isRobPick(pk) {
    const robUser = String(state.draft?.rob_user_id || ROB_USER);
    if (pk.picked_by && String(pk.picked_by) === robUser) return true;
    const slot = (state.draft?.slots || []).find((s) => s.is_rob) || { slot: 3, roster_id: 12 };
    if (pk.roster_id != null && Number(pk.roster_id) === Number(slot.roster_id)) return true;
    if (pk.draft_slot != null && Number(pk.draft_slot) === Number(slot.slot)) return true;
    return false;
  }

  function renderBoard() {
    const board = $("board");
    const d = state.draft;
    if (!d) return;
    const frag = document.createDocumentFragment();
    const corner = document.createElement("div");
    corner.className = "b-corner";
    frag.appendChild(corner);
    for (const slot of d.slots) {
      const el = document.createElement("div");
      el.className = "b-team" + (slot.slot === d.rob_slot ? " rob" : "");
      el.innerHTML = `<div class="tn">${esc(slot.short || slot.display)}</div>`;
      frag.appendChild(el);
    }
    const next = nextEmptyPick();
    const byRound = new Map();
    for (const cell of d.pick_map) {
      if (!byRound.has(cell.round)) byRound.set(cell.round, []);
      byRound.get(cell.round).push(cell);
    }
    for (let rnd = 1; rnd <= d.rounds; rnd++) {
      const rh = document.createElement("div");
      rh.className = "b-rnd";
      rh.textContent = rnd;
      frag.appendChild(rh);
      const row = byRound.get(rnd) || [];
      const bySlot = new Map(row.map((c) => [c.slot, c]));
      for (let slot = 1; slot <= d.teams; slot++) {
        const cell = bySlot.get(slot);
        const el = document.createElement("div");
        const pick = cell ? state.pickByOverall.get(cell.overall) : null;
        const cls = ["b-cell"];
        if (cell?.is_rob) cls.push("rob");
        if (pick) {
          cls.push("filled");
          const pos = (pick.position || "").toUpperCase();
          if (pos) cls.push("pos-" + pos);
          const nm = boardName(pick.name);
          el.innerHTML = `<span class="nm">${esc(nm)}</span><span class="p">${esc(pos)}</span>`;
          el.title = `${cell.label} · ${pick.name} (${pos} ${pick.team || ""})`;
        } else {
          if (next && cell && cell.overall === next.overall) cls.push("next");
          el.innerHTML = `<span class="lbl">${esc(cell ? cell.label : "")}</span>`;
          el.title = cell ? `${cell.label} · slot ${cell.slot}` : "";
        }
        el.className = cls.join(" ");
        frag.appendChild(el);
      }
    }
    board.replaceChildren(frag);
  }

  function bucketPos(raw, playerId) {
    const tryOne = (s) => {
      const t = String(s || "").toUpperCase().trim();
      if (!t) return null;
      if (t === "DST" || t === "DEF" || t === "K" || t === "PK") return null;
      const m = t.match(/\b(QB|RB|WR|TE)\b/);
      return m ? m[1] : null;
    };
    const direct = tryOne(raw);
    if (direct) return direct;
    if (playerId && state.byId.has(String(playerId))) {
      return tryOne(state.byId.get(String(playerId)).pos);
    }
    return null;
  }

  function robPosCounts() {
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0 };
    for (const p of state.robTaken) {
      const bucket = bucketPos(p.position || p.pos, p.player_id);
      if (bucket) counts[bucket] += 1;
    }
    return counts;
  }

  function renderMyPicks() {
    const countsEl = $("mypicks-counts");
    const listEl = $("mypicks-list");
    const leftEl = $("mypicks-left");
    if (!countsEl || !listEl) return;
    const counts = robPosCounts();
    countsEl.innerHTML = ["QB", "WR", "RB", "TE"]
      .map((pos) => {
        const n = counts[pos];
        return `<span class="mp-pill mp-${pos.toLowerCase()}" title="${pos} ${n}"><span class="c-pos ${pos}">${pos}</span><span class="mp-n">${n}</span></span>`;
      })
      .join("");
    if (leftEl) {
      const n = robRemainingPicks().length;
      leftEl.innerHTML = `<span class="n">${n}</span><span class="mp-left-lab">left</span>`;
    }
    const taken = state.robTaken;
    if (!taken.length) {
      listEl.replaceChildren();
      listEl.hidden = true;
      return;
    }
    listEl.hidden = false;
    listEl.innerHTML = taken
      .map((p) => {
        return `<span class="mp-chip">${logoHtml(p.team)}<span class="mp-name">${esc(p.name)}</span><span class="c-pos ${esc(p.position || "")}">${esc(p.position || "")}</span></span>`;
      })
      .join("");
  }

  function renderLists() {
    const foPending = state.match && state.match.fo_file_present === false;
    const fo = $("list-fo");
    const fp = $("list-fp");
    const stealOn = state.filterSteals;
    if (foPending) {
      fo.innerHTML = `<div class="empty-col"><strong>Sleeper board pending</strong>Drop <code>sleeper_board.json</code> into <code>/workspace/ff-dynasty/data/</code> and run <code>python3 dashboard/build_data.py</code>. Left column stays empty until then — no invented ADP.</div>`;
      $("count-fo").textContent = "0";
    } else {
      const foRows = state.players
        .filter((p) => p.fo_adp != null && matchesFilter(p, "fo"))
        .sort((a, b) => (a.fo_rank || 9999) - (b.fo_rank || 9999) || a.fo_adp - b.fo_adp);
      fo.replaceChildren(...listNodes(foRows, "fo"));
      $("count-fo").textContent = stealOn ? `${foRows.filter(remaining).length} steals` : `${foRows.filter(remaining).length} left`;
    }
    const fpRows = state.players
      .filter((p) => p.fp_rank != null && matchesFilter(p, "fp"))
      .sort((a, b) => a.fp_rank - b.fp_rank);
    fp.replaceChildren(...listNodes(fpRows, "fp"));
    $("count-fp").textContent = stealOn ? `${fpRows.filter(remaining).length} steals` : `${fpRows.filter(remaining).length} left`;
  }

  function rowEl(p, side) {
    const el = document.createElement("div");
    const key = playerKey(p);
    const sel = state.selectedId && key === String(state.selectedId);
    const tgt = p.id && state.targets.has(String(p.id));
    el.className = "rowp " + (side === "fo" ? "fo" : "fp") + (sel ? " sel" : "") + (tgt ? " tgt" : "") + (remaining(p) ? "" : " gone");
    el.dataset.key = key;
    el.innerHTML = `
      <span class="c-mark">
        <button type="button" class="star${tgt ? " on" : ""}" data-star="${esc(p.id || "")}" title="Target">${tgt ? "★" : "☆"}</button>
      </span>
      <span class="c-ranks">
        <span class="c-rank sl" title="Sleeper board">${esc(fmtFoRank(p.fo_rank))}</span>
        <span class="c-rank ecr" title="FantasyPros ECR">${esc(fmtRank(p.fp_rank))}</span>
      </span>
      <span class="c-pos ${esc(p.pos || "")}">${esc(p.pos || "")}</span>
      ${logoHtml(p.team)}
      ${nameCell(p)}
      ${rookieCell(p)}
      <span class="c-age" title="Age">${esc(fmtAge(p.age))}</span>
      <span class="c-pts" title="${esc(side === "fo" ? (state.sources.sleeper_pts_label || "Sleeper 2026 regular season (half-PPR)") : (state.sources.fp_pts_label || "FantasyPros 2026 season (half-PPR)"))}">${esc(fmtPts(side === "fo" ? p.sleeper_pts : p.fp_pts))}</span>
      <span class="c-gap ${gapClass(p.gap)}"${stealTip(p)}>${esc(gapLabel(p.gap))}</span>
    `;
    return el;
  }

  function rowsByKey(key) {
    const want = key == null ? null : String(key);
    const out = [];
    document.querySelectorAll(".rowp").forEach((el) => {
      if (want != null && el.dataset.key === want) out.push(el);
    });
    return out;
  }

  function highlightSelected(key) {
    const want = key == null ? null : String(key);
    document.querySelectorAll(".rowp").forEach((el) => {
      el.classList.toggle("sel", want != null && el.dataset.key === want);
    });
  }

  function rowVisibleInList(row, list) {
    const lr = list.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    return rr.top >= lr.top && rr.bottom <= lr.bottom;
  }

  function scrollRowInList(list, key) {
    if (!list || key == null) return;
    const want = String(key);
    const row = [...list.querySelectorAll(".rowp")].find((el) => el.dataset.key === want);
    if (!row) return;
    if (!rowVisibleInList(row, list)) row.scrollIntoView({ block: "nearest" });
  }

  function clearSelectionUi() {
    state.selectedId = null;
    state.research = { key: null, status: "idle", headlines: [], error: null };
    state.altsCache = { key: null, list: [] };
    highlightSelected(null);
    renderCard();
  }

  function toggleTarget(id) {
    if (state.targets.has(id)) state.targets.delete(id);
    else state.targets.add(id);
    saveTargets();
    const on = state.targets.has(id);
    rowsByKey(id).forEach((row) => {
      row.classList.toggle("tgt", on);
      const star = row.querySelector("[data-star]");
      if (star) {
        star.classList.toggle("on", on);
        star.textContent = on ? "★" : "☆";
      }
    });
    if (state.filterTargets) renderLists();
    renderCard();
  }

  function selectPlayer(key, fromList) {
    const same = state.selectedId != null && String(state.selectedId) === String(key);
    if (!same) {
      if (state.selectedId) {
        state.research = { key: null, status: "idle", headlines: [], error: null };
      }
      state.selectedId = key;
      highlightSelected(key);
      renderCard();
    }
    if (fromList) scrollRowInList(fromList, key);
  }

  function findPlayer(key) {
    if (!key) return null;
    if (state.byId.has(String(key))) return state.byId.get(String(key));
    return state.players.find((p) => playerKey(p) === String(key)) || null;
  }

  function alternates(p) {
    const key = playerKey(p);
    if (state.altsCache && state.altsCache.key === key && Array.isArray(state.altsCache.list)) {
      return state.altsCache.list;
    }
    const rank = p.fo_rank != null ? Number(p.fo_rank) : null;
    const pos = String(p.pos || "").trim();
    const pool = state.players.filter((o) => {
      if (!remaining(o) || playerKey(o) === key || o.fo_rank == null) return false;
      if (pos && String(o.pos || "").trim() !== pos) return false;
      return true;
    });
    pool.sort((a, b) => {
      const da = Math.abs(Number(a.fo_rank) - (rank ?? Number(a.fo_rank)));
      const db = Math.abs(Number(b.fo_rank) - (rank ?? Number(b.fo_rank)));
      return da - db || Number(a.fo_rank) - Number(b.fo_rank);
    });
    const near = pool.slice(0, 5);
    near.sort((a, b) => Number(a.fo_rank) - Number(b.fo_rank));
    const list = near;
    state.altsCache = { key, list };
    return list;
  }

  function trimHeadline(title) {
    const t = String(title || "").replace(/\s+/g, " ").trim();
    if (t.length <= 110) return t;
    return t.slice(0, 107).replace(/\s+\S*$/, "") + "…";
  }

  function synthesizeBrief(headlines, name) {
    /* Headline synthesis only — not a ranking or a Grok take. */
    const items = (headlines || []).filter((h) => h && h.title);
    if (!items.length) return "";
    const titles = items.map((h) => String(h.title).replace(/\s+/g, " ").trim());
    const sources = [...new Set(items.map((h) => h.source).filter(Boolean))];
    const who = name || "this player";
    const checks = [
      ["injury or availability", /injur|questionable|doubtful|\bir\b|pup|hamstring|ankle|knee|concussion|surgery|ailment|limited|week-to-week/i],
      ["training camp", /camp|practice|preseason|workout|reps|padded/i],
      ["role or usage", /role|starter|starting|snap|usage|committee|backup|depth chart|target|workload|feature|first-team|first team/i],
      ["a trade", /trade|traded|acquired|dealt/i],
      ["contract news", /contract|extension|franchise tag/i],
      ["a suspension", /suspend/i],
    ];
    const themes = [];
    for (const [label, re] of checks) {
      if (titles.some((t) => re.test(t))) themes.push(label);
    }
    const sentences = [];
    if (themes.length) {
      const listed =
        themes.length === 1
          ? themes[0]
          : themes.slice(0, -1).join(", ") + " and " + themes[themes.length - 1];
      sentences.push(`Recent public headlines on ${who} are mostly about ${listed}.`);
    } else {
      sentences.push(`Recent public headlines mention ${who} in NFL coverage.`);
    }
    if (titles[0]) sentences.push(`One thread: “${trimHeadline(titles[0])}.”`);
    if (titles[1] && sentences.length < 4) sentences.push(`Another: “${trimHeadline(titles[1])}.”`);
    if (sources.length && sentences.length < 4) {
      sentences.push(`Sources in the feed include ${sources.slice(0, 3).join(", ")}.`);
    }
    return sentences.slice(0, 4).join(" ");
  }

  function researchBlock(p) {
    const r = state.research;
    const same = r.key && r.key === playerKey(p);
    if (!same || r.status === "idle") return "";
    if (r.status === "loading") {
      return `<div class="flash" id="research-flash">Loading headlines…</div>`;
    }
    if (r.status === "err") {
      return `<div class="flash err" id="research-flash">${esc(r.error || "Research failed.")}</div>`;
    }
    if (r.status === "empty" || !r.headlines.length) {
      return `<div class="flash" id="research-flash">No headlines found</div>`;
    }
    const brief = synthesizeBrief(r.headlines, p.name);
    const lis = r.headlines
      .slice(0, 3)
      .map((h) => {
        const src = h.source ? `<em>${esc(h.source)}</em>` : "";
        return `<li><a href="${esc(h.url)}" target="_blank" rel="noopener noreferrer">${esc(h.title)}</a>${src}</li>`;
      })
      .join("");
    return `<div class="coverage" id="research-flash"><div class="k">From recent coverage</div><p class="brief">${esc(brief)}</p><ul class="hl-list compact">${lis}</ul></div>`;
  }


  function emptyPosCounts() {
    return { QB: 0, RB: 0, WR: 0, TE: 0 };
  }

  function slotOfPickRec(pk) {
    const n = Number(pk && (pk.draft_slot != null ? pk.draft_slot : pk.slot));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function liveRosters() {
    const teams = (state.draft && state.draft.teams) || 12;
    const by = {};
    for (let s = 1; s <= teams; s++) by[s] = emptyPosCounts();
    for (const rec of state.pickByOverall.values()) {
      const slot = slotOfPickRec(rec);
      if (!slot || !by[slot]) continue;
      const pos = String(rec.position || "").toUpperCase();
      if (by[slot][pos] != null) by[slot][pos] += 1;
    }
    return by;
  }

  /* Superflex startup needs: 1 QB + SF, 2 RB, 3 WR, 1 TE, 2 FLEX. */
  function posNeed(counts, pos, round) {
    const qb = counts.QB || 0;
    const rb = counts.RB || 0;
    const wr = counts.WR || 0;
    const te = counts.TE || 0;
    if (pos === "QB") {
      if (qb === 0) return 2.55;
      if (qb === 1) return round <= 8 ? 1.35 : 0.7;
      if (qb === 2) return round <= 12 ? 0.22 : 0.08;
      return 0.04;
    }
    if (pos === "RB") {
      if (rb === 0) return 1.8;
      if (rb === 1) return 1.4;
      if (rb === 2) return round <= 5 ? 0.42 : 0.55;
      if (rb >= 3 && round <= 4) return 0.08;
      return 0.32;
    }
    if (pos === "WR") {
      if (wr === 0) return 1.65;
      if (wr === 1) return 1.42;
      if (wr === 2) return 1.12;
      if (wr === 3) return round <= 6 ? 0.48 : 0.4;
      return 0.28;
    }
    if (pos === "TE") {
      if (te === 0) return round <= 2 ? 0.32 : round <= 6 ? 0.62 : 0.85;
      return 0.07;
    }
    return 0.15;
  }

  function goneTau(round) {
    if (round <= 1) return 1.6;
    if (round <= 2) return 2.05;
    if (round <= 4) return 2.7;
    return 3.5;
  }

  /* Room is a Sleeper board, but some drafters (including Rob) watch ECR. */
  function blendRank(p) {
    const sl = p.fo_rank != null && !Number.isNaN(Number(p.fo_rank)) ? Number(p.fo_rank) : null;
    const ecr = p.fp_rank != null && !Number.isNaN(Number(p.fp_rank)) ? Number(p.fp_rank) : null;
    if (sl != null && ecr != null) return 0.7 * sl + 0.3 * ecr;
    if (sl != null) return sl;
    if (ecr != null) return ecr;
    return 999;
  }

  function softmaxPick(cands, scores) {
    let max = -Infinity;
    for (let i = 0; i < scores.length; i++) if (scores[i] > max) max = scores[i];
    const ex = new Array(scores.length);
    let sum = 0;
    for (let i = 0; i < scores.length; i++) {
      const e = Math.exp(scores[i] - max);
      ex[i] = e;
      sum += e;
    }
    let r = Math.random() * sum;
    for (let i = 0; i < cands.length; i++) {
      r -= ex[i];
      if (r <= 0) return cands[i];
    }
    return cands[cands.length - 1];
  }

  function goneWindow() {
    const current = currentPickNo();
    const map = state.draft && state.draft.pick_map ? state.draft.pick_map : [];
    const robs = map.filter((cell) => cell.is_rob && cell.overall >= current && !state.pickByOverall.has(cell.overall));
    if (!robs.length) return null;
    const next = robs[0];
    const then = robs[1] || null;
    const end = then ? then.overall : next.overall;
    const upcoming = map.filter((c) => c.overall >= current && c.overall < end && !c.is_rob);
    return { current, next, then, upcoming };
  }

  function goneModelKey(win) {
    return String(win.current) + ":" + state.draftedIds.size + ":" + (win.then ? win.then.overall : "x");
  }

  function runGoneSims(win) {
    const gone1 = new Map();
    const live2 = new Map();
    const upcoming = win.upcoming;
    const rosters = liveRosters();
    const pool = state.players
      .filter((p) => remaining(p) && (p.fo_rank != null || p.fp_rank != null))
      .sort((a, b) => blendRank(a) - blendRank(b));
    const cap = Math.min(pool.length, Math.max(36, upcoming.length * 16 + 20));
    const short = pool.slice(0, cap);
    const nSims = upcoming.length <= 4 ? 700 : 400;
    const nextAt = win.next.overall;
    const hasThen = !!win.then;
    const hits = new Map();
    const still = new Map();
    for (let s = 0; s < nSims; s++) {
      const gone = new Set();
      const counts = {};
      for (const k of Object.keys(rosters)) counts[k] = Object.assign({}, rosters[k]);
      const recent = [];
      for (let pki = 0; pki < upcoming.length; pki++) {
        const cell = upcoming[pki];
        const round = Math.ceil(cell.overall / 12);
        const c = counts[cell.slot] || emptyPosCounts();
        const cand = [];
        for (let i = 0; i < short.length; i++) {
          const p = short[i];
          const id = p.id != null ? String(p.id) : playerKey(p);
          if (!gone.has(id)) cand.push(p);
        }
        if (!cand.length) break;
        const byPos = {};
        for (let i = 0; i < cand.length; i++) {
          const p = cand[i];
          const pos = p.pos || "";
          if (!byPos[pos]) byPos[pos] = [];
          byPos[pos].push(p);
        }
        const tau = goneTau(round);
        const scores = new Array(cand.length);
        for (let i = 0; i < cand.length; i++) {
          const p = cand[i];
          const rk = blendRank(p);
          let u = -rk / tau + 0.95 * posNeed(c, p.pos, round);
          const same = (byPos[p.pos] || []).slice().sort((a, b) => blendRank(a) - blendRank(b));
          let nextRank = null;
          for (let j = 0; j < same.length; j++) {
            if (blendRank(same[j]) > rk) {
              nextRank = blendRank(same[j]);
              break;
            }
          }
          if (nextRank != null) {
            const drop = nextRank - rk;
            if (drop >= 15) u += 0.55;
            else if (drop >= 10) u += 0.32;
            else if (drop >= 6) u += 0.15;
          } else {
            u += 0.2;
          }
          let nRun = 0;
          for (let k = recent.length - 1; k >= Math.max(0, recent.length - 4); k--) {
            if (recent[k] === p.pos) nRun++;
          }
          if (nRun >= 3) u += 0.28;
          else if (nRun >= 2) u += 0.12;
          scores[i] = u;
        }
        const pick = softmaxPick(cand, scores);
        const id = pick.id != null ? String(pick.id) : playerKey(pick);
        gone.add(id);
        if (cell.overall < nextAt) hits.set(id, (hits.get(id) || 0) + 1);
        if (c[pick.pos] != null) c[pick.pos] += 1;
        recent.push(pick.pos);
      }
      if (hasThen) {
        for (let i = 0; i < short.length; i++) {
          const p = short[i];
          const id = p.id != null ? String(p.id) : playerKey(p);
          if (!gone.has(id)) still.set(id, (still.get(id) || 0) + 1);
        }
      }
    }
    for (let i = 0; i < short.length; i++) {
      const p = short[i];
      const id = p.id != null ? String(p.id) : playerKey(p);
      const gPct = Math.round(((hits.get(id) || 0) / nSims) * 100);
      gone1.set(id, gPct);
      gone1.set(playerKey(p), gPct);
      if (hasThen) {
        const aPct = Math.round(((still.get(id) || 0) / nSims) * 100);
        live2.set(id, aPct);
        live2.set(playerKey(p), aPct);
      }
    }
    return { gone1, live2 };
  }

  function ensureGoneModel() {
    const win = goneWindow();
    if (!win) {
      state.goneModel = { key: "none", byId: new Map(), availById: new Map(), label: "", thenLabel: "" };
      return state.goneModel;
    }
    const key = goneModelKey(win);
    if (state.goneModel && state.goneModel.key === key) return state.goneModel;
    const { gone1, live2 } = runGoneSims(win);
    state.goneModel = {
      key,
      byId: gone1,
      availById: live2,
      label: win.next.label,
      thenLabel: win.then ? win.then.label : "",
    };
    return state.goneModel;
  }

  function currentPickNo() {
    let max = 0;
    for (const pk of state.picks) {
      const n = Number(pk.pick_no || pk.pickNo);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max > 0 ? max + 1 : 1;
  }

  function lookupGone(map, p) {
    if (!map) return 0;
    const id = p.id != null ? String(p.id) : playerKey(p);
    if (map.has(id)) return map.get(id);
    if (map.has(playerKey(p))) return map.get(playerKey(p));
    return 0;
  }

  function goneBeforeEstimate(p) {
    if (!p) return null;
    if (p.id && state.draftedIds.has(String(p.id))) return null;
    const model = ensureGoneModel();
    if (!model || model.key === "none") return null;
    return {
      pct: lookupGone(model.byId, p),
      avail: model.thenLabel ? lookupGone(model.availById, p) : null,
      label: model.label,
      thenLabel: model.thenLabel || "",
    };
  }

  function goneStat(p) {
    const g = goneBeforeEstimate(p);
    if (!g) return `<div class="stat"><div class="k">Gone</div><div class="v faint">—</div></div>`;
    let html = `<div class="stat"><div class="k">Gone</div><div class="v">${g.pct}%</div></div>`;
    if (g.thenLabel) html += `<div class="stat"><div class="k">${esc(g.thenLabel)}</div><div class="v">${g.avail}%</div></div>`;
    return html;
  }

  function renderCard() {
    const card = $("player-card");
    const p = findPlayer(state.selectedId);
    if (!p) {
      card.innerHTML = `<div class="card-empty">Click a player</div>`;
      return;
    }
    const tgt = p.id && state.targets.has(String(p.id));
    const alts = alternates(p);
    const exp = p.is_rookie || p.years_exp == null || p.years_exp === 0 ? "" : ` · ${p.years_exp} yr`;
    const age = p.age == null ? "" : ` · ${p.age}`;
    card.innerHTML = `
      <div class="card-layout">
        <div class="card-left">
          <div class="card-idrow">
            ${headshotHtml(p.id)}
            <div class="card-id">
              <div class="who"><span class="${p.is_rookie ? "rookie" : ""}" title="${esc(p.name)}">${esc(cardName(p))}</span>${heatMark(p)}${rookieChip(p)}</div>
              <div class="meta"><span class="c-pos ${esc(p.pos || "")}">${esc(p.pos || "")}</span> · ${esc(p.team || "FA")}${age}${exp}</div>
            </div>
            ${injuryLine(p)}
          </div>
          <div class="card-stats">
            <div class="stat">
              <div class="k">Sleeper</div>
              <div class="v">${esc(fmtFoRank(p.fo_rank))}</div>
            </div>
            <div class="stat">
              <div class="k">ECR</div>
              <div class="v">${esc(fmtRank(p.fp_rank))}</div>
            </div>
            <div class="stat">
              <div class="k">Gap</div>
              <div class="v ${gapClass(p.gap)}">${esc(gapLabel(p.gap))}</div>
            </div>
            ${goneStat(p)}
          </div>
          <div class="card-ops">
            <button type="button" class="card-act${tgt ? " on" : ""}" id="btn-target">${tgt ? "★ Target" : "☆ Target"}</button>
            <button type="button" class="card-act" id="btn-research">Research</button>
            <button type="button" class="card-x" id="btn-close" title="Clear">×</button>
          </div>
          <div class="alts">
            ${
              alts.length
                ? `<table class="alt-table">
                    <thead><tr><th class="n">Nearby</th><th>SL</th><th>ECR</th><th>+/−</th></tr></thead>
                    <tbody>
                      ${alts
                        .map((a) => {
                          const sl = a.fo_rank != null ? fmtFoRank(a.fo_rank) : a.fo_adp != null ? fmtAdp(a.fo_adp) : "—";
                          return `<tr class="alt" data-alt="${esc(playerKey(a))}"><td class="n">${esc(a.name)}</td><td>${esc(sl)}</td><td>${esc(fmtRank(a.fp_rank))}</td><td class="${gapClass(a.gap)}">${esc(gapLabel(a.gap))}</td></tr>`;
                        })
                        .join("")}
                    </tbody>
                  </table>`
                : `<span class="flash">No close neighbors on these boards.</span>`
            }
          </div>
        </div>
        <div class="card-right">${researchBlock(p)}</div>
      </div>
    `;
    $("btn-target").addEventListener("click", () => {
      if (p.id) toggleTarget(String(p.id));
    });
    $("btn-research").addEventListener("click", () => fetchResearch(p, alts));
    $("btn-close").addEventListener("click", () => {
      clearSelectionUi();
    });
    card.querySelectorAll("[data-alt]").forEach((btn) => {
      btn.addEventListener("click", () => selectPlayer(btn.getAttribute("data-alt")));
    });
  }

  async function fetchResearch(p, alts) {
    const key = playerKey(p);
    state.research = { key, status: "loading", headlines: [], error: null };
    renderCard();
    const payload = {
      player_id: p.id || null,
      name: p.name,
      fp_rank: p.fp_rank,
      fo_adp: p.fo_adp,
      alternates: alts.map((a) => ({
        player_id: a.id || null,
        name: a.name,
        pos: a.pos,
        fp_rank: a.fp_rank,
        fo_adp: a.fo_adp,
      })),
    };
    try {
      const res = await fetch("/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const js = await res.json();
      const headlines = Array.isArray(js.headlines) ? js.headlines : [];
      state.research = {
        key,
        status: headlines.length ? "ok" : "empty",
        headlines,
        error: null,
      };
    } catch (err) {
      state.research = {
        key,
        status: "err",
        headlines: [],
        error: "Could not fetch headlines. Check internet and that this page is served from the local app.",
      };
    }
    if (state.selectedId && playerKey(p) === String(state.selectedId)) renderCard();
  }

  function renderChrome() {
    const status = state.draftStatus || state.draft?.status || "pre_draft";
    const pill = $("draft-status");
    pill.textContent = String(status).replace(/_/g, " ").toUpperCase();
    pill.className = "status-pill" + (status === "drafting" ? " live" : status === "complete" ? " done" : "");
    const robNext = nextRobPick();
    const current = currentOverall();
    const until = robNext ? robNext.overall - current : null;
    const onClock = until === 0;
    const nextEl = $("rob-next");
    const untilEl = $("rob-until");
    function setChip(el, value, label) {
      if (!el) return;
      const v = el.querySelector(".stat-v");
      const k = el.querySelector(".stat-k");
      if (v) v.textContent = value;
      else el.textContent = value;
      if (k) k.textContent = label;
    }
    if (robNext) {
      setChip(nextEl, robNext.label, onClock ? "Clock" : "Next");
      setChip(untilEl, String(until), "until");
    } else {
      setChip(nextEl, "—", "Done");
      setChip(untilEl, "—", "until");
    }
    if (nextEl) nextEl.classList.toggle("up", onClock);
    if (untilEl) untilEl.classList.toggle("up", onClock);
    const polledEl = $("hdr-polled");
    let pollLabel = "—";
    if (state.lastPoll) {
      pollLabel = String(state.lastPoll)
        .replace(/\s*CT\s*$/i, "")
        .replace(/(\d{1,2}:\d{2}):\d{2}(\s*[AP]M)/i, "$1$2")
        .trim() || "—";
    }
    setChip(polledEl, pollLabel, "Polled");
    if (polledEl) {
      if (state.pollError) polledEl.title = "Picks poll failed · " + state.pollError;
      else if (state.lastPoll) polledEl.title = "Last poll " + state.lastPoll;
      else polledEl.title = "Picks poll every 30s";
    }
    const dot = $("poll-dot");
    dot.className = "poll-dot" + (state.pollError ? " err" : state.lastPoll ? " ok" : "");
    if (state.pollError) dot.title = "Picks poll failed · " + state.pollError;
    else if (state.lastPoll) dot.title = "Last poll " + state.lastPoll;
    else dot.title = "Picks poll every 30s";
  }

  function toEpochMs(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n < 1e12 ? n * 1000 : n;
  }

  function pickTimerSeconds() {
    const live = state.draftLive?.pick_timer;
    const baked = state.draft?.pick_timer_seconds;
    const n = Number(live != null ? live : baked);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function draftStartMs() {
    const live = toEpochMs(state.draftLive?.start_time);
    if (live) return live;
    const iso = state.draft?.start_time_ct;
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : null;
  }

  /* Clock start for the current pick: last_picked after a pick, else start_time. */
  function pickClockStartMs() {
    if (state.picks.length > 0) return toEpochMs(state.draftLive?.last_picked);
    return draftStartMs();
  }

  /*
   * Sleeper settings.autopause_* are minutes past midnight UTC on this draft
   * (240 / 780 = 04:00–13:00 UTC = 11:00 PM–8:00 AM CT in August). Honor them
   * only when enabled and both times are present — do not invent a window.
   */
  function autopauseWindow() {
    const s = state.draftLive?.settings;
    if (!s || Number(s.autopause_enabled) !== 1) return null;
    const startMin = Number(s.autopause_start_time);
    const endMin = Number(s.autopause_end_time);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return null;
    if (startMin === endMin) return null;
    return { startMin, endMin };
  }

  function utcDayStart(ms) {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  function utcMinutesOfDay(ms) {
    return (ms - utcDayStart(ms)) / 60000;
  }

  function inAutopause(ms, win) {
    const min = utcMinutesOfDay(ms);
    if (win.startMin < win.endMin) return min >= win.startMin && min < win.endMin;
    return min >= win.startMin || min < win.endMin;
  }

  function nextPauseStart(ms, win) {
    const day0 = utcDayStart(ms);
    const min = utcMinutesOfDay(ms);
    if (min < win.startMin) return day0 + win.startMin * 60000;
    return day0 + 86400000 + win.startMin * 60000;
  }

  function nextUnpause(ms, win) {
    const day0 = utcDayStart(ms);
    const min = utcMinutesOfDay(ms);
    if (win.startMin < win.endMin) {
      if (min < win.endMin) return day0 + win.endMin * 60000;
      return day0 + 86400000 + win.endMin * 60000;
    }
    if (min >= win.startMin) return day0 + 86400000 + win.endMin * 60000;
    return day0 + win.endMin * 60000;
  }

  /* Deadline = clock start + pick_timer, skipping official autopause windows. */
  function pickDeadlineMs() {
    const start = pickClockStartMs();
    const timer = pickTimerSeconds();
    if (start == null || timer == null) return null;
    const win = autopauseWindow();
    if (!win) return start + timer * 1000;
    let t = start;
    let remaining = timer * 1000;
    for (let i = 0; i < 48 && remaining > 0; i++) {
      if (inAutopause(t, win)) {
        const resume = nextUnpause(t, win);
        if (!(resume > t)) break;
        t = resume;
        continue;
      }
      const pauseAt = nextPauseStart(t, win);
      const avail = pauseAt - t;
      if (remaining <= avail) return t + remaining;
      remaining -= avail;
      t = pauseAt;
    }
    return t;
  }

  function formatDuration(ms) {
    if (ms <= 0) return "00:00:00";
    const d = Math.floor(ms / 86400000);
    ms -= d * 86400000;
    const h = Math.floor(ms / 3600000);
    ms -= h * 3600000;
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms - m * 60000) / 1000);
    return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function tickCountdown() {
    const el = $("countdown");
    const status = state.draftStatus || state.draft?.status || "pre_draft";
    if (status === "complete") {
      el.textContent = "FINAL";
      el.title = "Draft complete";
      return;
    }
    if (status === "paused") {
      el.textContent = "PAUSED";
      el.title = "Commissioner paused the draft";
      return;
    }
    if (status === "drafting") {
      const deadline = pickDeadlineMs();
      if (deadline == null) {
        el.textContent = "LIVE";
        el.title = "Draft is live";
        return;
      }
      const left = deadline - Date.now();
      el.textContent = left <= 0 ? "00:00:00" : formatDuration(left);
      const win = autopauseWindow();
      const pausedNow = !!(win && inAutopause(Date.now(), win));
      el.title = pausedNow
        ? "until this pick expires (timer paused overnight)"
        : "until this pick expires";
      return;
    }
    const start = draftStartMs();
    if (start == null) {
      el.textContent = "—";
      el.title = "";
      return;
    }
    const ms = start - Date.now();
    if (ms <= 0) {
      el.textContent = "START WINDOW";
      el.title = "until draft starts";
      return;
    }
    el.textContent = formatDuration(ms);
    el.title = "until draft starts";
  }
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function applyPicks(picks) {
    state.picks = Array.isArray(picks) ? picks : [];
    state.draftedIds = new Set();
    state.pickByOverall = new Map();
    state.robTaken = [];
    for (const pk of state.picks) {
      const overall = Number(pk.pick_no || pk.pickNo);
      const pid = pk.player_id != null ? String(pk.player_id) : null;
      if (pid) state.draftedIds.add(pid);
      const meta = pk.metadata || {};
      const name =
        [meta.first_name, meta.last_name].filter(Boolean).join(" ") ||
        (pid && state.byId.get(pid)?.name) ||
        "Unknown";
      const rec = {
        overall,
        player_id: pid,
        name,
        position: meta.position || state.byId.get(pid)?.pos || "",
        team: meta.team || state.byId.get(pid)?.team || "",
        slot: pk.draft_slot,
        picked_by: pk.picked_by,
        roster_id: pk.roster_id,
        draft_slot: pk.draft_slot,
      };
      state.pickByOverall.set(overall, rec);
      if (isRobPick(pk)) state.robTaken.push(rec);
    }
    state.robTaken.sort((a, b) => (a.overall || 0) - (b.overall || 0));
    state.goneModel = { key: "", byId: new Map(), availById: new Map(), label: "", thenLabel: "" };
  }

  async function pollPicks(manual) {
    const btn = $("btn-refresh");
    if (manual) btn.classList.add("busy");
    const prevDrafted = new Set(state.draftedIds);
    try {
      const [pRes, dRes] = await Promise.all([
        fetch(state.draft.picks_api, { cache: "no-store" }),
        fetch(state.draft.draft_api, { cache: "no-store" }),
      ]);
      if (!pRes.ok) throw new Error("picks " + pRes.status);
      const picks = await pRes.json();
      applyPicks(picks);
      if (dRes.ok) {
        const dj = await dRes.json();
        if (dj && dj.status) state.draftStatus = dj.status;
        state.draftLive = dj
          ? {
              start_time: dj.start_time ?? null,
              last_picked: dj.last_picked ?? null,
              pick_timer: dj.settings && dj.settings.pick_timer != null ? dj.settings.pick_timer : null,
              settings: dj.settings || null,
              status: dj.status || null,
            }
          : null;
      }
      state.pollError = null;
      const now = new Date();
      state.lastPoll = now.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", second: "2-digit" }) + " CT";
      $("poll-dot").classList.add("pulse");
      setTimeout(() => $("poll-dot").classList.remove("pulse"), 1200);
    } catch (err) {
      state.pollError = (err && err.message) || "network";
    }
    renderBoard();
    renderMyPicks();
    const draftedChanged =
      prevDrafted.size !== state.draftedIds.size ||
      [...state.draftedIds].some((id) => !prevDrafted.has(id));
    if (draftedChanged) {
      state.altsCache = { key: null, list: [] };
      renderLists();
    }
    renderCard();
    renderChrome();
    tickCountdown();
    btn.classList.remove("busy");
  }

  function syncAvailUi() {
    document.querySelectorAll(".avail").forEach((b) => {
      const side = b.getAttribute("data-side");
      const on = side === "fo" ? state.filterAvailableFo : state.filterAvailableFp;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncFilterUi() {
    document.querySelectorAll("#filters .pos").forEach((b) => {
      const pos = b.getAttribute("data-pos");
      if (pos === "ALL") b.classList.toggle("on", state.filterPos.size === 0);
      else if (pos === "TARGETS") b.classList.toggle("on", state.filterTargets);
      else if (pos === "STEALS") b.classList.toggle("on", state.filterSteals);
      else if (pos === "ROOKIES") b.classList.toggle("on", state.filterRookies);
      else if (pos === "YOUNG") b.classList.toggle("on", state.filterYoung);
      else b.classList.toggle("on", state.filterPos.has(pos));
    });
  }

  function bind() {
    $("btn-refresh").addEventListener("click", () => pollPicks(true));
    document.querySelectorAll("#filters .pos").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pos = btn.getAttribute("data-pos");
        if (pos === "ALL") {
          state.filterPos.clear();
        } else if (pos === "TARGETS") {
          state.filterTargets = !state.filterTargets;
        } else if (pos === "STEALS") {
          state.filterSteals = !state.filterSteals;
        } else if (pos === "ROOKIES") {
          state.filterRookies = !state.filterRookies;
        } else if (pos === "YOUNG") {
          state.filterYoung = !state.filterYoung;
        } else if (pos) {
          if (state.filterPos.has(pos)) state.filterPos.delete(pos);
          else state.filterPos.add(pos);
        }
        syncFilterUi();
        renderLists();
      });
    });
    document.querySelectorAll(".avail").forEach((btn) => {
      btn.addEventListener("click", () => {
        const side = btn.getAttribute("data-side");
        if (side === "fo") state.filterAvailableFo = !state.filterAvailableFo;
        if (side === "fp") state.filterAvailableFp = !state.filterAvailableFp;
        syncAvailUi();
        renderLists();
      });
    });
    $("search").addEventListener("input", (ev) => {
      state.search = ev.target.value;
      renderLists();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        clearSelectionUi();
      }
      if (ev.key === "/" && ev.target.tagName !== "INPUT") {
        ev.preventDefault();
        $("search").focus();
      }
    });
    bindSplitters();
    bindListClicks();
  }

  function bindListClicks() {
    function onListClick(ev) {
      const t = ev.target instanceof Element ? ev.target : ev.target && ev.target.parentElement;
      if (!t || !t.closest) return;
      const star = t.closest("[data-star], .star");
      if (star) {
        const id = star.getAttribute("data-star");
        if (id) toggleTarget(String(id));
        return;
      }
      const row = t.closest(".rowp");
      if (row && row.dataset.key) selectPlayer(row.dataset.key, ev.currentTarget);
    }
    $("list-fo").addEventListener("click", onListClick);
    $("list-fp").addEventListener("click", onListClick);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function init() {
    loadTargets();
    loadLayout();
    const [pj, dj] = await Promise.all([
      fetch("data/players.json", { cache: "no-store" }).then((r) => r.json()),
      fetch("data/draft.json", { cache: "no-store" }).then((r) => r.json()),
    ]);
    state.players = pj.players || [];
    state.sources = pj.sources || {};
    state.match = pj.match || {};
    state.draft = dj;
    state.draftStatus = dj.status || "pre_draft";
    state.byId = new Map(state.players.filter((p) => p.id != null).map((p) => [String(p.id), p]));
    bind();
    renderBoard();
    renderMyPicks();
    renderLists();
    renderCard();
    renderChrome();
    tickCountdown();
    setInterval(tickCountdown, 1000);
    await pollPicks(false);
    setInterval(() => pollPicks(false), POLL_MS);
  }

  init().catch((err) => {
    const dot = $("poll-dot");
    if (dot) {
      dot.className = "poll-dot err";
      dot.title = "Failed to load local data: " + (err && err.message);
    }
  });
})();
