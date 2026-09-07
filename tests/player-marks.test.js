import { test } from "node:test";
import assert from "node:assert/strict";
import { heatFromBrief, rookieChipInfo } from "../lib/player-marks.js";

test("heatFromBrief maps fire/ice and clears everything else", () => {
  assert.deepEqual(heatFromBrief("fire"), { hot: true, cold: false });
  assert.deepEqual(heatFromBrief("ICE"), { hot: false, cold: true });
  assert.deepEqual(heatFromBrief("neutral"), { hot: false, cold: false });
  assert.deepEqual(heatFromBrief(undefined), { hot: false, cold: false });
  assert.deepEqual(heatFromBrief(""), { hot: false, cold: false });
});

test("rookieChipInfo stays blank for veterans", () => {
  assert.equal(rookieChipInfo({ is_rookie: false, nfl_draft_round: 1 }), null);
  assert.equal(rookieChipInfo({}), null);
});

test("rookieChipInfo uses R{n} only for a known positive round", () => {
  assert.deepEqual(rookieChipInfo({ is_rookie: true, nfl_draft_round: 2 }), {
    lab: "R2",
    title: "2026 rookie · NFL draft round 2",
  });
});

test("rookieChipInfo does not call unknown-round rookies UDFA", () => {
  assert.deepEqual(rookieChipInfo({ is_rookie: true, nfl_draft_round: null }), {
    lab: "R",
    title: "2026 rookie",
  });
  assert.deepEqual(rookieChipInfo({ is_rookie: true }), {
    lab: "R",
    title: "2026 rookie",
  });
});

test("rookieChipInfo uses UDFA only with an explicit undrafted flag", () => {
  assert.equal(rookieChipInfo({ is_rookie: true, nfl_draft_round: 0 }).lab, "UDFA");
  assert.equal(rookieChipInfo({ is_rookie: true, nfl_draft_round: "0" }).lab, "UDFA");
  assert.equal(rookieChipInfo({ is_rookie: true, is_udfa: true }).lab, "UDFA");
  assert.equal(rookieChipInfo({ is_rookie: true, undrafted: true }).lab, "UDFA");
  assert.equal(rookieChipInfo({ is_rookie: true, is_udfa: false, nfl_draft_round: null }).lab, "R");
});
