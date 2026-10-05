"use strict";

const ANNUAL_EVENT_CATEGORIES = {
  school_event: "学校行事",
  exam: "考査",
  holiday: "休業日",
  long_break: "長期休業",
  other: "その他"
};

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
function calculateMonthlyAvailableSchoolDays(year, events) {
  const schoolYear = Math.trunc(Number(year));
  const months = Array.from({ length: 12 }, (_, index) => index < 9
    ? { year: schoolYear, month: index + 3 }
    : { year: schoolYear + 1, month: index - 9 });
  const excludedDates = new Set();
  const rangeStart = Date.UTC(schoolYear, 3, 1);
  const rangeEnd = Date.UTC(schoolYear + 1, 2, 31);

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
      if (weekday < 1 || weekday > 5) continue;
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
  calculateMonthlyAvailableSchoolDays
};
