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
    }));

  return clusterTextLines(positioned, 0.45)
    .map((line) => positionedLineText(line).text)
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

function clusterTextLines(items, toleranceRatio = 0.55) {
  const lines = [];
  [...items].sort((a, b) => b.y - a.y || a.x - b.x).forEach((item) => {
    const tolerance = Math.max(2, item.height * toleranceRatio);
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  });
  return lines.map((line) => ({ ...line, items: line.items.sort((a, b) => a.x - b.x) }));
}

/** Build the same readable line used by full-text extraction, retaining source ranges. */
function positionedLineText(line) {
  let text = "";
  const ranges = [];
  line.items.forEach((item, index) => {
    if (index) {
      const previous = line.items[index - 1];
      const gap = item.x - (previous.x + previous.width);
      const typicalCharacterWidth = previous.width / Math.max(previous.text.length, 1);
      if (gap > Math.max(1.5, typicalCharacterWidth * 0.35)) text += " ";
    }
    const start = text.length;
    text += item.text;
    ranges.push({ start, end: text.length, item });
  });
  return { text, ranges };
}

function findMonthHeaders(items, pageHeight) {
  const headerPattern = FISCAL_MONTHS.map((month) => `(${month}\\s*月)`).join("\\s*");
  const expression = new RegExp(headerPattern);
  let best = null;
  clusterTextLines(items, Math.max(0.55, (Number(pageHeight) || 0) / 5000)).forEach((line) => {
    const positionedLine = positionedLineText(line);
    const normalizedText = positionedLine.text.normalize("NFKC");
    const match = expression.exec(normalizedText);
    if (!match) return;
    let searchFrom = match.index;
    const headers = FISCAL_MONTHS.map((month, index) => {
      const label = match[index + 1];
      const start = normalizedText.indexOf(label, searchFrom);
      const end = start + label.length;
      searchFrom = end;
      const sourceRanges = positionedLine.ranges.filter((range) => range.end > start && range.start < end);
      const xValues = sourceRanges.map(({ start: itemStart, item }) => {
        const overlapStart = Math.max(start, itemStart) - itemStart;
        const overlapEnd = Math.min(end, itemStart + item.text.length) - itemStart;
        return item.x + item.width * (((overlapStart + overlapEnd) / 2) / Math.max(item.text.length, 1));
      });
      const x = median(xValues);
      return { text: label, month, x, y: median(line.items.map((item) => item.y)), width: 0,
        source: sourceRanges.length === 1 ? sourceRanges[0].item : null,
        sources: sourceRanges.map((range) => range.item) };
    });
    const candidate = { headers, text: FISCAL_MONTHS.map((month) => `${month}月`).join(" ") };
    if (!best || median(headers.map((header) => header.y)) > median(best.headers.map((header) => header.y))) best = candidate;
  });
  return best || { headers: [], text: "" };
}

function leadingDay(text) {
  const match = String(text ?? "").normalize("NFKC").trim().match(/^([1-9]|[12]\d|3[01])(?!\d)(?!\s*月)/);
  return match ? Number(match[1]) : null;
}

function findDayRows(items) {
  const candidates = clusterTextLines(items).map((line) => {
    const first = line.items[0];
    const leadingText = line.items.map((item) => item.text).join(" ");
    const day = leadingDay(leadingText);
    return day ? { day, y: median(line.items.map((item) => item.y)), sources: [first],
      leadingText } : null;
  }).filter(Boolean);
  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const matches = candidates.filter((item) => item.day === day);
    return matches.length ? { day, y: median(matches.map((item) => item.y)),
      sources: matches.flatMap((item) => item.sources), leadingText: matches[0].leadingText } : null;
  }).filter(Boolean);
}

/** Fill internal day-label gaps using the nearest recognized rows on both sides. */
function interpolateDayRows(recognizedRows) {
  // PDF coordinates descend as day numbers increase. Do not infer positions
  // from conflicting anchors, or extrapolate a missing first/last row.
  if (recognizedRows.some((row, index) => !Number.isFinite(row.y)
    || (index > 0 && row.y >= recognizedRows[index - 1].y))) return recognizedRows;
  const rows = [];
  recognizedRows.forEach((row, index) => {
    const previous = recognizedRows[index - 1];
    if (previous) {
      for (let day = previous.day + 1; day < row.day; day += 1) {
        const fraction = (day - previous.day) / (row.day - previous.day);
        rows.push({ day, y: previous.y + (row.y - previous.y) * fraction,
          sources: [], interpolated: true });
      }
    }
    rows.push(row);
  });
  return rows;
}

function splitPositionedItem(item) {
  const text = String(item.text ?? "");
  const tokens = [...text.matchAll(/\S+/g)];
  if (tokens.length < 2) return [item];
  return tokens.map((match) => ({ ...item, text: match[0],
    x: item.x + item.width * (match.index / text.length),
    width: item.width * (match[0].length / text.length), source: item }));
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
  const rawItems = Array.isArray(page?.items) ? page.items : [];
  // Whitespace-delimited pieces retain an estimated position inside a combined
  // PDF.js item. Standalone items are left untouched.
  const items = rawItems.flatMap(splitPositionedItem);
  const debug = {
    itemCount: rawItems.length,
    monthHeaderCandidates: [],
    monthHeaderLine: "",
    dayRowCandidates: clusterTextLines(items).map((line) => line.items.map((item) => item.text).join(" "))
      .filter((text) => leadingDay(text))
  };
  const recognizedHeader = findMonthHeaders(rawItems, page.height || 0);
  const monthHeaders = recognizedHeader.headers;
  debug.monthHeaderLine = recognizedHeader.text;
  debug.monthHeaderCandidates = recognizedHeader.text ? [recognizedHeader.text] : [];
  if (monthHeaders.length !== 12) return { ok: false, error: "月列を正しく認識できませんでした", monthHeaders, dayRows: [], cells: [], debug };
  const recognizedDayRows = findDayRows(items);
  const dayRows = interpolateDayRows(recognizedDayRows);
  debug.recognizedDayRowCount = recognizedDayRows.length;
  debug.interpolatedDayRows = dayRows.filter((row) => row.interpolated).map(({ day, y }) => ({ day, y }));
  if (dayRows.length !== 31) return {
    ok: false,
    error: "日付行を正しく認識できませんでした",
    monthHeaders: monthHeaders.map((item, index) => ({ month: FISCAL_MONTHS[index], x: centerX(item), y: item.y })),
    dayRows: dayRows.map(({ day, y }) => ({ day, y })),
    cells: [], debug
  };

  const monthBounds = makeBoundaries(monthHeaders.map(centerX));
  const rowsTopDown = [...dayRows].sort((a, b) => b.y - a.y);
  const rowBounds = makeBoundaries(rowsTopDown.map((row) => -row.y)).map((value) => -value);
  const excluded = new Set([...monthHeaders, ...monthHeaders.flatMap((header) => header.sources || [header.source]),
    ...dayRows.flatMap((row) => row.sources)]);
  const buckets = new Map();
  items.forEach((item) => {
    if (!item.text || excluded.has(item) || excluded.has(item.source)) return;
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
    monthBoundaries: monthBounds, dayRows: dayRows.map(({ day, y }) => ({ day, y })), cells, debug
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
      // PDF.js 3.11.174 has no disableCombineTextItems parameter. Its supported
      // options are includeMarkedContent and disableNormalization; explicitly
      // keep both disabled, then handle combined items geometrically below.
      const textContent = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
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
        return `${index + 1}ページ\n取得したtext item数: ${page.debug.itemCount}`
          + `\n月ヘッダー候補として検出した文字列: ${page.debug.monthHeaderCandidates.join(" | ") || "なし"}`
          + `\n月ヘッダー行: ${page.debug.monthHeaderLine || "認識なし"}`
          + `\n日付行候補として検出した先頭文字列: ${page.debug.dayRowCandidates.join(" | ") || "なし"}`
          + `\n認識月数: ${page.monthHeaders.length}\n認識日付行数: ${page.dayRows.length}`
          + `\n直接認識日付行数: ${page.debug.recognizedDayRowCount ?? 0}`
          + `\n補完日付行数: ${page.debug.interpolatedDayRows?.length ?? 0}`
          + `\n補完日付行: ${page.debug.interpolatedDayRows?.map((row) => `${row.day}日 y=${row.y.toFixed(1)}`).join(", ") || "なし"}`
          + `\n各月中心x:\n${months ? page.monthHeaders.map((header) => `${header.month}月 x=${header.x.toFixed(1)}`).join("\n") : "認識なし"}`
          + `\n日付行: ${days || "認識なし"}`;
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
