"use strict";
// Uses synthetic PDF.js text items through the real import/extraction/restoration
// pipeline. The Sannohe fixture supplies event text; this is not a real-PDF test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fixture = require("./test-fixtures/sannohe-r8-calendar-cells.json");
const item = (str, x, y, width = 40) => ({ str, transform: [1, 0, 0, 4, x, y], width, height: 4 });
const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const headers = months.map((month, i) => item(`${month}月`, 100 + i * 100 - 5, 4000, 10));
const dayItems = Array.from({ length: 31 }, (_, i) => item(String(i + 1), 10, 3800 - (i + 1) * 100, 5));
const eventItems = fixture.cells.flatMap(cell => cell.text.split("\n").map((text, line) => item(text, 100 + months.indexOf(cell.month) * 100 - 20, 3800 - cell.day * 100 - line * 3)));
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(__dirname, new URL(req.url, "http://localhost").pathname === "/" ? "index.html" : new URL(req.url, "http://localhost").pathname);
    try { res.setHeader("Content-Type", file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html"); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.route("https://**", route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator("#annual-events-tab").click();
    await page.locator("#events-year").fill("2026");
    await page.locator("#events-year").dispatchEvent("change");
    // Retain actual initialized storage plus representative opaque saved values.
    await page.evaluate(() => {
      for (const name of ["annual-events", "regular-schedule", "annual-hours", "unit-plan", "exam-scope"]) localStorage.setItem(`pdf-ui-preservation:${name}`, JSON.stringify({ saved: name }));
      window.pdfUiStorageBefore = JSON.stringify(Object.entries(localStorage).sort());
    });
    const importItems = async (items) => {
      await page.evaluate(items => {
        window.pdfjsLib = {
          GlobalWorkerOptions: {},
          getDocument: () => ({ promise: Promise.resolve({ numPages: 1,
            getPage: async () => ({ getTextContent: async () => ({ items }), getViewport: () => ({ width: 1300, height: 4200 }), cleanup() {} }), destroy() {} }) })
        };
      }, items);
      await page.locator("#annual-events-pdf").setInputFiles({ name: "synthetic-calendar.pdf", mimeType: "application/pdf", buffer: Buffer.from("synthetic") });
      await page.waitForFunction(() => !document.querySelector("#pdf-extraction-result").hidden && !document.querySelector("#annual-events-pdf").disabled);
    };
    const details = page.locator("#pdf-analysis-details");
    const summary = details.locator("summary");
    await importItems([...headers, ...dayItems, ...eventItems]);
    assert.equal(await details.evaluate(el => el.open), false);
    assert.equal(await page.locator("#pdf-extracted-text").isVisible(), false);
    assert.equal(await page.locator("#pdf-calendar-debug").isVisible(), false);
    assert.equal(await page.locator("#pdf-import-status").textContent(), "12か月・31日を認識しました。内容のあるセル：185件");
    assert.equal(await page.locator("#pdf-calendar-body tr").count(), 185);
    assert.match(await page.locator("#candidate-message").textContent(), /統合前 99件 → 期間候補 67件/);
    const candidateTopClosed = await page.locator("#candidate-heading").evaluate(el => el.getBoundingClientRect().top + window.scrollY);
    await summary.click();
    assert.equal(await page.locator("#pdf-extracted-text").isVisible(), true);
    assert.equal(await page.locator("#pdf-calendar-debug").isVisible(), true);
    assert.match(await page.locator("#pdf-extracted-text").inputValue(), /入学式/);
    const debug = await page.locator("#pdf-calendar-debug").textContent();
    for (const label of [`取得したtext item数: ${headers.length + dayItems.length + eventItems.length}`, "月ヘッダー候補", "月ヘッダー行", "日付行候補", "認識月数: 12", "認識日付行数: 31", "直接認識日付行数: 31", "補完日付行数: 0", "補完日付行: なし", "各月中心x", "31日 y="]) assert.ok(debug.includes(label), label);
    const candidateTopOpen = await page.locator("#candidate-heading").evaluate(el => el.getBoundingClientRect().top + window.scrollY);
    assert.ok(candidateTopOpen - candidateTopClosed > 280);
    console.log(`PC: closing PDF details reduces distance to candidates by ${Math.round(candidateTopOpen - candidateTopClosed)}px.`);
    // Keyboard disclosure and narrow viewport retain visible content inside panel.
    await summary.focus(); await page.keyboard.press("Enter");
    assert.equal(await details.evaluate(el => el.open), false);
    await page.setViewportSize({ width: 390, height: 844 });
    const checkBounds = async selector => {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= 391, selector);
    };
    await checkBounds(".pdf-import-panel"); await checkBounds("#pdf-analysis-details");
    await summary.click(); await checkBounds("#pdf-extracted-text"); await checkBounds("#pdf-calendar-debug");
    // Missing internal row: the existing interpolation stays intact.
    await importItems([...headers, ...dayItems.filter((_, i) => i !== 14), item("確認用行事", 100, 3800 - 15 * 100)]);
    assert.equal(await details.evaluate(el => el.open), false);
    assert.match(await page.locator("#pdf-calendar-debug").textContent(), /直接認識日付行数: 30[\s\S]*補完日付行数: 1[\s\S]*補完日付行: 15日 y=/);
    assert.equal(await page.locator("#pdf-calendar-body tr").count(), 1);
    for (const [items, error] of [[dayItems, "月列を正しく認識できませんでした"], [[...headers, ...dayItems.slice(1)], "日付行を正しく認識できませんでした"], [[], "スキャン画像形式"]]) {
      await summary.click();
      await importItems(items);
      assert.equal(await details.evaluate(el => el.open), false);
      assert.ok((await page.locator("#pdf-import-status").textContent()).includes(error));
      assert.equal(await page.locator("#pdf-import-status").isVisible(), true);
      assert.equal(await page.locator("#annual-event-candidates").isVisible(), false);
      assert.equal(await page.locator("#pdf-extracted-text").isVisible(), false);
      await summary.click();
      assert.equal(await page.locator("#pdf-calendar-debug").isVisible(), true);
      await summary.click();
    }
    await importItems([...headers, ...dayItems]);
    assert.match(await page.locator("#pdf-import-status").textContent(), /内容のあるセル：0件/);
    await summary.click(); await page.locator("#clear-annual-events-pdf").click();
    assert.equal(await details.evaluate(el => el.open), false);
    assert.equal(await page.locator("#pdf-extraction-result").isVisible(), false);
    assert.equal(await page.locator("#pdf-extracted-text").inputValue(), "");
    assert.equal(await page.locator("#pdf-calendar-debug").textContent(), "");
    assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()) === window.pdfUiStorageBefore), true);
    assert.deepEqual(errors, []);
    console.log("PDF UI regression passed: collapsed details, full diagnostics, successful/empty/interpolated calendars, month/day recognition errors, scan warning, reimport/clear, keyboard, responsive bounds and unchanged localStorage.");
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
