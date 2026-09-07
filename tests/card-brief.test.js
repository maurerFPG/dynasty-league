import { test } from "node:test";
import assert from "node:assert/strict";
import { isDefPos, scheduleBlockHtml } from "../lib/card-brief.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

test("isDefPos matches DEF / DST / D/ST only", () => {
  assert.equal(isDefPos("DEF"), true);
  assert.equal(isDefPos("dst"), true);
  assert.equal(isDefPos("D/ST"), true);
  assert.equal(isDefPos("RB"), false);
  assert.equal(isDefPos("K"), false);
  assert.equal(isDefPos(""), false);
  assert.equal(isDefPos(null), false);
});

test("scheduleBlockHtml is empty without a non-empty schedule array", () => {
  assert.equal(scheduleBlockHtml({ lead: "hi" }, esc), "");
  assert.equal(scheduleBlockHtml({ schedule: [] }, esc), "");
  assert.equal(scheduleBlockHtml({ schedule: ["", "  "] }, esc), "");
  assert.equal(scheduleBlockHtml(null, esc), "");
});

test("scheduleBlockHtml renders escaped bullets and optional note", () => {
  const html = scheduleBlockHtml(
    {
      schedule: ["W1 vs SF", "W2 vs NYG <home>", ""],
      schedule_note: "Offense ranks: Footballguys",
    },
    esc
  );
  assert.match(html, /<ul class="sched-list">/);
  assert.match(html, /<li>W1 vs SF<\/li>/);
  assert.match(html, /<li>W2 vs NYG &lt;home&gt;<\/li>/);
  assert.doesNotMatch(html, /<li><\/li>/);
  assert.match(html, /<p class="sched-note">Offense ranks: Footballguys<\/p>/);
});
