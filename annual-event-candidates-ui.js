"use strict";

/** Adapt the completed date-cell preview to the independent inference function.
 * The extractor publishes all restored cells in its table before revealing
 * #pdf-extraction-result. Observe that completion boundary once per import,
 * so changing the existing date-table month filter never discards candidates.
 * This adapter deliberately leaves pdf-text-extractor.js unchanged.
 */
function initializeAnnualEventCandidates() {
  const resultPanel = document.querySelector("#pdf-extraction-result");
  const calendarPanel = document.querySelector("#pdf-calendar-result");
  const calendarBody = document.querySelector("#pdf-calendar-body");
  const panel = document.querySelector("#annual-event-candidates");
  if (!resultPanel || !calendarPanel || !calendarBody || !panel) return;
  const monthSelect = document.querySelector("#candidate-month");
  const categorySelect = document.querySelector("#candidate-category");
  const message = document.querySelector("#candidate-message");
  const body = document.querySelector("#candidate-body");
  let candidates = [];
  let extractedCount = 0;

  monthSelect.replaceChildren(new Option("すべて", "all"),
    ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((month) => new Option(`${month}月`, String(month))));
  categorySelect.replaceChildren(new Option("すべて", "all"),
    ...["exam", "long_break", "holiday", "school_event", "other"]
      .map((category) => new Option(ANNUAL_EVENT_CATEGORIES[category], category)));

  const render = () => {
    const visible = candidates.filter((candidate) =>
      (monthSelect.value === "all" || candidatePeriodIncludesMonth(candidate, monthSelect.value))
      && (categorySelect.value === "all" || candidate.suggestedCategory === categorySelect.value));
    message.textContent = `統合前 ${extractedCount}件 → 期間候補 ${candidates.length}件（表示 ${visible.length}件）。`;
    const rows = visible.map((candidate) => {
      const row = document.createElement("tr");
      const date = document.createElement("th");
      date.scope = "row";
      date.textContent = formatCandidatePeriod(candidate);
      row.append(date);
      for (const text of [candidate.title, ANNUAL_EVENT_CATEGORIES[candidate.suggestedCategory],
        annualEventCandidateClassesLabel(candidate.suggestedRegularClassesAvailable),
        candidate.needsReview ? "要確認" : "—",
        [candidate.reason, candidate.reviewReason,
          candidate.duplicateWarning && !candidate.reason?.includes("国民の祝日一括追加機能")
            ? "国民の祝日一括追加機能と重複する可能性があります" : ""].filter(Boolean).join("。 ")]) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.append(cell);
      }
      if (candidate.needsReview) row.cells[4].classList.add("candidate-review");
      return row;
    });
    if (!rows.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = candidates.length ? "この条件に一致する候補はありません。" : "授業時数に関係する行事候補は見つかりませんでした。";
      row.append(cell);
      rows.push(row);
    }
    body.replaceChildren(...rows);
  };

  const syncCompletedImport = () => {
    candidates = [];
    extractedCount = 0;
    body.replaceChildren();
    message.textContent = "";
    panel.hidden = true;
    monthSelect.value = "all";
    categorySelect.value = "all";
    if (resultPanel.hidden || calendarPanel.hidden) return;
    // Copy exactly the date/text cell values; no keyword or coordinate parsing
    // belongs to this DOM adapter. Date cells use YYYY/MM/DD in the preview.
    const cells = Array.from(calendarBody.rows, (row) => {
      const date = row.cells[0].textContent.replaceAll("/", "-");
      return { date, month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)),
        text: row.cells[1].textContent };
    });
    // A restoration failure has no date rows. Hide the candidate section so
    // the existing calendar error remains the relevant feedback.
    if (!cells.length && document.querySelector("#pdf-calendar-month").hidden) return;
    const extracted = inferAnnualEventCandidates(cells);
    extractedCount = extracted.length;
    candidates = prepareAnnualEventCandidates(extracted);
    panel.hidden = false;
    render();
  };

  monthSelect.addEventListener("change", render);
  categorySelect.addEventListener("change", render);
  new MutationObserver(syncCompletedImport).observe(resultPanel, {
    attributes: true, attributeFilter: ["hidden"]
  });
  syncCompletedImport();
}

if (typeof window !== "undefined") initializeAnnualEventCandidates();
