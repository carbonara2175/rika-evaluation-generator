"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateAnnualHours, calculateExpectedHours, calculateUnitHoursTotal,
  calculateOperationalDifference, annualEventReferenceYearStorageKey, selectExpectedHours
} = require("./annual-hours");

test("standard annual hours remain credits times 35", () => {
  assert.equal(calculateAnnualHours(2), 70);
  assert.equal(calculateAnnualHours(4), 140);
});

test("unit hours total treats missing and invalid values as zero", () => {
  assert.equal(calculateUnitHoursTotal([
    { allocatedHours: 9 }, { allocatedHours: 16 }, {}, { allocatedHours: 10 },
    { allocatedHours: 6 }, { allocatedHours: 11 }, { allocatedHours: 8 }, { allocatedHours: 2 }
  ]), 62);
});

test("operational difference compares projected hours with unit plan hours before rounding", () => {
  const rawProjectedHours = calculateExpectedHours(119, 2);
  const rawDifference = calculateOperationalDifference(rawProjectedHours, 62);

  assert.equal(rawProjectedHours, 47.6);
  assert.ok(rawDifference < 0);
  assert.equal(Math.round(rawProjectedHours), 48);
  assert.equal(Math.round(Math.abs(rawDifference)), 14);
});

test("reference years are stored separately for every school and course", () => {
  assert.equal(
    annualEventReferenceYearStorageKey("sanno", "physicsBasic"),
    "rika-annual-event-reference-year-v1:sanno:physicsBasic"
  );
  assert.notEqual(
    annualEventReferenceYearStorageKey("sanno", "physicsBasic"),
    annualEventReferenceYearStorageKey("santo", "physics")
  );
});

test("annual-event projection takes priority only when timetable and events both exist", () => {
  assert.deepEqual(selectExpectedHours({
    hasRegularSchedule: true, hasAnnualEvents: true, availableCount: 59
  }, 70), { hours: 59, source: "annual-events" });
  assert.deepEqual(selectExpectedHours({
    hasRegularSchedule: true, hasAnnualEvents: false, availableCount: 104
  }, 70), { hours: 70, source: "available-days" });
  assert.deepEqual(selectExpectedHours({
    hasRegularSchedule: false, hasAnnualEvents: true, availableCount: 0
  }, 70), { hours: 70, source: "available-days" });
});

test("the requested 59-hour projection produces a three-hour shortage against 62 hours", () => {
  const expected = selectExpectedHours({
    hasRegularSchedule: true, hasAnnualEvents: true, availableCount: 59
  }, 0);
  assert.equal(calculateOperationalDifference(expected.hours, 62), -3);
  assert.equal(calculateAnnualHours(2), 70);
});

test("non-negative operational difference represents projected surplus", () => {
  const rawDifference = calculateOperationalDifference(48.2, 45);

  assert.ok(rawDifference >= 0);
  assert.equal(Math.round(Math.abs(rawDifference)), 3);
});
