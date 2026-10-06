"use strict";

// Post-process extracted candidates only. This module never reads stored events.
const CANDIDATE_DAY_MS = 86400000;

function candidateDateTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return NaN;
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

function candidateEndDate(year, month, day) {
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return Number.isFinite(candidateDateTime(value)) ? value : null;
}

function inferCandidatePeriodEnd(startDate, texts) {
  const [year, month, day] = startDate.split("-").map(Number);
  const ends = new Set();
  const reasons = new Set();
  for (const text of new Set(texts)) {
    const normalized = String(text ?? "").normalize("NFKC");
    for (const marker of normalized.matchAll(/[～〜~]([^～〜~]*)/g)) {
      const token = marker[1].trim();
      // Require a complete date token: do not accept 8/23 as part of 8/234,
      // 8/23/24, 8/23日頃 or a duration such as 13日間.
      const explicit = token.match(/^(\d{1,2})\s*\/\s*(\d{1,2})(?:日)?(?=$|[\s）)・、,。;；])/);
      const omitted = token.match(/^(\d{1,2})日(?=$|[\s）)・、,。;；])/);
      let end = null;
      if (explicit) {
        const endMonth = Number(explicit[1]);
        const endDay = Number(explicit[2]);
        const endYear = endMonth < month || (endMonth === month && endDay < day) ? year + 1 : year;
        end = candidateEndDate(endYear, endMonth, endDay);
      } else if (omitted) {
        end = candidateEndDate(year, month, Number(omitted[1]));
        if (end && end < startDate) end = null;
      }
      if (end) ends.add(end);
      else reasons.add("期間の終了日が不明確または無効なため確認が必要");
    }
  }
  if (ends.size > 1) reasons.add("終了日の表記が複数あり一致しないため確認が必要");
  return { endDate: reasons.size ? null : [...ends][0], reviewReasons: [...reasons] };
}

/** Merge exact normalized titles/categories using observed dates, before
 * inferring ranges. Missing dates may only be weekends or known holidays.
 * sourceCandidates preserves all original fields, independently of the input.
 */
function prepareAnnualEventCandidates(candidates, { holidayDates } = {}) {
  const holidayTable = typeof module !== "undefined" && module.exports
    ? require("./national-holidays").NATIONAL_HOLIDAYS_BY_YEAR
    : (typeof NATIONAL_HOLIDAYS_BY_YEAR !== "undefined" ? NATIONAL_HOLIDAYS_BY_YEAR : {});
  const holidays = new Set(holidayDates ?? Object.values(holidayTable).flat().map(([date]) => date));
  const groups = new Map();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const date = candidate?.date ?? candidate?.startDate;
    if (!Number.isFinite(candidateDateTime(date))) continue;
    const key = JSON.stringify([String(candidate.title ?? "").normalize("NFKC").replace(/\s+/g, ""),
      candidate.suggestedCategory]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ date, source: structuredClone(candidate) });
  }
  const periods = [];
  const canBridge = (previous, next) => {
    for (let time = candidateDateTime(previous) + CANDIDATE_DAY_MS; time < candidateDateTime(next); time += CANDIDATE_DAY_MS) {
      const day = new Date(time);
      if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6 && !holidays.has(day.toISOString().slice(0, 10))) return false;
    }
    return true;
  };
  for (const group of groups.values()) {
    group.sort((a, b) => a.date.localeCompare(b.date));
    let period;
    for (const { date, source } of group) {
      if (!period || !canBridge(period.observedEndDate, date)) {
        period = { ...source, startDate: date, endDate: date, observedEndDate: date,
          sourceDates: [], sourceTexts: [], sourceCandidates: [] };
        periods.push(period);
      }
      period.observedEndDate = date;
      period.sourceDates.push(date);
      period.sourceTexts.push(source.sourceText ?? source.title ?? "");
      period.sourceCandidates.push(source);
    }
  }
  for (const period of periods) {
    const inferred = inferCandidatePeriodEnd(period.startDate,
      period.sourceCandidates.flatMap((source) => [source.title, source.sourceText]));
    const reasons = new Set(inferred.reviewReasons);
    period.endDate = inferred.endDate === null ? null : inferred.endDate ?? period.observedEndDate;
    if (period.endDate && period.endDate < period.observedEndDate) {
      reasons.add("推定終了日より後にも同一行事が抽出されているため確認が必要");
      period.endDate = null;
    }
    for (const source of period.sourceCandidates) {
      if (source.needsReview) reasons.add(source.reviewReason || "元の候補が要確認");
      if (source.suggestedRegularClassesAvailable !== true && source.suggestedRegularClassesAvailable !== false)
        reasons.add("通常授業可否の確認が必要");
      if (source.suggestedCategory === "school_event") reasons.add("学校行事は学年・科目によって扱いが異なる可能性があるため確認が必要");
      if (source.suggestedRegularClassesAvailable !== period.suggestedRegularClassesAvailable) {
        period.suggestedRegularClassesAvailable = null;
        reasons.add("統合元の通常授業可否が一致しないため確認が必要");
      }
      const text = String(source.title ?? "") + String(source.sourceText ?? "");
      const month = Number((source.date ?? source.startDate).slice(5, 7));
      if ((/夏季休業/.test(text) && ![6, 7, 8, 9].includes(month))
        || (/冬季休業/.test(text) && ![12, 1, 2].includes(month))
        || (/春季休業/.test(text) && ![3, 4].includes(month)))
        reasons.add("季節名と開始時期が不自然なため確認が必要");
    }
    period.needsReview = reasons.size > 0;
    period.reviewReason = [...reasons].join("。 ");
    period.duplicateWarning = period.suggestedCategory === "holiday"
      || period.sourceCandidates.some((source) => source.duplicateWarning === true);
  }
  return periods.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, "ja"));
}

function formatCandidatePeriod(candidate) {
  const start = candidate.startDate.replaceAll("-", "/");
  if (!candidate.endDate) return `${start} ～ 終了日要確認`;
  return candidate.startDate === candidate.endDate ? start : `${start} ～ ${candidate.endDate.replaceAll("-", "/")}`;
}

function candidatePeriodIncludesMonth(candidate, month) {
  const start = new Date(candidate.startDate + "T00:00:00Z");
  const end = candidate.endDate ?? candidate.observedEndDate ?? candidate.startDate;
  for (let year = start.getUTCFullYear(); year <= Number(end.slice(0, 4)); year += 1) {
    const first = candidateEndDate(year, Number(month), 1);
    const last = new Date(Date.UTC(year, Number(month), 0)).toISOString().slice(0, 10);
    if (first && first <= end && last >= candidate.startDate) return true;
  }
  return false;
}

if (typeof module !== "undefined") module.exports = {
  prepareAnnualEventCandidates, inferCandidatePeriodEnd, formatCandidatePeriod, candidatePeriodIncludesMonth
};
