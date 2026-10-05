"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PDFJS_WORKER_URL,
  pdfTextItemsToText,
  extractPdfText,
  formatPdfExtractionResult
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
          return { async getTextContent() { return { items: pageItems[number - 1] }; } };
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
    pages: [{ pageNumber: 1, text: "始業式" }, { pageNumber: 2, text: "体育祭" }],
    combinedText: "始業式\n\n体育祭"
  });
  assert.deepEqual(progress, [[1, 2], [2, 2]]);
  assert.equal(destroyed, true);
  assert.match(formatPdfExtractionResult(result), /--- 2ページ ---\n体育祭/);
});

test("pages without embedded text are explicitly identified", () => {
  assert.equal(formatPdfExtractionResult({ pages: [{ pageNumber: 1, text: "" }] }), "--- 1ページ ---\n（文字情報なし）");
});
