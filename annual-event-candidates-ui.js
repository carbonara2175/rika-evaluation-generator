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
  let importContext = null;
  let editingCandidate = null;
  const dialog = document.querySelector("#candidate-editor");
  const form = document.querySelector("#candidate-edit-form");
  const resultMessage = document.querySelector("#candidate-registration-result");
  const registerButton = document.querySelector("#register-candidates");
  const context = () => `${document.querySelector("#events-school").value}:${document.querySelector("#events-year").value}`;
  const visibleCandidates = () => candidates.filter(candidate =>
    (monthSelect.value === "all" || candidatePeriodIncludesMonth(candidate, monthSelect.value))
    && (categorySelect.value === "all" || candidate.category === categorySelect.value));
  const clearCandidates = () => {
    candidates = [];
    extractedCount = 0;
    importContext = null;
    editingCandidate = null;
    dialog.close();
    body.replaceChildren();
    panel.hidden = true;
    resultMessage.textContent = "";
  };

  monthSelect.replaceChildren(new Option("すべて", "all"),
    ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((month) => new Option(`${month}月`, String(month))));
  categorySelect.replaceChildren(new Option("すべて", "all"),
    ...["exam", "long_break", "holiday", "school_event", "other"]
      .map((category) => new Option(ANNUAL_EVENT_CATEGORIES[category], category)));

  const render = () => {
    const events = loadAnnualEvents();
    const visible = visibleCandidates();
    for (const candidate of candidates) {
      if (isRegisteredAnnualEventCandidate(candidate, events)) candidate.selected = false;
    }
    const selectedCount = candidates.filter(candidate => candidate.selected).length;
    message.textContent = `統合前 ${extractedCount}件 → 期間候補 ${candidates.length}件（表示 ${visible.length}件・選択 ${selectedCount}件）。`;
    registerButton.disabled = !selectedCount;
    const rows = visible.map((candidate) => {
      const row = document.createElement("tr");
      const registered = isRegisteredAnnualEventCandidate(candidate, events);
      const selection = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.setAttribute("aria-label", `「${candidate.title}」を登録する`);
      checkbox.checked = candidate.selected;
      checkbox.disabled = registered;
      checkbox.addEventListener("change", () => { candidate.selected = checkbox.checked; render(); });
      selection.append(checkbox);
      row.append(selection);
      const date = document.createElement("th");
      date.scope = "row";
      date.textContent = formatCandidatePeriod(candidate);
      row.append(date);
      for (const text of [candidate.title, ANNUAL_EVENT_CATEGORIES[candidate.category],
        annualEventCandidateClassesLabel(candidate.regularClassesAvailable),
        registered ? "登録済み" : candidate.needsReview ? (candidate.reviewConfirmed ? "確認済み（原文は要確認）" : "要確認") : "—",
        [candidate.reason, candidate.reviewReason,
          candidate.duplicateWarning && !candidate.reason?.includes("国民の祝日一括追加機能")
            ? "国民の祝日一括追加機能と重複する可能性があります" : ""].filter(Boolean).join("。 ")]) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.append(cell);
      }
      if (candidate.needsReview) row.cells[5].classList.add("candidate-review");
      const actions = document.createElement("td");
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "編集";
      edit.disabled = registered;
      edit.addEventListener("click", () => {
        editingCandidate = candidate;
        for (const key of ["startDate", "endDate", "title", "category"]) form.elements.namedItem(key).value = candidate[key] ?? "";
        form.elements.namedItem("regularClassesAvailable").value = String(candidate.regularClassesAvailable);
        document.querySelector("#candidate-editor-source").textContent = candidate.sourceTexts.join("\n");
        document.querySelector("#candidate-editor-reason").textContent = candidate.reviewReason || "内容を確認してください。";
        dialog.showModal();
      });
      const sources = document.createElement("details");
      const summary = document.createElement("summary"); summary.textContent = "PDF原文";
      const original = document.createElement("p"); original.textContent = candidate.sourceDates.map((date, i) => `${date}: ${candidate.sourceTexts[i]}`).join("\n");
      sources.append(summary, original);
      actions.append(edit, sources);
      row.append(actions);
      if (candidate.errors.length) {
        const error = document.createElement("p");
        error.className = "candidate-error";
        error.setAttribute("role", "alert");
        error.textContent = candidate.errors.join("。 ");
        actions.append(error);
      }
      return row;
    });
    if (!rows.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 8;
      cell.textContent = candidates.length ? "この条件に一致する候補はありません。" : "授業時数に関係する行事候補は見つかりませんでした。";
      row.append(cell);
      rows.push(row);
    }
    body.replaceChildren(...rows);
  };

  const syncCompletedImport = () => {
    clearCandidates();
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
    candidates = prepareAnnualEventCandidates(extracted).map(createAnnualEventCandidateDraft);
    importContext = context();
    panel.hidden = false;
    render();
  };

  form.elements.namedItem("category").replaceChildren(...Object.entries(ANNUAL_EVENT_CATEGORIES).map(([id, name]) => new Option(name, id)));
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!editingCandidate) return;
    const changes = Object.fromEntries(new FormData(form));
    changes.regularClassesAvailable = changes.regularClassesAvailable === "true" ? true
      : changes.regularClassesAvailable === "false" ? false : null;
    Object.assign(editingCandidate, editAnnualEventCandidateDraft(editingCandidate, changes));
    editingCandidate.errors = validateAnnualEventCandidateDraft(editingCandidate);
    dialog.close();
    editingCandidate = null;
    render();
  });
  document.querySelector("#candidate-edit-cancel").addEventListener("click", () => dialog.close());
  for (const [id, mode] of [["select-safe-candidates", "safe"], ["select-visible-candidates", "visible"], ["deselect-candidates", "clear"]]) {
    document.querySelector(`#${id}`).addEventListener("click", () => {
      selectAnnualEventCandidateDrafts(candidates, mode, visibleCandidates(), loadAnnualEvents());
      render();
    });
  }
  document.querySelector("#clear-candidates").addEventListener("click", clearCandidates);
  registerButton.addEventListener("click", () => {
    if (importContext !== context()) { clearCandidates(); return; }
    const count = candidates.filter(candidate => candidate.selected).length;
    if (!count || !window.confirm(`選択した${count}件を年間行事へ登録します。\nよろしいですか？`)) return;
    const result = registerAnnualEventCandidateDrafts(candidates, loadAnnualEvents(), annualEventId);
    if (result.addedCount && !saveAnnualEvents(result.events)) {
      resultMessage.textContent = "保存できませんでした。ブラウザの保存設定や空き容量を確認して、もう一度登録してください。";
      return;
    }
    renderAnnualEvents();
    renderExamRanges();
    resultMessage.textContent = `${result.addedCount}件登録しました。${result.skippedCount}件は登録済みのためスキップしました。${result.invalidCount}件は要確認・入力不足のため登録しませんでした。`;
    render();
  });
  document.addEventListener("annual-events-changed", () => {
    if (importContext && importContext !== context()) clearCandidates();
    else if (importContext) render();
  });
  monthSelect.addEventListener("change", render);
  categorySelect.addEventListener("change", render);
  new MutationObserver(syncCompletedImport).observe(resultPanel, {
    attributes: true, attributeFilter: ["hidden"]
  });
  syncCompletedImport();
}

if (typeof window !== "undefined") initializeAnnualEventCandidates();
