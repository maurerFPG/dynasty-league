import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { indexPlayers } from "./picks.js";

let cached = null;

export async function loadPlayerIndex() {
  if (cached) return cached;
  const path = process.env.PLAYERS_PATH || join(process.cwd(), "data", "players.json");
  const raw = await readFile(path, "utf8");
  const data = JSON.parse(raw);
  cached = indexPlayers(data.players || []);
  return cached;
}

export function clearPlayerIndexCache() {
  cached = null;
}
