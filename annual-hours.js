"use strict";

function calculateAnnualHours(credits) {
  return Math.max(0, Math.trunc(Number(credits) || 0)) * 35;
}

function calculateExpectedHours(availableDays, weeklyHours) {
  return Math.max(0, Number(availableDays) || 0) * Math.max(0, Number(weeklyHours) || 0) / 5;
}

function calculateProportionalAllocation(annualHours, availableDays) {
  const days = availableDays.map((value) => Math.max(0, Math.trunc(Number(value) || 0)));
  const totalDays = days.reduce((sum, value) => sum + value, 0);
  return totalDays ? days.map((value) => annualHours * value / totalDays) : days.map(() => 0);
}

function allocateByLargestRemainder(annualHours, availableDays) {
  const target = Math.max(0, Math.trunc(Number(annualHours) || 0));
  const theoretical = calculateProportionalAllocation(target, availableDays);
  const allocation = theoretical.map(Math.floor);
  let remainder = target - allocation.reduce((sum, value) => sum + value, 0);
  const order = theoretical.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder && order.length; index += 1) allocation[order[index % order.length].index] += 1;
  return availableDays.some((value) => Number(value) > 0) ? allocation : allocation.map(() => 0);
}

function calculateUnitHoursTotal(plans) {
  return plans.reduce((total, plan) => total + Math.max(0, Math.trunc(Number(plan?.allocatedHours) || 0)), 0);
}

function calculateOperationalDifference(projectedHours, unitPlanHours) {
  return (Number(projectedHours) || 0) - (Number(unitPlanHours) || 0);
}

function annualEventReferenceYearStorageKey(schoolId, courseId) {
  return `rika-annual-event-reference-year-v1:${schoolId}:${courseId}`;
}

function selectExpectedHours(eventProjection, fallbackHours) {
  const hasEventProjection = eventProjection?.hasRegularSchedule === true
    && eventProjection?.hasAnnualEvents === true
    && Number.isFinite(eventProjection?.availableCount);
  return {
    hours: hasEventProjection ? eventProjection.availableCount : (Number(fallbackHours) || 0),
    source: hasEventProjection ? "annual-events" : "available-days"
  };
}

// Keep a saved teaching order usable when curriculum definitions gain or lose
// units: retain known saved IDs, then append newly defined units in their
// existing curriculum order.
function reconcileTeachingOrder(definedUnits, savedOrder) {
  const units = Array.isArray(definedUnits) ? definedUnits : [];
  const knownIds = new Set(units.map((unit) => unit?.id).filter(Boolean));
  const result = [];
  (Array.isArray(savedOrder) ? savedOrder : []).forEach((id) => {
    if (knownIds.has(id) && !result.includes(id)) result.push(id);
  });
  units.forEach((unit) => {
    if (unit?.id && !result.includes(unit.id)) result.push(unit.id);
  });
  return result;
}

// Build one subject-wide timeline from the supplied order (curriculum order by
// default, or the school's saved teaching order). Only
// rows actually present in saved plans are included; missing lessons are never
// invented to make the allocation add up.
function buildUnitLessonTimeline(orderedUnits, savedPlans) {
  const plansByUnit = new Map((Array.isArray(savedPlans) ? savedPlans : []).map((plan) => [plan?.unitId, plan]));
  const lessons = [];
  const warnings = [];
  (Array.isArray(orderedUnits) ? orderedUnits : []).forEach((unit) => {
    const plan = plansByUnit.get(unit?.id);
    if (!plan) return;
    const rows = Array.isArray(plan.rows) ? plan.rows : [];
    const allocatedHours = Math.max(0, Math.trunc(Number(plan.allocatedHours) || 0));
    if (rows.length < allocatedHours) warnings.push(`${unit.unit}：単元指導計画の時間データが${allocatedHours - rows.length}時間分不足しています`);
    if (rows.length > allocatedHours) warnings.push(`${unit.unit}：時間データが配当時数を超えています`);
    rows.forEach((row, index) => lessons.push({
      unitId: unit.id,
      unitName: unit.unit,
      hour: Math.max(1, Math.trunc(Number(row?.hour) || index + 1)),
      cumulativeHours: lessons.length + 1
    }));
  });
  return { lessons, warnings };
}

function endpointId(endpoint) {
  return endpoint ? `${endpoint.unitId}:${endpoint.hour}` : "";
}

function findAutomaticExamRange(lessons, cumulativeHours) {
  const limit = Math.max(0, Math.trunc(Number(cumulativeHours) || 0));
  return (Array.isArray(lessons) ? lessons : []).filter((lesson) => lesson.cumulativeHours <= limit).at(-1) || null;
}

function calculateExamRangeDifference(projectedHours, endpoint) {
  if (!endpoint) return null;
  return (Number(projectedHours) || 0) - endpoint.cumulativeHours;
}

if (typeof module !== "undefined") module.exports = {
  calculateAnnualHours, calculateExpectedHours, calculateProportionalAllocation,
  allocateByLargestRemainder, calculateUnitHoursTotal, calculateOperationalDifference,
  annualEventReferenceYearStorageKey, selectExpectedHours, buildUnitLessonTimeline,
  endpointId, findAutomaticExamRange, calculateExamRangeDifference, reconcileTeachingOrder
};
