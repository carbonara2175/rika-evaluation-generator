"use strict";
const assert = require("node:assert/strict");
const { defaultTeachingPeriod, teachingPeriodStorageKey, teachingPeriodValidationError, loadTeachingPeriod, saveTeachingPeriod } = require("./teaching-period");
const { calculateScheduleProjection, calculateExamCheckpoints } = require("./regular-schedule");
const { calculateMonthlyAvailableSchoolDays } = require("./annual-events");
const { calculateAnnualHours, allocateByLargestRemainder } = require("./annual-hours");
const slots = ["monday", "tuesday", "wednesday", "thursday"].map(dayOfWeek => ({ dayOfWeek, period: 1 }));
const full = defaultTeachingPeriod(2026);
const period = { startDate: "2026-04-07", endDate: "2027-02-28" };
const storage = new Map();
storage.getItem = key => storage.get(key) ?? null;
storage.setItem = (key, value) => storage.set(key, value);
assert.deepEqual(loadTeachingPeriod(storage, "gosho", 2026, "inquiryPhysics"), full);
const baseline = calculateScheduleProjection(2026, slots, []);
assert.deepEqual(calculateScheduleProjection(2026, slots, [], full), baseline);
assert.deepEqual(calculateMonthlyAvailableSchoolDays(2026, [], full), calculateMonthlyAvailableSchoolDays(2026, []));
for (const value of [{ ...full, startDate: period.startDate }, { ...full, endDate: period.endDate }, period]) {
  const expected = baseline.scheduledSessions.filter(s => s.date >= value.startDate && s.date <= value.endDate);
  const actual = calculateScheduleProjection(2026, slots, [], value);
  assert.deepEqual(actual.scheduledSessions, expected);
  assert.equal(actual.plannedCount, expected.length);
  assert.equal(actual.excludedCount, 0);
  assert.equal(actual.availableCount, expected.length);
}
const breakEvent = { category: "holiday", title: "年度始休業", startDate: "2026-04-01", endDate: "2026-04-06", regularClassesAvailable: false };
assert.equal(calculateScheduleProjection(2026, slots, [breakEvent], period).excludedCount, 0);
const days = calculateMonthlyAvailableSchoolDays(2026, [breakEvent], period);
assert.equal(days.days[11], 0);
assert.equal(days.details[0].weekdays, 18);
assert.equal(days.details[0].excluded, 0);
assert.equal(calculateMonthlyAvailableSchoolDays(2026, [], { startDate: "2026-04-07", endDate: "2026-04-09" }).days[0], 3);
assert.equal(allocateByLargestRemainder(calculateAnnualHours(4), days.days).reduce((a,b)=>a+b,0), 140);
const exams = ["2026-04-02", "2026-04-09", "2027-03-01"].map(startDate => ({ category: "exam", startDate, endDate: startDate, regularClassesAvailable: false }));
const checkpoints = calculateExamCheckpoints(2026, slots, exams, period);
assert.equal(checkpoints.length, 1);
assert.equal(checkpoints[0].cumulativeHours, 2);
assert.equal(checkpoints[0].periodHours, 2);
assert.deepEqual(calculateExamCheckpoints(2026, slots, exams, full), calculateExamCheckpoints(2026, slots, exams));
assert.equal(saveTeachingPeriod(storage, "gosho", 2026, "inquiryPhysics", period), true);
for (const [school, year, course] of [["other",2026,"inquiryPhysics"],["gosho",2027,"inquiryPhysics"],["gosho",2026,"physics"]]) {
  assert.deepEqual(loadTeachingPeriod(storage, school, year, course), defaultTeachingPeriod(year));
  assert.equal(saveTeachingPeriod(storage, school, year, course, defaultTeachingPeriod(year)), true);
}
assert.deepEqual(loadTeachingPeriod(storage, "gosho", 2026, "inquiryPhysics"), period);
for (const invalid of [{...period,startDate:"2026-03-31"},{...period,endDate:"2027-04-01"},{...period,endDate:"2026-04-06"},{...period,startDate:"2026-02-30"},{...period,endDate:"invalid"},{...period,startDate:""}]) {
  assert.ok(teachingPeriodValidationError(2026, invalid));
  assert.equal(saveTeachingPeriod(storage,"gosho",2026,"inquiryPhysics",invalid),false);
  assert.deepEqual(loadTeachingPeriod(storage,"gosho",2026,"inquiryPhysics"),period);
}
storage.setItem(teachingPeriodStorageKey("broken",2026,"physics"), "not json");
assert.deepEqual(loadTeachingPeriod(storage,"broken",2026,"physics"),full);
storage.setItem(teachingPeriodStorageKey("broken",2026,"physics"), JSON.stringify({startDate:"2026-02-30",endDate:"2027-03-31"}));
assert.deepEqual(loadTeachingPeriod(storage,"broken",2026,"physics"),full);
console.log("Teaching period calculation, validation and independent storage tests passed");
