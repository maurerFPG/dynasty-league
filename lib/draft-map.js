/**
 * Snake draft geometry. Team count comes from draft.teams (not a hard-coded 12).
 */

export function teamCount(draft) {
  const n = Number(draft && draft.teams);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const slots = draft && Array.isArray(draft.slots) ? draft.slots.length : 0;
  if (slots > 0) return slots;
  return 10;
}

export function roundCount(draft) {
  const n = Number(draft && draft.rounds);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 16;
}

export function robSlot(draft) {
  const n = Number(draft && draft.rob_slot);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function roundOfOverall(overall, teams) {
  const t = Number(teams);
  const o = Number(overall);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(o) || o <= 0) return 1;
  return Math.ceil(o / t);
}

export function snakeSlot(round, pickInRound, teams) {
  const reverse = Number(round) % 2 === 0;
  return reverse ? Number(teams) - Number(pickInRound) + 1 : Number(pickInRound);
}

export function pickLabel(round, pickInRound) {
  return `${round}.${String(pickInRound).padStart(2, "0")}`;
}

export function buildSnakePickMap(draft) {
  const teams = teamCount(draft);
  const rounds = roundCount(draft);
  const rob = robSlot(draft);
  const map = [];
  let overall = 1;
  for (let rnd = 1; rnd <= rounds; rnd++) {
    for (let pir = 1; pir <= teams; pir++) {
      const slot = snakeSlot(rnd, pir, teams);
      map.push({
        overall,
        round: rnd,
        pick_in_round: pir,
        slot,
        label: pickLabel(rnd, pir),
        is_rob: rob != null && slot === rob,
      });
      overall += 1;
    }
  }
  return map;
}

export function ensureDraftShape(draft) {
  const d = draft && typeof draft === "object" ? draft : {};
  const teams = teamCount(d);
  const rounds = roundCount(d);
  const expected = teams * rounds;
  const map = Array.isArray(d.pick_map) ? d.pick_map : [];
  const ok =
    map.length === expected &&
    map.every((c, i) => Number(c.overall) === i + 1 && Number(c.slot) >= 1 && Number(c.slot) <= teams);
  return {
    ...d,
    teams,
    rounds,
    pick_map: ok ? map : buildSnakePickMap({ ...d, teams, rounds }),
  };
}
