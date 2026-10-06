"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { inferAnnualEventCandidates } = require("./annual-events");
const { prepareAnnualEventCandidates } = require("./annual-event-candidate-periods");
const { nationalHolidaysForSchoolYear } = require("./national-holidays");
const { createAnnualEventCandidateDraft: draft, editAnnualEventCandidateDraft: edit,
  candidateRegistrationTitle: title, validateAnnualEventCandidateDraft: validate,
  selectAnnualEventCandidateDrafts: select, registerAnnualEventCandidateDrafts: register,
  isRegisteredAnnualEventCandidate: registered } = require("./annual-event-candidate-registration");
const periods = () => prepareAnnualEventCandidates(inferAnnualEventCandidates(require("./test-fixtures/sannohe-r8-calendar-cells.json").cells));
const sample = () => draft(periods().find(item => item.title === "期末考査"));
let nextId = 0;
const id = () => `test-${++nextId}`;

test("Sannohe safe initial selection includes requested exam/break periods only", () => {
  const candidates = periods().map(draft);
  for (const [name, start, end, category] of [
    ["期末考査", "2026-06-18", "2026-06-23", "exam"],
    ["学年末考査", "2027-02-15", "2027-02-18", "exam"],
    ["夏季休業", "2026-07-24", "2026-08-23", "long_break"],
    ["年末年始休", "2026-12-29", "2027-01-03", "long_break"]]) {
    const candidate = candidates.find(item => item.title === name && item.startDate === start);
    assert.equal(candidate.endDate, end); assert.equal(candidate.category, category);
    assert.equal(candidate.regularClassesAvailable, false); assert.equal(candidate.selected, true);
    assert.deepEqual(validate(candidate), []);
  }
  for (const candidate of candidates.filter(item => item.needsReview || item.duplicateWarning
    || ["school_event", "other"].includes(item.category))) assert.equal(candidate.selected, false);
  const suspicious = candidates.find(item => item.startDate === "2026-12-23");
  assert.equal(suspicious.title, "夏季休業"); assert.equal(suspicious.needsReview, true);
  assert.equal(suspicious.sourceText, "夏季休業～ 1/10");
});

test("terminal range removal requires the exact successfully inferred date", () => {
  for (const suffix of ["～8/23", "〜8/23", "~８／２３"]) assert.equal(title({title: "夏季休業"+suffix, startDate:"2026-07-24", endDate:"2026-08-23"}), "夏季休業");
  assert.equal(title({title:"期末考査～13日", startDate:"2026-11-10", endDate:"2026-11-13"}), "期末考査");
  for (const name of ["第2回考査", "考査～13日間", "考査～8/234", "考査～8/23頃", "考査～8/23（予定）", "考査～8/23～8/24"])
    assert.equal(title({title:name,startDate:"2026-07-24",endDate:"2026-08-23"}),name);
  assert.equal(title({title:"夏季休業～8/23",startDate:"2026-07-24",endDate:null}),"夏季休業～8/23");
});

test("editing changes only draft fields and preserves independent PDF provenance", () => {
  const period = periods().find(item => item.startDate === "2026-12-23");
  const candidate = draft(period);
  const changed = edit(candidate, { title:"冬季休業", startDate:"2026-12-24", endDate:"2027-01-10", category:"long_break", regularClassesAvailable:false, sourceText:"overwrite" });
  assert.equal(candidate.title,"夏季休業"); assert.equal(period.title,"夏季休業～ 1/10");
  for (const key of ["sourceText","sourceTexts","sourceDates","sourceCandidates"]) assert.deepEqual(changed[key],period[key]);
  assert.equal(changed.needsReview,true); assert.equal(changed.reviewConfirmed,true); assert.deepEqual(validate(changed),[]);
});

test("selection of visible candidates respects month/category result; clear and safe selection work", () => {
  const candidates = periods().map(draft);
  select(candidates,"clear"); assert.ok(candidates.every(item => !item.selected));
  const visible = candidates.filter(item => item.startDate.startsWith("2026-06") && item.category === "school_event");
  select(candidates,"visible",visible); assert.deepEqual(candidates.filter(item => item.selected),visible);
  select(candidates,"clear"); select(candidates,"safe");
  assert.ok(candidates.filter(item => item.selected).every(item => !item.needsReview && !item.duplicateWarning));
});

test("registration rejects unchecked review, unresolved end, uncertain classes, invalid dates/order/name/category", () => {
  for (const changes of [{needsReview:true}, {endDate:null}, {regularClassesAvailable:null},
    {startDate:"2026-02-30"}, {endDate:"2026-06-17"}, {title:" "}, {category:"invalid"}]) {
    const candidate = {...sample(),...changes};
    const result = register([candidate],[],id);
    assert.equal(result.addedCount,0); assert.equal(result.invalidCount,1); assert.ok(candidate.errors.length);
  }
});

test("confirmed review with valid fields registers; editing alone never mutates existing events", () => {
  const existing = [{id:"existing",title:"既存"}]; const before = structuredClone(existing);
  const candidate = edit({...sample(),needsReview:true}, {title:"確認した考査"});
  assert.deepEqual(existing,before);
  assert.equal(register([candidate],[],id).addedCount,1);
});

test("duplicate identity is dates plus normalized title independent of category/spacing/width", () => {
  const candidate = {...sample(), title:"第１回 期末考査"};
  const existing = [{...candidate,id:"old",title:"第1回期末考査",category:"other"}];
  assert.equal(registered(candidate,existing),true);
  const result = register([candidate],existing,id);
  assert.equal(result.skippedCount,1); assert.deepEqual(result.events,existing);
  assert.equal(registered({...candidate,endDate:"2026-06-24"},existing),false);
});

test("national holiday duplicates skip by date; unrelated holiday does not", () => {
  const candidate = periods().map(draft).find(item => item.title === "昭和の日");
  assert.equal(candidate.selected,false); candidate.selected=true;
  const holiday = nationalHolidaysForSchoolYear(2026).find(item => item.startDate === candidate.startDate);
  assert.equal(register([candidate],[{...holiday,title:"祝日（昭和）"}],id).skippedCount,1);
  assert.equal(registered(candidate,[{...holiday,id:"school",title:"学校独自休業",memo:""}]),false);
});

test("bulk registration preserves schema, skips within-batch/reimport duplicates and ignores unselected rows", () => {
  const candidates = periods().map(draft);
  const selected = candidates.filter(item => item.selected);
  const result = register([...candidates,structuredClone(selected[0])],[],id);
  assert.equal(result.addedCount,selected.length); assert.equal(result.skippedCount,1);
  for (const event of result.events) assert.deepEqual(Object.keys(event),["id","startDate","endDate","title","category","regularClassesAvailable","memo"]);
  const repeated = register(periods().map(draft),result.events,id);
  assert.equal(repeated.addedCount,0); assert.equal(repeated.skippedCount,selected.length);
  select(candidates,"safe",candidates,result.events); assert.ok(candidates.every(item => !item.selected));
});
