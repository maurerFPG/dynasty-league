/** Card helpers: D/ST avatar routing and baked-brief schedule lists. */

export function isDefPos(pos) {
  const t = String(pos || "").toUpperCase().trim();
  return t === "DEF" || t === "DST" || t === "D/ST";
}

export function scheduleBlockHtml(b, esc) {
  if (!b || !Array.isArray(b.schedule)) return "";
  const items = b.schedule.filter((s) => s != null && String(s).trim() !== "");
  if (!items.length) return "";
  const list = `<ul class="sched-list">${items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
  const note = b.schedule_note ? `<p class="sched-note">${esc(b.schedule_note)}</p>` : "";
  return `${list}${note}`;
}
