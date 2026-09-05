import { timingSafeEqual } from "node:crypto";
import { extractPicksPayload, parsePickHistoryText, toRecord, upsertPicks } from "../lib/picks.js";
import { loadPlayerIndex } from "../lib/players.js";
import { loadDoc, saveDoc, storageMode } from "../lib/store.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-picks-secret, Authorization",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function secretOk(request) {
  const expected = process.env.PICKS_SECRET || "";
  if (!expected) return false;
  const header = request.headers.get("x-picks-secret") || "";
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const got = header || bearer;
  if (!got) return false;
  const a = Buffer.from(String(got));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    const doc = await loadDoc();
    return json(200, {
      picks: doc.picks,
      updated_at: doc.updated_at,
      league_id: doc.league_id,
      source: doc.source,
      store: storageMode(),
    });
  } catch (err) {
    console.error("GET /api/picks failed", err && err.message);
    return json(err.status || 500, { error: err.message || "store error" });
  }
}

export async function DELETE(request) {
  if (!secretOk(request)) return json(401, { error: "unauthorized" });
  try {
    const doc = await saveDoc({
      picks: [],
      updated_at: new Date().toISOString(),
      league_id: null,
      source: "reset",
    });
    return json(200, { ok: true, picks: [], total: 0, updated_at: doc.updated_at });
  } catch (err) {
    console.error("DELETE /api/picks failed", err && err.message);
    return json(err.status || 500, { error: err.message || "store error" });
  }
}

export async function POST(request) {
  if (!secretOk(request)) return json(401, { error: "unauthorized" });
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "invalid json" });
  }

  try {
    const index = await loadPlayerIndex();
    const payload = extractPicksPayload(body);
    let incoming = [];
    if (payload.text) {
      incoming = parsePickHistoryText(payload.text, index);
    } else {
      for (const item of payload.items || []) {
        const rec = toRecord(item, index);
        if (rec) incoming.push(rec);
      }
    }

    const prev = payload.reset ? { picks: [] } : await loadDoc();
    const { picks, merged } = upsertPicks(prev.picks, incoming);
    const doc = await saveDoc({
      picks,
      updated_at: new Date().toISOString(),
      league_id: payload.league_id || prev.league_id || null,
      source: payload.source || prev.source || null,
    });
    return json(200, {
      ok: true,
      merged,
      total: picks.length,
      picks: doc.picks,
      updated_at: doc.updated_at,
      source: doc.source,
      store: storageMode(),
    });
  } catch (err) {
    console.error("POST /api/picks failed", err && err.message);
    return json(err.status || 500, { error: err.message || "store error" });
  }
}
