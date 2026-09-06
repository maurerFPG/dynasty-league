import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { boardCellPos, boardName, lastName } from "../lib/board-label.js";

const players = JSON.parse(await readFile(new URL("../data/players.json", import.meta.url), "utf8")).players;

test("boardName keeps F. Last for skill players and kickers", () => {
  assert.equal(boardName("Jahmyr Gibbs"), "J. Gibbs");
  assert.equal(boardName("Ja'Marr Chase"), "J. Chase");
  assert.equal(boardName("Bijan Robinson"), "B. Robinson");
  assert.equal(boardName("Amon-Ra St. Brown"), "A. St. Brown");
  assert.equal(boardName("Travis Etienne Jr."), "T. Etienne");
  assert.equal(boardName("Brandon Aubrey", "K"), "B. Aubrey");
  assert.equal(boardName("Ka'imi Fairbairn", "K"), "K. Fairbairn");
});

test("boardName shows defense nicknames instead of R. D/ST", () => {
  assert.equal(boardName("Ravens D/ST"), "Ravens");
  assert.equal(boardName("Texans D/ST"), "Texans");
  assert.equal(boardName("49ers D/ST"), "49ers");
  assert.equal(boardName("Buccaneers D/ST"), "Buccaneers");
  assert.equal(boardName("Commanders D/ST"), "Commanders");
  assert.equal(boardName("Ravens DST"), "Ravens");
  assert.equal(boardName("Lions DEF"), "Lions");
  assert.equal(boardName("Baltimore Ravens D/ST"), "Ravens");
  assert.equal(boardName("Ravens"), "Ravens");
  assert.equal(boardName("Ravens", "DEF"), "Ravens");
  assert.equal(boardName("Lions", "D/ST"), "Lions");
});

test("boardName does not treat surname-only Washington as a D/ST cell", () => {
  assert.equal(boardName("Washington"), "W. Washington");
  assert.equal(boardName("DeAndre Washington"), "D. Washington");
  assert.equal(boardName("Washington", "DEF"), "Washington");
  assert.equal(boardName("Washington D/ST"), "Washington");
});

test("lastName still returns D/ST for matching (display is boardName's job)", () => {
  assert.equal(lastName("Ravens D/ST"), "D/ST");
  assert.equal(lastName("Jahmyr Gibbs"), "Gibbs");
});

test("boardCellPos normalizes DST aliases to DEF and PK to K", () => {
  assert.equal(boardCellPos("DEF"), "DEF");
  assert.equal(boardCellPos("DST"), "DEF");
  assert.equal(boardCellPos("D/ST"), "DEF");
  assert.equal(boardCellPos("d/st"), "DEF");
  assert.equal(boardCellPos("TEAMDEF"), "DEF");
  assert.equal(boardCellPos("K"), "K");
  assert.equal(boardCellPos("PK"), "K");
  assert.equal(boardCellPos("QB"), "QB");
  assert.equal(boardCellPos(""), "");
});

test("every players.json DEF row board-labels as the team nickname", () => {
  const defs = players.filter((p) => p.pos === "DEF");
  assert.equal(defs.length, 32);
  for (const p of defs) {
    const label = boardName(p.name, p.pos);
    assert.ok(!/^[A-Z]\. /.test(label), `${p.name} became ${label}`);
    assert.ok(!/d\/st/i.test(label), `${p.name} still contains D/ST: ${label}`);
    assert.ok(p.name.startsWith(label), `${p.name} should start with ${label}`);
  }
});
