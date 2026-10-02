"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateAnnualHours, calculateExpectedHours, calculateUnitHoursTotal, calculateOperationalDifference } = require("./annual-hours");

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

test("non-negative operational difference represents projected surplus", () => {
  const rawDifference = calculateOperationalDifference(48.2, 45);

  assert.ok(rawDifference >= 0);
  assert.equal(Math.round(Math.abs(rawDifference)), 3);
});
