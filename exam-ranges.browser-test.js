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
    for (const format of ["new", "mixed", "legacy"]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://**", route => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const fixture = await page.evaluate(format => {
        localStorage.clear();
        const units = [
          ["planar-motion-rigid-body", "平面内の運動と剛体のつり合い", 8],
          ["momentum", "運動量", 9],
          ["circular-motion-oscillation", "円運動と単振動", 9],
          ["gravitation", "万有引力", 10]
        ];
        const plans = {};
        for (const [unitId, unitName, allocatedHours] of units) {
          const plan = { allocatedHours, rows: Array.from({ length: allocatedHours }, (_, index) => ({ hour: index + 1, activity: `${unitName}の学習${index + 1}` })) };
          if (format === "new" || (format === "mixed" && unitId === units[0][0])) Object.assign(plan, { unitId, unitName });
          const key = `rika-unit-plan-v2:santo__physics__${unitId}`;
          plans[key] = JSON.stringify(plan);
          localStorage.setItem(key, plans[key]);
        }
        localStorage.setItem("rika-unit-plan-selection-v2", JSON.stringify({ schoolId: "santo", courseId: "physics", unitId: units[0][0] }));
        localStorage.setItem("rika-teaching-order-v1:santo:physics", JSON.stringify(units.map(([id]) => id)));
        localStorage.setItem("rika-annual-event-reference-year-v1:santo:physics", "2026");
        // A reproducible 33-hour schedule; this is a test fixture, not the user's actual timetable.
        localStorage.setItem("rika-regular-schedule-v1:santo:2026:physics", JSON.stringify(["monday", "tuesday", "thursday"].map(dayOfWeek => ({ dayOfWeek, period: 1 }))));
        const events = [{ id: "term1-final", title: "1学期期末考査", category: "exam", startDate: "2026-06-18", endDate: "2026-06-23", regularClassesAvailable: false }];
        localStorage.setItem("rika-annual-events-v1:santo:2026", JSON.stringify(events));
        return { plans, events: JSON.stringify(events) };
      }, format);
      await page.reload();
      await page.locator("#unit-plan-tab").click();
      assert.equal(await page.locator("#exam-range-context").textContent(), "三戸高校・物理・2026年度（年間行事参照年度）");
      const card = page.locator("#exam-range-list article").first();
      const select = card.locator("select");
      assert.match(await card.textContent(), /考査までの授業実施見込み33時間/);
      assert.equal(await select.inputValue(), "gravitation:7");
      assert.match(await card.locator(".automatic-range").textContent(), /万有引力 第7時まで/);
      const options = await select.locator("option").evaluateAll(options => options.map(option => ({ value: option.value, text: option.textContent })));
      assert.equal(options.length, 36);
      assert.deepEqual([0, 8, 17, 26].map(index => options[index].text), ["平面内の運動と剛体のつり合い 第1時まで", "運動量 第1時まで", "円運動と単振動 第1時まで", "万有引力 第1時まで"]);
      const loaded = await page.evaluate(() => savedPlansInTeachingOrder().plans.map(({ unitId, unitName }) => ({ unitId, unitName })));
      assert.equal(loaded[1].unitId, "momentum");
      assert.equal(loaded[1].unitName, "運動量");
      assert.match(await page.locator("#exam-range-message").textContent(), /気体分子の運動の単元指導計画が未保存/);
      assert.equal(await page.locator("#unit-total-hours").textContent(), "36時間");
      const timeline = await page.evaluate(() => { const { orderedUnits, plans } = savedPlansInTeachingOrder(); return buildUnitLessonTimeline(orderedUnits, plans).lessons; });
      assert.deepEqual(timeline.map(lesson => lesson.cumulativeHours), Array.from({ length: 36 }, (_, index) => index + 1));
      for (const [key, value] of Object.entries(fixture.plans)) assert.equal(await page.evaluate(key => localStorage.getItem(key), key), value);

      // Existing confirmations win over automatic suggestions, without rewriting storage.
      const rangeKey = "rika-exam-range-v1:santo:physics:2026:term1-final";
      const confirmed = JSON.stringify({ endpointId: "momentum:5", unitId: "momentum", hour: 5, savedAt: "2026-05-01T00:00:00.000Z" });
      await page.evaluate(({ rangeKey, confirmed }) => { localStorage.setItem(rangeKey, confirmed); renderExamRanges(); }, { rangeKey, confirmed });
      assert.equal(await select.inputValue(), "momentum:5");
      assert.match(await card.textContent(), /確定範囲の必要時数13時間/);
      await page.reload();
      await page.locator("#unit-plan-tab").click();
      assert.equal(await select.inputValue(), "momentum:5");
      assert.equal(await page.evaluate(key => localStorage.getItem(key), rangeKey), confirmed);

      // Changing teaching order changes cumulative hours, while preserving endpoint IDs.
      await page.evaluate(() => { saveTeachingOrder(["momentum", "planar-motion-rigid-body", "circular-motion-oscillation", "gravitation"]); renderExamRanges(); });
      assert.equal(await select.inputValue(), "momentum:5");
      assert.equal(await select.locator("option").first().textContent(), "運動量 第1時まで");
      assert.match(await card.textContent(), /確定範囲の必要時数5時間/);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), rangeKey), confirmed);

      // Saving a new range is still available and persists across reloads.
      await select.selectOption("circular-motion-oscillation:3");
      await card.getByRole("button", { name: "この範囲を確定・保存" }).click();
      await page.reload();
      await page.locator("#unit-plan-tab").click();
      assert.equal(await select.inputValue(), "circular-motion-oscillation:3");

      // An invalid saved endpoint is warned about, never deleted or reset.
      const invalid = JSON.stringify({ endpointId: "missing:99" });
      await page.evaluate(({ rangeKey, invalid }) => { localStorage.setItem(rangeKey, invalid); renderExamRanges(); }, { rangeKey, invalid });
      assert.match(await card.locator(".exam-range-warning").textContent(), /保存済みの考査範囲が現在の単元指導計画に存在しません/);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), rangeKey), invalid);
      assert.equal(await page.evaluate(() => localStorage.getItem("rika-annual-events-v1:santo:2026")), fixture.events);
      for (const [key, value] of Object.entries(fixture.plans)) assert.equal(await page.evaluate(key => localStorage.getItem(key), key), value);
      assert.deepEqual(errors, []);
      console.log(`${format} saved plans: 36 options, 33 hours → 万有引力 第7時まで; order, confirmations, save/reload and storage preservation passed.`);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
