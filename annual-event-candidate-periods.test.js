"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { inferAnnualEventCandidates } = require("./annual-events");
const { prepareAnnualEventCandidates, formatCandidatePeriod, candidatePeriodIncludesMonth } = require("./annual-event-candidate-periods");

test("uploaded Sannohe R8 PDF cells retain all 99 sources in 67 periods and the five requested examples", () => {
  // Actual cells captured via unchanged extractPdfText/restoreAnnualCalendar,
  // using PDF.js 3.11.174. This fixture checks extraction-rule/post-process
  // integration; the PDF binary itself is not included in the repository.
  const { cells } = require("./test-fixtures/sannohe-r8-calendar-cells.json");
  const extracted = inferAnnualEventCandidates(cells);
  const periods = prepareAnnualEventCandidates(extracted);
  assert.equal(cells.length, 185);
  assert.equal(extracted.length, 99);
  assert.equal(periods.length, 67);
  assert.equal(periods.filter(p => p.needsReview).length, 38);
  assert.deepEqual(periods.flatMap(p => p.sourceCandidates).sort((a, b) =>
    a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
  [...extracted].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)));
  for (const [title, start, end, count] of [
    ["期末考査", "2026-06-18", "2026-06-23", 4],
    ["学年末考査", "2027-02-15", "2027-02-18", 4],
    ["年末年始休", "2026-12-29", "2027-01-03", 6],
    ["夏季休業～ 8/23", "2026-07-24", "2026-08-23", 1],
    ["夏季休業～ 1/10", "2026-12-23", "2027-01-10", 1]
  ]) {
    const matching = periods.filter(p => p.title === title && p.startDate === start);
    assert.equal(matching.length, 1, title);
    const [period] = matching;
    assert.equal(period.endDate, end, title);
    assert.equal(period.sourceDates.length, count, title);
    assert.equal(period.sourceText, title, title);
    assert.equal(period.needsReview, start === "2026-12-23", title);
    if (period.needsReview) assert.match(period.reviewReason, /季節名と開始時期/);
  }
  for (const title of ["午前授業～ 18", "教員研修週間～ 18"]) {
    const matching = periods.filter(p => p.title === title && p.startDate === "2026-09-14");
    assert.equal(matching.length, 1, title);
    assert.equal(matching[0].endDate, "2026-09-18", title);
    assert.equal(formatCandidatePeriod(matching[0]), "2026/09/14 ～ 2026/09/18", title);
    assert.doesNotMatch(matching[0].reviewReason, /終了日/, title);
  }
});

const raw = (date, title = "期末考査", category = "exam", available = false) => ({
  date, title, sourceText: title, suggestedCategory: category,
  suggestedRegularClassesAvailable: available, confidence: "high", reason: "検出理由"
});
const prepare = (dates, title, category) => prepareAnnualEventCandidates(dates.map((date) => raw(date, title, category)));

test("single dates and consecutive observed dates become one range in chronological order", () => {
  const [single] = prepare(["2026-04-07"]);
  assert.equal(single.startDate, single.endDate);
  assert.equal(formatCandidatePeriod(single), "2026/04/07");
  const [period] = prepare(["2026-11-13", "2026-11-10", "2026-11-12", "2026-11-11"]);
  assert.equal(period.startDate, "2026-11-10");
  assert.equal(period.endDate, "2026-11-13");
  assert.equal(period.needsReview, false);
  assert.equal(formatCandidatePeriod(period), "2026/11/10 ～ 2026/11/13");
});

test("Sannohe final exams bridge only missing Saturday and Sunday", () => {
  const dates = ["2026-06-18", "2026-06-19", "2026-06-22", "2026-06-23"];
  const periods = prepare(dates);
  assert.equal(periods.length, 1);
  assert.equal(periods[0].endDate, "2026-06-23");
  assert.deepEqual(periods[0].sourceDates, dates);
});

test("known holidays bridge gaps but missing ordinary weekdays never do", () => {
  assert.equal(prepare(["2026-10-09", "2026-10-13"]).length, 1); // Sports Day
  assert.equal(prepare(["2026-06-19", "2026-06-23"]).length, 2); // Monday missing
  assert.equal(prepare(["2026-06-16", "2026-06-18"]).length, 2); // Wednesday missing
  assert.equal(prepare(["2028-10-06", "2028-10-10"]).length, 2); // Uncollected holiday year
  const rows = [raw("2026-06-16"), raw("2026-06-18")];
  assert.equal(prepareAnnualEventCandidates(rows, { holidayDates: ["2026-06-17"] }).length, 1);
});

test("ranges merge across months and years", () => {
  const [monthly] = prepare(["2026-04-30", "2026-05-01"]);
  assert.equal(monthly.endDate, "2026-05-01");
  const [yearly] = prepare(["2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"], "年末年始休", "long_break");
  assert.equal(yearly.startDate, "2026-12-29");
  assert.equal(yearly.endDate, "2027-01-03");
  assert.equal(candidatePeriodIncludesMonth(yearly, 12), true);
  assert.equal(candidatePeriodIncludesMonth(yearly, 1), true);
  assert.equal(candidatePeriodIncludesMonth(yearly, 2), false);
  const [exam] = prepare(["2027-02-15", "2027-02-16", "2027-02-17", "2027-02-18"], "学年末考査");
  assert.equal(exam.endDate, "2027-02-18");
});

test("explicit month/day endings support wave variants, width, wrapped source and next year", () => {
  for (const marker of ["～", "〜", "~"]) {
    const [summer] = prepare(["2026-07-24"], `夏季休業${marker}8/23`, "long_break");
    assert.equal(summer.endDate, "2026-08-23");
    assert.equal(summer.needsReview, false);
    assert.equal(candidatePeriodIncludesMonth(summer, 8), true);
    const [winter] = prepare(["2026-12-23"], `冬季休業${marker}1/10`, "long_break");
    assert.equal(winter.endDate, "2027-01-10");
  }
  const source = raw("2026-07-24", "夏季休業", "long_break");
  source.sourceText = "夏季休業\n～８／２３";
  const [wrapped] = prepareAnnualEventCandidates([source]);
  assert.equal(wrapped.endDate, "2026-08-23");
  assert.equal(wrapped.sourceText, source.sourceText);
  assert.equal(wrapped.title, "夏季休業");
});

test("omitted months are inferred only when valid and not before the start", () => {
  const [valid] = prepare(["2026-11-03"], "考査週間～13日");
  assert.equal(valid.endDate, "2026-11-13");
  assert.equal(valid.needsReview, false);
  for (const title of ["期末考査～13日", "期末考査～31日", "期末考査～来月", "期末考査～", "期末考査～13日頃", "期末考査～13日間"]) {
    const [ambiguous] = prepare(["2026-06-18"], title);
    assert.equal(ambiguous.endDate, null, title);
    assert.equal(ambiguous.needsReview, true, title);
    assert.match(ambiguous.reviewReason, /終了日/);
    assert.match(formatCandidatePeriod(ambiguous), /終了日要確認/);
  }
});

test("bare end days support wave variants and infer the same month from source text", () => {
  for (const title of ["午前授業", "教員研修週間"]) {
    for (const marker of ["～", "〜", "~"]) {
      const [period] = prepareAnnualEventCandidates([
        { ...raw("2026-09-14", title), sourceText: `${title}${marker}18` }
      ]);
      assert.equal(period.endDate, "2026-09-18");
      assert.equal(period.needsReview, false);
      assert.equal(formatCandidatePeriod(period), "2026/09/14 ～ 2026/09/18");
    }
  }
  for (const [start, ending, end] of [
    ["2026-09-01", "9", "2026-09-09"],
    ["2026-09-14", "14", "2026-09-14"],
    ["2026-09-14", "１８", "2026-09-18"],
    ["2026-09-14", "18 ）", "2026-09-18"],
    ["2028-02-01", "29", "2028-02-29"]
  ]) assert.equal(prepare([start], `午前授業～${ending}`)[0].endDate, end);
});

test("invalid or non-date bare endings stay null and require review", () => {
  for (const [start, ending] of [
    ...["32", "0", "10", "31", "180", "018", "18:00", "18 :00", "18：00",
      "18日間", "18 日間", "18回", "18 回", "18時間", "18/20", "18.5", "18頃"]
      .map(ending => ["2026-09-14", ending]),
    ["2027-02-01", "29"], ["2026-12-23", "10"]
  ]) {
    const [period] = prepare([start], `午前授業～${ending}`);
    assert.equal(period.endDate, null, ending);
    assert.equal(period.needsReview, true, ending);
    assert.match(formatCandidatePeriod(period), /終了日要確認/, ending);
  }
  for (const ending of ["18:00", "18日間", "18回"]) {
    // Without a range marker these remain single-day candidates.
    assert.equal(prepare(["2026-09-14"], `午前授業 ${ending}`)[0].endDate, "2026-09-14");
  }
});

test("invalid dates and conflicting expressions remain review candidates", () => {
  for (const title of ["期末考査～2/30", "期末考査～13/1", "期末考査～8/234", "期末考査～8/23/24", "期末考査～8/23日頃", "期末考査～8/23（予定）", "期末考査～8/23～8/24"]) {
    const [period] = prepare(["2026-06-18"], title);
    assert.equal(period.needsReview, true, title);
    assert.equal(period.endDate, null, title);
  }
  const [valid] = prepare(["2028-02-01"], "期末考査～2/29");
  assert.equal(valid.endDate, "2028-02-29");
  assert.equal(prepare(["2027-12-23"], "冬季休業～2/29", "long_break")[0].endDate, "2028-02-29");
  assert.equal(prepare(["2027-02-01"], "期末考査～2/29")[0].endDate, null);
  const [conflict] = prepareAnnualEventCandidates([
    { ...raw("2026-06-18", "期末考査"), sourceText: "期末考査～6/20" },
    { ...raw("2026-06-19", "期末考査"), sourceText: "期末考査～6/21" }
  ]);
  assert.match(conflict.reviewReason, /一致しない/);
});

test("inferred endings cannot silently omit later observed dates or bridge ordinary weekdays", () => {
  const [conflict] = prepare(["2026-06-18", "2026-06-19", "2026-06-22"], "期末考査～6/19");
  assert.equal(conflict.endDate, null);
  assert.match(conflict.reviewReason, /後にも/);
  assert.equal(candidatePeriodIncludesMonth(conflict, 6), true);
  assert.equal(prepare(["2026-06-18", "2026-06-23"], "期末考査～6/23").length, 2);
});

test("unusual seasonal wording is retained and marked for review", () => {
  const [period] = prepare(["2026-12-23"], "夏季休業～1/10", "long_break");
  assert.equal(period.endDate, "2027-01-10");
  assert.equal(period.title, "夏季休業～1/10");
  assert.equal(period.sourceText, "夏季休業～1/10");
  assert.equal(period.needsReview, true);
  assert.match(period.reviewReason, /季節名と開始時期/);
});

test("unknown class availability and all school events have explicit review reasons", () => {
  const [unknown] = prepareAnnualEventCandidates([raw("2026-04-07", "午前授業", "other", null)]);
  assert.match(unknown.reviewReason, /通常授業可否/);
  const [school] = prepareAnnualEventCandidates([raw("2026-04-07", "入学式", "school_event", false)]);
  assert.match(school.reviewReason, /学年・科目/);
  const [conflict] = prepareAnnualEventCandidates([raw("2026-06-18"), raw("2026-06-19", "期末考査", "exam", true)]);
  assert.equal(conflict.suggestedRegularClassesAvailable, null);
  assert.equal(conflict.needsReview, true);
});

test("source arrays and original metadata survive merging without mutation or aliasing", () => {
  const input = [raw("2026-06-18"), { ...raw("2026-06-19"), needsReview: true, reviewReason: "原文確認", metadata: { page: 1 } }];
  const before = structuredClone(input);
  const [period] = prepareAnnualEventCandidates(input);
  assert.deepEqual(period.sourceTexts, ["期末考査", "期末考査"]);
  assert.deepEqual(period.sourceCandidates, before);
  assert.match(period.reviewReason, /原文確認/);
  period.sourceCandidates[1].metadata.page = 2;
  assert.deepEqual(input, before);
});

test("different titles and categories do not merge; interleaved events do not prevent valid merging", () => {
  const periods = prepareAnnualEventCandidates([raw("2026-06-18"), raw("2026-06-19", "中間考査"), raw("2026-06-19"), raw("2026-06-19", "期末考査", "other")]);
  assert.equal(periods.length, 3);
  assert.equal(periods.find((p) => p.title === "期末考査" && p.suggestedCategory === "exam").sourceDates.length, 2);
});

test("holidays retain potential duplication warning and post-processing does not access localStorage", () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("must not access storage"); } });
  try {
    const candidates = inferAnnualEventCandidates([{ date: "2026-11-03", text: "文化の日" }]);
    const [period] = prepareAnnualEventCandidates(candidates);
    assert.equal(period.duplicateWarning, true);
    assert.equal(period.sourceText, "文化の日");
    assert.deepEqual(prepareAnnualEventCandidates(null), []);
  } finally { delete globalThis.localStorage; }
});
