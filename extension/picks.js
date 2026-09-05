/**
 * Shared ESPN redraft pick helpers.
 * Browser (extension) and Node (API / tests) both import this module.
 *
 * Never treat playerId -1 as a made pick.
 * D/ST primary key is ESPN's negative id (e.g. -16034 → board id espn--16034).
 * Team nicknames (Lions, Ravens) map only to D/ST — never to skill players.
 */

export const SEASON_DEFAULT = 2026;

export const ESPN_DST_BY_TEAM = {
  ARI: "-16022",
  ATL: "-16001",
  BAL: "-16033",
  BUF: "-16002",
  CAR: "-16029",
  CHI: "-16003",
  CIN: "-16004",
  CLE: "-16005",
  DAL: "-16006",
  DEN: "-16007",
  DET: "-16008",
  GB: "-16009",
  HOU: "-16034",
  IND: "-16011",
  JAX: "-16030",
  JAC: "-16030",
  KC: "-16012",
  LV: "-16013",
  LAC: "-16024",
  LAR: "-16014",
  MIA: "-16015",
  MIN: "-16016",
  NE: "-16017",
  NO: "-16018",
  NYG: "-16019",
  NYJ: "-16020",
  PHI: "-16021",
  PIT: "-16023",
  SEA: "-16026",
  SF: "-16025",
  TB: "-16027",
  TEN: "-16010",
  WAS: "-16028",
  WSH: "-16028",
  WASH: "-16028",
};

const TEAM_ALIASES = {
  ARZ: "ARI",
  JAC: "JAX",
  WSH: "WAS",
  WASH: "WAS",
  GBP: "GB",
  KCC: "KC",
  NOR: "NO",
  NWE: "NE",
  SFO: "SF",
  TAM: "TB",
  TBB: "TB",
  LVR: "LV",
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
};

const NICK_TO_TEAM = {
  cardinals: "ARI",
  arizona: "ARI",
  falcons: "ATL",
  atlanta: "ATL",
  ravens: "BAL",
  baltimore: "BAL",
  bills: "BUF",
  buffalo: "BUF",
  panthers: "CAR",
  carolina: "CAR",
  bears: "CHI",
  chicago: "CHI",
  bengals: "CIN",
  cincinnati: "CIN",
  browns: "CLE",
  cleveland: "CLE",
  cowboys: "DAL",
  dallas: "DAL",
  broncos: "DEN",
  denver: "DEN",
  lions: "DET",
  detroit: "DET",
  packers: "GB",
  "green bay": "GB",
  texans: "HOU",
  houston: "HOU",
  colts: "IND",
  indianapolis: "IND",
  jaguars: "JAX",
  jacksonville: "JAX",
  chiefs: "KC",
  "kansas city": "KC",
  raiders: "LV",
  "las vegas": "LV",
  chargers: "LAC",
  rams: "LAR",
  dolphins: "MIA",
  miami: "MIA",
  vikings: "MIN",
  minnesota: "MIN",
  patriots: "NE",
  "new england": "NE",
  saints: "NO",
  "new orleans": "NO",
  giants: "NYG",
  jets: "NYJ",
  eagles: "PHI",
  philadelphia: "PHI",
  steelers: "PIT",
  pittsburgh: "PIT",
  seahawks: "SEA",
  seattle: "SEA",
  "49ers": "SF",
  fortyniners: "SF",
  "san francisco": "SF",
  buccaneers: "TB",
  bucs: "TB",
  "tampa bay": "TB",
  tampa: "TB",
  titans: "TEN",
  tennessee: "TEN",
  commanders: "WAS",
  washington: "WAS",
};

const SKILL_POS = new Set(["QB", "RB", "WR", "TE", "K"]);

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normPos(raw) {
  const t = String(raw || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\//g, "");
  if (!t) return "";
  if (t === "DST" || t === "DEF" || t === "D" || t === "TEAMDEF") return "DEF";
  if (t === "PK" || t === "K") return "K";
  if (SKILL_POS.has(t)) return t;
  return String(raw || "").toUpperCase();
}

export function canonTeam(raw) {
  const t = String(raw || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!t) return "";
  const code = TEAM_ALIASES[t] || t;
  return ESPN_DST_BY_TEAM[code] ? code : "";
}

export function dstBoardId(espnId) {
  return `espn-${espnId}`;
}

/**
 * ESPN D/ST playerIds are negative (-16034). Accept the positive twin too.
 * Returns null for empty / 0 / -1 (unmade slot).
 */
export function normEspnId(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (s === "-1" || s === "0") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0 || n === -1) return null;
  if (n >= 16001 && n <= 16040) return String(-n);
  if (n <= -16001 && n >= -16040) return String(n);
  if (Number.isInteger(n)) return String(n);
  return s;
}

export function isUnmadePlayerId(raw) {
  if (raw == null || raw === "") return true;
  const n = Number(raw);
  return !Number.isFinite(n) || n === 0 || n === -1;
}

export function looksLikeDstEspnId(espnId) {
  const n = Number(espnId);
  return Number.isFinite(n) && n <= -16001 && n >= -16040;
}

function stripDefSuffix(name) {
  return String(name || "")
    .replace(/\b(d\/st|dst|defense|def)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function teamFromNickname(name) {
  const raw = stripDefSuffix(name).toLowerCase().replace(/[.]/g, "").trim();
  if (!raw) return "";
  if (NICK_TO_TEAM[raw]) return NICK_TO_TEAM[raw];
  const compact = raw.replace(/\s+/g, " ");
  if (NICK_TO_TEAM[compact]) return NICK_TO_TEAM[compact];
  // "Houston Texans" / "Detroit Lions"
  const parts = compact.split(" ");
  if (parts.length >= 2) {
    const nick = parts[parts.length - 1];
    const city = parts.slice(0, -1).join(" ");
    if (NICK_TO_TEAM[nick] && (NICK_TO_TEAM[city] === NICK_TO_TEAM[nick] || !NICK_TO_TEAM[city])) {
      return NICK_TO_TEAM[nick];
    }
    if (NICK_TO_TEAM[city] && NICK_TO_TEAM[nick] === NICK_TO_TEAM[city]) return NICK_TO_TEAM[nick];
  }
  return "";
}

export function isTeamNicknameName(name) {
  return !!teamFromNickname(name);
}

function splitName(name) {
  const n = String(name || "").trim();
  if (!n) return { first: "", last: "" };
  const parts = n.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function foldKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function indexPlayers(players) {
  const byEspn = new Map();
  const byId = new Map();
  const byNamePos = new Map();
  const list = Array.isArray(players) ? players : [];
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    if (p.id != null && p.id !== "") byId.set(String(p.id), p);
    const eid = normEspnId(p.espn_id);
    if (eid) byEspn.set(eid, p);
    const key = `${foldKey(p.name)}|${normPos(p.pos)}`;
    if (p.name) byNamePos.set(key, p);
  }
  return { byEspn, byId, byNamePos, list };
}

export function resolvePlayer(index, { espnId, name, pos, team } = {}) {
  const eid = normEspnId(espnId);
  if (eid && index.byEspn.has(eid)) return index.byEspn.get(eid);

  const npos = normPos(pos);
  const treatedDef = npos === "DEF" || (!npos && isTeamNicknameName(name));
  if (treatedDef) {
    const t = canonTeam(team) || teamFromNickname(name);
    const dstId = t && ESPN_DST_BY_TEAM[t];
    if (dstId && index.byEspn.has(dstId)) return index.byEspn.get(dstId);
    if (dstId) {
      return {
        id: dstBoardId(dstId),
        espn_id: dstId,
        name: name || `${t} D/ST`,
        pos: "DEF",
        team: t,
      };
    }
  }

  // Never let a bare nickname ("Lions") match a skill player.
  if (isTeamNicknameName(name) && npos !== "DEF" && !SKILL_POS.has(npos)) {
    const t = teamFromNickname(name);
    const dstId = ESPN_DST_BY_TEAM[t];
    if (dstId && index.byEspn.has(dstId)) return index.byEspn.get(dstId);
  }

  if (name && npos) {
    const hit = index.byNamePos.get(`${foldKey(name)}|${npos}`);
    if (hit) return hit;
  }
  if (name) {
    const folded = foldKey(name);
    const matches = index.list.filter((p) => foldKey(p.name) === folded);
    if (matches.length === 1) return matches[0];
    if (npos) {
      const posHits = matches.filter((p) => normPos(p.pos) === npos);
      if (posHits.length === 1) return posHits[0];
    }
  }
  return null;
}

export function toRecord(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const pickNo = num(raw.pick_no ?? raw.pickNo ?? raw.overallPickNumber ?? raw.overall);
  if (!pickNo || pickNo <= 0) return null;

  if (isUnmadePlayerId(raw.playerId) && raw.espn_id == null && raw.espnId == null) {
    // Allow records that already stripped playerId and carry espn_id/name.
    if (!raw.name && !raw.playerName && !(raw.player && raw.player.fullName)) return null;
  }

  let espnId = normEspnId(raw.espn_id ?? raw.espnId ?? raw.playerId);
  if (espnId == null && raw.playerId != null && isUnmadePlayerId(raw.playerId)) return null;

  const player = raw.player || (raw.playerPoolEntry && raw.playerPoolEntry.player) || {};
  let name =
    (raw.name ||
      raw.playerName ||
      player.fullName ||
      [player.firstName, player.lastName].filter(Boolean).join(" ") ||
      "")
      .trim();
  let pos = normPos(raw.position || raw.pos || player.defaultPosition || player.position || "");
  let team = canonTeam(raw.team || raw.proTeam || player.proTeamAbbreviation || player.proTeam || "");

  if ((!pos || pos === "DEF") && isTeamNicknameName(name)) {
    pos = "DEF";
    team = team || teamFromNickname(name);
  }

  const matched = resolvePlayer(index, { espnId, name, pos, team });
  if (matched) {
    espnId = espnId || normEspnId(matched.espn_id);
    if (!name || normPos(matched.pos) === "DEF") name = matched.name || name;
    pos = pos || normPos(matched.pos);
    team = team || canonTeam(matched.team);
  }

  if (!espnId && !name) return null;

  const { first, last } = splitName(name);
  const slot = num(raw.draft_slot ?? raw.draftSlot ?? raw.teamId ?? raw.slot);
  const playerId = matched && matched.id != null ? String(matched.id) : raw.player_id != null ? String(raw.player_id) : null;

  return {
    pick_no: pickNo,
    player_id: playerId,
    espn_id: espnId,
    draft_slot: slot,
    picked_by: raw.picked_by != null ? raw.picked_by : slot != null ? String(slot) : null,
    roster_id: raw.roster_id != null ? raw.roster_id : raw.teamId != null ? raw.teamId : slot,
    metadata: {
      first_name: first,
      last_name: last,
      position: pos,
      team,
    },
  };
}

export function fromMDraftDetail(data, index) {
  if (!data || typeof data !== "object") {
    return { picks: [], real: 0, slots: 0, inProgress: null, stale: true };
  }
  const detail = data.draftDetail || data;
  const raw = detail.picks || [];
  const list = Array.isArray(raw) ? raw : [];
  const made = [];
  let slots = 0;
  for (const p of list) {
    slots += 1;
    if (!p || isUnmadePlayerId(p.playerId)) continue;
    const rec = toRecord(p, index);
    if (rec) made.push(rec);
  }
  const inProgress = detail.inProgress == null ? null : !!detail.inProgress;
  const stale = inProgress === true && made.length === 0 && slots > 0;
  return { picks: made, real: made.length, slots, inProgress, stale, drafted: !!detail.drafted };
}

export function mDraftUrls(leagueId, season = SEASON_DEFAULT) {
  const id = String(leagueId || "").trim();
  const yr = Number(season) || SEASON_DEFAULT;
  if (!id) return [];
  return [
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${yr}/segments/0/leagues/${id}?view=mDraftDetail`,
    `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${yr}/segments/0/leagues/${id}?view=mDraftDetail`,
  ];
}

export function leagueIdFromHref(href) {
  try {
    const u = new URL(href, "https://fantasy.espn.com");
    return u.searchParams.get("leagueId") || u.searchParams.get("league_id") || "";
  } catch {
    const m = String(href || "").match(/leagueId=(\d+)/i);
    return m ? m[1] : "";
  }
}

export function seasonFromHref(href, fallback = SEASON_DEFAULT) {
  try {
    const u = new URL(href, "https://fantasy.espn.com");
    const s = Number(u.searchParams.get("seasonId") || u.searchParams.get("season"));
    return Number.isFinite(s) && s >= 2018 ? s : fallback;
  } catch {
    return fallback;
  }
}

const POS_TOKEN = "QB|RB|WR|TE|K|D\\/ST|DST|DEF";
const PICK_LINE = new RegExp(
  `(?:^|\\b)(?:rd(?:\\.|ound)?\\s*\\d+\\s*[,:]?\\s*)?(?:pick\\s*)?(\\d{1,3})\\s*[.):\\-–]?\\s+(.+?)\\s+(${POS_TOKEN})\\b(?:\\s+([A-Za-z]{2,4}))?`,
  "i"
);
const PICK_TEAM_POS = new RegExp(
  `^(?:pick\\s*)?(\\d{1,3})\\s*[.):\\-–]?\\s+(.+?)\\s+([A-Za-z]{2,4})\\s+(${POS_TOKEN})\\b`,
  "i"
);
const PICK_PAREN_POS = new RegExp(
  `^(?:pick\\s*)?(\\d{1,3})\\s*[.):\\-–]?\\s+(.+?)\\s+\\(([A-Za-z]{2,4})\\s+(${POS_TOKEN})\\)`,
  "i"
);

function cleanParsedName(name, team) {
  let n = String(name || "")
    .replace(/,$/, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = n.split(/\s+/);
  if (parts.length >= 2 && canonTeam(parts[parts.length - 1])) {
    return { name: parts.slice(0, -1).join(" "), team: team || canonTeam(parts[parts.length - 1]) };
  }
  return { name: n, team: team || "" };
}

export function parsePickLine(line) {
  const text = String(line || "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  let m = text.match(PICK_PAREN_POS);
  if (m) {
    const pos = normPos(m[4]);
    const team = canonTeam(m[3] || "") || (pos === "DEF" ? teamFromNickname(m[2]) : "");
    const cleaned = cleanParsedName(m[2], team);
    return { pick_no: num(m[1]), name: cleaned.name, pos, team: cleaned.team };
  }

  m = text.match(PICK_TEAM_POS);
  if (m && canonTeam(m[3])) {
    const pos = normPos(m[4]);
    const team = canonTeam(m[3]) || (pos === "DEF" ? teamFromNickname(m[2]) : "");
    const cleaned = cleanParsedName(m[2], team);
    return { pick_no: num(m[1]), name: cleaned.name, pos, team: cleaned.team };
  }

  m = text.match(PICK_LINE);
  if (m) {
    const pos = normPos(m[3]);
    const cleaned = cleanParsedName(
      m[2],
      canonTeam(m[4] || "") || (pos === "DEF" ? teamFromNickname(m[2]) : "")
    );
    return { pick_no: num(m[1]), name: cleaned.name, pos, team: cleaned.team };
  }
  // "12 Texans D/ST" / "12. Lions" / name-only skill "1 Jahmyr Gibbs"
  m = text.match(/^(?:pick\s*)?(\d{1,3})\s*[.):\-–]?\s+(.+)$/i);
  if (m) {
    const rest = m[2].replace(/\s+/g, " ").trim();
    if (isTeamNicknameName(rest)) {
      return { pick_no: num(m[1]), name: rest, pos: "DEF", team: teamFromNickname(rest) };
    }
    if (rest && /[A-Za-z]/.test(rest) && !isPickHistoryHeaderText(text)) {
      return { pick_no: num(m[1]), name: rest, pos: "", team: "" };
    }
  }
  return null;
}

export function isPickHistoryHeaderText(text) {
  const t = String(text || "").replace(/\s+/g, " ").toUpperCase();
  return /\bPICK\b/.test(t) && /\bPLAYER\b/.test(t);
}

export function parsePlayerCell(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  let m = t.match(new RegExp(`^(.+?)\\s+\\(([A-Za-z]{2,4})\\s+(${POS_TOKEN})\\)$`, "i"));
  if (m) return { name: m[1].trim(), team: canonTeam(m[2] || ""), pos: normPos(m[3]) };
  m = t.match(new RegExp(`^(.+?)\\s+([A-Za-z]{2,4})\\s+(${POS_TOKEN})\\b`, "i"));
  if (m && canonTeam(m[2])) return { name: m[1].trim(), team: canonTeam(m[2]), pos: normPos(m[3]) };
  m = t.match(new RegExp(`^(.+?)\\s+(${POS_TOKEN})\\b(?:\\s+([A-Za-z]{2,4}))?`, "i"));
  if (m) return { name: m[1].trim(), pos: normPos(m[2]), team: canonTeam(m[3] || "") };
  if (isTeamNicknameName(t)) return { name: t, pos: "DEF", team: teamFromNickname(t) };
  return { name: t, pos: "", team: "" };
}

export function formatPickLine(parsed) {
  if (!parsed || parsed.pick_no == null) return "";
  const bits = [parsed.pick_no, parsed.name];
  if (parsed.pos) bits.push(parsed.pos);
  if (parsed.team) bits.push(parsed.team);
  return bits.filter((x) => x !== "" && x != null).join(" ");
}

export function pickLinesFromCellRows(rows) {
  const lines = [];
  const seen = new Set();
  for (const row of rows || []) {
    const cells = (row.cells || []).map((c) => String(c || "").replace(/\s+/g, " ").trim());
    const rowText = String(row.rowText || cells.join(" ")).replace(/\s+/g, " ").trim();
    if (!rowText || isPickHistoryHeaderText(rowText) || isPickHistoryHeaderText(cells.join(" "))) continue;

    const pickRaw = String(cells[0] || "").replace(/^#\s*/, "");
    let pick_no = num(pickRaw);
    const playerText = String(row.name || cells[1] || "").replace(/\s+/g, " ").trim();
    let parsed = null;
    if (pick_no && playerText) {
      const cell = parsePlayerCell(playerText);
      parsed = {
        pick_no,
        name: cell && cell.name ? cell.name : playerText,
        pos: cell && cell.pos ? cell.pos : "",
        team: cell && cell.team ? cell.team : "",
      };
    }
    if (!parsed) parsed = parsePickLine(rowText);
    if (!parsed || !parsed.pick_no || seen.has(parsed.pick_no)) continue;
    seen.add(parsed.pick_no);
    lines.push(formatPickLine(parsed));
  }
  return lines;
}

const HISTORY_ROW_SEL = [
  "tr",
  "[class*='Table__TR']",
  "[class*='fixedDataTableRowLayout_row']",
  "[class*='public_fixedDataTableRow_main']",
  "[role='row']",
].join(",");

const HISTORY_CELL_SEL = [
  "th",
  "td",
  "[class*='Table__TH']",
  "[class*='Table__TD']",
  "[class*='fixedDataTableCell_cellContent']",
  "[class*='public_fixedDataTableCell_cellContent']",
  "[role='columnheader']",
  "[role='cell']",
].join(",");

const HISTORY_CONTAINER_SEL = [
  "table",
  ".k-table",
  ".players-table",
  "[class*='pick-history']",
  "[class*='fixedDataTable']",
  "[class*='ResponsiveTable']",
  "[class*='public_fixedDataTable_main']",
].join(",");

const NAME_SEL = [
  ".playerinfo__playername",
  "[class*='playerinfo__playername']",
  ".player-column .player-details a",
  ".player-column a",
  ".player-details a",
].join(",");

function queryAll(root, sel) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  try {
    return Array.from(root.querySelectorAll(sel));
  } catch {
    return [];
  }
}

function classNameOf(el) {
  const c = el && el.className;
  if (typeof c === "string") return c;
  if (c && typeof c.baseVal === "string") return c.baseVal;
  return "";
}

function rowRecord(row) {
  let cellEls = queryAll(row, HISTORY_CELL_SEL);
  if (!cellEls.length && row.children) cellEls = Array.from(row.children);
  const nameEl = row.querySelector && row.querySelector(NAME_SEL);
  return {
    cells: cellEls.map((c) => (c.textContent || "").replace(/\s+/g, " ").trim()),
    name: nameEl ? (nameEl.textContent || "").replace(/\s+/g, " ").trim() : "",
    rowText: (row.textContent || "").replace(/\s+/g, " ").trim(),
  };
}

function closestTableish(el) {
  if (!el || typeof el.closest !== "function") return el;
  return (
    el.closest(
      "table, .k-table, .players-table, [class*='pick-history'], [class*='fixedDataTable'], [class*='ResponsiveTable']"
    ) || el.parentElement || el
  );
}

function containerLooksLikePickHistory(el) {
  if (!el) return false;
  if (/pick-history/i.test(classNameOf(el))) return true;
  const header = el.querySelector && el.querySelector("thead, [class*='Table__THEAD'], [class*='fixedDataTable_header']");
  if (header && isPickHistoryHeaderText(header.textContent)) return true;
  return isPickHistoryHeaderText((el.textContent || "").slice(0, 500));
}

function walkRoots(root, visit, seen) {
  if (!root || seen.has(root)) return;
  seen.add(root);
  visit(root);
  for (const el of queryAll(root, "*")) {
    if (el.shadowRoot) walkRoots(el.shadowRoot, visit, seen);
  }
  for (const frame of queryAll(root, "iframe")) {
    try {
      const doc = frame.contentDocument;
      if (doc) walkRoots(doc, visit, seen);
    } catch {
      /* cross-origin */
    }
  }
}

/**
 * Read visible ESPN Pick History (PICK / PLAYER / TEAM table or FixedDataTable).
 * Do not require .playerinfo__playername or .pick-history*.
 */
export function scrapeHistoryText(doc) {
  if (!doc) return "";
  const containers = [];
  const seenEls = new Set();

  walkRoots(doc, (root) => {
    for (const el of queryAll(root, HISTORY_CONTAINER_SEL)) {
      if (containerLooksLikePickHistory(el)) containers.push(el);
    }
    for (const row of queryAll(root, HISTORY_ROW_SEL)) {
      const rec = rowRecord(row);
      if (isPickHistoryHeaderText(rec.cells.join(" ")) || isPickHistoryHeaderText(rec.rowText)) {
        containers.push(closestTableish(row));
      }
    }
  }, new Set());

  const lines = [];
  const seenPick = new Set();
  for (const c of containers) {
    if (!c || seenEls.has(c)) continue;
    seenEls.add(c);
    for (const line of pickLinesFromCellRows(queryAll(c, HISTORY_ROW_SEL).map(rowRecord))) {
      const n = num((String(line).match(/^(\d{1,3})\b/) || [])[1]);
      if (!n || seenPick.has(n)) continue;
      seenPick.add(n);
      lines.push(line);
    }
  }
  return lines.join("\n");
}

export function parsePickHistoryText(text, index) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  const seen = new Set();
  for (const line of lines) {
    const parsed = parsePickLine(line);
    if (!parsed || !parsed.pick_no || seen.has(parsed.pick_no)) continue;
    const rec = toRecord(parsed, index);
    if (!rec) continue;
    seen.add(rec.pick_no);
    out.push(rec);
  }
  return out;
}

export function picksFromHistoryDom(root, index) {
  return parsePickHistoryText(scrapeHistoryText(root), index);
}

export function upsertPicks(existing, incoming) {
  const map = new Map();
  for (const p of existing || []) {
    if (p && p.pick_no != null) map.set(Number(p.pick_no), p);
  }
  let merged = 0;
  for (const p of incoming || []) {
    if (!p || p.pick_no == null) continue;
    map.set(Number(p.pick_no), p);
    merged += 1;
  }
  const picks = [...map.values()].sort((a, b) => Number(a.pick_no) - Number(b.pick_no));
  return { picks, merged };
}

export function extractPicksPayload(body) {
  if (Array.isArray(body)) return { items: body, reset: false, source: "unknown", league_id: null };
  if (!body || typeof body !== "object") return { items: [], reset: false, source: "unknown", league_id: null };
  if (typeof body.text === "string" && body.text.trim()) {
    return {
      items: null,
      text: body.text,
      reset: !!body.reset,
      source: body.source || "paste",
      league_id: body.league_id || body.leagueId || null,
    };
  }
  const items = Array.isArray(body.picks) ? body.picks : [];
  return {
    items,
    reset: !!body.reset,
    source: body.source || "unknown",
    league_id: body.league_id || body.leagueId || null,
  };
}
