import { writeFile } from "node:fs/promises";
import { buildSnakePickMap } from "../lib/draft-map.js";

const teams = 10;
const rounds = 16;
const rob_slot = 1;

const slots = [
  { slot: 1, display: "Maurer Hour", short: "MAURER", is_rob: true },
];
for (let s = 2; s <= teams; s++) {
  slots.push({ slot: s, display: `Slot ${s}`, short: `Slot ${s}`, is_rob: false });
}

const draft = {
  league_id: "PENDING",
  league_name: "ESPN redraft (10-team) — leagueId pending",
  league_url: "",
  platform: "espn",
  rob_slot,
  rob_team: "Maurer Hour",
  rob_owner: "Rob Maurer",
  teams,
  rounds,
  type: "snake",
  reversal_round: null,
  start_time_ct: null,
  start_label: "Monday night — time and order TBD",
  status: "pre-draft",
  pick_timer_seconds: 60,
  scoring: "half-PPR, 4-pt pass TD, no TEP, 1QB (no superflex)",
  roster: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    DST: 1,
    K: 1,
    BE: 7,
    IR: 1,
  },
  divisions: 1,
  order_note:
    "10-team snake, 16 rounds. Draft order is not set. rob_slot=1 is a placeholder so the board has a Maurer Hour column — replace with Monday’s real slot. Do not invent leagueId; Rob will supply Monday’s ESPN leagueId. Today’s 10-team mock (1835701124) is for smoke tests only and is not production.",
  picks_api: "/api/picks",
  draft_api: "data/espn_draft_status.json",
  slots,
  pick_map: buildSnakePickMap({ teams, rounds, rob_slot }),
};

await writeFile(new URL("../data/draft.json", import.meta.url), JSON.stringify(draft, null, 2) + "\n");
console.log(`wrote draft.json teams=${teams} rounds=${rounds} picks=${draft.pick_map.length}`);
