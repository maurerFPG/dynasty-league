import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildSnakePickMap,
  ensureDraftShape,
  roundOfOverall,
  snakeSlot,
  teamCount,
} from "../lib/draft-map.js";

test("snake map is teams × rounds and snakes even rounds", () => {
  const map = buildSnakePickMap({ teams: 10, rounds: 16, rob_slot: 1 });
  assert.equal(map.length, 160);
  assert.equal(map[0].slot, 1);
  assert.equal(map[0].is_rob, true);
  assert.equal(map[9].slot, 10);
  assert.equal(map[9].label, "1.10");
  assert.equal(map[10].slot, 10);
  assert.equal(map[10].round, 2);
  assert.equal(map[19].slot, 1);
  assert.equal(map[19].is_rob, true);
  assert.equal(map[19].label, "2.10");
  assert.equal(snakeSlot(1, 3, 10), 3);
  assert.equal(snakeSlot(2, 3, 10), 8);
});

test("round math uses team count, not 12", () => {
  assert.equal(roundOfOverall(10, 10), 1);
  assert.equal(roundOfOverall(11, 10), 2);
  assert.equal(roundOfOverall(12, 10), 2);
  assert.equal(roundOfOverall(12, 12), 1);
  assert.equal(roundOfOverall(13, 12), 2);
});

test("draft.json is a 10-team placeholder snake", async () => {
  const draft = JSON.parse(await readFile(new URL("../data/draft.json", import.meta.url), "utf8"));
  assert.equal(draft.teams, 10);
  assert.equal(draft.rounds, 16);
  assert.equal(draft.league_id, "PENDING");
  assert.equal(draft.status, "pre-draft");
  assert.equal(draft.slots.length, 10);
  assert.equal(draft.slots.filter((s) => s.is_rob).length, 1);
  assert.equal(draft.slots[0].display, "Maurer Hour");
  assert.ok(!draft.slots.some((s) => /Pitts|Matty Ice|Brees-y/i.test(s.display)));
  const shaped = ensureDraftShape(draft);
  assert.equal(shaped.pick_map.length, 160);
  assert.equal(teamCount(draft), 10);
  assert.ok(!/1030576/.test(JSON.stringify({ league_id: draft.league_id, league_url: draft.league_url })));
});

test("board source has no hard-coded 12-team math", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.equal((app.match(/\/\s*12\b/g) || []).length, 0);
  assert.equal((app.match(/\|\|\s*12\b/g) || []).length, 0);
  assert.equal((css.match(/repeat\(\s*12\b/g) || []).length, 0);
  assert.match(css, /--board-cols:\s*10/);
});
