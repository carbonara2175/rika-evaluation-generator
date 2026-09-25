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

if (typeof module !== "undefined") module.exports = { calculateAnnualHours, calculateExpectedHours, calculateProportionalAllocation, allocateByLargestRemainder };
