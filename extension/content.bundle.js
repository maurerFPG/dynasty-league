/**
 * Generated. Do not edit by hand — node scripts/bundle-content.mjs
 * Classic IIFE so Chrome registers the isolated content script.
 */
(() => {
  if (globalThis.__espnCompanionContent) return;
  globalThis.__espnCompanionContent = true;

/**
 * Shared ESPN redraft pick helpers.
 * Browser (extension) and Node (API / tests) both import this module.
 *
 * Never treat playerId -1 as a made pick.
 * D/ST primary key is ESPN's negative id (e.g. -16034 → board id espn--16034).
 * Team nicknames (Lions, Ravens) map only to D/ST — never to skill players.
 */

const SEASON_DEFAULT = 2026;

const ESPN_DST_BY_TEAM = {
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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normPos(raw) {
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

function canonTeam(raw) {
  const t = String(raw || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!t) return "";
  const code = TEAM_ALIASES[t] || t;
  return ESPN_DST_BY_TEAM[code] ? code : "";
}

function dstBoardId(espnId) {
  return `espn-${espnId}`;
}

/**
 * ESPN D/ST playerIds are negative (-16034). Accept the positive twin too.
 * Returns null for empty / 0 / -1 (unmade slot).
 */
function normEspnId(raw) {
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

function isUnmadePlayerId(raw) {
  if (raw == null || raw === "") return true;
  const n = Number(raw);
  return !Number.isFinite(n) || n === 0 || n === -1;
}

function looksLikeDstEspnId(espnId) {
  const n = Number(espnId);
  return Number.isFinite(n) && n <= -16001 && n >= -16040;
}

function stripDefSuffix(name) {
  return String(name || "")
    .replace(/\b(d\/st|dst|defense|def)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function teamFromNickname(name) {
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

function isTeamNicknameName(name) {
  return !!teamFromNickname(name);
}

function splitName(name) {
  const n = String(name || "").trim();
  if (!n) return { first: "", last: "" };
  const parts = n.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Trailing Jr/Sr/II/III/IV (and spelled-out junior/senior). Do not strip a lone I. */
const GENERATIONAL_SUFFIX = /(?:\s+(?:junior|senior|iii|ii|iv|jr|sr|v))+$/;

/** Display-name / pick-line tokens, including Jr. with a period. Not a lone I. */
const GENERATIONAL_INLINE = /\s+(?:junior|senior|iii|ii|iv|jr\.?|sr\.?|v)(?=\s|$)/gi;

/**
 * Remove standalone Jr/Sr/II/III/IV tokens from a pick line or captured name
 * so they cannot be parsed as team/pos or left on the name.
 */
function stripGenerationalTokens(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(GENERATIONAL_INLINE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Shared name fold for indexPlayers keys and resolvePlayer lookups.
 * ESPN Pick History often appends "III" / "Jr." while players.json does not.
 */
function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(GENERATIONAL_SUFFIX, "")
    .trim();
}

function foldKey(s) {
  return normalizeName(s);
}

function indexPlayers(players) {
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

function resolvePlayer(index, { espnId, name, pos, team } = {}) {
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

function toRecord(raw, index) {
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

  let matched = resolvePlayer(index, { espnId, name, pos, team });
  if (!matched && name) {
    const normalized = normalizeName(name);
    if (normalized) {
      matched = resolvePlayer(index, { espnId, name: normalized, pos, team });
      if (!matched) matched = resolvePlayer(index, { espnId, name: normalized, pos: "", team });
    }
  }
  if (matched) {
    espnId = espnId || normEspnId(matched.espn_id);
    if (!name || normPos(matched.pos) === "DEF" || foldKey(matched.name) === foldKey(name)) {
      name = matched.name || name;
    }
    pos = pos || normPos(matched.pos);
    team = team || canonTeam(matched.team);
  }

  // Keep skill picks that have a pick number + name even if espn_id is unknown.
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

function fromMDraftDetail(data, index) {
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

function mDraftUrls(leagueId, season = SEASON_DEFAULT) {
  const id = String(leagueId || "").trim();
  const yr = Number(season) || SEASON_DEFAULT;
  if (!id) return [];
  return [
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${yr}/segments/0/leagues/${id}?view=mDraftDetail`,
    `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${yr}/segments/0/leagues/${id}?view=mDraftDetail`,
  ];
}

function leagueIdFromHref(href) {
  try {
    const u = new URL(href, "https://fantasy.espn.com");
    return u.searchParams.get("leagueId") || u.searchParams.get("league_id") || "";
  } catch {
    const m = String(href || "").match(/leagueId=(\d+)/i);
    return m ? m[1] : "";
  }
}

function seasonFromHref(href, fallback = SEASON_DEFAULT) {
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
  let n = stripGenerationalTokens(
    String(name || "")
      .replace(/,$/, "")
      .replace(/\s+/g, " ")
      .trim()
  );
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && canonTeam(parts[parts.length - 1])) {
    return {
      name: stripGenerationalTokens(parts.slice(0, -1).join(" ")),
      team: team || canonTeam(parts[parts.length - 1]),
    };
  }
  return { name: n, team: team || "" };
}

function parsePickLineText(text) {
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
    const rest = stripGenerationalTokens(m[2].replace(/\s+/g, " ").trim());
    if (isTeamNicknameName(rest)) {
      return { pick_no: num(m[1]), name: rest, pos: "DEF", team: teamFromNickname(rest) };
    }
    if (rest && /[A-Za-z]/.test(rest) && !isPickHistoryHeaderText(text)) {
      return { pick_no: num(m[1]), name: rest, pos: "", team: "" };
    }
  }
  return null;
}

function parsePickLine(line) {
  const text = String(line || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const stripped = stripGenerationalTokens(text);
  return parsePickLineText(stripped) || (stripped !== text ? parsePickLineText(text) : null);
}

function isPickHistoryHeaderText(text) {
  const t = String(text || "").replace(/\s+/g, " ").toUpperCase();
  return /\bPICK\b/.test(t) && /\bPLAYER\b/.test(t);
}

function parsePlayerCellText(t) {
  let m = t.match(new RegExp(`^(.+?)\\s+\\(([A-Za-z]{2,4})\\s+(${POS_TOKEN})\\)$`, "i"));
  if (m) return { name: stripGenerationalTokens(m[1]), team: canonTeam(m[2] || ""), pos: normPos(m[3]) };
  m = t.match(new RegExp(`^(.+?)\\s+([A-Za-z]{2,4})\\s+(${POS_TOKEN})\\b`, "i"));
  if (m && canonTeam(m[2])) {
    return { name: stripGenerationalTokens(m[1]), team: canonTeam(m[2]), pos: normPos(m[3]) };
  }
  m = t.match(new RegExp(`^(.+?)\\s+(${POS_TOKEN})\\b(?:\\s+([A-Za-z]{2,4}))?`, "i"));
  if (m) return { name: stripGenerationalTokens(m[1]), pos: normPos(m[2]), team: canonTeam(m[3] || "") };
  const stripped = stripGenerationalTokens(t);
  if (isTeamNicknameName(stripped) || isTeamNicknameName(t)) {
    const nick = isTeamNicknameName(stripped) ? stripped : t;
    return { name: nick, pos: "DEF", team: teamFromNickname(nick) };
  }
  return { name: stripped || t, pos: "", team: "" };
}

function parsePlayerCell(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const stripped = stripGenerationalTokens(t);
  return parsePlayerCellText(stripped) || (stripped !== t ? parsePlayerCellText(t) : null);
}

function formatPickLine(parsed) {
  if (!parsed || parsed.pick_no == null) return "";
  const bits = [parsed.pick_no, parsed.name];
  if (parsed.pos) bits.push(parsed.pos);
  if (parsed.team) bits.push(parsed.team);
  return bits.filter((x) => x !== "" && x != null).join(" ");
}

function pickLinesFromCellRows(rows) {
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
function scrapeHistoryText(doc) {
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

function parsePickHistoryText(text, index) {
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

function picksFromHistoryDom(root, index) {
  return parsePickHistoryText(scrapeHistoryText(root), index);
}

function upsertPicks(existing, incoming) {
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

/**
 * Stable pick-set id: count + sorted pick_no:espn_id.
 * Used so live auto-sync can skip POSTing an unchanged set every second.
 */
function picksFingerprint(picks) {
  const list = Array.isArray(picks) ? picks : [];
  const keys = [];
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    const n = Number(p.pick_no ?? p.pickNo);
    const id = p.espn_id != null && p.espn_id !== "" ? String(p.espn_id) : "";
    keys.push(`${Number.isFinite(n) ? n : 0}:${id}`);
  }
  keys.sort();
  return `${keys.length}|${keys.join(",")}`;
}

function shouldSkipIdenticalPost(lastFingerprint, picks) {
  const fp = picksFingerprint(picks);
  return Boolean(lastFingerprint) && fp === lastFingerprint;
}

function extractPicksPayload(body) {
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


/**
 * Isolated-world content script SOURCE. Chrome loads content.bundle.js
 * (classic IIFE). Rebuild with: node scripts/bundle-content.mjs
 *
 * Asks the page world for mDraftDetail (cookies stay on ESPN),
 * scrapes Pick History if that payload is empty/stale, then
 * hands normalized-ready payloads to the service worker.
 */
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

  const LIVE_MS = 1000;
  let liveTimer = null;
  let liveBusy = false;
  let lastCollectAt = 0;
  let historyObserver = null;
  let observerTimer = null;

  async function liveEnabled() {
    try {
      const data = await chrome.storage.sync.get({ liveSync: true });
      return data.liveSync !== false;
    } catch {
      return true;
    }
  }

  async function tickLive() {
    if (!onDraftPage() || liveBusy) return;
    if (Date.now() - lastCollectAt < 800) return;
    if (!(await liveEnabled())) return;
    liveBusy = true;
    lastCollectAt = Date.now();
    try {
      const payload = await collect();
      await chrome.runtime.sendMessage({ type: "espn-companion-autosync", payload });
    } catch {
      /* service worker may be restarting */
    }
    liveBusy = false;
  }

  function onHistoryMutation() {
    if (observerTimer) return;
    observerTimer = setTimeout(() => {
      observerTimer = null;
      tickLive();
    }, 400);
  }

  function startLive() {
    if (!onDraftPage()) return;
    if (!liveTimer) {
      liveTimer = setInterval(tickLive, LIVE_MS);
      tickLive();
    }
    if (!historyObserver && document.documentElement) {
      historyObserver = new MutationObserver(onHistoryMutation);
      historyObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  function stopLive() {
    if (liveTimer) {
      clearInterval(liveTimer);
      liveTimer = null;
    }
    if (historyObserver) {
      historyObserver.disconnect();
      historyObserver = null;
    }
    if (observerTimer) {
      clearTimeout(observerTimer);
      observerTimer = null;
    }
  }

  function syncLiveLoop() {
    if (onDraftPage()) startLive();
    else stopLive();
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

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.liveSync) return;
    if (changes.liveSync.newValue === false) stopLive();
    else syncLiveLoop();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureButton();
      syncLiveLoop();
    });
  } else {
    ensureButton();
    syncLiveLoop();
  }
}

})();
