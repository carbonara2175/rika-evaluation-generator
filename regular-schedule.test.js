"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  regularScheduleStorageKey, normalizeRegularSchedule, hasRegularScheduleSlot,
  dateOnlyToUtc, calculateScheduleProjection
} = require("./regular-schedule");

test("storage keys separate school, year, and course", () => {
  assert.equal(regularScheduleStorageKey("sanno", 2025, "physicsBasic"), "rika-regular-schedule-v1:sanno:2025:physicsBasic");
  assert.notEqual(regularScheduleStorageKey("gosho", 2025, "inquiryPhysics"), regularScheduleStorageKey("ajigasawa", 2025, "inquiryPhysics"));
  assert.notEqual(regularScheduleStorageKey("sanno", 2025, "physicsBasic"), regularScheduleStorageKey("sanno", 2026, "physicsBasic"));
});

test("schedule normalization validates, de-duplicates, and sorts slots", () => {
  assert.deepEqual(normalizeRegularSchedule([
    { dayOfWeek: "thursday", period: 2 },
    { dayOfWeek: "monday", period: 3 },
    { dayOfWeek: "monday", period: 3 },
    { dayOfWeek: "sunday", period: 1 },
    { dayOfWeek: "friday", period: 8 }
  ]), [
    { dayOfWeek: "monday", period: 3 },
    { dayOfWeek: "thursday", period: 2 }
  ]);
});

test("duplicate detection uses both weekday and period", () => {
  const slots = [{ dayOfWeek: "tuesday", period: 2 }];
  assert.equal(hasRegularScheduleSlot(slots, { dayOfWeek: "tuesday", period: 2 }), true);
  assert.equal(hasRegularScheduleSlot(slots, { dayOfWeek: "tuesday", period: 3 }), false);
});

test("a fiscal year generates every matching timetable session", () => {
  const result = calculateScheduleProjection(2026, [
    { dayOfWeek: "monday", period: 3 },
    { dayOfWeek: "wednesday", period: 3 }
  ], []);
  assert.equal(result.plannedCount, 105);
  assert.equal(result.availableCount, 105);
  assert.equal(result.excludedCount, 0);
  assert.equal(result.scheduledSessions[0].date, "2026-04-01");
  assert.equal(result.scheduledSessions.at(-1).date, "2027-03-31");
});

test("unavailable multi-day events exclude matching sessions only", () => {
  const result = calculateScheduleProjection(2026, [
    { dayOfWeek: "monday", period: 3 },
    { dayOfWeek: "wednesday", period: 3 }
  ], [
    { startDate: "2026-05-18", endDate: "2026-05-20", title: "1学期中間考査", regularClassesAvailable: false },
    { startDate: "2026-07-22", endDate: "2026-07-22", title: "体育祭", regularClassesAvailable: false },
    { startDate: "2026-07-23", endDate: "2026-08-23", title: "夏季休業", regularClassesAvailable: false }
  ]);
  assert.equal(result.excludedCount, 11);
  assert.equal(result.availableCount, 94);
  assert.deepEqual(result.excludedSessions.slice(0, 2).map(({ date }) => date), ["2026-05-18", "2026-05-20"]);
});

test("available events do not exclude and overlapping unavailable reasons do not double count", () => {
  const result = calculateScheduleProjection(2026, [{ dayOfWeek: "wednesday", period: 3 }], [
    { startDate: "2026-07-22", title: "授業可行事", regularClassesAvailable: true },
    { startDate: "2026-07-22", title: "体育祭", regularClassesAvailable: false },
    { startDate: "2026-07-22", title: "校内行事", regularClassesAvailable: false },
    { startDate: "2026-07-23", title: "木曜行事", regularClassesAvailable: false }
  ]);
  assert.equal(result.excludedCount, 1);
  assert.deepEqual(result.excludedSessions[0].eventTitles, ["体育祭", "校内行事"]);
});

test("date-only validation is independent of the runtime local timezone", () => {
  assert.equal(dateOnlyToUtc("2026-05-18").getUTCDay(), 1);
  assert.equal(dateOnlyToUtc("2026-02-30"), null);
});
