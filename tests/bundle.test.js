import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildContentBundle } from "../scripts/bundle-content.mjs";

test("content.bundle.js is a classic IIFE with no ESM imports", async () => {
  const picks = await readFile(new URL("../lib/picks.js", import.meta.url), "utf8");
  const content = await readFile(new URL("../extension/content.js", import.meta.url), "utf8");
  const expected = buildContentBundle(picks, content);
  const actual = await readFile(new URL("../extension/content.bundle.js", import.meta.url), "utf8");
  assert.equal(actual, expected);
  assert.match(actual, /^\s*\/\*\*/);
  assert.match(actual, /\(\(\) => \{/);
  assert.match(actual, /__espnCompanionContent/);
  assert.match(actual, /espn-companion-collect/);
  assert.match(actual, /espn-companion-autosync/);
  assert.match(actual, /function scrapeHistoryText/);
  assert.equal((actual.match(/^import /gm) || []).length, 0);
  assert.equal((actual.match(/^export /gm) || []).length, 0);
});

test("manifest loads the classic bundle, not a module content.js", async () => {
  const manifest = JSON.parse(
    await readFile(fileURLToPath(new URL("../extension/manifest.json", import.meta.url)), "utf8")
  );
  assert.equal(manifest.version, "1.0.5");
  const isolated = manifest.content_scripts.find((s) => s.world === "ISOLATED" && s.js.includes("content.bundle.js"));
  assert.deepEqual(isolated.js, ["content.bundle.js"]);
  assert.notEqual(isolated.type, "module");
  assert.equal(isolated.all_frames, true);
  assert.ok(manifest.permissions.includes("scripting"));
  assert.ok(manifest.permissions.includes("webNavigation"));
  assert.ok(manifest.permissions.includes("alarms"));
  const board = manifest.content_scripts.find((s) => s.js.includes("board.js"));
  assert.ok(board);
  assert.notEqual(board.type, "module");
  assert.ok(board.matches.some((m) => /vercel\.app/.test(m)));
  const bg = await readFile(new URL("../extension/background.js", import.meta.url), "utf8");
  assert.match(bg, /executeScript/);
  assert.match(bg, /content\.bundle\.js/);
  assert.match(bg, /page-bridge\.js/);
  assert.match(bg, /getAllFrames/);
  assert.match(bg, /frameScore/);
  assert.match(bg, /espn-companion-autosync/);
  assert.match(bg, /shouldSkipIdenticalPost/);
  assert.match(bg, /picks-updated/);
});

test("board.js is a classic listener, not an ES module", async () => {
  const board = await readFile(new URL("../extension/board.js", import.meta.url), "utf8");
  assert.match(board, /\(\(\) => \{/);
  assert.match(board, /__espnCompanionBoard/);
  assert.match(board, /picks-updated/);
  assert.match(board, /espn-companion-picks-updated/);
  assert.equal((board.match(/^import /gm) || []).length, 0);
  assert.equal((board.match(/^export /gm) || []).length, 0);
});
