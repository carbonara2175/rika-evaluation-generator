"use strict";

const BACKUP_APP = "rika-evaluation-generator";
const BACKUP_VERSION = 1;
const BACKUP_MAX_BYTES = 10 * 1024 * 1024;

function isAppStorageKey(key) {
  return typeof key === "string" && (key.startsWith("rika-") || key.startsWith("annualHours_"));
}

function collectAppEntries(storage) {
  const entries = Object.create(null);
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (isAppStorageKey(key)) {
      const value = storage.getItem(key);
      if (typeof value !== "string") throw new Error("保存データを読み取れませんでした。");
      entries[key] = value;
    }
  }
  return entries;
}

function createStorageBackup(storage, origin, now = new Date()) {
  return { app: BACKUP_APP, backupVersion: BACKUP_VERSION, exportedAt: now.toISOString(), origin: String(origin), entries: collectAppEntries(storage) };
}

function validateStorageBackup(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup) || backup.app !== BACKUP_APP) throw new Error("このアプリのバックアップファイルではありません。");
  if (backup.backupVersion !== BACKUP_VERSION) throw new Error("対応していないバックアップバージョンです。");
  if (!backup.entries || typeof backup.entries !== "object" || Array.isArray(backup.entries)) throw new Error("保存データの形式が不正です。");
  const entries = Object.create(null);
  for (const [key, value] of Object.entries(backup.entries)) {
    if (!isAppStorageKey(key) || typeof value !== "string") throw new Error("保存データのキーまたは値が不正です。");
    entries[key] = value;
  }
  return { app: BACKUP_APP, backupVersion: BACKUP_VERSION, exportedAt: backup.exportedAt, origin: backup.origin, entries };
}

function parseStorageBackup(text) {
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error("JSONファイルとして読み込めませんでした。"); }
  return validateStorageBackup(backup);
}

function replaceAppEntries(storage, entries) {
  Object.keys(collectAppEntries(storage)).forEach(key => storage.removeItem(key));
  Object.entries(entries).forEach(([key, value]) => storage.setItem(key, value));
}

function restoreStorageBackup(storage, backup) {
  // Snapshot and complete validation both finish before the first mutation.
  const previous = collectAppEntries(storage);
  const validated = validateStorageBackup(backup);
  try {
    replaceAppEntries(storage, validated.entries);
  } catch (cause) {
    try { replaceAppEntries(storage, previous); }
    catch (rollbackCause) {
      const error = new Error("復元と元データへの復旧に失敗しました。退避データを保存し、保存領域が利用できる状態で復元してください。");
      error.recoveryEntries = previous;
      error.cause = rollbackCause;
      throw error;
    }
    throw new Error("復元に失敗しました。処理前のデータへ戻しました。保存容量やブラウザの設定を確認してください。", { cause });
  }
  return Object.keys(validated.entries).length;
}

function backupFilename(now = new Date()) {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${BACKUP_APP}-backup-${date}.json`;
}

if (typeof module !== "undefined") module.exports = {
  BACKUP_APP, BACKUP_VERSION, BACKUP_MAX_BYTES, isAppStorageKey, collectAppEntries, createStorageBackup,
  validateStorageBackup, parseStorageBackup, restoreStorageBackup, backupFilename
};
