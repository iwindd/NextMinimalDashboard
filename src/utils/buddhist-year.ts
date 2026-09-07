import { toValidDate, type DateValue } from "./format";

/**
 * Public content is grouped by the Thai Buddhist Era (พ.ศ.) year it was
 * published in. There is no year column in the database, so every year is
 * derived from `publishedAt` (falling back to `createdAt`) evaluated in the
 * Asia/Bangkok timezone, which is the timezone the site is authored for.
 */
const BUDDHIST_YEAR_OFFSET = 543;

const BANGKOK_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US-u-ca-gregory", {
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const YEAR_SEGMENT_PATTERN = /^\d{4}$/;

export function getBuddhistYear(value: DateValue) {
  const date = toValidDate(value);
  if (!date) return null;
  const gregorianYear = Number(BANGKOK_YEAR_FORMATTER.format(date));
  return Number.isFinite(gregorianYear)
    ? gregorianYear + BUDDHIST_YEAR_OFFSET
    : null;
}

/**
 * A four-digit segment is interpreted as a Buddhist Era year. Content ids are
 * cuids, which never consist of exactly four digits.
 */
export function parseBuddhistYearSegment(segment: string) {
  return YEAR_SEGMENT_PATTERN.test(segment) ? Number(segment) : null;
}

/** Unique Buddhist years present in the given dates, newest first. */
export function collectBuddhistYears(values: DateValue[]) {
  const years = new Set<number>();
  for (const value of values) {
    const year = getBuddhistYear(value);
    if (year !== null) years.add(year);
  }
  return [...years].sort((first, second) => second - first);
}

export function filterByBuddhistYear<Item extends { publishedAt: string }>(
  items: Item[],
  year: number,
) {
  return items.filter((item) => getBuddhistYear(item.publishedAt) === year);
}

/**
 * Asia/Bangkok has no DST, so a Buddhist year always maps to a fixed UTC
 * range: the Gregorian year is UTC+7, i.e. `[Dec 31 17:00 UTC of the
 * previous Gregorian year, Dec 31 17:00 UTC of that Gregorian year)`. Used to
 * filter a year archive at the database level instead of fetching every
 * published row and filtering it in memory.
 */
function getBuddhistYearUtcRange(buddhistYear: number) {
  const gregorianYear = buddhistYear - BUDDHIST_YEAR_OFFSET;
  return {
    gte: new Date(Date.UTC(gregorianYear - 1, 11, 31, 17, 0, 0, 0)),
    lt: new Date(Date.UTC(gregorianYear, 11, 31, 17, 0, 0, 0)),
  };
}

/**
 * Public content's display date is `publishedAt ?? createdAt`; this builds
 * the matching Prisma `OR` so a Buddhist year archive can be filtered at the
 * database level: either `publishedAt` falls in the year, or `publishedAt` is
 * absent and `createdAt` does.
 */
function buddhistYearWhere(buddhistYear: number) {
  const range = getBuddhistYearUtcRange(buddhistYear);
  return {
    OR: [
      { publishedAt: range },
      { publishedAt: null, createdAt: range },
    ],
  };
}
