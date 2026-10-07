"use strict";
// Run with PLAYWRIGHT_MODULE pointing to an installed playwright/core module.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = path.join(__dirname, pathname === "/" ? "index.html" : pathname);
    try {
      res.setHeader("Content-Type", file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://**", route => {
      const url = route.request().url();
      const root = process.env.WORD_VALIDATION_MODULES;
      if (root && url.includes("pizzip@")) return route.fulfill({path:path.join(root,"pizzip/dist/pizzip.min.js"),contentType:"application/javascript"});
      if (root && url.includes("docxtemplater@")) return route.fulfill({path:path.join(root,"docxtemplater/build/docxtemplater.js"),contentType:"application/javascript"});
      return route.abort();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator("#unit-plan-tab").click();
    const seed = async () => page.evaluate(() => {
      allocatedHoursInput.value = 12;
      const plan = normalizedPlan({ allocatedHours: 12 });
      plan.rows.forEach((row, i) => Object.assign(row, {
        activity: `学習${i + 1}`, method: `評価方法${i + 1}`,
        evaluation: { knowledge: "formative", thinking: "summative", attitude: "formative" }
      }));
      renderLessonRows(plan); savePlan();
      return plan;
    });
    const perform = async (hour, action, accept = true) => {
      await page.getByRole("button", { name: `${hour}時間目の操作`, exact: true }).click();
      if (action === "delete") page.once("dialog", async dialog => {
        assert.match(dialog.message(), /入力済みの学習活動・評価設定も削除/);
        await (accept ? dialog.accept() : dialog.dismiss());
      });
      await page.locator(`.lesson-actions-dialog [data-lesson-action="${action}"]`).click();
    };
    for (const [hour, action] of [[7,"before"], [7,"after"], [1,"before"], [12,"after"], [7,"delete"], [12,"delete"]]) {
      const original = await seed();
      // Change fields without input events: storage must not be the source.
      await page.evaluate(() => {
        const row = lessonRows.querySelectorAll("tr")[7];
        row.querySelector('[data-field="activity"]').value = "入力途中";
        row.querySelector('[data-field="method"]').value = "未保存方法";
        row.querySelector('[data-evaluation="attitude"]').dataset.value = "summative";
      });
      original.rows[7].activity = "入力途中";
      original.rows[7].method = "未保存方法";
      original.rows[7].evaluation.attitude = "summative";
      const expected = original.rows;
      if (action === "delete") expected.splice(hour - 1, 1);
      else expected.splice(action === "before" ? hour - 1 : hour, 0, {hour:0, activity:"", method:"", evaluation:{knowledge:"",thinking:"",attitude:""}});
      expected.forEach((row,i) => row.hour = i + 1);
      await perform(hour, action);
      const result = await page.evaluate(() => ({ live: currentPlan(), saved: loadPlan(), word: wordTemplateData(), text: unitPlanText() }));
      assert.deepEqual(result.live.rows, expected);
      assert.deepEqual(result.saved.rows, expected);
      assert.equal(result.live.allocatedHours, expected.length);
      assert.equal(result.word.allocatedHours, expected.length);
      assert.deepEqual(result.word.lessons.map(row => row.hour), expected.map(row => row.hour));
      assert.deepEqual(result.word.lessons.map(row => row.activity), expected.map(row => row.activity || "－"));
      assert.deepEqual(result.word.lessons.map(row => row.method), expected.map(row => row.method || "－"));
      assert.ok(result.text.includes(`配当時数：${expected.length}時間`));
      assert.ok(result.text.includes("入力途中"));
      if (process.env.WORD_VALIDATION_MODULES) {
        const downloadPromise = page.waitForEvent("download");
        await page.locator("#export-unit-plan-word").click();
        const download = await downloadPromise;
        const PizZip = require(path.join(process.env.WORD_VALIDATION_MODULES,"pizzip"));
        const xml = new PizZip(fs.readFileSync(await download.path())).file("word/document.xml").asText();
        assert.ok(xml.includes("入力途中"));
        assert.ok(xml.includes("未保存方法"));
        for (const row of expected) assert.ok(xml.includes(row.activity));
        assert.ok(!xml.includes("{allocatedHours}"));
      }
      await page.evaluate(() => { window.copiedPlan = ""; copyText = async text => { window.copiedPlan = text; }; });
      await page.locator("#copy-unit-plan").click();
      assert.equal(await page.evaluate(() => window.copiedPlan),result.text);
      await page.reload(); await page.locator("#unit-plan-tab").click();
      assert.deepEqual(await page.evaluate(() => currentPlan().rows), expected);
    }
    await seed();
    const beforeCancel = await page.evaluate(() => currentPlan());
    await perform(7,"delete",false);
    assert.deepEqual(await page.evaluate(() => currentPlan()), beforeCancel);
    await page.locator("#allocated-hours").fill("1");
    await page.locator("#allocated-hours").press("Tab");
    await page.getByRole("button", {name:"1時間目の操作",exact:true}).click();
    assert.equal(await page.locator('[data-lesson-action="delete"]').isDisabled(),true);
    await page.keyboard.press("Escape");
    await page.evaluate(() => editLessonRow(1,"delete"));
    assert.equal(await page.evaluate(() => currentPlan().rows.length),1);
    // Existing evaluation cycles still work.
    await page.locator('[data-evaluation="knowledge"]').click();
    assert.equal(await page.locator('[data-evaluation="knowledge"]').getAttribute("data-value"), "summative");
    for (const action of ["before","after","delete"]) {
      await seed();
      const fixture = await page.evaluate(() => {
        const prefix = `${EXAM_RANGE_STORAGE_PREFIX}${planSchool.value}:${planSubject.value}:`;
        const unitId = planUnitData().id;
        for (const h of [6,7,8]) localStorage.setItem(`${prefix}2026:h${h}`, JSON.stringify({unitId,hour:h,endpointId:endpointId({unitId,hour:h})}));
        localStorage.setItem(`${prefix}2027:legacy`,JSON.stringify({endpointId:endpointId({unitId,hour:8})}));
        localStorage.setItem(`${prefix}2026:other`,JSON.stringify({unitId:"other",hour:8,endpointId:"other:8"}));
        localStorage.setItem(`${EXAM_RANGE_STORAGE_PREFIX}other:subject:2026:x`,JSON.stringify({unitId,hour:8}));
        localStorage.setItem(`${prefix}2026:broken`,"not-json");
        return {prefix,unitId};
      });
      await perform(7,action);
      const ranges = await page.evaluate(({prefix}) => Object.fromEntries([6,7,8].map(h => [h,JSON.parse(localStorage.getItem(`${prefix}2026:h${h}`))])),fixture);
      assert.equal(ranges[6].hour,6);
      assert.equal(ranges[8].hour,action === "delete" ? 7 : 9);
      if(action === "delete") { assert.equal(ranges[7].needsReview,true); assert.equal(ranges[7].endpointId,`${fixture.unitId}:7`); }
      else assert.equal(ranges[7].hour, action === "before" ? 8 : 7);
      assert.equal(await page.evaluate(({prefix}) => JSON.parse(localStorage.getItem(`${prefix}2027:legacy`)).hour,fixture),action === "delete" ? 7 : 9);
      assert.equal(await page.evaluate(({prefix}) => localStorage.getItem(`${prefix}2026:other`),fixture),JSON.stringify({unitId:"other",hour:8,endpointId:"other:8"}));
      assert.equal(await page.evaluate(({prefix}) => localStorage.getItem(`${prefix}2026:broken`),fixture),"not-json");
    }
    // Review warning persists even when a replacement row has the same number;
    // explicit re-confirmation clears it.
    await seed();
    await page.evaluate(() => {
      const year = planReferenceYear();
      localStorage.setItem(regularScheduleStorageKey(planSchool.value,year,planSubject.value),JSON.stringify([{dayOfWeek:"monday",period:1}]));
      localStorage.setItem(annualEventsStorageKey(planSchool.value,year),JSON.stringify([{id:"exam",title:"考査",category:"exam",startDate:`${year}-06-18`,endDate:`${year}-06-23`,regularClassesAvailable:false}]));
      const checkpoint = planExamProjection(year).checkpoints[0];
      const unitId = planUnitData().id;
      localStorage.setItem(examRangeStorageKey(year,checkpoint),JSON.stringify({unitId,hour:7,endpointId:endpointId({unitId,hour:7})}));
      renderExamRanges();
    });
    await perform(7,"delete");
    assert.match(await page.locator("#exam-range-list .exam-range-warning").first().textContent(),/再確認が必要/);
    await perform(1,"before");
    assert.match(await page.locator("#exam-range-list .exam-range-warning").first().textContent(),/再確認が必要/);
    await page.reload(); await page.locator("#unit-plan-tab").click();
    assert.match(await page.locator("#exam-range-list .exam-range-warning").first().textContent(),/再確認が必要/);
    await page.locator("#exam-range-list select").first().selectOption(await page.evaluate(() => endpointId({unitId:planUnitData().id,hour:5})));
    await page.getByRole("button",{name:"この範囲を確定・保存"}).first().click();
    assert.equal(await page.locator("#exam-range-list .exam-range-warning").first().textContent(),"");
    await page.setViewportSize({width:390,height:844});
    await page.getByRole("button",{name:"1時間目の操作",exact:true}).click();
    assert.equal(await page.locator(".lesson-actions-dialog").isVisible(),true);
    await page.keyboard.press("Escape");
    assert.deepEqual(errors,[]);
    console.log("Lesson edits: six insertion/deletion cases, live fields, storage/reload, numbering, hours, Word data, copy text, cancel/minimum, evaluation, endpoint shifts/legacy/isolation/review/reconfirm, mobile passed.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
