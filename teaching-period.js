"use strict";

function teachingPeriodStorageKey(schoolId, year, courseId) {
  return `rika-teaching-period-v1:${schoolId}:${year}:${courseId}`;
}

function defaultTeachingPeriod(year) {
  const fiscalYear = Math.trunc(Number(year));
  return { startDate: `${fiscalYear}-04-01`, endDate: `${fiscalYear + 1}-03-31` };
}

function teachingPeriodValidationError(year, period) {
  const bounds = defaultTeachingPeriod(year);
  const validDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  };
  if (!validDate(period?.startDate) || !validDate(period?.endDate)) return "有効な開始日・終了日を入力してください。";
  if (period.startDate < bounds.startDate || period.startDate > bounds.endDate
      || period.endDate < bounds.startDate || period.endDate > bounds.endDate) return "開始日・終了日は指定年度内にしてください。";
  if (period.endDate < period.startDate) return "終了日は開始日以降にしてください。";
  return "";
}

function normalizeTeachingPeriod(year, period) {
  return teachingPeriodValidationError(year, period) ? defaultTeachingPeriod(year)
    : { startDate: period.startDate, endDate: period.endDate };
}

function loadTeachingPeriod(storage, schoolId, year, courseId) {
  try {
    return normalizeTeachingPeriod(year, JSON.parse(storage.getItem(teachingPeriodStorageKey(schoolId, year, courseId))));
  } catch { return defaultTeachingPeriod(year); }
}

function saveTeachingPeriod(storage, schoolId, year, courseId, period) {
  if (teachingPeriodValidationError(year, period)) return false;
  try {
    storage.setItem(teachingPeriodStorageKey(schoolId, year, courseId), JSON.stringify(normalizeTeachingPeriod(year, period)));
    return true;
  } catch { return false; }
}

if (typeof module !== "undefined") module.exports = {
  teachingPeriodStorageKey, defaultTeachingPeriod, teachingPeriodValidationError,
  normalizeTeachingPeriod, loadTeachingPeriod, saveTeachingPeriod
};
