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
            async getTextContent() { return { items: pageItems[number - 1] }; }
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

test("calendar restoration fails safely when headers or rows are incomplete", () => {
  assert.deepEqual(restoreAnnualCalendar({ width: 800, height: 600, items: [] }, 2026), {
    ok: false, error: "月列を正しく認識できませんでした", monthHeaders: [], dayRows: [], cells: []
  });
  const headers = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((month, index) => positioned(`${month}月`, 50 + index * 60, 550));
  const result = restoreAnnualCalendar({ width: 800, height: 600, items: headers }, 2026);
  assert.equal(result.ok, false);
  assert.equal(result.error, "日付行を正しく認識できませんでした");
});
