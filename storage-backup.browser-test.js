"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const server = http.createServer((req,res)=>{
    const pathname=new URL(req.url,"http://localhost").pathname;
    const file=path.join(__dirname,pathname==="/"?"index.html":pathname);
    try {res.setHeader("Content-Type",file.endsWith(".js")?"application/javascript":file.endsWith(".css")?"text/css":"text/html");res.end(fs.readFileSync(file));}
    catch {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||"/usr/bin/chromium",args:["--no-sandbox"]});
    const page=await browser.newPage();
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.route("https://**",route=>route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const fixture=await page.evaluate(()=>{
      const entries={
        "rika-annual-events-v1:gosho:2026":JSON.stringify([{id:"holiday",title:"休業",category:"holiday",startDate:"2026-04-01",endDate:"2026-04-06",regularClassesAvailable:false,memo:""}]),
        "rika-regular-schedule-v1:gosho:2026:inquiryPhysics":JSON.stringify([{dayOfWeek:"monday",period:1}]),
        "rika-teaching-period-v1:gosho:2026:inquiryPhysics":JSON.stringify({startDate:"2026-04-07",endDate:"2027-02-28"}),
        "rika-unit-plan-v2:gosho__inquiryPhysics__test-unit":'{ "rows": [], "allocatedHours": 0 }',
        "rika-teaching-order-v1:gosho:inquiryPhysics":'["test-unit"]',
        "rika-exam-range-v1:gosho:inquiryPhysics:2026:test-exam":'{ "hour": 2 }',
        "rika-unit-plan-user-info-v1":JSON.stringify({affiliation:"テスト学校",name:"テスト氏名"}),
        "rika-future-feature-v1":"raw\nstring <img src=x onerror=alert(1)>",
        "rika-annual-hours-v99":"legacy raw allocation"
      };
      for(const [key,value] of Object.entries(entries))localStorage.setItem(key,value);
      localStorage.setItem("unrelated","keep");localStorage.setItem("annualHours_test","untouched");
      return Object.fromEntries(Object.entries(localStorage));
    });
    // Initializing the added feature reads storage only; no migration or default writes.
    await page.addScriptTag({path:path.join(__dirname,"storage-backup-ui.js")});
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),fixture);
    // Use a fresh page to avoid duplicate handlers from the isolated startup check.
    await page.reload();
    const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
    const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#backup-save").click()]);
    assert.match(download.suggestedFilename(),/^rika-evaluation-generator-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const backup=JSON.parse(fs.readFileSync(await download.path(),"utf8"));
    const expected=Object.fromEntries(Object.entries(before).filter(([key])=>key.startsWith("rika-")));
    assert.deepEqual(backup.entries,expected);
    assert.equal(backup.app,"rika-evaluation-generator");assert.equal(backup.backupVersion,1);assert.ok(backup.exportedAt);
    assert.match(await page.locator("#backup-message").textContent(),new RegExp(`${Object.keys(expected).length}件`));
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),before);
    await page.evaluate(()=>{localStorage.setItem("rika-future-feature-v1","changed");localStorage.setItem("rika-obsolete","remove");});
    const changed=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
    const select=async value=>page.locator("#backup-file").setInputFiles({name:"backup.json",mimeType:"application/json",buffer:Buffer.from(typeof value==="string"?value:JSON.stringify(value))});
    for(const invalid of ["{bad",{...backup,app:"wrong"},{...backup,backupVersion:2},{...backup,entries:[]},{...backup,entries:{foreign:"x"}},{...backup,entries:{"rika-key":9}}]) {
      await select(invalid);await page.waitForFunction(()=>document.querySelector("#backup-message").textContent.length>0);
      assert.equal(await page.locator("#backup-confirmation").evaluate(d=>d.open),false);
      assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),changed);
    }
    await page.locator("#backup-file").setInputFiles({name:"huge.json",mimeType:"application/json",buffer:Buffer.alloc(10*1024*1024+1)});
    assert.match(await page.locator("#backup-message").textContent(),/10MB/);
    await select({...backup,origin:"https://different.example"});await page.locator("#backup-confirmation").waitFor({state:"visible"});
    assert.equal(await page.locator("#backup-entry-count").textContent(),`${Object.keys(expected).length}件`);
    await page.locator("#backup-cancel").click();assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),changed);
    await select(backup);await page.locator("#backup-confirmation").waitFor({state:"visible"});
    await page.keyboard.press("Escape");assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),changed);
    await select(backup);await page.locator("#backup-confirmation").waitFor({state:"visible"});
    await page.evaluate(()=>{const original=Storage.prototype.setItem;let fail=true;Storage.prototype.setItem=function(key,value){if(key==="rika-future-feature-v1"&&fail){fail=false;throw Error("quota");}return original.call(this,key,value);};});
    await page.locator("#backup-confirm-restore").click();assert.match(await page.locator("#backup-message").textContent(),/処理前のデータへ戻しました/);
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),changed);
    await select({...backup,origin:"https://different.example"});await page.locator("#backup-confirmation").waitFor({state:"visible"});
    await page.locator("#backup-confirm-restore").click();
    assert.match(await page.locator("#backup-message").textContent(),/画面を再読み込みします/);
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),before);
    await page.waitForEvent("load");
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),before);
    await page.setViewportSize({width:390,height:844});
    await select(backup);await page.locator("#backup-confirmation").waitFor({state:"visible"});
    assert.ok(await page.locator("#backup-confirmation").evaluate(d=>d.getBoundingClientRect().right<=innerWidth));
    await page.locator("#backup-cancel").click();
    assert.deepEqual(errors,[]);
    console.log("Backup download, raw values, startup preservation, validation, size limit, confirmation/cancel, rollback, cross-origin restore, reload and mobile passed");
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
