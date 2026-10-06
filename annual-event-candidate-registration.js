"use strict";

const candidateEventApi = typeof module !== "undefined" && module.exports
  ? require("./annual-events") : { ANNUAL_EVENT_CATEGORIES, normalizeAnnualEvent };
const candidateHolidayApi = typeof module !== "undefined" && module.exports
  ? require("./national-holidays") : { NATIONAL_HOLIDAYS_BY_YEAR };
const candidatePeriodApi = typeof module !== "undefined" && module.exports
  ? require("./annual-event-candidate-periods") : { inferCandidatePeriodEnd };

function validCandidateRegistrationDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function candidateRegistrationTitle(candidate) {
  const title = String(candidate.title ?? "").trim();
  if (!validCandidateRegistrationDate(candidate.endDate)) return title;
  // Only remove a terminal token that the existing period inference resolves
  // to this exact end date. Leave names, other numbers and ambiguous tails alone.
  const tail = title.match(/\s*[～〜~]\s*[\d０-９]{1,2}(?:\s*[/／]\s*[\d０-９]{1,2}(?:日)?|日)\s*$/);
  if (!tail || candidatePeriodApi.inferCandidatePeriodEnd(candidate.startDate, [title]).endDate !== candidate.endDate) return title;
  return title.slice(0, tail.index).trim() || title;
}

function isSafeAnnualEventCandidate(candidate) {
  return candidate.needsReview !== true && candidate.duplicateWarning !== true
    && !["school_event", "other"].includes(candidate.suggestedCategory)
    && validCandidateRegistrationDate(candidate.endDate)
    && [true, false].includes(candidate.suggestedRegularClassesAvailable);
}

function createAnnualEventCandidateDraft(candidate) {
  return { ...structuredClone(candidate), title: candidateRegistrationTitle(candidate),
    category: candidate.suggestedCategory,
    regularClassesAvailable: candidate.suggestedRegularClassesAvailable,
    selected: isSafeAnnualEventCandidate(candidate), reviewConfirmed: false, errors: [] };
}

function editAnnualEventCandidateDraft(candidate, changes) {
  // Whitelist editable fields; the independent PDF source snapshots survive.
  const draft = { ...candidate };
  for (const key of ["startDate", "endDate", "title", "category", "regularClassesAvailable"])
    if (Object.hasOwn(changes, key)) draft[key] = changes[key];
  draft.reviewConfirmed = true;
  draft.errors = [];
  return draft;
}

function validateAnnualEventCandidateDraft(candidate) {
  const errors = [];
  if (!validCandidateRegistrationDate(candidate.startDate)) errors.push("開始日を正しく入力してください");
  if (!validCandidateRegistrationDate(candidate.endDate)) errors.push("終了日を確定してください");
  if (validCandidateRegistrationDate(candidate.startDate) && validCandidateRegistrationDate(candidate.endDate)
    && candidate.endDate < candidate.startDate) errors.push("終了日は開始日以降にしてください");
  if (!String(candidate.title ?? "").trim()) errors.push("行事名を入力してください");
  if (!Object.hasOwn(candidateEventApi.ANNUAL_EVENT_CATEGORIES, candidate.category)) errors.push("区分を選択してください");
  if (![true, false].includes(candidate.regularClassesAvailable)) errors.push("通常授業可否を確定してください");
  if (candidate.needsReview && !candidate.reviewConfirmed) errors.push("編集画面で内容を確認して候補に反映してください");
  return errors;
}

function normalizedCandidateEventTitle(title) {
  return String(title ?? "").normalize("NFKC").replace(/\s+/g, "");
}

function isRegisteredAnnualEventCandidate(candidate, events) {
  const normalize = normalizedCandidateEventTitle;
  const holidayNames = Object.values(candidateHolidayApi.NATIONAL_HOLIDAYS_BY_YEAR).flat()
    .filter(([date]) => date === candidate.startDate).map(([, title]) => normalize(title));
  const isNationalHoliday = candidate.category === "holiday" && candidate.startDate === candidate.endDate
    && (holidayNames.includes(normalize(candidate.title))
      || candidate.sourceCandidates?.some(source => holidayNames.includes(normalize(source.title))));
  return events.some(event => (event.startDate === candidate.startDate
    && (event.endDate || event.startDate) === candidate.endDate && normalize(event.title) === normalize(candidate.title))
    || (isNationalHoliday && event.startDate === candidate.startDate && (event.endDate || event.startDate) === candidate.endDate
      && event.category === "holiday" && (String(event.id).startsWith("national-holiday:")
        || holidayNames.includes(normalize(event.title)) || /国民の祝日|祝日法/.test(event.memo ?? ""))));
}

function selectAnnualEventCandidateDrafts(candidates, mode, visible = candidates, events = []) {
  const shown = new Set(visible);
  for (const candidate of candidates) {
    if (isRegisteredAnnualEventCandidate(candidate, events)) candidate.selected = false;
    else if (mode === "clear") candidate.selected = false;
    else if (mode === "visible" && shown.has(candidate)) candidate.selected = true;
    else if (mode === "safe" && isSafeAnnualEventCandidate(candidate)
      && !validateAnnualEventCandidateDraft(candidate).length) candidate.selected = true;
  }
}

function registerAnnualEventCandidateDrafts(candidates, existingEvents, idFactory) {
  const events = [...existingEvents];
  let addedCount = 0, skippedCount = 0, invalidCount = 0;
  for (const candidate of candidates.filter(item => item.selected)) {
    candidate.errors = [];
    if (isRegisteredAnnualEventCandidate(candidate, events)) { skippedCount++; continue; }
    candidate.errors = validateAnnualEventCandidateDraft(candidate);
    if (candidate.errors.length) { invalidCount++; continue; }
    events.push(candidateEventApi.normalizeAnnualEvent({ id: idFactory(), startDate: candidate.startDate,
      endDate: candidate.endDate, title: candidate.title.trim(), category: candidate.category,
      regularClassesAvailable: candidate.regularClassesAvailable, memo: "" }));
    addedCount++;
  }
  return { events, addedCount, skippedCount, invalidCount };
}

if (typeof module !== "undefined") module.exports = { validCandidateRegistrationDate,
  candidateRegistrationTitle, isSafeAnnualEventCandidate, createAnnualEventCandidateDraft,
  editAnnualEventCandidateDraft, validateAnnualEventCandidateDraft, normalizedCandidateEventTitle,
  isRegisteredAnnualEventCandidate, selectAnnualEventCandidateDrafts, registerAnnualEventCandidateDrafts };
