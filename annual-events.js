"use strict";

const normalizeMonthlyTeachingPeriod = typeof module !== "undefined"
  ? require("./teaching-period.js").normalizeTeachingPeriod : normalizeTeachingPeriod;

const ANNUAL_EVENT_CATEGORIES = {
  school_event: "学校行事",
  exam: "考査",
  holiday: "休業日",
  long_break: "長期休業",
  other: "その他"
};

// Preview rules are independent of stored annual events. Keep keyword groups
// here so future inclusion/exclusion changes do not affect PDF restoration.
const ANNUAL_EVENT_CANDIDATE_RULES = [
  { category: "exam", confidence: "high", available: false,
    pattern: /(?:中間|期末|学年末|定期)?考査(?!週間|採点|範囲|時間割)/ },
  { category: "long_break", confidence: "high", available: false,
    pattern: /夏季休業|冬季休業|春季休業|学年始休業|学年末休業|年度末休業|年末年始休/ },
  { category: "other", confidence: "medium", available: null,
    pattern: /振替授業/ },
  { category: "holiday", confidence: "high", available: false,
    pattern: /振替休日|振替|休日|休業日|閉庁日/ },
  { category: "school_event", confidence: "medium", available: null,
    pattern: /入学式|始業式|終業式|卒業式|修了式|離任式|体育祭|文化祭|三高祭|球技大会|遠足|修学旅行|開校記念日|高校総体|高総体|式場準備/ },
  { category: "other", confidence: "medium", available: null,
    pattern: /午前授業|午後授業|[月火水木金土日](?:曜日|曜)?の授業|HR活動|採点日|入学者選抜|追検査|再募集検査|高教研|教員研修/i }
];

const ANNUAL_EVENT_CANDIDATE_EXCLUSIONS =
  /(?:放課後.*委員会|PTA.*(?:会議|委員会)|部活動集会|健康診断|検診|検定試験|進路相談会|模試|講習)/i;
const ANNUAL_EVENT_CANDIDATE_NATIONAL_HOLIDAYS =
  /昭和の日|憲法記念日|みどりの日|こどもの日|海の日|山の日|敬老の日|秋分の日|スポーツの日|文化の日|勤労感謝の日|元日|成人の日|建国記念(?:の)?日|天皇誕生日|春分の日/;
const candidateMatchText = (text) => String(text).normalize("NFKC").replace(/\s+/g, "");

function matchAnnualEventCandidate(text) {
  const normalized = candidateMatchText(text);
  if (ANNUAL_EVENT_CANDIDATE_EXCLUSIONS.test(normalized)) return null;
  const holiday = normalized.match(ANNUAL_EVENT_CANDIDATE_NATIONAL_HOLIDAYS);
  if (holiday) return { category: "holiday", confidence: "high", available: false,
    keyword: holiday[0], nationalHoliday: true };
  // Mask preparatory exam wording before matching: a later, actual exam in
  // the same line can still be recognized without classifying 考査週間 as exam.
  const searchable = normalized.replace(/(?:中間|期末|学年末|定期)?考査(?=週間|採点|範囲|時間割)/g, "");
  for (const rule of ANNUAL_EVENT_CANDIDATE_RULES) {
    const match = searchable.match(rule.pattern);
    if (match) return { ...rule, keyword: match[0] };
  }
  return null;
}

function splitAnnualEventCandidateText(text) {
  // Middle dots, commas and spaces often belong to one event name; keep them.
  const lines = String(text ?? "").split(/\r\n|[\n\r\u2028\u2029]|[;；]/)
    .map((line) => line.trim()).filter(Boolean);
  const parts = [];
  for (let index = 0; index < lines.length; index += 1) {
    let part = lines[index];
    // A wrapped 考査週間 remains preparation, not an actual exam.
    if (/^(?:中間|期末|学年末|定期)?考査$/.test(candidateMatchText(part))
      && /^週間/.test(candidateMatchText(lines[index + 1] || ""))) {
      part += "\n" + lines[++index];
    }
    // Rejoin a wrapped keyword only when neither line is itself a candidate.
    // Otherwise, e.g. 式場準備\n入学式 must remain two separate events.
    if (!matchAnnualEventCandidate(part) && lines[index + 1]
      && (!matchAnnualEventCandidate(lines[index + 1])
        || /^(?:中間|期末|学年末|定期)$/.test(candidateMatchText(part)))
      && matchAnnualEventCandidate(part + lines[index + 1])) {
      part += "\n" + lines[++index];
    }
    // Retain a period wrapped onto the following line without inferring an end.
    if (matchAnnualEventCandidate(part) && /^[～〜~]/.test(lines[index + 1] || "")) {
      part += "\n" + lines[++index];
    }
    parts.push(part);
  }
  return parts;
}

/** Infer preview-only candidates from { date, month, day, text } cells.
 * No storage, date-range expansion, or mutation of input cells occurs here.
 */
function inferAnnualEventCandidates(cells) {
  const candidates = [];
  const seen = new Set();
  for (const cell of Array.isArray(cells) ? cells : []) {
    const date = String(cell?.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const parsed = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) continue;
    for (const sourceText of splitAnnualEventCandidateText(cell?.text)) {
      const match = matchAnnualEventCandidate(sourceText);
      if (!match) continue;
      const title = sourceText.replace(/\s*\n\s*/g, "").replace(/\s+/g, " ").trim();
      const key = date + ":" + candidateMatchText(title);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        date, title,
        suggestedCategory: match.category,
        suggestedRegularClassesAvailable: match.available,
        confidence: match.confidence,
        reason: `「${match.keyword}」を検出` + (match.nationalHoliday
          ? "。国民の祝日一括追加機能と重複する可能性があります" : ""),
        sourceText
      });
    }
  }
  return candidates.sort((a, b) => a.date.localeCompare(b.date));
}

function annualEventCandidateClassesLabel(available) {
  return available === false ? "実施できない" : available === true ? "実施できる" : "要確認";
}

function annualEventsStorageKey(schoolId, year) {
  return `rika-annual-events-v1:${schoolId}:${year}`;
}

function normalizeAnnualEvent(event) {
  const startDate = String(event?.startDate || "");
  return {
    id: String(event?.id || ""),
    startDate,
    endDate: String(event?.endDate || startDate),
    title: String(event?.title || ""),
    category: ANNUAL_EVENT_CATEGORIES[event?.category] ? event.category : "other",
    regularClassesAvailable: event?.regularClassesAvailable === true,
    memo: String(event?.memo || "")
  };
}

function annualEventDisplayTitle(event) {
  const title = String(event?.title || "").trim();
  const category = ANNUAL_EVENT_CATEGORIES[event?.category] || ANNUAL_EVENT_CATEGORIES.other;
  return title || category;
}

function sortAnnualEvents(events) {
  return events.map(normalizeAnnualEvent).sort((a, b) =>
    a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || a.title.localeCompare(b.title, "ja")
  );
}

function formatEventDateRange(startDate, endDate = startDate) {
  const format = (value) => {
    const [, month, day] = String(value).split("-").map(Number);
    return `${month}/${day}`;
  };
  return startDate === endDate ? format(startDate) : `${format(startDate)} ～ ${format(endDate)}`;
}

// Use UTC dates so the count is not affected by the browser's locale or DST.
function calculateMonthlyAvailableSchoolDays(year, events, teachingPeriod) {
  const schoolYear = Math.trunc(Number(year));
  const months = Array.from({ length: 12 }, (_, index) => index < 9
    ? { year: schoolYear, month: index + 3 }
    : { year: schoolYear + 1, month: index - 9 });
  const excludedDates = new Set();
  const period = normalizeMonthlyTeachingPeriod(schoolYear, teachingPeriod);
  const rangeStart = Date.parse(`${period.startDate}T00:00:00Z`);
  const rangeEnd = Date.parse(`${period.endDate}T00:00:00Z`);

  (Array.isArray(events) ? events : []).map(normalizeAnnualEvent)
    .filter((event) => !event.regularClassesAvailable)
    .forEach((event) => {
      const start = Date.parse(`${event.startDate}T00:00:00Z`);
      const end = Date.parse(`${event.endDate}T00:00:00Z`);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
      for (let time = Math.max(start, rangeStart); time <= Math.min(end, rangeEnd); time += 86400000) {
        const date = new Date(time);
        const day = date.getUTCDay();
        if (day >= 1 && day <= 5) excludedDates.add(date.toISOString().slice(0, 10));
      }
    });

  const details = months.map(({ year: calendarYear, month }) => {
    const daysInMonth = new Date(Date.UTC(calendarYear, month + 1, 0)).getUTCDate();
    let weekdays = 0;
    let excluded = 0;
    for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
      const date = new Date(Date.UTC(calendarYear, month, dayOfMonth));
      const weekday = date.getUTCDay();
      if (weekday < 1 || weekday > 5 || date.getTime() < rangeStart || date.getTime() > rangeEnd) continue;
      weekdays += 1;
      if (excludedDates.has(date.toISOString().slice(0, 10))) excluded += 1;
    }
    return { weekdays, excluded, available: weekdays - excluded };
  });
  return { days: details.map(({ available }) => available), details, excludedDates };
}

if (typeof module !== "undefined") module.exports = {
  ANNUAL_EVENT_CATEGORIES, annualEventsStorageKey, normalizeAnnualEvent,
  annualEventDisplayTitle, sortAnnualEvents, formatEventDateRange,
  calculateMonthlyAvailableSchoolDays, inferAnnualEventCandidates, annualEventCandidateClassesLabel
};
