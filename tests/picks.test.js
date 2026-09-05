import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  fromMDraftDetail,
  indexPlayers,
  isTeamNicknameName,
  normEspnId,
  parsePickHistoryText,
  parsePickLine,
  pickLinesFromCellRows,
  resolvePlayer,
  scrapeHistoryText,
  toRecord,
  upsertPicks,
} from "../lib/picks.js";

const players = JSON.parse(await readFile(new URL("../data/players.json", import.meta.url), "utf8")).players;
const index = indexPlayers(players);

test("players.json has one D/ST row per team keyed by espn--160xx", () => {
  const defs = players.filter((p) => p.pos === "DEF");
  assert.equal(defs.length, 32);
  assert.ok(defs.every((p) => String(p.id).startsWith("espn--16")));
  assert.ok(defs.every((p) => String(p.espn_id).startsWith("-16")));
  assert.equal(defs.filter((p) => p.id === "HOU" || p.team === "HOU").length, 1);
  const hou = defs.find((p) => p.team === "HOU");
  assert.equal(hou.id, "espn--16034");
  assert.equal(hou.espn_id, "-16034");
});

test("unmade playerId -1 is ignored", () => {
  const md = fromMDraftDetail(
    {
      draftDetail: {
        inProgress: true,
        drafted: false,
        picks: [
          { overallPickNumber: 1, playerId: -1, teamId: 1 },
          { overallPickNumber: 2, playerId: 4429795, teamId: 2 },
        ],
      },
    },
    index
  );
  assert.equal(md.real, 1);
  assert.equal(md.stale, false);
  assert.equal(md.picks[0].espn_id, "4429795");
  assert.equal(md.picks[0].player_id, "9221");
  assert.equal(toRecord({ pick_no: 1, playerId: -1 }, index), null);
});

test("stale live mDraftDetail (all -1) is flagged", () => {
  const md = fromMDraftDetail(
    {
      draftDetail: {
        inProgress: true,
        picks: [
          { overallPickNumber: 1, playerId: -1, teamId: 1 },
          { overallPickNumber: 2, playerId: -1, teamId: 2 },
        ],
      },
    },
    index
  );
  assert.equal(md.real, 0);
  assert.equal(md.stale, true);
});

test("D/ST espn playerId maps to the single board id", () => {
  const rec = toRecord({ pick_no: 48, playerId: -16034, teamId: 7 }, index);
  assert.ok(rec);
  assert.equal(rec.espn_id, "-16034");
  assert.equal(rec.player_id, "espn--16034");
  assert.equal(rec.metadata.position, "DEF");
  assert.equal(normEspnId(16034), "-16034");
});

test("team nicknames are defenses, never skill players", () => {
  assert.equal(isTeamNicknameName("Lions"), true);
  assert.equal(isTeamNicknameName("Ravens"), true);
  assert.equal(isTeamNicknameName("Jahmyr Gibbs"), false);
  const lions = parsePickLine("12 Lions");
  assert.equal(lions.pos, "DEF");
  assert.equal(lions.team, "DET");
  const rec = toRecord(lions, index);
  assert.equal(rec.player_id, "espn--16008");
  assert.equal(rec.espn_id, "-16008");
  const skill = resolvePlayer(index, { name: "Lions" });
  assert.equal(skill.pos, "DEF");
});

test("name-only skill history lines become picks; D/ST still maps", () => {
  assert.equal(parsePickLine("1 Jahmyr Gibbs").name, "Jahmyr Gibbs");
  assert.equal(parsePickLine("1 Jahmyr Gibbs").pos, "");
  assert.equal(parsePickLine("5 Jaxon Smith-Njigba").name, "Jaxon Smith-Njigba");
  const named = parsePickHistoryText(["1 Jahmyr Gibbs", "5 Jaxon Smith-Njigba", "73 Commanders DEF WAS"].join("\n"), index);
  assert.equal(named.length, 3);
  assert.equal(named[0].espn_id, "4429795");
  assert.equal(named[0].metadata.position, "RB");
  assert.equal(named[1].espn_id, "4430878");
  assert.equal(named[1].metadata.position, "WR");
  assert.equal(named.find((p) => p.pick_no === 73).espn_id, "-16028");
  const cellLines = pickLinesFromCellRows([
    { cells: ["1", "Jahmyr Gibbs", "Sully's Smart Team"], name: "Jahmyr Gibbs", rowText: "1 Jahmyr Gibbs Sully's Smart Team" },
    { cells: ["5", "Jaxon Smith-Njigba", "David's Daring Team"], name: "Jaxon Smith-Njigba" },
    { cells: ["73", "Commanders DEF WAS", "Tucker's Team"], name: "Commanders" },
  ]);
  assert.ok(cellLines.includes("1 Jahmyr Gibbs"));
  assert.ok(cellLines.includes("5 Jaxon Smith-Njigba"));
  const fromCells = parsePickHistoryText(cellLines.join("\n"), index);
  assert.equal(fromCells.find((p) => p.pick_no === 1).espn_id, "4429795");
  assert.equal(fromCells.find((p) => p.pick_no === 5).espn_id, "4430878");
  assert.equal(fromCells.find((p) => p.pick_no === 73).espn_id, "-16028");
});

test("draft-room Pick History rows use PICK/PLAYER/TEAM (team before pos)", () => {
  const rows = [
    "PICK PLAYER TEAM 2025 PTS PROJ PTS RK",
    "1 Jahmyr Gibbs DET RB Sully's Smart Team 312.4 289.2 1",
    "2 Bijan Robinson ATL RB ethan's Excellent Team 298.1 285.0 2",
    "3 Josh Allen BUF QB Liz's Loud Team 410.2 388.0 4",
    "4 Puka Nacua LAR WR Sam's Super Team 250.1 240.0 6",
    "5 Jaxon Smith-Njigba SEA WR David's Daring Team 198.4 188.0 12",
    "48 Texans D/ST HOU DEF Tucker's Talented Team 140.0 130.0 180",
  ];
  const gibbs = parsePickLine(rows[1]);
  assert.equal(gibbs.pick_no, 1);
  assert.equal(gibbs.name, "Jahmyr Gibbs");
  assert.equal(gibbs.pos, "RB");
  assert.equal(gibbs.team, "DET");
  const chaseOld = parsePickLine("1 Ja'Marr Chase WR Cin");
  assert.equal(chaseOld.name, "Ja'Marr Chase");
  assert.equal(chaseOld.pos, "WR");
  assert.equal(chaseOld.team, "CIN");
  const picks = parsePickHistoryText(rows.join("\n"), index);
  assert.equal(picks.length, 6);
  assert.equal(picks[0].espn_id, "4429795");
  assert.equal(picks[1].player_id, "9509");
  assert.equal(picks[2].metadata.position, "QB");
  const dst = picks.find((p) => p.pick_no === 48);
  assert.equal(dst.espn_id, "-16034");
});

test("scrapeHistoryText reads a PICK/PLAYER/TEAM table without playerinfo or pick-history classes", () => {
  const header = ["PICK", "PLAYER", "TEAM", "2025 PTS", "PROJ PTS", "RK"];
  const data = [
    ["1", "Jahmyr Gibbs DET RB", "Sully's Smart Team", "312.4", "289.2", "1"],
    ["2", "Bijan Robinson ATL RB", "ethan's Excellent Team", "298.1", "285.0", "2"],
    ["5", "Jaxon Smith-Njigba SEA WR", "David's Daring Team", "198.4", "188.0", "12"],
  ];
  const lines = pickLinesFromCellRows([
    { cells: header },
    ...data.map((cells) => ({ cells })),
  ]);
  assert.deepEqual(lines, [
    "1 Jahmyr Gibbs RB DET",
    "2 Bijan Robinson RB ATL",
    "5 Jaxon Smith-Njigba WR SEA",
  ]);
  const doc = fakePickTable(header, data);
  const scraped = scrapeHistoryText(doc);
  const picks = parsePickHistoryText(scraped, index);
  assert.equal(picks.length, 3);
  assert.equal(picks[0].espn_id, "4429795");
  assert.equal(picks[0].metadata.first_name, "Jahmyr");
  assert.equal(picks[2].pick_no, 5);
  assert.match(scraped, /Jahmyr Gibbs/);
  assert.doesNotMatch(scraped, /PICK PLAYER/);

  const fdt = fakeFixedDataTable(header, data);
  const fdtPicks = parsePickHistoryText(scrapeHistoryText(fdt), index);
  assert.equal(fdtPicks.length, 3);
  assert.equal(fdtPicks[1].espn_id, "4430807");
});

function fakePickTable(header, dataRows) {
  function match(el, rawSel) {
    const sel = rawSel.trim();
    if (sel === "*") return true;
    if (/^[a-z]+$/i.test(sel)) return el.tagName === sel.toUpperCase();
    const cls = sel.match(/^\[class\*='([^']+)'\]$/) || sel.match(/^\[class\*="([^"]+)"\]$/);
    if (cls) return String(el.className || "").includes(cls[1]);
    if (sel.startsWith(".")) return String(el.className || "").split(/\s+/).includes(sel.slice(1));
    if (sel.startsWith("[role=")) return false;
    return false;
  }
  function matches(el, selector) {
    return String(selector)
      .split(",")
      .some((part) => match(el, part));
  }
  function descendants(el, out = []) {
    for (const c of el.children || []) {
      out.push(c);
      descendants(c, out);
    }
    return out;
  }
  function decorate(el) {
    el.querySelectorAll = (sel) => descendants(el).filter((n) => matches(n, sel));
    el.querySelector = (sel) => el.querySelectorAll(sel)[0] || null;
    el.closest = () => el;
    return el;
  }
  function cell(tag, className, text) {
    return decorate({
      tagName: tag,
      className,
      textContent: text,
      children: [],
      shadowRoot: null,
    });
  }
  function row(tag, className, texts, cellTag, cellClass) {
    const children = texts.map((t) => cell(cellTag, cellClass, t));
    return decorate({
      tagName: tag,
      className,
      textContent: texts.join(" "),
      children,
      shadowRoot: null,
    });
  }
  const thead = decorate({
    tagName: "THEAD",
    className: "Table__THEAD",
    textContent: header.join(" "),
    children: [row("TR", "Table__TR", header, "TH", "Table__TH")],
    shadowRoot: null,
  });
  const bodyRows = dataRows.map((cells) => row("TR", "Table__TR", cells, "TD", "Table__TD"));
  const tbody = decorate({
    tagName: "TBODY",
    className: "Table__TBODY",
    textContent: bodyRows.map((r) => r.textContent).join(" "),
    children: bodyRows,
    shadowRoot: null,
  });
  const table = decorate({
    tagName: "TABLE",
    className: "Table",
    textContent: `${header.join(" ")} ${tbody.textContent}`,
    children: [thead, tbody],
    shadowRoot: null,
  });
  return decorate({
    tagName: "BODY",
    className: "",
    textContent: table.textContent,
    children: [table],
    shadowRoot: null,
    contentDocument: null,
  });
}

function fakeFixedDataTable(header, dataRows) {
  function match(el, rawSel) {
    const sel = rawSel.trim();
    if (sel === "*") return true;
    if (/^[a-z]+$/i.test(sel)) return el.tagName === sel.toUpperCase();
    const cls = sel.match(/^\[class\*='([^']+)'\]$/) || sel.match(/^\[class\*="([^"]+)"\]$/);
    if (cls) return String(el.className || "").includes(cls[1]);
    if (sel.startsWith(".")) return String(el.className || "").split(/\s+/).includes(sel.slice(1));
    return false;
  }
  function matches(el, selector) {
    return String(selector)
      .split(",")
      .some((part) => match(el, part));
  }
  function descendants(el, out = []) {
    for (const c of el.children || []) {
      out.push(c);
      descendants(c, out);
    }
    return out;
  }
  function decorate(el) {
    el.querySelectorAll = (sel) => descendants(el).filter((n) => matches(n, sel));
    el.querySelector = (sel) => el.querySelectorAll(sel)[0] || null;
    el.closest = (sel) => {
      let n = el;
      while (n) {
        if (!sel || matches(n, sel)) return n;
        n = n.parentElement;
      }
      return null;
    };
    return el;
  }
  function cell(text) {
    return decorate({
      tagName: "DIV",
      className: "public_fixedDataTableCell_cellContent",
      textContent: text,
      children: [],
      shadowRoot: null,
    });
  }
  function row(texts, extraClass = "") {
    const children = texts.map(cell);
    return decorate({
      tagName: "DIV",
      className: `public_fixedDataTableRow_main ${extraClass}`.trim(),
      textContent: texts.join(" "),
      children,
      shadowRoot: null,
    });
  }
  const headerRow = row(header, "public_fixedDataTable_header");
  const bodyRows = dataRows.map((cells) => row(cells));
  const table = decorate({
    tagName: "DIV",
    className: "k-table public_fixedDataTable_main",
    textContent: `${header.join(" ")} ${bodyRows.map((r) => r.textContent).join(" ")}`,
    children: [headerRow, ...bodyRows],
    shadowRoot: null,
  });
  headerRow.parentElement = table;
  for (const r of bodyRows) r.parentElement = table;
  return decorate({
    tagName: "BODY",
    className: "",
    textContent: table.textContent,
    children: [table],
    shadowRoot: null,
  });
}

test("paste parser reads ESPN Pick History text including D/ST", () => {
  const text = [
    "1 Ja'Marr Chase WR Cin",
    "2 Bijan Robinson RB Atl",
    "48 Texans D/ST",
    "49. Lions D/ST DEF DET",
  ].join("\n");
  const picks = parsePickHistoryText(text, index);
  assert.equal(picks.length, 4);
  const dst = picks.find((p) => p.pick_no === 48);
  assert.equal(dst.espn_id, "-16034");
  assert.equal(dst.player_id, "espn--16034");
  assert.equal(dst.metadata.first_name, "Texans");
  assert.equal(dst.metadata.last_name, "D/ST");
  const lions = picks.find((p) => p.pick_no === 49);
  assert.equal(lions.espn_id, "-16008");
});

test("extension copies lib/picks.js", async () => {
  const a = await readFile(fileURLToPath(new URL("../lib/picks.js", import.meta.url)), "utf8");
  const b = await readFile(fileURLToPath(new URL("../extension/picks.js", import.meta.url)), "utf8");
  assert.equal(a, b);
});

test("upsert is by overall pick number", () => {
  const first = [toRecord({ pick_no: 1, playerId: 4429795 }, index)];
  const next = [toRecord({ pick_no: 1, playerId: 4430807 }, index), toRecord({ pick_no: 2, playerId: -16034 }, index)];
  const { picks, merged } = upsertPicks(first, next);
  assert.equal(merged, 2);
  assert.equal(picks.length, 2);
  assert.equal(picks[0].espn_id, "4430807");
  assert.equal(picks[1].player_id, "espn--16034");
});
