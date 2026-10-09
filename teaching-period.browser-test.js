"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(__dirname, new URL(req.url, "http://localhost").pathname === "/" ? "index.html" : new URL(req.url, "http://localhost").pathname);
    try { res.setHeader("Content-Type", file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html"); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("https://**", route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const fixture = await page.evaluate(() => {
      const school = Object.keys(SCHOOL_COURSES).find(id => SCHOOLS[id].name.includes("五所川原"));
      const course = Object.keys(SCHOOL_COURSES[school]).find(id => SCHOOL_COURSES[school][id].name.includes("探究物理"));
      const events = [{ id: "break", category: "holiday", title: "年度始休業", startDate: "2026-04-01", endDate: "2026-04-06", regularClassesAvailable: false },
        { id: "exam", category: "exam", title: "考査", startDate: "2026-04-09", endDate: "2026-04-09", regularClassesAvailable: false },
        { id: "late", category: "exam", title: "対象外考査", startDate: "2027-03-01", endDate: "2027-03-01", regularClassesAvailable: false }];
      localStorage.setItem(annualEventsStorageKey(school,2026), JSON.stringify(events));
      localStorage.setItem(regularScheduleStorageKey(school,2026,course),JSON.stringify(["monday","tuesday","wednesday","thursday"].map(dayOfWeek=>({dayOfWeek,period:1}))));
      return {school,course,existing:Object.fromEntries(Object.entries(localStorage))};
    });
    await page.locator("#annual-events-tab").click();
    await page.locator("#events-school").selectOption(fixture.school);
    await page.locator("#events-year").fill("2026"); await page.locator("#events-year").dispatchEvent("change");
    await page.locator("#schedule-subject").selectOption(fixture.course);
    assert.equal(await page.locator("#teaching-period-start").inputValue(),"2026-04-01");
    fixture.existing = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    await page.locator("#teaching-period-start").fill("2026-04-07");
    await page.locator("#teaching-period-end").fill("2027-02-28");
    await page.locator("#teaching-period-form button[type=submit]").click();
    assert.match(await page.locator("#teaching-period-message").textContent(), /保存しました/);
    assert.match(await page.locator("#projection-teaching-period").textContent(), /2026\/04\/07 ～ 2027\/02\/28/);
    const result = await page.evaluate(({school,course,existing}) => {
      for (const [key,value] of Object.entries(existing)) if(localStorage.getItem(key)!==value) throw Error(`Existing data changed: ${key}`);
      annualSchool.value=school; populateAnnualCourses(course); annualEventsReferenceYear.value="2026"; saveAnnualEventsReferenceYear(); renderAnnual();
      planSchool.value=school; populatePlanCourses(course);
      const annual = annualExamProjection();
      const plan = planExamProjection(2026);
      const projection = annualEventProjection();
      return {days:annualEventAvailableDays().days,annual,plan,projection};
    },fixture);
    assert.equal(result.days[11],0);
    assert.deepEqual(result.plan,result.annual);
    assert.equal(result.annual.checkpoints.length,1);
    assert.equal(result.annual.checkpoints[0].cumulativeHours,2);
    assert.ok(result.projection.scheduledSessions.every(s=>s.date>="2026-04-07" && s.date<="2027-02-28"));
    assert.equal(result.projection.excludedCount,1);
    await page.evaluate(({school,course}) => {
      const key = annualEventsStorageKey(school,2026);
      const saved = localStorage.getItem(key);
      localStorage.removeItem(key);
      try {
        const projection = annualEventProjection();
        const selected = selectExpectedHours(projection,140);
        if(selected.hours !== projection.availableCount || selected.source !== "annual-events") throw Error("Custom period did not use timetable without events");
        if(annualEventAvailableDays().days[11] !== 0) throw Error("March must remain zero without annual events");
      } finally { localStorage.setItem(key,saved); }
    },fixture);
    for (const [start,end] of [["2026-04-08","2026-04-07"],["2026-03-31","2027-02-28"]]) {
      await page.locator("#teaching-period-start").fill(start); await page.locator("#teaching-period-end").fill(end);
      await page.locator("#teaching-period-form").evaluate(form=>form.dispatchEvent(new Event("submit",{cancelable:true})));
      assert.doesNotMatch(await page.locator("#teaching-period-message").textContent(),/保存しました/);
    }
    await page.locator("#events-year").fill("2027");await page.locator("#events-year").dispatchEvent("change");
    assert.equal(await page.locator("#teaching-period-start").inputValue(),"2027-04-01");
    await page.locator("#events-year").fill("2026");await page.locator("#events-year").dispatchEvent("change");
    assert.equal(await page.locator("#teaching-period-start").inputValue(),"2026-04-07");
    await page.reload();await page.locator("#annual-events-tab").click();await page.locator("#schedule-subject").selectOption(fixture.course);
    assert.equal(await page.locator("#teaching-period-end").inputValue(),"2027-02-28");
    await page.locator("#teaching-period-reset").click();
    assert.equal(await page.locator("#teaching-period-start").inputValue(),"2026-04-01");
    assert.equal(await page.locator("#teaching-period-end").inputValue(),"2027-03-31");
    assert.deepEqual(errors,[]);
    console.log("Teaching period UI, validation, switching, reload, reset, projections and data preservation passed");
  } finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
