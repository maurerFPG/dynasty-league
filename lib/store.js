/**
 * Durable picks store.
 * Production: Vercel Blob (BLOB_READ_WRITE_TOKEN).
 * Local / tests: JSON file (PICKS_STORE_PATH or data/espn_picks.live.json).
 * Never use process memory as the only store.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

const BLOB_PATH = "espn-companion/picks.json";

function emptyDoc() {
  return {
    picks: [],
    updated_at: null,
    league_id: null,
    source: null,
  };
}

function filePath() {
  const raw = process.env.PICKS_STORE_PATH;
  if (raw) return isAbsolute(raw) ? raw : join(process.cwd(), raw);
  return join(process.cwd(), "data", "espn_picks.live.json");
}

async function readFileDoc() {
  try {
    const raw = await readFile(filePath(), "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return { ...emptyDoc(), picks: data };
    if (data && typeof data === "object") {
      return {
        picks: Array.isArray(data.picks) ? data.picks : [],
        updated_at: data.updated_at || null,
        league_id: data.league_id || null,
        source: data.source || null,
      };
    }
  } catch (err) {
    if (err && err.code !== "ENOENT") throw err;
  }
  return emptyDoc();
}

async function writeFileDoc(doc) {
  const path = filePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(doc, null, 2) + "\n", "utf8");
  return doc;
}

async function streamText(stream) {
  if (!stream) return "";
  if (typeof stream.text === "function") return stream.text();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks.map((c) => (typeof c === "string" ? Buffer.from(c) : c))).toString("utf8");
}

function hasBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function readBlobDoc() {
  const { get } = await import("@vercel/blob");
  try {
    const res = await get(BLOB_PATH, { access: "private", useCache: false });
    if (!res) return emptyDoc();
    const text = await streamText(res.stream || res);
    if (!text) return emptyDoc();
    const data = JSON.parse(text);
    if (Array.isArray(data)) return { ...emptyDoc(), picks: data };
    return {
      picks: Array.isArray(data.picks) ? data.picks : [],
      updated_at: data.updated_at || null,
      league_id: data.league_id || null,
      source: data.source || null,
    };
  } catch (err) {
    const msg = String(err && err.message || err);
    if (/not found|404|does not exist/i.test(msg)) return emptyDoc();
    throw err;
  }
}

async function writeBlobDoc(doc) {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(doc), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return doc;
}

export function storageMode() {
  if (hasBlob()) return "blob";
  if (process.env.VERCEL && !process.env.PICKS_ALLOW_FILE_STORE) return "unconfigured";
  return "file";
}

export async function loadDoc() {
  const mode = storageMode();
  if (mode === "unconfigured") {
    const err = new Error("Picks store is not configured. Add a Vercel Blob store (BLOB_READ_WRITE_TOKEN).");
    err.status = 503;
    throw err;
  }
  return mode === "blob" ? readBlobDoc() : readFileDoc();
}

export async function saveDoc(doc) {
  const mode = storageMode();
  if (mode === "unconfigured") {
    const err = new Error("Picks store is not configured. Add a Vercel Blob store (BLOB_READ_WRITE_TOKEN).");
    err.status = 503;
    throw err;
  }
  return mode === "blob" ? writeBlobDoc(doc) : writeFileDoc(doc);
}
