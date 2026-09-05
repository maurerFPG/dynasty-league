const boardUrl = document.getElementById("boardUrl");
const apiUrl = document.getElementById("apiUrl");
const secret = document.getElementById("secret");
const status = document.getElementById("status");

chrome.storage.sync.get({ boardUrl: "", apiUrl: "", secret: "" }, (data) => {
  boardUrl.value = data.boardUrl || "";
  apiUrl.value = data.apiUrl || "";
  secret.value = data.secret || "";
});

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      boardUrl: boardUrl.value.trim(),
      apiUrl: apiUrl.value.trim(),
      secret: secret.value,
    },
    () => {
      status.textContent = "Saved.";
    }
  );
});
