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

if (typeof module !== "undefined") module.exports = { ANNUAL_EVENT_CATEGORIES, annualEventsStorageKey, normalizeAnnualEvent, sortAnnualEvents, formatEventDateRange };
