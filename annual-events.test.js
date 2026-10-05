"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  annualEventsStorageKey, normalizeAnnualEvent, annualEventDisplayTitle,
  sortAnnualEvents, formatEventDateRange
} = require("./annual-events");

test("storage keys completely separate schools and years", () => {
  assert.equal(annualEventsStorageKey("sanno", 2027), "rika-annual-events-v1:sanno:2027");
  assert.notEqual(annualEventsStorageKey("sanno", 2027), annualEventsStorageKey("santo", 2027));
  assert.notEqual(annualEventsStorageKey("sanno", 2027), annualEventsStorageKey("sanno", 2028));
});

test("an omitted end date becomes a one-day event", () => {
  const event = normalizeAnnualEvent({ id: "1", startDate: "2027-05-18", title: "考査", category: "exam" });
  assert.equal(event.endDate, "2027-05-18");
  assert.equal(event.regularClassesAvailable, false);
});

test("an omitted title is preserved and displayed using its category", () => {
  const event = normalizeAnnualEvent({ startDate: "2027-05-18", title: "", category: "exam" });
  assert.equal(event.title, "");
  assert.equal(annualEventDisplayTitle(event), "考査");
  assert.equal(annualEventDisplayTitle({ title: "体育祭", category: "school_event" }), "体育祭");
});

test("events are sorted by their start date", () => {
  const events = sortAnnualEvents([
    { id: "2", startDate: "2027-08-23", title: "始業式", category: "school_event" },
    { id: "1", startDate: "2027-07-22", endDate: "2027-08-22", title: "夏季休業", category: "long_break" }
  ]);
  assert.deepEqual(events.map(({ id }) => id), ["1", "2"]);
  assert.equal(formatEventDateRange(events[0].startDate, events[0].endDate), "7/22 ～ 8/22");
});
