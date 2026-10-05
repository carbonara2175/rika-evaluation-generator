"use strict";

// 内閣府「国民の祝日について」で公表された日付を、外部通信なしで使える形で保持する。
// 公表年が追加されたときは、この年別配列へ行を追加する。
// https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
const NATIONAL_HOLIDAYS_BY_YEAR = Object.freeze({
  2026: Object.freeze([
    ["2026-01-01", "元日"], ["2026-01-12", "成人の日"], ["2026-02-11", "建国記念の日"],
    ["2026-02-23", "天皇誕生日"], ["2026-03-20", "春分の日"], ["2026-04-29", "昭和の日"],
    ["2026-05-03", "憲法記念日"], ["2026-05-04", "みどりの日"], ["2026-05-05", "こどもの日"],
    ["2026-05-06", "振替休日", "祝日法第3条第2項による休日"], ["2026-07-20", "海の日"],
    ["2026-08-11", "山の日"], ["2026-09-21", "敬老の日"],
    ["2026-09-22", "国民の休日", "祝日法第3条第3項による休日"], ["2026-09-23", "秋分の日"],
    ["2026-10-12", "スポーツの日"], ["2026-11-03", "文化の日"], ["2026-11-23", "勤労感謝の日"]
  ]),
  2027: Object.freeze([
    ["2027-01-01", "元日"], ["2027-01-11", "成人の日"], ["2027-02-11", "建国記念の日"],
    ["2027-02-23", "天皇誕生日"], ["2027-03-21", "春分の日"],
    ["2027-03-22", "振替休日", "祝日法第3条第2項による休日"], ["2027-04-29", "昭和の日"],
    ["2027-05-03", "憲法記念日"], ["2027-05-04", "みどりの日"], ["2027-05-05", "こどもの日"],
    ["2027-07-19", "海の日"], ["2027-08-11", "山の日"], ["2027-09-20", "敬老の日"],
    ["2027-09-23", "秋分の日"], ["2027-10-11", "スポーツの日"], ["2027-11-03", "文化の日"],
    ["2027-11-23", "勤労感謝の日"]
  ])
});

const NATIONAL_HOLIDAY_ID_PREFIX = "national-holiday:";

function nationalHolidaysForSchoolYear(schoolYear) {
  const year = Math.trunc(Number(schoolYear));
  const start = `${year}-04-01`;
  const end = `${year + 1}-03-31`;
  return [year, year + 1]
    .flatMap((calendarYear) => NATIONAL_HOLIDAYS_BY_YEAR[calendarYear] || [])
    .filter(([date]) => date >= start && date <= end)
    .map(([date, title, specialMemo]) => ({
      id: `${NATIONAL_HOLIDAY_ID_PREFIX}${date}:${title}`,
      startDate: date,
      endDate: date,
      title,
      category: "holiday",
      regularClassesAvailable: false,
      memo: specialMemo || "国民の祝日"
    }));
}

function hasNationalHolidayDataForSchoolYear(schoolYear) {
  const year = Math.trunc(Number(schoolYear));
  return Boolean(NATIONAL_HOLIDAYS_BY_YEAR[year] && NATIONAL_HOLIDAYS_BY_YEAR[year + 1]);
}

function addMissingNationalHolidays(existingEvents, schoolYear) {
  const additions = nationalHolidaysForSchoolYear(schoolYear);
  const existing = Array.isArray(existingEvents) ? existingEvents : [];
  const isDuplicate = (holiday) => existing.some((event) =>
    event?.id === holiday.id || (
      event?.startDate === holiday.startDate &&
      event?.category === "holiday" &&
      event?.title === holiday.title &&
      event?.memo === holiday.memo
    )
  );
  const added = additions.filter((holiday) => !isDuplicate(holiday));
  return { events: [...existing, ...added], addedCount: added.length, skippedCount: additions.length - added.length };
}

if (typeof module !== "undefined") module.exports = {
  NATIONAL_HOLIDAYS_BY_YEAR, NATIONAL_HOLIDAY_ID_PREFIX, nationalHolidaysForSchoolYear,
  hasNationalHolidayDataForSchoolYear, addMissingNationalHolidays
};
