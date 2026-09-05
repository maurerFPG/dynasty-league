# ESPN redraft companion

HTTPS draft board for Rob Maurer’s ESPN redraft. The companion **observes** picks. The actual **Draft** click stays on ESPN.

This is not a localhost Tampermonkey setup. Happy path: Vercel board + Chrome extension (or the Paste box).

## What shipped

1. **Chrome MV3 extension** on `https://fantasy.espn.com/*`
   - On demand (page **Sync picks** button, or the extension popup)
   - Fetches `mDraftDetail` **from the ESPN page** with the browser session (`credentials: include`)
   - Ignores unmade slots (`playerId: -1`)
   - If the room is live but `mDraftDetail` is all `-1` / empty, reads **Pick History** (full names). Nicknames like Lions / Ravens are D/ST only.
   - Posts normalized picks (`espn_id` primary) to `POST /api/picks` with `x-picks-secret`
   - Never sends `espn_s2` / SWID / ESPN passwords to our server

2. **HTTPS picks API** (this repo, Vercel)
   - `GET /api/picks` — board reads this (CORS open)
   - `POST /api/picks` — upsert by overall pick number (shared secret)
   - `DELETE /api/picks` — clear the store (secret; useful between mocks)
   - Durable store: **Vercel Blob** in production (not memory)

3. **Web board** (existing dual-column redraft UI)
   - **Refresh** GETs `/api/picks` and greys taken players by `espn_id` / board id
   - **Paste** is the reliability floor: paste Pick History text → POST

4. **Single D/ST id scheme**: `espn--16034` / `espn_id: "-16034"`. The old team-code twins (`HOU` vs `Texans D/ST`) are gone.

## Mock smoke test (do this before Monday night)

ESPN mock rooms are real temporary leagues. Confirmed live URLs (Sep 2026):

| Step | URL |
| --- | --- |
| Lobby | https://fantasy.espn.com/football/mockdraftlobby |
| Join | https://fantasy.espn.com/football/waitingroom?leagueId={id} |
| Room | https://fantasy.espn.com/football/draft?leagueId={id}&seasonId=2026 |

`/football/mockdraft?leagueId=` is a **404** — do not use it.

Public `GET https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/{id}?view=mDraftDetail` works for many mock rooms **without** cookies, but live rooms often return every slot as `playerId: -1` until the browser session fetch (or Pick History) sees made picks. The private redraft (league `1030576`) returns **401** without ESPN auth — that is why the extension fetches from the page, not from our server.

### Steps

1. Deploy this repo to Vercel. In Project Settings → Environment Variables:
   - `PICKS_SECRET` — long random string (do not commit it)
   - Add a **Vercel Blob** store so `BLOB_READ_WRITE_TOKEN` is injected
2. Open the Vercel URL (HTTPS board). Confirm **Refresh** works (0 picks is fine).
3. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `extension/`
   After pulling a new build, click the **reload / refresh icon on the extension card**. The old content script stays loaded until you do. Runtime is `content.bundle.js` (classic IIFE, v1.0.3) — do not load `content.js` as a module.
4. Extension **Options**: board origin (`https://your-app.vercel.app`) and the same `PICKS_SECRET`
5. Sign into ESPN in Chrome. Open the [mock lobby](https://fantasy.espn.com/football/mockdraftlobby), join a **12-team snake** room, wait for the draft page.
6. Make a few picks **in ESPN** (including a D/ST). Do not use this tool to draft.
7. Click **Sync picks** on the ESPN page (or the extension popup).
8. On the board, click **Refresh** within a few seconds. Taken players grey out, including that D/ST.
9. If the extension reports stale mDraftDetail, open ESPN **Pick History**, copy the rows, board **Paste** → Apply.

### Paste-only drill (no extension)

1. Board → **Paste**
2. Enter `PICKS_SECRET`
3. Paste:

   ```
   1 Ja'Marr Chase WR Cin
   2 Bijan Robinson RB Atl
   48 Texans D/ST
   49 Lions D/ST
   ```

4. Apply paste, then confirm Texans / Lions D/ST are gone from both columns.

## Env secrets (never commit)

| Variable | Where | Purpose |
| --- | --- | --- |
| `PICKS_SECRET` | Vercel env + extension options + board Paste field | Authorizes POST/DELETE |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store | Durable picks JSON |
| `PICKS_STORE_PATH` | local / tests only | File fallback |
| `PICKS_ALLOW_FILE_STORE=1` | local / tests only | Allow file store |

Copy `.env.example`. Do not put secrets in git, the extension repo files, or README examples you share publicly.

## Local (optional)

```bash
npm install
npm test
PICKS_SECRET=dev-secret npm run dev
```

Opens `http://127.0.0.1:8765/` for UI/API tests. **Do not use localhost as the Monday-night tool.**

## League

- ESPN league `1030576`, season **2026**
- Maurer Hour = slot 7
- Extension reads `leagueId` / `seasonId` from the current ESPN URL (mocks included). Falls back to `1030576` / `2026` on pages without those params.
