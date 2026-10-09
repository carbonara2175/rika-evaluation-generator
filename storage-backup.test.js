"use strict";
const assert = require("node:assert/strict");
const { collectAppEntries, createStorageBackup, parseStorageBackup, validateStorageBackup, restoreStorageBackup, backupFilename } = require("./storage-backup");
class Storage {
  constructor(entries) { this.data = new Map(Object.entries(entries)); this.failure = null; }
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key,value) { this.check("set",key); this.data.set(key,value); }
  removeItem(key) { this.check("remove",key); this.data.delete(key); }
  check(action,key) { if(this.failure?.action===action && this.failure.key===key) { this.failure=null; throw Error("Injected storage failure"); } }
}
const raw = '{ "legacy": 1, "text": "日本語" }\n';
const storage = new Storage({"rika-plan":raw,"rika-future-feature":"not JSON","unrelated":"keep","annualHours_test":raw});
const initial = [...storage.data];
const backup = createStorageBackup(storage,"https://old.example",new Date("2026-10-09T00:00:00.000Z"));
assert.deepEqual([...storage.data],initial);
assert.equal(backup.app,"rika-evaluation-generator");
assert.equal(backup.backupVersion,1);
assert.equal(backup.exportedAt,"2026-10-09T00:00:00.000Z");
assert.equal(backup.origin,"https://old.example");
assert.equal(Object.keys(backup.entries).length,3);
assert.equal(backup.entries["rika-plan"],raw);
assert.equal(backup.entries.unrelated,undefined);
assert.equal(backup.entries.annualHours_test,raw);
assert.equal(backupFilename(new Date(2026,9,9)),"rika-evaluation-generator-backup-2026-10-09.json");
const parsed = parseStorageBackup(JSON.stringify(backup));
storage.setItem("annualHours_test","changed");storage.setItem("annualHours_obsolete","remove me too");storage.setItem("rika-obsolete","remove me");storage.setItem("rika-plan","changed");
assert.equal(restoreStorageBackup(storage,parsed),3);
assert.equal(storage.getItem("rika-plan"),raw);
assert.equal(storage.getItem("rika-future-feature"),"not JSON");
assert.equal(storage.getItem("rika-obsolete"),null);
assert.equal(storage.getItem("unrelated"),"keep");
assert.equal(storage.getItem("annualHours_test"),raw);
assert.equal(storage.getItem("annualHours_obsolete"),null);
const unchanged = [...storage.data];
for (const invalid of [null,[],{...backup,app:"other"},{...backup,backupVersion:2},{...backup,entries:null},{...backup,entries:[]},{...backup,entries:{foreign:"x"}},{...backup,entries:{"annualHours_x":42}},{...backup,entries:{"annualHoursX":"x"}},{...backup,entries:{"rika-x":42}},{...backup,entries:{"rika-x":null}},JSON.parse('{"app":"rika-evaluation-generator","backupVersion":1,"entries":{"__proto__":"x"}}')]) {
  assert.throws(()=>validateStorageBackup(invalid));
  assert.throws(()=>restoreStorageBackup(storage,invalid));
  assert.deepEqual([...storage.data],unchanged);
}
assert.throws(()=>parseStorageBackup("not json"));
const incoming = {...backup,entries:{"rika-new":"one","rika-failure":"two"}};
for(const failure of [{action:"set",key:"rika-failure"},{action:"remove",key:"rika-future-feature"},{action:"remove",key:"annualHours_test"}]) {
  storage.failure=failure;
  assert.throws(()=>restoreStorageBackup(storage,incoming),/処理前のデータへ戻しました/);
  assert.deepEqual(Object.fromEntries(storage.data),Object.fromEntries(unchanged));
}
// Even if storage remains unavailable, the original data stays accessible for recovery.
const broken = new Storage({"rika-original":raw,"foreign":"stay"});
broken.setItem=()=>{throw Error("storage unavailable");};
assert.throws(()=>restoreStorageBackup(broken,incoming),error=>error.recoveryEntries["rika-original"]===raw);
assert.equal(broken.getItem("foreign"),"stay");
const empty = {...backup,entries:{}};
assert.equal(restoreStorageBackup(storage,empty),0);
assert.equal(Object.keys(collectAppEntries(storage)).length,0);
assert.equal(storage.getItem("unrelated"),"keep");
console.log("Backup format, raw strings, filtering, validation, replace, rollback and recovery tests passed");
