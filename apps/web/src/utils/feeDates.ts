export const DEFAULT_FEE_GRACE_DAYS = 7;
export const DEFAULT_MID_COURSE_DAYS = 45;

/**
 * Formats a local Date's calendar year/month/day as YYYY-MM-DD without UTC conversion.
 */
export function formatLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns local midnight for the given reference timestamp.
 */
export function getLocalMidnight(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Adds a whole number of calendar days in local time.
 */
export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Parses a date input or ISO string to local midnight, preserving YYYY-MM-DD
 * calendar dates stored at UTC midnight (e.g. Prisma @db.Date values).
 */
export function parseCalendarDateLocal(raw?: string | Date | null): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const iso = raw.toISOString();
    if (iso.endsWith('T00:00:00.000Z')) {
      const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }

  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const isoMidnightMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/);
  if (isoMidnightMatch) {
    const year = Number(isoMidnightMatch[1]);
    const month = Number(isoMidnightMatch[2]);
    const day = Number(isoMidnightMatch[3]);
    const localDate = new Date(year, month - 1, day);
    if (
      localDate.getFullYear() !== year ||
      localDate.getMonth() !== month - 1 ||
      localDate.getDate() !== day
    ) {
      return null;
    }
    return localDate;
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Returns default fee due dates anchored to today + grace period.
 */
export function getDefaultFeeDueDates(
  now = new Date(),
  midCourseDueDays?: number | null
): { preCourseDate: string; midCourseDate: string } {
  const today = getLocalMidnight(now);
  const preCourse = addLocalDays(today, DEFAULT_FEE_GRACE_DAYS);
  const midDays =
    midCourseDueDays && midCourseDueDays > 0 ? midCourseDueDays : DEFAULT_MID_COURSE_DAYS;
  const midCourse = addLocalDays(preCourse, midDays);
  return {
    preCourseDate: formatLocalDateInput(preCourse),
    midCourseDate: formatLocalDateInput(midCourse),
  };
}

/**
 * Computes default initial and mid-course fee due dates for a batch.
 * Guarantees the initial due date is never earlier than today + grace period
 * (even if the batch started in the past or starts today), and that the
 * mid-course due date is strictly after the initial due date.
 */
export function getBatchFeeMilestoneDates(
  batch?: { startDate?: string | Date | null; endDate?: string | Date | null } | null,
  options?: { midCourseDueDays?: number | null; now?: Date }
): { preCourseDate: string; midCourseDate: string } {
  const now = options?.now ?? new Date();
  const midDays =
    options?.midCourseDueDays && options.midCourseDueDays > 0
      ? options.midCourseDueDays
      : DEFAULT_MID_COURSE_DAYS;

  const today = getLocalMidnight(now);
  const minGraceDate = addLocalDays(today, DEFAULT_FEE_GRACE_DAYS);

  if (!batch?.startDate) {
    return {
      preCourseDate: formatLocalDateInput(minGraceDate),
      midCourseDate: formatLocalDateInput(addLocalDays(minGraceDate, midDays)),
    };
  }

  const parsedStart = parseCalendarDateLocal(batch.startDate);
  const preCourse = parsedStart && parsedStart >= minGraceDate ? parsedStart : minGraceDate;

  const parsedEnd = parseCalendarDateLocal(batch.endDate);
  let midCourse: Date;
  if (parsedStart && parsedEnd && parsedEnd > parsedStart) {
    const midMs = parsedStart.getTime() + (parsedEnd.getTime() - parsedStart.getTime()) / 2;
    const candidate = new Date(midMs);
    const candidateLocal = new Date(
      candidate.getFullYear(),
      candidate.getMonth(),
      candidate.getDate()
    );
    midCourse = candidateLocal > preCourse ? candidateLocal : addLocalDays(preCourse, midDays);
  } else {
    midCourse = addLocalDays(preCourse, midDays);
  }

  return {
    preCourseDate: formatLocalDateInput(preCourse),
    midCourseDate: formatLocalDateInput(midCourse),
  };
}
