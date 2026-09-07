import { pick, type Random, shuffle } from "./random";

/**
 * Mockup records are spread over several years so the public year archives
 * (`/knowledge/[year]`, `/tech/[year]`) and the nav year submenus have something
 * to show for every year.
 *
 * Years here are ordinary Gregorian years. The public site derives the Buddhist
 * Era year it displays from the published revision's `publishedAt` read in
 * Asia/Bangkok (see `src/utils/buddhist-year.ts`), so the dates are built at UTC
 * midnight: Bangkok is UTC+7, which keeps the day and therefore the year the
 * same on both sides.
 */
export const SEED_PUBLISH_YEARS = [2024, 2025, 2026] as const;

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Keep a template's day and month but move it into the given year. The day is
 * clamped so a template dated the 31st never rolls into the next month.
 */
export function withPublishYear(base: Date, year: number) {
  const monthIndex = base.getUTCMonth();
  const day = Math.min(base.getUTCDate(), daysInMonth(year, monthIndex));
  return new Date(Date.UTC(year, monthIndex, day));
}

/**
 * Pick a publish year for every seeded record. Years are random, except that
 * each year is guaranteed one publicly visible record, so no year in
 * `SEED_PUBLISH_YEARS` ends up as an empty archive.
 *
 * `isLivePublished` marks the records the public site will actually list, which
 * is a published revision that is neither archived nor deleted. Draft,
 * in-review, archived and deleted records can fall anywhere.
 */
export function assignPublishYears(
  isLivePublished: boolean[],
  years: readonly number[] = SEED_PUBLISH_YEARS,
  random: Random = Math.random,
) {
  if (years.length === 0) {
    throw new Error("ต้องระบุปีสำหรับกระจายข้อมูล seed อย่างน้อย 1 ปี");
  }

  const liveIndexes = isLivePublished.flatMap((live, index) =>
    live ? [index] : [],
  );
  if (liveIndexes.length < years.length) {
    throw new Error(
      `ข้อมูล seed ที่เผยแพร่มี ${liveIndexes.length} รายการ ไม่พอสำหรับ ${years.length} ปี`,
    );
  }

  const assigned = isLivePublished.map(() => pick(years, random));

  // Reserve one live record per year, drawn at random so the guaranteed records
  // are not always the first few in the list.
  const shuffledLiveIndexes = shuffle(liveIndexes, random);
  years.forEach((year, offset) => {
    assigned[shuffledLiveIndexes[offset]] = year;
  });

  return assigned;
}

/**
 * A date for a record whose template carries no date of its own.
 *
 * Spread across months and days by position so records inside one year do not all
 * land on the same day and the public lists have a meaningful sort order. The year
 * is a placeholder: `withPublishYear` moves the result into its assigned year.
 */
export function spreadWithinYear(index: number) {
  const monthIndex = index % 12;
  const day = (index % daysInMonth(2025, monthIndex)) + 1;
  return new Date(Date.UTC(2025, monthIndex, day));
}
