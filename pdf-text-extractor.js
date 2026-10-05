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

const FISCAL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

const normalizeCalendarToken = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, "").trim();

function normalizePdfItem(item, pageNumber) {
  return {
    text: typeof item?.str === "string" ? item.str.trim() : "",
    x: Number(item?.transform?.[4]) || 0,
    y: Number(item?.transform?.[5]) || 0,
    width: Math.max(0, Number(item?.width) || 0),
    height: Math.max(1, Math.abs(Number(item?.height) || Number(item?.transform?.[3]) || 10)),
    pageNumber
  };
}

const centerX = (item) => item.x + item.width / 2;
const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function findMonthHeaders(items, pageHeight) {
  // NFKC normalization is deliberately limited to recognizing table labels. The
  // original item text is retained for the cell output.
  const candidates = items.filter((item) => /^(?:[1-9]|1[0-2])月$/.test(normalizeCalendarToken(item.text)));
  let best = [];
  candidates.forEach((anchor) => {
    const tolerance = Math.max(4, anchor.height * 1.5, pageHeight * 0.012);
    const band = candidates.filter((item) => Math.abs(item.y - anchor.y) <= tolerance);
    const headers = FISCAL_MONTHS.map((month) => {
      const matches = band.filter((item) => normalizeCalendarToken(item.text) === `${month}月`);
      return matches.sort((a, b) => Math.abs(a.y - anchor.y) - Math.abs(b.y - anchor.y))[0];
    });
    if (headers.every(Boolean) && headers.every((item, index) => !index || centerX(item) > centerX(headers[index - 1]))) {
      if (!best.length || median(headers.map((item) => item.y)) > median(best.map((item) => item.y))) best = headers;
    }
  });
  return best;
}

function findDayRows(items, pageWidth) {
  const candidates = items.filter((item) => {
    if (!/^(?:[1-9]|[12]\d|3[01])$/.test(normalizeCalendarToken(item.text))) return false;
    const x = centerX(item);
    return x <= pageWidth * 0.15 || x >= pageWidth * 0.85;
  });
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const matches = candidates.filter((item) => Number(normalizeCalendarToken(item.text)) === day);
    return matches.length ? { day, y: median(matches.map((item) => item.y)), sources: matches } : null;
  }).filter(Boolean);
}

function makeBoundaries(positions) {
  if (positions.length < 2) return [];
  const boundaries = positions.slice(0, -1).map((value, index) => (value + positions[index + 1]) / 2);
  return [positions[0] - (boundaries[0] - positions[0]), ...boundaries,
    positions.at(-1) + (positions.at(-1) - boundaries.at(-1))];
}

function joinCellItems(items) {
  // Weekday/status columns are table metadata rather than event text. Since the
  // decision is made on each positioned item (not combinedText), event names
  // containing these characters remain untouched.
  const structuralToken = /^[月火水木金土日・□■△▲○●◎◇◆]+$/;
  const ordered = items.filter((item) => !structuralToken.test(normalizeCalendarToken(item.text)))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  ordered.forEach((item) => {
    const tolerance = Math.max(1.5, item.height * 0.4);
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  });
  return lines.sort((a, b) => b.y - a.y).map((line) => line.items.sort((a, b) => a.x - b.x)
    .map((item) => item.text).join(" ")).join("\n");
}

/** Restore a 12-month by 31-day calendar from positioned PDF text. */
function restoreAnnualCalendar(page, fiscalYear) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const monthHeaders = findMonthHeaders(items, page.height || 0);
  if (monthHeaders.length !== 12) return { ok: false, error: "月列を正しく認識できませんでした", monthHeaders, dayRows: [], cells: [] };
  const dayRows = findDayRows(items, page.width || 0);
  if (dayRows.length !== 31) return {
    ok: false,
    error: "日付行を正しく認識できませんでした",
    monthHeaders: monthHeaders.map((item, index) => ({ month: FISCAL_MONTHS[index], x: centerX(item), y: item.y })),
    dayRows: dayRows.map(({ day, y }) => ({ day, y })),
    cells: []
  };

  const monthBounds = makeBoundaries(monthHeaders.map(centerX));
  const rowsTopDown = [...dayRows].sort((a, b) => b.y - a.y);
  const rowBounds = makeBoundaries(rowsTopDown.map((row) => -row.y)).map((value) => -value);
  const excluded = new Set([...monthHeaders, ...dayRows.flatMap((row) => row.sources)]);
  const buckets = new Map();
  items.forEach((item) => {
    if (!item.text || excluded.has(item)) return;
    const x = centerX(item);
    const monthIndex = monthBounds.findIndex((right, index) => index < 12 && x >= monthBounds[index] && x < monthBounds[index + 1]);
    if (monthIndex < 0) return;
    const rowIndex = rowsTopDown.findIndex((row, index) => item.y <= rowBounds[index] && item.y > rowBounds[index + 1]);
    if (rowIndex < 0) return;
    const key = `${monthIndex}:${rowsTopDown[rowIndex].day}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  });

  const cells = [];
  buckets.forEach((cellItems, key) => {
    const [monthIndex, day] = key.split(":").map(Number);
    const month = FISCAL_MONTHS[monthIndex];
    const year = month >= 4 ? Number(fiscalYear) : Number(fiscalYear) + 1;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1) return;
    const text = joinCellItems(cellItems);
    if (!text) return;
    cells.push({ date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, month, day, text, items: cellItems });
  });
  cells.sort((a, b) => a.date.localeCompare(b.date));
  return {
    ok: true, monthHeaders: monthHeaders.map((item, index) => ({ month: FISCAL_MONTHS[index], x: centerX(item), y: item.y })),
    monthBoundaries: monthBounds, dayRows: dayRows.map(({ day, y }) => ({ day, y })), cells
  };
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
      const viewport = page.getViewport?.({ scale: 1 }) || {};
      const items = textContent.items.map((item) => normalizePdfItem(item, pageNumber)).filter((item) => item.text);
      pages.push({ pageNumber, width: Number(viewport.width) || 0, height: Number(viewport.height) || 0,
        text: pdfTextItemsToText(textContent.items), items });
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
  const calendarPanel = document.querySelector("#pdf-calendar-result");
  const calendarMessage = document.querySelector("#pdf-calendar-message");
  const monthSelect = document.querySelector("#pdf-calendar-month");
  const calendarBody = document.querySelector("#pdf-calendar-body");
  const debugOutput = document.querySelector("#pdf-calendar-debug");
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
    calendarPanel.hidden = true;
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
      const fiscalYear = Number(document.querySelector("#events-year")?.value) || new Date().getFullYear();
      const restored = result.pages.map((page) => restoreAnnualCalendar(page, fiscalYear));
      const successful = restored.filter((page) => page.ok);
      calendarPanel.hidden = false;
      if (!successful.length) {
        calendarMessage.textContent = restored.map((page, index) => `${index + 1}ページ: ${page.error}`).join(" / ");
        monthSelect.hidden = true;
        calendarBody.replaceChildren();
      } else {
        const cells = successful.flatMap((page) => page.cells);
        calendarMessage.textContent = `12か月・31日の日付行を認識しました（内容のあるセル: ${cells.length}件）。確認用のため年間行事には登録されません。`;
        monthSelect.hidden = false;
        monthSelect.replaceChildren(new Option("すべて", "all"),
          ...FISCAL_MONTHS.map((month) => new Option(`${month}月`, String(month))));
        const render = () => {
          const visible = monthSelect.value === "all"
            ? cells
            : cells.filter((cell) => cell.month === Number(monthSelect.value));
          calendarBody.replaceChildren(...visible.map((cell) => {
            const row = document.createElement("tr");
            const date = document.createElement("th"); date.scope = "row"; date.textContent = cell.date.replaceAll("-", "/");
            const content = document.createElement("td"); content.textContent = cell.text;
            row.append(date, content); return row;
          }));
        };
        monthSelect.onchange = render;
        render();
      }
      debugOutput.textContent = restored.map((page, index) => {
        const months = page.monthHeaders.map((header) => `${header.month}月 x=${header.x.toFixed(1)}`).join(", ");
        const days = page.dayRows.map((row) => `${row.day}日 y=${row.y.toFixed(1)}`).join(", ");
        return `${index + 1}ページ\n月列: ${months || "認識なし"}\n日付行: ${days || "認識なし"}`;
      }).join("\n\n");
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
  Object.assign(window, { extractPdfText, formatPdfExtractionResult, restoreAnnualCalendar });
  initializePdfImport();
}
if (typeof module !== "undefined") module.exports = { PDFJS_WORKER_URL, pdfTextItemsToText, extractPdfText, formatPdfExtractionResult, restoreAnnualCalendar };
