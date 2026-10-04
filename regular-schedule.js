"use strict";

// IDs are deliberately independent of their labels so more weekdays can be
// added later without changing saved schedules.
const REGULAR_SCHEDULE_DAYS = [
  { id: "monday", label: "月曜日", shortLabel: "月" },
  { id: "tuesday", label: "火曜日", shortLabel: "火" },
  { id: "wednesday", label: "水曜日", shortLabel: "水" },
  { id: "thursday", label: "木曜日", shortLabel: "木" },
  { id: "friday", label: "金曜日", shortLabel: "金" }
];

function regularScheduleStorageKey(schoolId, year, courseId) {
  return `rika-regular-schedule-v1:${schoolId}:${year}:${courseId}`;
}

function normalizeRegularSchedule(slots) {
  if (!Array.isArray(slots)) return [];
  const validDays = new Set(REGULAR_SCHEDULE_DAYS.map(({ id }) => id));
  const seen = new Set();
  return slots.reduce((result, slot) => {
    const dayOfWeek = String(slot?.dayOfWeek || "");
    const period = Math.trunc(Number(slot?.period));
    const identity = `${dayOfWeek}:${period}`;
    if (!validDays.has(dayOfWeek) || period < 1 || period > 7 || seen.has(identity)) return result;
    seen.add(identity);
    result.push({ dayOfWeek, period });
    return result;
  }, []).sort((a, b) =>
    REGULAR_SCHEDULE_DAYS.findIndex(({ id }) => id === a.dayOfWeek)
      - REGULAR_SCHEDULE_DAYS.findIndex(({ id }) => id === b.dayOfWeek)
      || a.period - b.period
  );
}

function hasRegularScheduleSlot(slots, candidate) {
  return slots.some(({ dayOfWeek, period }) => dayOfWeek === candidate.dayOfWeek && period === candidate.period);
}

if (typeof module !== "undefined") module.exports = { REGULAR_SCHEDULE_DAYS, regularScheduleStorageKey, normalizeRegularSchedule, hasRegularScheduleSlot };
