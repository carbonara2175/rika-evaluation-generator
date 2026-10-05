"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  nationalHolidaysForSchoolYear, hasNationalHolidayDataForSchoolYear, addMissingNationalHolidays
} = require("./national-holidays");

test("2026 school year includes official holidays through March 2027", () => {
  const holidays = nationalHolidaysForSchoolYear(2026);
  assert.equal(holidays.length, 19);
  assert.equal(holidays[0].startDate, "2026-04-29");
  assert.equal(holidays.at(-1).startDate, "2027-03-22");
  assert.ok(holidays.some(({ startDate, title, memo }) =>
    startDate === "2026-05-06" && title === "振替休日" && memo === "祝日法第3条第2項による休日"
  ));
  assert.ok(holidays.some(({ startDate, title, memo }) =>
    startDate === "2026-09-22" && title === "国民の休日" && memo === "祝日法第3条第3項による休日"
  ));
  assert.ok(holidays.some(({ startDate, title }) => startDate === "2027-03-21" && title === "春分の日"));
  assert.ok(holidays.every(({ category, regularClassesAvailable }) => category === "holiday" && !regularClassesAvailable));
});

test("bulk addition is idempotent and preserves unrelated same-day events", () => {
  const schoolEvent = { id: "school-event", startDate: "2026-07-20", title: "学校行事", category: "school_event" };
  const first = addMissingNationalHolidays([schoolEvent], 2026);
  assert.equal(first.addedCount, 19);
  assert.equal(first.events.length, 20);
  const second = addMissingNationalHolidays(first.events, 2026);
  assert.equal(second.addedCount, 0);
  assert.equal(second.skippedCount, 19);
  assert.equal(second.events.length, 20);
  assert.ok(second.events.includes(schoolEvent));
});

test("a school year is available only when both calendar years are published", () => {
  assert.equal(hasNationalHolidayDataForSchoolYear(2026), true);
  assert.equal(hasNationalHolidayDataForSchoolYear(2027), false);
});
