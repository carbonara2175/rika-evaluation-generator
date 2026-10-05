"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  annualEventsStorageKey, normalizeAnnualEvent, annualEventDisplayTitle,
  sortAnnualEvents, formatEventDateRange, calculateMonthlyAvailableSchoolDays
} = require("./annual-events");

test("storage keys completely separate schools and years", () => {
  assert.equal(annualEventsStorageKey("sanno", 2027), "rika-annual-events-v1:sanno:2027");
  assert.notEqual(annualEventsStorageKey("sanno", 2027), annualEventsStorageKey("santo", 2027));
  assert.notEqual(annualEventsStorageKey("sanno", 2027), annualEventsStorageKey("sanno", 2028));
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
