#!/usr/bin/env python3
"""Local ESPN redraft dashboard server. Serves this folder on 127.0.0.1:8765.

POST /picks merges ESPN picks into data/espn_picks.json, mapping espn_id
to Sleeper player_id via players.json. No secrets are logged.
"""
from __future__ import annotations

import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
PLAYERS_PATH = ROOT / "data" / "players.json"
PICKS_PATH = ROOT / "data" / "espn_picks.json"
HOST = "127.0.0.1"
PORT = 8765


def split_name(name: str) -> tuple[str, str]:
    name = (name or "").strip()
    if not name:
        return "", ""
    parts = name.split()
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def norm_pos(raw) -> str:
    t = str(raw or "").upper().replace(" ", "").replace("/", "")
    if t in ("DST", "DEF", "D/ST", "DST", "D"):
        return "DEF"
    if t in ("PK", "K"):
        return "K"
    return str(raw or "").upper()


def load_espn_map() -> dict:
    try:
        blob = json.loads(PLAYERS_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return {}
    out = {}
    for p in blob.get("players") or []:
        eid = p.get("espn_id")
        if eid is None or eid == "":
            continue
        out[str(eid)] = p
    return out


def load_picks() -> list:
    try:
        data = json.loads(PICKS_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def write_picks(picks: list) -> None:
    picks = sorted(picks, key=lambda p: int(p.get("pick_no") or 0))
    tmp = PICKS_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(picks, indent=2) + "\n")
    os.replace(tmp, PICKS_PATH)


def to_record(raw: dict, by_espn: dict) -> dict | None:
    if not isinstance(raw, dict):
        return None
    pick_no = raw.get("pick_no") or raw.get("pickNo") or raw.get("overallPickNumber") or raw.get("overall")
    try:
        pick_no = int(pick_no)
    except (TypeError, ValueError):
        return None
    if pick_no <= 0:
        return None

    espn_id = raw.get("espn_id") or raw.get("espnId") or raw.get("playerId")
    espn_id = None if espn_id in (None, "") else str(espn_id)

    matched = by_espn.get(espn_id) if espn_id else None
    sleeper_id = None
    if matched and matched.get("id") not in (None, ""):
        sleeper_id = str(matched["id"])
    elif raw.get("player_id") not in (None, ""):
        sleeper_id = str(raw.get("player_id"))

    name = (raw.get("name") or "").strip()
    if not name and matched:
        name = matched.get("name") or ""
    if not name:
        first = (raw.get("first_name") or raw.get("firstName") or "").strip()
        last = (raw.get("last_name") or raw.get("lastName") or "").strip()
        name = (first + " " + last).strip()
    first, last = split_name(name)

    pos = norm_pos(raw.get("position") or raw.get("pos") or (matched or {}).get("pos") or "")
    team = raw.get("team") or (matched or {}).get("team") or ""
    slot = raw.get("draft_slot") or raw.get("draftSlot") or raw.get("teamId") or raw.get("slot")
    try:
        slot = int(slot) if slot not in (None, "") else None
    except (TypeError, ValueError):
        slot = None

    rec = {
        "pick_no": pick_no,
        "player_id": sleeper_id,
        "espn_id": espn_id,
        "draft_slot": slot,
        "picked_by": raw.get("picked_by") or (str(slot) if slot is not None else None),
        "roster_id": raw.get("roster_id") or raw.get("teamId") or slot,
        "metadata": {
            "first_name": first,
            "last_name": last,
            "position": pos,
            "team": team,
        },
    }
    return rec


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        # Access log only — never dump bodies or headers.
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _route(self) -> str:
        return urlparse(self.path).path.rstrip("/") or "/"

    def _cors(self, json_body: bool = False):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if json_body or self._route().endswith(".json") or self._route() == "/picks":
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.send_header("Pragma", "no-cache")

    def end_headers(self):
        self._cors()
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self._route() == "/picks":
            body = json.dumps(load_picks()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self._cors(json_body=True)
            SimpleHTTPRequestHandler.end_headers(self)
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self._route() != "/picks":
            self.send_error(404, "not found")
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(max(0, min(length, 2_000_000)))
        try:
            payload = json.loads(raw.decode("utf-8") or "null")
        except json.JSONDecodeError:
            self.send_error(400, "invalid json")
            return

        items = []
        if isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            if isinstance(payload.get("picks"), list):
                items = payload["picks"]
            else:
                items = [payload]
        else:
            self.send_error(400, "expected pick object or {picks:[...]}")
            return

        by_espn = load_espn_map()
        existing = {int(p["pick_no"]): p for p in load_picks() if p.get("pick_no") is not None}
        added = 0
        for item in items:
            rec = to_record(item, by_espn)
            if not rec:
                continue
            existing[rec["pick_no"]] = rec
            added += 1
        merged = list(existing.values())
        write_picks(merged)

        body = json.dumps({"ok": True, "merged": added, "total": len(merged)}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors(json_body=True)
        SimpleHTTPRequestHandler.end_headers(self)
        self.wfile.write(body)
        name0 = ""
        if items and isinstance(items[-1], dict):
            name0 = items[-1].get("name") or items[-1].get("playerId") or ""
        self.log_message("POST /picks merged=%s total=%s last=%s", added, len(merged), name0)


def main():
    os.chdir(ROOT)
    PICKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not PICKS_PATH.exists():
        PICKS_PATH.write_text("[]\n")
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Serving {ROOT} at http://{HOST}:{PORT}/")
    print("Open that URL during the draft. Tampermonkey posts to /picks.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
        httpd.server_close()


if __name__ == "__main__":
    main()
