const status = document.getElementById("status");
const btn = document.getElementById("sync");
const live = document.getElementById("live");

function fmtTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function refreshHint(liveOn) {
  return liveOn ? "" : " Refresh the board.";
}

async function paintIdle() {
  const liveOn = live.checked;
  let st = null;
  try {
    st = await chrome.runtime.sendMessage({ type: "espn-companion-status" });
  } catch {
    st = null;
  }
  if (st && st.lastAutoSyncAt) {
    const when = fmtTime(st.lastAutoSyncAt);
    const n = st.lastAutoSyncTotal || 0;
    status.textContent = liveOn
      ? `Live · last auto-sync ${when} · ${n} pick(s)`
      : `Live off · last auto-sync ${when} · ${n} pick(s). Manual Sync only.`;
    return;
  }
  status.textContent = liveOn
    ? "Live · will auto-sync on an ESPN draft tab."
    : "Live off · uses the active ESPN draft tab. Cookies stay in the browser.";
}

chrome.storage.sync.get({ liveSync: true }, (data) => {
  live.checked = data.liveSync !== false;
  paintIdle();
});

live.addEventListener("change", () => {
  chrome.storage.sync.set({ liveSync: live.checked }, () => {
    paintIdle();
  });
});

btn.addEventListener("click", async () => {
  btn.disabled = true;
  status.textContent = "Syncing…";
  try {
    const res = await chrome.runtime.sendMessage({ type: "espn-companion-sync-active" });
    if (res && res.ok) {
      if (res.skipped) {
        status.textContent = `${res.total || 0} pick(s) already synced.`;
      } else {
        status.textContent = `Posted ${res.total} pick(s) (${res.source}).${refreshHint(live.checked)}`;
      }
    } else {
      status.textContent = (res && res.error) || "Sync failed.";
    }
  } catch (err) {
    status.textContent = err && err.message ? err.message : "Sync failed.";
  }
  btn.disabled = false;
});
