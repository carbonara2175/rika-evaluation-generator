"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { regularScheduleStorageKey, normalizeRegularSchedule, hasRegularScheduleSlot } = require("./regular-schedule");

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
