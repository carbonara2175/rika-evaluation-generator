"use strict";

(() => {
  const section = document.querySelector("#data-management");
  const message = document.querySelector("#backup-message");
  const count = document.querySelector("#backup-count");
  const fileInput = document.querySelector("#backup-file");
  const dialog = document.querySelector("#backup-confirmation");
  const restoreButton = document.querySelector("#backup-confirm-restore");
  const recoveryButton = document.querySelector("#backup-recovery-save");
  let pending = null;
  let recovery = null;
  let reading = false;

  function refreshCount() {
    try { count.textContent = `現在このブラウザに保存されているアプリデータ：${Object.keys(collectAppEntries(localStorage)).length}件`; }
    catch { count.textContent = "保存データの件数を取得できませんでした。"; }
  }

  function download(backup) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFilename();
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.querySelector("#backup-save").addEventListener("click", () => {
    try {
      const backup = createStorageBackup(localStorage, location.origin);
      download(backup);
      message.textContent = `${Object.keys(backup.entries).length}件のデータをバックアップしました。`;
      refreshCount();
    } catch { message.textContent = "バックアップを保存できませんでした。ブラウザの設定を確認してください。"; }
  });

  document.querySelector("#backup-load").addEventListener("click", () => {
    if (!reading) fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file || reading) return;
    pending = null;
    message.textContent = "";
    if (file.size > BACKUP_MAX_BYTES) { message.textContent = "ファイルが大きすぎます。10MB以下のバックアップを選択してください。"; return; }
    reading = true;
    try {
      const backup = parseStorageBackup(await file.text());
      pending = backup;
      const time = typeof backup.exportedAt === "string" ? new Date(backup.exportedAt) : new Date(NaN);
      document.querySelector("#backup-exported-at").textContent = Number.isFinite(time.getTime())
        ? time.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "日時情報なし";
      document.querySelector("#backup-entry-count").textContent = `${Object.keys(backup.entries).length}件`;
      restoreButton.disabled = false;
      dialog.showModal();
    } catch (error) { pending = null; message.textContent = error.message || "ファイルを読み込めませんでした。"; }
    finally { reading = false; }
  });

  document.querySelector("#backup-cancel").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { pending = null; });
  dialog.addEventListener("cancel", () => { pending = null; });
  restoreButton.addEventListener("click", () => {
    if (!pending) return;
    restoreButton.disabled = true;
    try {
      const restored = restoreStorageBackup(localStorage, pending);
      dialog.close();
      message.textContent = `${restored}件のデータを復元しました。画面を再読み込みします。`;
      document.querySelector("#backup-save").disabled = true;
      document.querySelector("#backup-load").disabled = true;
      refreshCount();
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      dialog.close();
      message.textContent = error.message;
      if (error.recoveryEntries) {
        recovery = { app: BACKUP_APP, backupVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), origin: location.origin, entries: error.recoveryEntries };
        recoveryButton.hidden = false;
      }
      refreshCount();
    }
  });
  recoveryButton.addEventListener("click", () => {
    if (recovery) download(recovery);
  });
  section.addEventListener("pointerenter", refreshCount);
  section.addEventListener("focusin", refreshCount);
  window.addEventListener("storage", refreshCount);
  refreshCount();
})();
