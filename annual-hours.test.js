"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateAnnualHours, calculateUnitHoursTotal } = require("./annual-hours");

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
