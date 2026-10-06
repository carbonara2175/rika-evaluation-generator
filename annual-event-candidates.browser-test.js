"use strict";
// Run with PLAYWRIGHT_MODULE pointing to an installed playwright/core module.
// Optional SANNOHE_PDF, PDFJS_SCRIPT and PDFJS_WORKER exercise the actual PDF.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const cells = require("./test-fixtures/sannohe-r8-calendar-cells.json").cells;
(async () => {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const file = path.join(__dirname, pathname === "/" ? "index.html" : pathname);
    try { res.setHeader("Content-Type",file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html"); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || "/usr/bin/chromium",args:["--no-sandbox"]});
  try {
    const page = await browser.newPage();
    const errors = []; page.on("pageerror",error => errors.push(error.message));
    let accept = true; page.on("dialog",dialog => accept ? dialog.accept() : dialog.dismiss());
    await page.route("https://**",route => {
      const url = route.request().url();
      const asset = url.endsWith("/pdf.min.js") ? process.env.PDFJS_SCRIPT
        : url.endsWith("/pdf.worker.min.js") ? process.env.PDFJS_WORKER : null;
      return asset ? route.fulfill({path:asset,contentType:"application/javascript"}) : route.abort();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator("#annual-events-tab").click();
    await page.locator("#events-school").selectOption("santo");
    await page.locator("#events-year").fill("2026"); await page.locator("#events-year").dispatchEvent("change");
    const loadPdf = async () => {
      if (process.env.SANNOHE_PDF) {
        await page.locator("#annual-events-pdf").setInputFiles(process.env.SANNOHE_PDF);
        await page.waitForFunction(() => !document.querySelector("#annual-event-candidates").hidden);
      } else {
        await page.evaluate(cells => {
          const result = document.querySelector("#pdf-extraction-result"); result.hidden = true;
          document.querySelector("#pdf-calendar-result").hidden = false;
          document.querySelector("#pdf-calendar-month").hidden = false;
          document.querySelector("#pdf-calendar-body").replaceChildren(...cells.map(cell => {
            const row = document.createElement("tr");
            const date = document.createElement("th"); date.textContent=cell.date.replaceAll("-","/");
            const text = document.createElement("td"); text.textContent=cell.text; row.append(date,text); return row;
          }));
          result.hidden = false;
        },cells);
      }
      await page.locator("#candidate-body tr").last().waitFor();
    };
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("rika-annual-events-v1:santo:2026")) || []);
    const row = (title) => page.locator("#candidate-body tr").filter({has:page.locator("td:nth-child(3)",{hasText:new RegExp(`^${title}$`)})});
    await page.locator("#schedule-form button[type=submit]").click();
    const projectedBefore = await page.locator("#projection-available").textContent();
    await loadPdf();
    if (process.env.SANNOHE_PDF) {
      const restored = await page.evaluate(() => Array.from(document.querySelector("#pdf-calendar-body").rows, row => ({
        date:row.cells[0].textContent.replaceAll("/","-"), text:row.cells[1].textContent
      })));
      assert.deepEqual(restored,cells.map(({date,text}) => ({date,text})));
      console.log(`Actual PDF.js ${await page.evaluate(() => pdfjsLib.version)} restored all ${restored.length} cells exactly as the main fixture.`);
    }
    assert.match(await page.locator("#candidate-message").textContent(),/統合前 99件 → 期間候補 67件/);
    assert.equal(await row("期末考査").first().locator("input").isChecked(),true);
    assert.equal(await row("夏季休業").count(),2);
    const suspicious = row("夏季休業").filter({hasText:"2026/12/23"});
    assert.equal(await suspicious.locator("input").isChecked(),false);
    await page.locator("#candidate-month").selectOption("8");
    assert.equal(await row("夏季休業").count(),1);
    await page.locator("#deselect-candidates").click(); await page.locator("#select-visible-candidates").click();
    const checkedVisible = await page.locator("#candidate-body input:checked").count();
    await page.locator("#candidate-month").selectOption("all");
    assert.equal(await page.locator("#candidate-body input:checked").count(),checkedVisible);
    await page.locator("#deselect-candidates").click();
    await suspicious.getByRole("button",{name:"編集",exact:true}).click();
    await page.locator('#candidate-edit-form [name="title"]').fill("冬季休業（確認済み）");
    await page.locator("#candidate-edit-form button[type=submit]").click();
    assert.equal((await stored()).length,0);
    assert.ok((await page.locator("#candidate-body").textContent()).includes("夏季休業～ 1/10"));
    const edited = row("冬季休業（確認済み）"); await edited.locator("input").check();
    accept=false; await page.locator("#register-candidates").click(); assert.equal((await stored()).length,0); accept=true;
    await page.locator("#register-candidates").click(); assert.equal((await stored()).length,1);
    assert.equal(await edited.locator("input").isDisabled(),true);
    await page.locator("#deselect-candidates").click();
    const sports = page.locator("#candidate-body tr").filter({has:page.locator('td:nth-child(3)',{hasText:/^体育祭$/})}).first();
    await sports.locator("input").check(); await page.locator("#register-candidates").click();
    assert.match(await sports.textContent(),/編集画面で内容を確認/); assert.equal((await stored()).length,1);
    await sports.getByRole("button",{name:"編集",exact:true}).click();
    await page.locator('#candidate-edit-form [name="regularClassesAvailable"]').selectOption("false");
    await page.locator('#candidate-edit-form [name="endDate"]').fill("");
    await page.locator("#candidate-edit-form button[type=submit]").click();
    await page.locator("#register-candidates").click(); assert.match(await sports.textContent(),/終了日を確定/);
    await page.locator("#deselect-candidates").click(); await page.locator("#select-safe-candidates").click();
    const count = await page.locator("#candidate-body input:checked").count();
    await page.evaluate(() => {
      window.originalStorageSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key,value) {
        if (key.startsWith("rika-annual-events-v1:")) throw new DOMException("Full", "QuotaExceededError");
        return window.originalStorageSetItem.call(this,key,value);
      };
    });
    await page.locator("#register-candidates").click();
    assert.equal((await stored()).length,1);
    assert.match(await page.locator("#candidate-registration-result").textContent(),/保存できませんでした/);
    await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageSetItem; });
    await page.locator("#register-candidates").click();
    assert.equal((await stored()).length,count+1);
    assert.notEqual(await page.locator("#projection-available").textContent(),projectedBefore);
    assert.equal(await page.locator("#events-table-body tr").count(),count+1);
    assert.ok((await stored()).some(event => event.title === "期末考査" && event.endDate === "2026-06-23"));
    const beforeHoliday = (await stored()).length;
    await page.locator("#add-national-holidays").click();
    assert.ok((await stored()).length > beforeHoliday);
    assert.equal(await row("昭和の日").locator("input").isDisabled(),true);
    const beforeClear = await stored(); await page.locator("#clear-candidates").click();
    assert.deepEqual(await stored(),beforeClear); assert.equal(await page.locator("#annual-event-candidates").isVisible(),false);
    if (process.env.SANNOHE_PDF) await page.locator("#clear-annual-events-pdf").click();
    await loadPdf(); assert.equal(await row("期末考査").first().locator("input").isDisabled(),true);
    await page.locator("#events-year").fill("2027"); await page.locator("#events-year").dispatchEvent("change");
    assert.equal(await page.locator("#annual-event-candidates").isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log(`Browser regression passed: ${process.env.SANNOHE_PDF ? "uploaded PDF" : "fixture"}; 67 candidates, edits, confirmation/cancel, validation, bulk registration, holiday duplicates, list updates, clear, reimport and context isolation.`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
