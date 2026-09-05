/**
 * Local HTTPS-shaped companion: static board + /api/picks (file store).
 * Production happy path is Vercel. This is for smoke tests only.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { DELETE, GET, OPTIONS, POST } from "../api/picks.js";

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || "127.0.0.1";

if (!process.env.PICKS_SECRET) {
  process.env.PICKS_SECRET = "dev-secret";
  console.warn("PICKS_SECRET unset; using dev-secret for local only.");
}
process.env.PICKS_ALLOW_FILE_STORE = "1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function toRequest(req, body) {
  const url = `http://${HOST}:${PORT}${req.url}`;
  const headers = req.headers;
  if (req.method === "GET" || req.method === "OPTIONS" || req.method === "HEAD") {
    return new Request(url, { method: req.method, headers });
  }
  return new Request(url, { method: req.method, headers, body });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function sendWeb(res, webRes) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));
  const buf = Buffer.from(await webRes.arrayBuffer());
  res.end(buf);
}

async function sendStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const full = normalize(join(ROOT, rel));
  if (!full.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end("forbidden");
    return;
  }
  try {
    const st = await stat(full);
    if (st.isDirectory()) return sendStatic(res, rel.replace(/\/?$/, "/index.html"));
    const data = await readFile(full);
    res.setHeader("Content-Type", TYPES[extname(full)] || "application/octet-stream");
    res.setHeader("Cache-Control", extname(full) === ".json" ? "no-store" : "no-cache");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}

const server = createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0];
  try {
    if (path === "/api/picks" || path === "/api/picks/") {
      const body = req.method === "POST" || req.method === "DELETE" ? await readBody(req) : undefined;
      const request = toRequest(req, body);
      if (req.method === "OPTIONS") return sendWeb(res, OPTIONS());
      if (req.method === "GET") return sendWeb(res, await GET(request));
      if (req.method === "POST") return sendWeb(res, await POST(request));
      if (req.method === "DELETE") return sendWeb(res, await DELETE(request));
      res.statusCode = 405;
      res.end("method not allowed");
      return;
    }
    await sendStatic(res, path);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end("error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Companion board at http://${HOST}:${PORT}/`);
  console.log(`Picks API at http://${HOST}:${PORT}/api/picks`);
  console.log("Local only — deploy to Vercel for the HTTPS happy path.");
});
