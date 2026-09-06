/**
 * Draft-board cell labels and position classes.
 * Keep D/ST names readable (Ravens, not R. D/ST) and map DST aliases to DEF.
 */

const DEF_SUFFIX = /^(d\/st|dst|def|defense)$/i;

/** Franchise nicknames only — not city names (Washington, Dallas) that collide with surnames. */
const DEF_NICKNAMES = new Set([
  "cardinals",
  "falcons",
  "ravens",
  "bills",
  "panthers",
  "bears",
  "bengals",
  "browns",
  "cowboys",
  "broncos",
  "lions",
  "packers",
  "texans",
  "colts",
  "jaguars",
  "chiefs",
  "raiders",
  "chargers",
  "rams",
  "dolphins",
  "vikings",
  "patriots",
  "saints",
  "giants",
  "jets",
  "eagles",
  "steelers",
  "seahawks",
  "49ers",
  "fortyniners",
  "buccaneers",
  "bucs",
  "titans",
  "commanders",
]);

export function lastName(full) {
  if (!full) return "";
  const suf = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
  const parts = String(full).replace(/,/g, "").trim().split(/\s+/);
  while (parts.length > 1 && suf.has(parts[parts.length - 1].toLowerCase().replace(/\./g, ""))) {
    parts.pop();
  }
  if (parts.length >= 2 && /^st\.?$/i.test(parts[parts.length - 2])) {
    return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
  }
  return parts[parts.length - 1] || String(full);
}

export function boardCellPos(raw) {
  const t = String(raw || "").toUpperCase().trim();
  if (!t) return "";
  const compact = t.replace(/[\s/]/g, "");
  if (compact === "DST" || compact === "DEF" || compact === "D" || compact === "TEAMDEF") return "DEF";
  if (t === "K" || t === "PK") return "K";
  if (t === "QB" || t === "RB" || t === "WR" || t === "TE") return t;
  return t;
}

function stripDefTokens(full) {
  const parts = String(full || "").replace(/,/g, "").trim().split(/\s+/).filter(Boolean);
  while (parts.length && DEF_SUFFIX.test(parts[parts.length - 1])) parts.pop();
  return parts;
}

function isDefenseName(full) {
  const raw = String(full || "").trim();
  if (!raw) return false;
  const parts = stripDefTokens(raw);
  if (DEF_SUFFIX.test(String(full).replace(/,/g, "").trim().split(/\s+/).pop() || "")) return true;
  if (parts.length === 1 && DEF_NICKNAMES.has(parts[0].toLowerCase())) return true;
  return false;
}

function defenseBoardName(full) {
  const parts = stripDefTokens(full);
  if (!parts.length) return "D/ST";
  return parts[parts.length - 1];
}

export function boardName(full, pos) {
  const trimmed = String(full || "").trim();
  if (!trimmed) return "";
  if (boardCellPos(pos) === "DEF" || isDefenseName(trimmed)) {
    return defenseBoardName(trimmed);
  }
  const last = lastName(trimmed);
  const first = trimmed.replace(/,/g, "").split(/\s+/)[0] || "";
  const init = first.replace(/[^A-Za-z]/g, "").charAt(0);
  if (!init) return last;
  return `${init.toUpperCase()}. ${last}`;
}
