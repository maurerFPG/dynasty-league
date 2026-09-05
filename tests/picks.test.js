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
  resolvePlayer,
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
