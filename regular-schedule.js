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

const ANNUAL_EVENT_CATEGORY_TITLES = {
  school_event: "学校行事",
  exam: "考査",
  holiday: "休業日",
  long_break: "長期休業",
  other: "その他"
};

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

// Date-only values are converted to UTC calendar parts deliberately. This avoids
// parsing YYYY-MM-DD as an instant and then accidentally moving it to another day
// when the browser applies its local time zone.
function dateOnlyToUtc(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function utcDateOnly(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function calculateScheduleProjection(year, slots, events) {
  const fiscalYear = Math.trunc(Number(year));
  const normalizedSlots = normalizeRegularSchedule(slots);
  const start = new Date(Date.UTC(fiscalYear, 3, 1));
  const end = new Date(Date.UTC(fiscalYear + 1, 2, 31));
  const unavailableByDate = new Map();

  (Array.isArray(events) ? events : []).filter((event) => event?.regularClassesAvailable !== true).forEach((event) => {
    const eventStart = dateOnlyToUtc(event?.startDate);
    const eventEnd = dateOnlyToUtc(event?.endDate || event?.startDate);
    if (!eventStart || !eventEnd || eventEnd < eventStart) return;
    const rangeStart = eventStart < start ? start : eventStart;
    const rangeEnd = eventEnd > end ? end : eventEnd;
    for (const date = new Date(rangeStart); date <= rangeEnd; date.setUTCDate(date.getUTCDate() + 1)) {
      const key = utcDateOnly(date);
      if (!unavailableByDate.has(key)) unavailableByDate.set(key, new Set());
      unavailableByDate.get(key).add(
        String(event.title || "").trim() || ANNUAL_EVENT_CATEGORY_TITLES[event.category] || ANNUAL_EVENT_CATEGORY_TITLES.other
      );
    }
  });

  const dayIds = [null, "monday", "tuesday", "wednesday", "thursday", "friday", null];
  const scheduledSessions = [];
  const excludedSessions = [];
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const dayOfWeek = dayIds[date.getUTCDay()];
    if (!dayOfWeek) continue;
    const dateString = utcDateOnly(date);
    normalizedSlots.filter((slot) => slot.dayOfWeek === dayOfWeek).forEach((slot) => {
      const day = REGULAR_SCHEDULE_DAYS.find(({ id }) => id === dayOfWeek);
      const session = { date: dateString, dayOfWeek, weekday: day.shortLabel, period: slot.period };
      scheduledSessions.push(session);
      const reasons = unavailableByDate.get(dateString);
      if (reasons) excludedSessions.push({ ...session, eventTitles: [...reasons] });
    });
  }
  return {
    plannedCount: scheduledSessions.length,
    excludedCount: excludedSessions.length,
    availableCount: scheduledSessions.length - excludedSessions.length,
    scheduledSessions,
    excludedSessions,
    availableSessions: scheduledSessions.filter((session) => !unavailableByDate.has(session.date))
  };
}

// Exams are checkpoints only. Their dates are already removed from
// availableSessions by calculateScheduleProjection, just like every other
// unavailable annual event.
function calculateExamCheckpoints(year, slots, events) {
  const fiscalYear = Math.trunc(Number(year));
  const fiscalStart = `${fiscalYear}-04-01`;
  const fiscalEnd = `${fiscalYear + 1}-03-31`;
  const exams = (Array.isArray(events) ? events : []).filter((event) => event?.category === "exam")
    .map((event) => {
      const start = dateOnlyToUtc(event?.startDate);
      const end = dateOnlyToUtc(event?.endDate || event?.startDate);
      if (!start || !end || end < start) return null;
      return {
        id: String(event?.id || ""),
        title: String(event?.title || "").trim() || ANNUAL_EVENT_CATEGORY_TITLES.exam,
        startDate: utcDateOnly(start),
        endDate: utcDateOnly(end)
      };
    })
    .filter((exam) => exam && exam.startDate >= fiscalStart && exam.startDate <= fiscalEnd)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
  const availableSessions = calculateScheduleProjection(fiscalYear, slots, events).availableSessions;
  let periodStart = fiscalStart;

  return exams.map((exam) => {
    const periodHours = availableSessions.filter(({ date }) => date >= periodStart && date < exam.startDate).length;
    const cumulativeHours = availableSessions.filter(({ date }) => date >= fiscalStart && date < exam.startDate).length;
    const end = dateOnlyToUtc(exam.endDate);
    end.setUTCDate(end.getUTCDate() + 1);
    periodStart = utcDateOnly(end);
    return { ...exam, periodHours, cumulativeHours };
  });
}

if (typeof module !== "undefined") module.exports = {
  REGULAR_SCHEDULE_DAYS, regularScheduleStorageKey, normalizeRegularSchedule,
  hasRegularScheduleSlot, dateOnlyToUtc, calculateScheduleProjection, calculateExamCheckpoints
};
