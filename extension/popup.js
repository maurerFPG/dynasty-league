const status = document.getElementById("status");
const btn = document.getElementById("sync");

btn.addEventListener("click", async () => {
  btn.disabled = true;
  status.textContent = "Syncing…";
  try {
    const res = await chrome.runtime.sendMessage({ type: "espn-companion-sync-active" });
    if (res && res.ok) {
      status.textContent = `Posted ${res.total} pick(s) (${res.source}). Refresh the board.`;
    } else {
      status.textContent = (res && res.error) || "Sync failed.";
    }
  } catch (err) {
    status.textContent = err && err.message ? err.message : "Sync failed.";
  }
  btn.disabled = false;
});
