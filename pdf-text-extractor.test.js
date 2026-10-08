"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PDFJS_WORKER_URL,
  pdfTextItemsToText,
  extractPdfText,
  formatPdfExtractionResult,
  restoreAnnualCalendar
} = require("./pdf-text-extractor");

test("text items are grouped into lines and ordered by position", () => {
  const text = pdfTextItemsToText([
    { str: "入学式", transform: [1, 0, 0, 10, 80, 90], width: 30, height: 10 },
    { str: "8日", transform: [1, 0, 0, 10, 10, 90], width: 18, height: 10 },
    { str: "4月", transform: [1, 0, 0, 10, 10, 110], width: 20, height: 10 }
  ]);
  assert.equal(text, "4月\n8日 入学式");
});

test("all pages are extracted and returned in a parser-friendly structure", async () => {
  let destroyed = false;
  const pageItems = [
    [{ str: "始業式", transform: [1, 0, 0, 10, 10, 100], width: 30, height: 10 }],
    [{ str: "体育祭", transform: [1, 0, 0, 10, 10, 100], width: 30, height: 10 }]
  ];
  const pdfjsLib = {
    GlobalWorkerOptions: {},
    getDocument({ data }) {
      assert.ok(data instanceof Uint8Array);
      return { promise: Promise.resolve({
        numPages: 2,
        async getPage(number) {
          return {
            getViewport() { return { width: 800, height: 600 }; },
            async getTextContent(options) {
              assert.deepEqual(options, { includeMarkedContent: false, disableNormalization: false });
              return { items: pageItems[number - 1] };
            }
          };
        },
        async destroy() { destroyed = true; }
      }) };
    }
  };
  const progress = [];
  const result = await extractPdfText({
    name: "2026年度.pdf",
    async arrayBuffer() { return Uint8Array.from([37, 80, 68, 70]).buffer; }
  }, { pdfjsLib, onProgress: (...values) => progress.push(values) });

  assert.equal(pdfjsLib.GlobalWorkerOptions.workerSrc, PDFJS_WORKER_URL);
  assert.deepEqual(result, {
    fileName: "2026年度.pdf",
    pageCount: 2,
    pages: [
      { pageNumber: 1, width: 800, height: 600, text: "始業式", items: [{ text: "始業式", x: 10, y: 100, width: 30, height: 10, pageNumber: 1 }] },
      { pageNumber: 2, width: 800, height: 600, text: "体育祭", items: [{ text: "体育祭", x: 10, y: 100, width: 30, height: 10, pageNumber: 2 }] }
    ],
    combinedText: "始業式\n\n体育祭"
  });
  assert.deepEqual(progress, [[1, 2], [2, 2]]);
  assert.equal(destroyed, true);
  assert.match(formatPdfExtractionResult(result), /--- 2ページ ---\n体育祭/);
});

test("pages without embedded text are explicitly identified", () => {
  assert.equal(formatPdfExtractionResult({ pages: [{ pageNumber: 1, text: "" }] }), "--- 1ページ ---\n（文字情報なし）");
});

function positioned(text, x, y, width = 8, height = 6) {
  return { text, x, y, width, height, pageNumber: 1 };
}

test("annual calendar is restored from dynamic month columns and day rows", () => {
  const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const items = months.map((month, index) => positioned(`${month}月`, 55 + index * 70, 560, 18));
  for (let day = 1; day <= 31; day += 1) {
    const y = 530 - (day - 1) * 15;
    items.push(positioned(String(day), 5, y), positioned(String(day), 895, y));
  }
  items.push(positioned("昭和の日", 55, 530 - 28 * 15, 40));
  items.push(positioned("成人の日", 55 + 9 * 70, 530 - 11 * 15, 40));
  items.push(positioned("上段", 55 + 3 * 70, 530 - 16 * 15 + 2, 20));
  items.push(positioned("下段", 55 + 3 * 70, 530 - 16 * 15 - 2, 20));
  items.push(positioned("タイトル", 300, 590, 60));

  const result = restoreAnnualCalendar({ width: 910, height: 600, items }, 2026);
  assert.equal(result.ok, true);
  assert.equal(result.monthHeaders.length, 12);
  assert.equal(result.dayRows.length, 31);
  assert.equal(result.cells.find((cell) => cell.text === "昭和の日").date, "2026-04-29");
  assert.equal(result.cells.find((cell) => cell.text === "成人の日").date, "2027-01-12");
  assert.equal(result.cells.find((cell) => cell.month === 7 && cell.day === 17).text, "上段\n下段");
  assert.equal(result.cells.some((cell) => cell.text.includes("タイトル")), false);
});

test("calendar restoration recognizes full-width labels and removes positioned table metadata", () => {
  const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const fullWidth = (value) => String(value).replace(/[0-9]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) + 0xfee0));
  const items = months.map((month, index) => positioned(`${fullWidth(month)} 月`, 55 + index * 70, 560, 18));
  for (let day = 1; day <= 31; day += 1) {
    const y = 530 - (day - 1) * 15;
    items.push(positioned(fullWidth(day), 5, y), positioned(fullWidth(day), 895, y));
  }
  const holidays = [
    [4, 29, "昭和の日"], [5, 3, "憲法記念日"], [5, 4, "みどりの日"], [5, 5, "こどもの日"],
    [7, 20, "海の日"], [8, 11, "山の日"], [9, 21, "敬老の日"], [9, 23, "秋分の日"]
  ];
  holidays.forEach(([month, day, name]) => {
    const x = 55 + months.indexOf(month) * 70;
    const y = 530 - (day - 1) * 15;
    items.push(positioned("水 □", x - 12, y), positioned(name, x, y, 40));
  });

  const result = restoreAnnualCalendar({ width: 910, height: 600, items }, 2026);
  assert.equal(result.ok, true);
  assert.deepEqual(result.cells.map(({ date, text }) => [date, text]), [
    ["2026-04-29", "昭和の日"], ["2026-05-03", "憲法記念日"], ["2026-05-04", "みどりの日"],
    ["2026-05-05", "こどもの日"], ["2026-07-20", "海の日"], ["2026-08-11", "山の日"],
    ["2026-09-21", "敬老の日"], ["2026-09-23", "秋分の日"]
  ]);
});

test("combined PDF text items restore Mito High School-style month headers, rows, and holidays", () => {
  const monthText = "4月 5月 6月 7月 8月 9月 10月 11月 12月 1月 2月 3月";
  const items = [positioned(monthText, 50, 560, 840)];
  const holidays = new Map([
    ["29:4", "昭和の日"], ["3:5", "憲法記念日"], ["4:5", "みどりの日"], ["5:5", "こどもの日"],
    ["20:7", "海の日"], ["11:8", "山の日"], ["21:9", "敬老の日"], ["23:9", "秋分の日"]
  ]);
  const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  for (let day = 1; day <= 31; day += 1) {
    const row = `${String(day).padEnd(5)}${months.map((month) =>
      `水 □ ${holidays.get(`${day}:${month}`) || "・"}`.padEnd(12)).join("")}`;
    items.push(positioned(row, 5, 530 - (day - 1) * 15, 900));
  }

  const result = restoreAnnualCalendar({ width: 910, height: 600, items }, 2026);
  assert.equal(result.ok, true);
  assert.equal(result.monthHeaders.length, 12);
  assert.equal(result.dayRows.length, 31);
  holidays.forEach((name, key) => {
    const [day, month] = key.split(":").map(Number);
    const year = month >= 4 ? 2026 : 2027;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    assert.match(result.cells.find((cell) => cell.date === date)?.text || "", new RegExp(name));
  });
  assert.deepEqual(result.debug.monthHeaderCandidates, [monthText]);
  assert.equal(result.debug.monthHeaderLine, monthText);
  assert.equal(result.debug.dayRowCandidates.length, 31);
});

test("month header recognition uses the complete clustered line when labels are fragmented", () => {
  const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const items = [];
  months.forEach((month, index) => {
    const x = 50 + index * 70;
    const label = String(month);
    items.push(positioned(label, x, 560, label.length * 7), positioned("月", x + label.length * 7, 560, 7));
  });
  for (let day = 1; day <= 31; day += 1) {
    const y = 530 - (day - 1) * 15;
    items.push(positioned(String(day), 5, y), positioned(String(day), 895, y));
  }
  items.push(positioned("昭和の日", 50, 530 - 28 * 15, 40));

  const result = restoreAnnualCalendar({ width: 910, height: 600, items }, 2026);
  assert.equal(result.ok, true);
  assert.equal(result.monthHeaders.length, 12);
  assert.equal(result.debug.monthHeaderLine, "4月 5月 6月 7月 8月 9月 10月 11月 12月 1月 2月 3月");
  assert.equal(result.cells.find((cell) => cell.text === "昭和の日").date, "2026-04-29");
  assert.equal(result.cells.some((cell) => /月/.test(cell.text)), false);
});

function calendarWithMissingDayLabels(missingDays, rowY = (day) => 530 - (day - 1) * 15) {
  const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const items = months.map((month, index) => positioned(`${month}月`, 55 + index * 70, 560, 18));
  for (let day = 1; day <= 31; day += 1) {
    const y = rowY(day);
    if (!missingDays.includes(day)) items.push(positioned(String(day), 5, y));
    months.forEach((month, index) => {
      const text = month === 7 && day === 20 ? "海の日" : `行事${month}/${day}`;
      items.push(positioned(text, 55 + index * 70, y, 40));
    });
  }
  return { width: 910, height: 600, items };
}

test("Mito-style missing day labels 6, 20, and 27 restore all twelve months with Marine Day on July 20", () => {
  const page = calendarWithMissingDayLabels([6, 20, 27]);
  const result = restoreAnnualCalendar(page, 2026);
  const complete = restoreAnnualCalendar(calendarWithMissingDayLabels([]), 2026);

  assert.equal(result.ok, true);
  assert.equal(result.debug.dayRowCandidates.length, 28);
  assert.equal(result.debug.recognizedDayRowCount, 28);
  assert.deepEqual(result.debug.interpolatedDayRows, [
    { day: 6, y: 455 }, { day: 20, y: 245 }, { day: 27, y: 140 }
  ]);
  assert.equal(result.debug.recognizedDayRowCount + result.debug.interpolatedDayRows.length, 31);
  assert.equal(result.dayRows.length, 31);
  assert.deepEqual(result.monthHeaders, complete.monthHeaders);
  assert.deepEqual(result.monthBoundaries, complete.monthBoundaries);
  assert.deepEqual(result.dayRows, complete.dayRows);
  assert.deepEqual(result.cells.map(({ date, text }) => [date, text]),
    complete.cells.map(({ date, text }) => [date, text]));
  // The 12 x 31 grid retains every valid fiscal-year date, excluding dates
  // such as April 31 and February 30 just as the original restoration does.
  assert.equal(result.cells.length, 365);
  for (let month = 1; month <= 12; month += 1) {
    const year = month >= 4 ? 2026 : 2027;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    assert.equal(result.cells.filter((cell) => cell.month === month).length, days);
  }
  assert.equal(result.cells.find((cell) => cell.date === "2026-07-20").text, "海の日");
  assert.equal(result.cells.filter((cell) => cell.text === "海の日").length, 1);
  assert.equal(complete.debug.recognizedDayRowCount, 31);
  assert.deepEqual(complete.debug.interpolatedDayRows, []);
});

test("missing day rows use local neighboring coordinates without moving recognized rows", () => {
  // Each gap sits in a different local row spacing; a global fixed pitch
  // would restore the later rows at the wrong coordinates.
  const rowY = (day) => 530 - (day - 1) * 12 - Math.max(0, day - 10) * 2 - Math.max(0, day - 23) * 3;
  const result = restoreAnnualCalendar(calendarWithMissingDayLabels([6, 20, 27], rowY), 2026);
  assert.equal(result.ok, true);
  assert.deepEqual(result.debug.interpolatedDayRows,
    [6, 20, 27].map((day) => ({ day, y: (rowY(day - 1) + rowY(day + 1)) / 2 })));
  assert.deepEqual(result.dayRows, Array.from({ length: 31 }, (_, index) => ({ day: index + 1, y: rowY(index + 1) })));
  assert.equal(result.cells.find((cell) => cell.text === "海の日").date, "2026-07-20");
});

test("consecutive missing labels are interpolated between the nearest recognized anchors", () => {
  const result = restoreAnnualCalendar(calendarWithMissingDayLabels([19, 20, 21]), 2026);
  assert.equal(result.ok, true);
  assert.deepEqual(result.debug.interpolatedDayRows, [
    { day: 19, y: 260 }, { day: 20, y: 245 }, { day: 21, y: 230 }
  ]);
  assert.equal(result.cells.find((cell) => cell.text === "海の日").date, "2026-07-20");
});

test("missing edge rows and conflicting anchor coordinates are not guessed", () => {
  for (const missing of [[1], [31], [1, 6, 20, 27, 31]]) {
    const result = restoreAnnualCalendar(calendarWithMissingDayLabels(missing), 2026);
    assert.equal(result.ok, false);
    assert.equal(result.error, "日付行を正しく認識できませんでした");
    assert.deepEqual(result.cells, []);
    assert.equal(result.dayRows.some((row) => missing.includes(row.day) && [1, 31].includes(row.day)), false);
  }
  const conflicting = restoreAnnualCalendar(calendarWithMissingDayLabels([6, 20, 27],
    (day) => day === 7 ? 475 : 530 - (day - 1) * 15), 2026);
  assert.equal(conflicting.ok, false);
  assert.deepEqual(conflicting.debug.interpolatedDayRows, []);
  assert.deepEqual(conflicting.cells, []);
});

test("calendar restoration fails safely when headers or rows are incomplete", () => {
  const empty = restoreAnnualCalendar({ width: 800, height: 600, items: [] }, 2026);
  assert.equal(empty.ok, false);
  assert.equal(empty.error, "月列を正しく認識できませんでした");
  assert.deepEqual(empty.debug, { itemCount: 0, monthHeaderCandidates: [], monthHeaderLine: "", dayRowCandidates: [] });
  const headers = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((month, index) => positioned(`${month}月`, 50 + index * 60, 550));
  const result = restoreAnnualCalendar({ width: 800, height: 600, items: headers }, 2026);
  assert.equal(result.ok, false);
  assert.equal(result.error, "日付行を正しく認識できませんでした");
});

const fiscalMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const numericMonthLine = fiscalMonths.join(" ");
function numericCalendar() {
  const page = calendarWithMissingDayLabels([]);
  page.items.splice(0, 12, positioned("日", 5, 560),
    ...fiscalMonths.map((month, index) => positioned(String(month), 55 + index * 70, 560, 18)),
    positioned("日", 895, 560));
  return page;
}

test("numeric fiscal headers ignore flanking 日 and preserve all columns, rows and valid cells", () => {
  const result = restoreAnnualCalendar(numericCalendar(), 2026);
  const labeled = restoreAnnualCalendar(calendarWithMissingDayLabels([]), 2026);
  assert.equal(result.ok, true);
  assert.equal(result.monthHeaders.length, 12);
  assert.deepEqual(result.monthHeaders, labeled.monthHeaders);
  assert.deepEqual(result.monthBoundaries, labeled.monthBoundaries);
  assert.deepEqual(result.dayRows, labeled.dayRows);
  assert.equal(result.debug.recognizedDayRowCount, 31);
  assert.equal(result.cells.length, 365);
  assert.deepEqual(result.cells.map(({ date, text }) => [date, text]),
    labeled.cells.map(({ date, text }) => [date, text]));
  assert.equal(result.debug.monthHeaderLine, numericMonthLine);
  assert.deepEqual(result.debug.monthHeaderCandidates, [numericMonthLine]);
  result.monthHeaders.forEach((header, index) => {
    assert.equal(header.month, fiscalMonths[index]);
    assert.equal(header.x, 64 + index * 70);
    if (index) assert.ok(header.x > result.monthHeaders[index - 1].x);
  });
});

test("combined numeric headers recover each character center with and without 日", () => {
  for (const text of [numericMonthLine, `日 ${numericMonthLine} 日`, `日 ${numericMonthLine} 日`.replace(/\d/g, d => String.fromCharCode(d.charCodeAt(0) + 0xfee0))]) {
    const page = calendarWithMissingDayLabels([]);
    page.items.splice(0, 12, positioned(text, 50, 560, text.length * 7));
    const result = restoreAnnualCalendar(page, 2026);
    assert.equal(result.ok, true);
    let from = 0;
    const normalized = text.normalize("NFKC");
    result.monthHeaders.forEach((header, index) => {
      const label = String(fiscalMonths[index]);
      const start = normalized.indexOf(label, from);
      from = start + label.length;
      assert.equal(header.x, 50 + (start + label.length / 2) * 7);
      if (index) assert.ok(header.x > result.monthHeaders[index - 1].x);
    });
    assert.equal(result.cells.some(cell => cell.text === numericMonthLine), false);
  }
});

test("labeled headers take precedence even when numeric headers are higher", () => {
  const page = calendarWithMissingDayLabels([]);
  page.items.push(positioned(`日 ${numericMonthLine} 日`, 10, 585, 880));
  const result = restoreAnnualCalendar(page, 2026);
  assert.equal(result.debug.monthHeaderLine, fiscalMonths.map(month => `${month}月`).join(" "));
  assert.deepEqual(result.monthHeaders, restoreAnnualCalendar(calendarWithMissingDayLabels([]), 2026).monthHeaders);
});

test("incomplete, reordered, extra, adjacent, nonmonotonic and multiline numeric sequences are rejected", () => {
  for (const text of ["4 5 6 7 8 9 10 11 12 1 2", "5 4 6 7 8 9 10 11 12 1 2 3",
    `0 ${numericMonthLine}`, `${numericMonthLine} 4`, numericMonthLine.replace("4 5", "45"), `集計 ${numericMonthLine}`]) {
    const result = restoreAnnualCalendar({ height: 600, items: [positioned(text, 50, 560, 840)] }, 2026);
    assert.equal(result.monthHeaders.length, 0, text);
  }
  const collapsed = restoreAnnualCalendar({ height: 600, items: [positioned(numericMonthLine, 50, 560, 0)] }, 2026);
  assert.equal(collapsed.monthHeaders.length, 0);
  const split = fiscalMonths.map((month, index) => positioned(String(month), 55 + index * 70, index < 6 ? 560 : 540));
  assert.equal(restoreAnnualCalendar({ height: 600, items: split }, 2026).monthHeaders.length, 0);
});

test("bottom summary numbers cannot supply a numeric month header; topmost valid candidate wins", () => {
  for (const height of [600, 0]) {
    const items = [positioned("年間行事", 50, 590, 60), positioned(numericMonthLine, 50, 50, 840)];
    assert.equal(restoreAnnualCalendar({ height, items }, 2026).monthHeaders.length, 0);
  }
  const page = numericCalendar();
  page.items.push(positioned(numericMonthLine, 50, 550, 840), positioned(numericMonthLine, 50, 50, 840));
  const result = restoreAnnualCalendar(page, 2026);
  assert.equal(result.ok, true);
  assert.ok(result.monthHeaders.every(header => header.y === 560));
});

test("uploaded Goshoko R08 PDF header recognizes twelve numeric columns at their actual centers", () => {
  const page = require("./test-fixtures/goshoko-r08-month-header.json");
  const result = restoreAnnualCalendar(page, 2026);
  assert.equal(result.monthHeaders.length, 12);
  assert.deepEqual(result.monthHeaders.map(header => header.month), fiscalMonths);
  assert.equal(result.debug.monthHeaderLine, numericMonthLine);
  const expected = [148.43979825, 233.71116975, 319.112133, 404.3835045,
    489.654876, 575.05583925, 660.32721075, 745.728174, 830.9995455,
    916.270917, 1001.67188025, 1086.94325175];
  result.monthHeaders.forEach((header, index) => {
    assert.ok(Math.abs(header.x - expected[index]) < 0.000001);
    if (index) assert.ok(header.x > result.monthHeaders[index - 1].x);
  });
  assert.equal(result.error, "日付行を正しく認識できませんでした");
});
