/**
 * Build extension/content.bundle.js — a classic IIFE for MV3 isolated
 * content_scripts. ES module content scripts often never register, which
 * yields: Could not establish connection. Receiving end does not exist.
 *
 *   node scripts/bundle-content.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

export function buildContentBundle(picksSrc, contentSrc) {
  const picksBody = String(picksSrc).replace(/^export /gm, "");
  const contentBody = String(contentSrc).replace(
    /^import\s+\{[\s\S]*?\}\s+from\s+["']\.\/picks\.js["'];\s*/m,
    ""
  );
  return `/**
 * Generated. Do not edit by hand — node scripts/bundle-content.mjs
 * Classic IIFE so Chrome registers the isolated content script.
 */
(() => {
  if (globalThis.__espnCompanionContent) return;
  globalThis.__espnCompanionContent = true;

${picksBody}

${contentBody}
})();
`;
}

const isMain = import.meta.url === new URL(process.argv[1], `file://${process.cwd()}/`).href
  || process.argv[1]?.endsWith("bundle-content.mjs");

if (isMain) {
  const picksUrl = new URL("../lib/picks.js", import.meta.url);
  const contentUrl = new URL("../extension/content.js", import.meta.url);
  const outUrl = new URL("../extension/content.bundle.js", import.meta.url);
  const bundle = buildContentBundle(await readFile(picksUrl, "utf8"), await readFile(contentUrl, "utf8"));
  await writeFile(outUrl, bundle);
  console.log(`wrote extension/content.bundle.js (${bundle.length} bytes)`);
}
