"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateAnnualHours, calculateExpectedHours, calculateUnitHoursTotal,
  calculateOperationalDifference, annualEventReferenceYearStorageKey, selectExpectedHours,
  buildUnitLessonTimeline, endpointId, findAutomaticExamRange, calculateExamRangeDifference,
  reconcileTeachingOrder
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

test("unit lesson timeline follows curriculum order and does not invent missing rows", () => {
  const units = [{ id: "motion", unit: "運動の表し方" }, { id: "forces", unit: "様々な力とその働き" }];
  const result = buildUnitLessonTimeline(units, [
    { unitId: "forces", allocatedHours: 3, rows: [{ hour: 1 }] },
    { unitId: "motion", allocatedHours: 2, rows: [{ hour: 1 }, { hour: 2 }] }
  ]);
  assert.deepEqual(result.lessons.map(({ unitId, hour, cumulativeHours }) => ({ unitId, hour, cumulativeHours })), [
    { unitId: "motion", hour: 1, cumulativeHours: 1 },
    { unitId: "motion", hour: 2, cumulativeHours: 2 },
    { unitId: "forces", hour: 1, cumulativeHours: 3 }
  ]);
  assert.match(result.warnings[0], /2時間分不足/);
});

test("exam candidate reaches the first hour after a nine-hour opening unit", () => {
  const motion = Array.from({ length: 9 }, (_, index) => ({ unitId: "motion", unitName: "運動の表し方", hour: index + 1, cumulativeHours: index + 1 }));
  const force1 = { unitId: "forces", unitName: "様々な力とその働き", hour: 1, cumulativeHours: 10 };
  const candidate = findAutomaticExamRange([...motion, force1], 10);
  assert.equal(endpointId(candidate), "forces:1");
  assert.equal(calculateExamRangeDifference(10, motion[8]), 1);
  assert.equal(calculateExamRangeDifference(10, { ...force1, cumulativeHours: 12 }), -2);
});

test("subject timeline accumulates saved units in teaching order and reaches hour 33", () => {
  const units = [
    { id: "planar", unit: "平面内の運動と剛体のつり合い" },
    { id: "momentum", unit: "運動量" },
    { id: "circular", unit: "円運動と単振動" },
    { id: "gravitation", unit: "万有引力" },
    { id: "unsaved", unit: "気体分子の運動" }
  ];
  const plans = units.slice(0, 4).map((unit, index) => ({
    unitId: unit.id, allocatedHours: [8, 9, 9, 10][index],
    rows: Array.from({ length: [8, 9, 9, 10][index] }, (_, hour) => ({ hour: hour + 1 }))
  })).reverse();
  const { lessons, warnings } = buildUnitLessonTimeline(units, plans);
  assert.equal(lessons.length, 36);
  assert.deepEqual(lessons.map((lesson) => lesson.cumulativeHours), Array.from({ length: 36 }, (_, index) => index + 1));
  assert.deepEqual([0, 8, 17, 26].map((index) => endpointId(lessons[index])), ["planar:1", "momentum:1", "circular:1", "gravitation:1"]);
  assert.equal(endpointId(findAutomaticExamRange(lessons, 33)), "gravitation:7");
  assert.equal(findAutomaticExamRange(lessons, 0), null);
  assert.equal(endpointId(findAutomaticExamRange(lessons, 99)), "gravitation:10");
  assert.ok(lessons.every((lesson) => lesson.unitId !== "unsaved"));
  assert.deepEqual(warnings, ["気体分子の運動の単元指導計画が未保存のため候補に含まれていません"]);
  const reordered = buildUnitLessonTimeline([units[1], units[0], ...units.slice(2)], plans).lessons;
  assert.equal(endpointId(reordered[0]), "momentum:1");
  assert.equal(endpointId(reordered[9]), "planar:1");
});

test("teaching order keeps valid saved IDs and appends newly defined units", () => {
  const units = [{ id: "motion" }, { id: "waves" }, { id: "heat" }, { id: "electricity" }];
  assert.deepEqual(reconcileTeachingOrder(units, ["motion", "heat", "removed", "heat", "waves"]), [
    "motion", "heat", "waves", "electricity"
  ]);
  assert.deepEqual(reconcileTeachingOrder(units, null), ["motion", "waves", "heat", "electricity"]);
});

test("a confirmed heat endpoint is recalculated without later waves", () => {
  const units = [
    { id: "motion", unit: "運動の表し方" },
    { id: "forces", unit: "様々な力とその働き" },
    { id: "mechanical-energy", unit: "力学的エネルギー" },
    { id: "heat", unit: "熱" },
    { id: "waves", unit: "波" }
  ];
  const hours = { motion: 9, forces: 16, "mechanical-energy": 10, heat: 6, waves: 11 };
  const plans = units.map((unit) => ({
    unitId: unit.id, allocatedHours: hours[unit.id],
    rows: Array.from({ length: hours[unit.id] }, (_, index) => ({ hour: index + 1 }))
  }));
  const { lessons } = buildUnitLessonTimeline(units, plans);
  const heat6 = lessons.find((lesson) => endpointId(lesson) === "heat:6");
  assert.equal(heat6.cumulativeHours, 41);
  assert.equal(calculateExamRangeDifference(45, heat6), 4);
  assert.equal(findAutomaticExamRange(lessons, 45).unitId, "waves");
});
