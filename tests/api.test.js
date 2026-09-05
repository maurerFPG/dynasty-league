import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = await mkdtemp(join(tmpdir(), "espn-picks-"));
process.env.PICKS_SECRET = "test-secret";
process.env.PICKS_STORE_PATH = join(dir, "picks.json");
process.env.PICKS_ALLOW_FILE_STORE = "1";
delete process.env.VERCEL;
delete process.env.BLOB_READ_WRITE_TOKEN;

const { GET, POST, DELETE, OPTIONS } = await import("../api/picks.js");

function req(method, body, secret = "test-secret") {
  const headers = { "content-type": "application/json" };
  if (secret) headers["x-picks-secret"] = secret;
  return new Request("http://localhost/api/picks", {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

test("OPTIONS is CORS-open", async () => {
  const res = OPTIONS();
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});

test("GET starts empty and POST upserts with secret", async () => {
  const empty = await GET().then((r) => r.json());
  assert.deepEqual(empty.picks, []);

  const denied = await POST(req("POST", { picks: [{ pick_no: 1, playerId: 4429795 }] }, "wrong"));
  assert.equal(denied.status, 401);

  const ok = await POST(req("POST", { picks: [{ overallPickNumber: 1, playerId: 4429795 }, { overallPickNumber: 2, playerId: -1 }] }));
  assert.equal(ok.status, 200);
  const posted = await ok.json();
  assert.equal(posted.total, 1);
  assert.equal(posted.picks[0].espn_id, "4429795");
  assert.equal(posted.picks[0].player_id, "9221");

  const got = await GET().then((r) => r.json());
  assert.equal(got.picks.length, 1);
});

test("paste text maps D/ST onto espn--16034", async () => {
  const res = await POST(
    req("POST", {
      text: "1 Jahmyr Gibbs RB Det\n48 Texans D/ST\n",
      source: "paste",
    })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  const dst = body.picks.find((p) => p.pick_no === 48);
  assert.ok(dst);
  assert.equal(dst.espn_id, "-16034");
  assert.equal(dst.player_id, "espn--16034");
});

test("DELETE clears store with secret", async () => {
  const res = await DELETE(req("DELETE"));
  assert.equal(res.status, 200);
  const got = await GET().then((r) => r.json());
  assert.equal(got.picks.length, 0);
  await rm(dir, { recursive: true, force: true });
});
