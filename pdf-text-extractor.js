"use strict";

const PDFJS_VERSION = "3.11.174";
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;

/** Arrange PDF.js text items into readable lines using their x/y positions. */
function pdfTextItemsToText(items) {
  const positioned = (Array.isArray(items) ? items : [])
    .filter((item) => typeof item?.str === "string" && item.str.trim())
    .map((item) => ({
      text: item.str.trim(),
      x: Number(item.transform?.[4]) || 0,
      y: Number(item.transform?.[5]) || 0,
      width: Math.max(0, Number(item.width) || 0),
      height: Math.max(1, Math.abs(Number(item.height) || Number(item.transform?.[3]) || 10))
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  positioned.forEach((item) => {
    const tolerance = Math.max(2, item.height * 0.45);
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  });

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const lineItems = line.items.sort((a, b) => a.x - b.x);
      return lineItems.reduce((text, item, index) => {
        if (!index) return item.text;
        const previous = lineItems[index - 1];
        const gap = item.x - (previous.x + previous.width);
        const typicalCharacterWidth = previous.width / Math.max(previous.text.length, 1);
        return `${text}${gap > Math.max(1.5, typicalCharacterWidth * 0.35) ? " " : ""}${item.text}`;
      }, "");
    })
    .join("\n");
}

/** Extract each page and combined text without uploading the File anywhere. */
async function extractPdfText(file, options = {}) {
  const pdfjs = options.pdfjsLib || globalThis.pdfjsLib;
  if (!pdfjs?.getDocument) throw new Error("PDF_READER_UNAVAILABLE");
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  let pdf;
  try {
    pdf = await loadingTask.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      options.onProgress?.(pageNumber, pdf.numPages);
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pages.push({ pageNumber, text: pdfTextItemsToText(textContent.items) });
      page.cleanup?.();
    }
    return {
      fileName: file.name,
      pageCount: pdf.numPages,
      pages,
      combinedText: pages.map(({ text }) => text).join("\n\n")
    };
  } finally {
    if (pdf) await pdf.destroy?.();
    else await loadingTask.destroy?.();
  }
}

function formatPdfExtractionResult(result) {
  return result.pages.map(({ pageNumber, text }) =>
    `--- ${pageNumber}ページ ---\n${text || "（文字情報なし）"}`
  ).join("\n\n");
}

function initializePdfImport() {
  const input = document.querySelector("#annual-events-pdf");
  if (!input) return;
  const clearButton = document.querySelector("#clear-annual-events-pdf");
  const status = document.querySelector("#pdf-import-status");
  const resultPanel = document.querySelector("#pdf-extraction-result");
  const fileName = document.querySelector("#pdf-file-name");
  const pageCount = document.querySelector("#pdf-page-count");
  const output = document.querySelector("#pdf-extracted-text");
  let requestId = 0;

  const clear = () => {
    requestId += 1;
    input.value = "";
    input.disabled = false;
    clearButton.hidden = true;
    resultPanel.hidden = true;
    fileName.textContent = "";
    pageCount.textContent = "";
    output.value = "";
    status.textContent = "PDFを選択してください。";
    status.className = "pdf-import-status";
  };

  clearButton.addEventListener("click", clear);
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const currentRequest = ++requestId;
    resultPanel.hidden = true;
    clearButton.hidden = false;
    status.className = "pdf-import-status";
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      status.textContent = "PDF形式（.pdf）のファイルを選択してください。";
      status.classList.add("error");
      input.value = "";
      return;
    }

    input.disabled = true;
    status.textContent = "PDFを読み込んでいます…";
    try {
      const result = await extractPdfText(file, {
        onProgress(page, total) {
          if (currentRequest === requestId) status.textContent = `PDFを読み込んでいます… ${page} / ${total}ページ`;
        }
      });
      if (currentRequest !== requestId) return;
      fileName.textContent = result.fileName;
      pageCount.textContent = `${result.pageCount}ページ`;
      output.value = formatPdfExtractionResult(result);
      resultPanel.hidden = false;
      if (result.combinedText.replace(/\s/g, "").length < 5) {
        status.textContent = "このPDFから文字情報を抽出できませんでした。スキャン画像形式のPDFである可能性があります。";
        status.classList.add("warning");
      } else {
        status.textContent = "PDFから文字情報を抽出しました。";
        status.classList.add("success");
      }
    } catch (error) {
      if (currentRequest !== requestId) return;
      const passwordProtected = error?.name === "PasswordException" || /password/i.test(String(error?.message));
      status.textContent = passwordProtected
        ? "パスワードで保護されたPDFは読み込めません。保護を解除したPDFを選択してください。"
        : error?.message === "PDF_READER_UNAVAILABLE"
          ? "PDF読込機能を読み込めませんでした。通信環境を確認して、ページを再読み込みしてください。"
          : "PDFを読み込めませんでした。ファイルが破損していないか確認してください。";
      status.classList.add("error");
    } finally {
      if (currentRequest === requestId) input.disabled = false;
    }
  });
}

if (typeof window !== "undefined") {
  Object.assign(window, { extractPdfText, formatPdfExtractionResult });
  initializePdfImport();
}
if (typeof module !== "undefined") module.exports = { PDFJS_WORKER_URL, pdfTextItemsToText, extractPdfText, formatPdfExtractionResult };
