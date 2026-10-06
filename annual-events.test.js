"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  annualEventsStorageKey, normalizeAnnualEvent, annualEventDisplayTitle,
  sortAnnualEvents, formatEventDateRange, calculateMonthlyAvailableSchoolDays,
  inferAnnualEventCandidates, annualEventCandidateClassesLabel
} = require("./annual-events");

test("storage keys completely separate schools and years", () => {
  assert.equal(annualEventsStorageKey("sanno", 2027), "rika-annual-events-v1:sanno:2027");
  assert.notEqual(annualEventsStorageKey("sanno", 2027), annualEventsStorageKey("santo", 2027));
  assert.notEqual(annualEventsStorageKey("sanno", 2027), annualEventsStorageKey("sanno", 2028));
});

const candidateCell = (text, date = "2026-04-07") => ({
  date, month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)), text
});

test("candidate rules classify requested keywords and leave school events and changes for review", () => {
  const groups = [
    ["exam", false, "high", ["中間考査", "期末考査", "学年末考査", "定期考査", "考査"]],
    ["long_break", false, "high", ["夏季休業", "冬季休業", "春季休業", "学年始休業", "学年末休業", "年度末休業", "年末年始休"]],
    ["holiday", false, "high", ["振替休日", "振替", "休日", "休業日", "閉庁日"]],
    ["school_event", null, "medium", ["入学式", "始業式", "終業式", "卒業式", "修了式", "離任式",
      "体育祭", "文化祭", "三高祭", "球技大会", "遠足", "修学旅行", "開校記念日", "高校総体", "高総体", "式場準備"]],
    ["other", null, "medium", ["午前授業", "午後授業", "月の授業", "火曜日の授業", "水曜の授業", "HR活動",
      "採点日", "入学者選抜", "追検査", "再募集検査", "高教研", "教員研修", "振替授業"]]
  ];
  for (const [category, available, confidence, titles] of groups) {
    for (const title of titles) {
      const [candidate] = inferAnnualEventCandidates([candidateCell(title)]);
      assert.ok(candidate, title);
      assert.equal(candidate.suggestedCategory, category, title);
      assert.equal(candidate.suggestedRegularClassesAvailable, available, title);
      assert.equal(candidate.confidence, confidence, title);
      assert.equal(candidate.sourceText, title);
      assert.match(candidate.reason, /を検出/);
    }
  }
});

test("splits separate events while preserving middle dots, punctuation and period source text", () => {
  const text = "新任式・式場準備\r\n入学式\n\n夏季休業～8/23\n考査週間～13日";
  const candidates = inferAnnualEventCandidates([candidateCell(text)]);
  assert.deepEqual(candidates.map(({ title }) => title), ["新任式・式場準備", "入学式", "夏季休業～8/23"]);
  assert.equal(candidates[2].sourceText, "夏季休業～8/23");
  assert.equal(Object.hasOwn(candidates[2], "endDate"), false);
  assert.deepEqual(inferAnnualEventCandidates([candidateCell("夏季休業\n～8/23")])[0].sourceText, "夏季休業\n～8/23");
  assert.equal(inferAnnualEventCandidates([candidateCell("入学\n式")])[0].title, "入学式");
  assert.equal(inferAnnualEventCandidates([candidateCell("学年末\n考査")])[0].title, "学年末考査");
  assert.equal(inferAnnualEventCandidates([candidateCell("体育祭（雨天時：翌日）")])[0].title, "体育祭（雨天時：翌日）");
});

test("exam preparation and low-impact events are excluded, including exclusion keywords with holiday text", () => {
  const texts = ["考査週間～13日", "期末考査週間", "学年末考査週間", "考査\n週間～13日", "考査範囲発表", "考査時間割発表",
    "放課後の委員会", "PTA会議", "PTA専門委員会", "部活動集会", "健康診断", "検診",
    "各種検定試験", "進路相談会", "模試", "講習", "休日講習"];
  assert.deepEqual(inferAnnualEventCandidates(texts.map((text) => candidateCell(text))), []);
  assert.equal(inferAnnualEventCandidates([candidateCell("期末考査採点日")])[0].suggestedCategory, "other");
  assert.equal(inferAnnualEventCandidates([candidateCell("考査週間～13日・期末考査")])[0].suggestedCategory, "exam");
  assert.deepEqual(inferAnnualEventCandidates([candidateCell("健康診断\n午前授業")]).map(({ title }) => title), ["午前授業"]);
});

test("all national holiday names carry a duplicate warning", () => {
  const names = ["昭和の日", "憲法記念日", "みどりの日", "こどもの日", "海の日", "山の日",
    "敬老の日", "秋分の日", "スポーツの日", "文化の日", "勤労感謝の日", "元日", "成人の日",
    "建国記念の日", "天皇誕生日", "春分の日"];
  const candidates = inferAnnualEventCandidates(names.map((name) => candidateCell(name)));
  assert.equal(candidates.length, 16);
  for (const candidate of candidates) {
    assert.equal(candidate.suggestedCategory, "holiday");
    assert.equal(candidate.suggestedRegularClassesAvailable, false);
    assert.match(candidate.reason, /国民の祝日一括追加機能と重複する可能性があります/);
  }
  const [abbreviated] = inferAnnualEventCandidates([candidateCell("建国記念日")]);
  assert.equal(abbreviated.suggestedCategory, "holiday");
  assert.match(abbreviated.reason, /重複する可能性があります/);
});

test("deduplicates only same-day titles, sorts across fiscal years, and never changes cells or storage", () => {
  const cells = [
    candidateCell("期末考査\n終業式", "2026-07-20"),
    candidateCell("期末考査", "2026-07-20"),
    candidateCell("期末考査", "2026-07-21"),
    candidateCell("ＨＲ活動", "2027-01-08"),
    candidateCell("HR 活動", "2027-01-08"),
    candidateCell("入学式")
  ];
  const before = structuredClone(cells);
  for (const cell of cells) Object.freeze(cell);
  Object.freeze(cells);
  const previousStorage = global.localStorage;
  global.localStorage = { setItem() { assert.fail("candidate inference must not write to storage"); } };
  try {
    const candidates = inferAnnualEventCandidates(cells);
    assert.equal(candidates.length, 5);
    assert.deepEqual(candidates.map(({ date }) => date), ["2026-04-07", "2026-07-20", "2026-07-20", "2026-07-21", "2027-01-08"]);
    assert.deepEqual(cells, before);
  } finally {
    if (previousStorage === undefined) delete global.localStorage;
    else global.localStorage = previousStorage;
  }
});

test("invalid cells are ignored and availability has human-readable labels", () => {
  assert.deepEqual(inferAnnualEventCandidates(null), []);
  assert.deepEqual(inferAnnualEventCandidates([null, {}, candidateCell("入学式", "2026-02-30"),
    candidateCell("入学式", "2026/04/07"), candidateCell("入学式", "invalid"), candidateCell("")]), []);
  assert.equal(annualEventCandidateClassesLabel(false), "実施できない");
  assert.equal(annualEventCandidateClassesLabel(true), "実施できる");
  assert.equal(annualEventCandidateClassesLabel(null), "要確認");
});

test("monthly available days count weekdays and exclude overlapping unavailable events once", () => {
  const result = calculateMonthlyAvailableSchoolDays(2026, [
    { startDate: "2026-07-20", category: "holiday", regularClassesAvailable: false },
    { startDate: "2026-07-20", endDate: "2026-08-23", category: "long_break", regularClassesAvailable: false },
    { startDate: "2026-07-21", category: "school_event", regularClassesAvailable: true },
    { startDate: "2027-03-01", category: "exam", regularClassesAvailable: false }
  ]);

  assert.deepEqual(result.details[3], { weekdays: 23, excluded: 10, available: 13 });
  assert.deepEqual(result.details[4], { weekdays: 21, excluded: 15, available: 6 });
  assert.deepEqual(result.details[11], { weekdays: 23, excluded: 1, available: 22 });
  assert.equal(result.excludedDates.has("2026-07-20"), true);
});

test("events outside the school year are clipped and weekends never count", () => {
  const result = calculateMonthlyAvailableSchoolDays(2026, [
    { startDate: "2026-03-01", endDate: "2026-04-05", regularClassesAvailable: false },
    { startDate: "2027-03-31", endDate: "2027-04-10", regularClassesAvailable: false }
  ]);
  assert.deepEqual(result.details[0], { weekdays: 22, excluded: 3, available: 19 });
  assert.deepEqual(result.details[11], { weekdays: 23, excluded: 1, available: 22 });
});

test("an omitted end date becomes a one-day event", () => {
  const event = normalizeAnnualEvent({ id: "1", startDate: "2027-05-18", title: "考査", category: "exam" });
  assert.equal(event.endDate, "2027-05-18");
  assert.equal(event.regularClassesAvailable, false);
});

test("an omitted title is preserved and displayed using its category", () => {
  const event = normalizeAnnualEvent({ startDate: "2027-05-18", title: "", category: "exam" });
  assert.equal(event.title, "");
  assert.equal(annualEventDisplayTitle(event), "考査");
  assert.equal(annualEventDisplayTitle({ title: "体育祭", category: "school_event" }), "体育祭");
});

test("events are sorted by their start date", () => {
  const events = sortAnnualEvents([
    { id: "2", startDate: "2027-08-23", title: "始業式", category: "school_event" },
    { id: "1", startDate: "2027-07-22", endDate: "2027-08-22", title: "夏季休業", category: "long_break" }
  ]);
  assert.deepEqual(events.map(({ id }) => id), ["1", "2"]);
  assert.equal(formatEventDateRange(events[0].startDate, events[0].endDate), "7/22 ～ 8/22");
});
