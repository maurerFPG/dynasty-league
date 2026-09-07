/** Brief heat + rookie chip labels used on list rows and player cards. */

export function heatFromBrief(heat) {
  const h = String(heat || "").toLowerCase().trim();
  if (h === "fire") return { hot: true, cold: false };
  if (h === "ice") return { hot: false, cold: true };
  return { hot: false, cold: false };
}

export function rookieChipInfo(p) {
  if (!p || !p.is_rookie) return null;
  const raw = p.nfl_draft_round;
  const explicitUdfa =
    p.is_udfa === true || p.undrafted === true || raw === 0 || raw === "0";
  const rnd = Number(raw);
  if (Number.isFinite(rnd) && rnd > 0) {
    return { lab: "R" + rnd, title: `2026 rookie · NFL draft round ${rnd}` };
  }
  if (explicitUdfa) {
    return { lab: "UDFA", title: "2026 rookie · undrafted free agent" };
  }
  return { lab: "R", title: "2026 rookie" };
}
