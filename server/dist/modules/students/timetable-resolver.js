"use strict";
/**
 * Digital Guru Franchise — Timetable & Schedule Resolver
 * Safely parses free-form schedule strings from Batch and BatchSubject records
 * without silently inventing or dropping data.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveStructuredTimetable = resolveStructuredTimetable;
const ALL_DAYS = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
];
const DAY_LABELS = {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday',
};
const DAY_MAP = {
    mon: 'MONDAY',
    monday: 'MONDAY',
    tue: 'TUESDAY',
    tues: 'TUESDAY',
    tuesday: 'TUESDAY',
    wed: 'WEDNESDAY',
    wednesday: 'WEDNESDAY',
    thu: 'THURSDAY',
    thur: 'THURSDAY',
    thurs: 'THURSDAY',
    thursday: 'THURSDAY',
    fri: 'FRIDAY',
    friday: 'FRIDAY',
    sat: 'SATURDAY',
    saturday: 'SATURDAY',
    sun: 'SUNDAY',
    sunday: 'SUNDAY',
};
/**
 * Parses days from string tokens like "Mon-Fri", "Weekends", "Mon, Wed, Fri"
 */
function parseDays(dayPart) {
    const normalized = dayPart.toLowerCase().trim();
    if (normalized.includes('weekend')) {
        return ['SATURDAY', 'SUNDAY'];
    }
    if (normalized.includes('weekday') || normalized.includes('daily') || normalized.includes('everyday')) {
        return ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    }
    // Handle range like "Mon-Fri" or "Monday - Friday"
    const rangeMatch = normalized.match(/([a-z]+)\s*(?:-|to)\s*([a-z]+)/i);
    if (rangeMatch) {
        const startDay = DAY_MAP[rangeMatch[1].toLowerCase()];
        const endDay = DAY_MAP[rangeMatch[2].toLowerCase()];
        if (startDay && endDay) {
            const startIndex = ALL_DAYS.indexOf(startDay);
            const endIndex = ALL_DAYS.indexOf(endDay);
            if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
                return ALL_DAYS.slice(startIndex, endIndex + 1);
            }
        }
    }
    // Handle comma or space separated days e.g. "Mon, Wed, Fri"
    const tokens = normalized.split(/[\s,]+/);
    const matchedDays = [];
    for (const token of tokens) {
        const mapped = DAY_MAP[token.toLowerCase()];
        if (mapped && !matchedDays.includes(mapped)) {
            matchedDays.push(mapped);
        }
    }
    return matchedDays;
}
/**
 * Resolves day-of-week name for a Date in local/IST context
 */
function getCurrentDayOfWeek(date = new Date()) {
    // Day 0 = Sunday, 1 = Monday, etc.
    const dayIndex = date.getDay();
    switch (dayIndex) {
        case 0:
            return 'SUNDAY';
        case 1:
            return 'MONDAY';
        case 2:
            return 'TUESDAY';
        case 3:
            return 'WEDNESDAY';
        case 4:
            return 'THURSDAY';
        case 5:
            return 'FRIDAY';
        case 6:
            return 'SATURDAY';
        default:
            return 'MONDAY';
    }
}
/**
 * Resolves structured timetable from enrolled batch and batch subjects.
 */
function resolveStructuredTimetable(batch, now = new Date()) {
    const currentDay = getCurrentDayOfWeek(now);
    const dayMap = {
        MONDAY: [],
        TUESDAY: [],
        WEDNESDAY: [],
        THURSDAY: [],
        FRIDAY: [],
        SATURDAY: [],
        SUNDAY: [],
    };
    if (!batch) {
        return {
            batchId: null,
            batchName: 'No Enrolled Batch',
            academicYear: null,
            rawSchedule: null,
            isParsed: false,
            days: ALL_DAYS.map((d) => ({
                day: d,
                label: DAY_LABELS[d],
                isToday: d === currentDay,
                slots: [],
            })),
            todaySlots: [],
        };
    }
    const rawBatchSchedule = batch.schedule?.trim() || null;
    let batchScheduleParsed = false;
    let unparsedWarning = null;
    // 1. Process batch-level subjects or default batch schedule
    const batchSubjects = batch.batchSubjects || [];
    if (batchSubjects.length > 0) {
        for (const bs of batchSubjects) {
            const scheduleString = (bs.schedule || rawBatchSchedule || '').trim();
            const subjectName = bs.subject?.name || 'Class Session';
            const teacherName = bs.staffProfile?.user?.fullName || null;
            if (!scheduleString) {
                continue;
            }
            // Regex for time e.g. "10:00 AM - 12:00 PM"
            const timeMatch = scheduleString.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/i);
            const days = parseDays(scheduleString);
            if (days.length > 0 && timeMatch) {
                batchScheduleParsed = true;
                const timeDisplay = `${timeMatch[1].trim()} - ${timeMatch[2].trim()}`;
                for (const day of days) {
                    dayMap[day].push({
                        id: `${bs.id}-${day}`,
                        subjectName,
                        batchName: batch.name,
                        teacherName,
                        staffProfileId: bs.staffProfileId || bs.staffProfile?.id || null,
                        timeDisplay,
                        startTime: timeMatch[1].trim(),
                        endTime: timeMatch[2].trim(),
                        rawSchedule: scheduleString,
                        isParsed: true,
                    });
                }
            }
            else {
                // Unparseable format — preserve without dropping!
                unparsedWarning = `Schedule format "${scheduleString}" is shown in raw format.`;
                // Attach to weekdays or current day with unparsed flag
                const targetDays = days.length > 0 ? days : ALL_DAYS.slice(0, 5);
                for (const day of targetDays) {
                    dayMap[day].push({
                        id: `${bs.id}-${day}-raw`,
                        subjectName,
                        batchName: batch.name,
                        teacherName,
                        staffProfileId: bs.staffProfileId || bs.staffProfile?.id || null,
                        timeDisplay: scheduleString,
                        rawSchedule: scheduleString,
                        isParsed: false,
                    });
                }
            }
        }
    }
    else if (rawBatchSchedule) {
        // Batch has schedule string but no explicit batchSubjects yet
        const timeMatch = rawBatchSchedule.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/i);
        const days = parseDays(rawBatchSchedule);
        if (days.length > 0 && timeMatch) {
            batchScheduleParsed = true;
            const timeDisplay = `${timeMatch[1].trim()} - ${timeMatch[2].trim()}`;
            for (const day of days) {
                dayMap[day].push({
                    id: `${batch.id}-${day}`,
                    subjectName: 'Regular Session',
                    batchName: batch.name,
                    teacherName: null,
                    timeDisplay,
                    startTime: timeMatch[1].trim(),
                    endTime: timeMatch[2].trim(),
                    rawSchedule: rawBatchSchedule,
                    isParsed: true,
                });
            }
        }
        else {
            unparsedWarning = `Batch schedule "${rawBatchSchedule}" could not be parsed into daily slots.`;
            for (const day of ALL_DAYS.slice(0, 5)) {
                dayMap[day].push({
                    id: `${batch.id}-${day}-raw`,
                    subjectName: 'Regular Session',
                    batchName: batch.name,
                    teacherName: null,
                    timeDisplay: rawBatchSchedule,
                    rawSchedule: rawBatchSchedule,
                    isParsed: false,
                });
            }
        }
    }
    const days = ALL_DAYS.map((d) => ({
        day: d,
        label: DAY_LABELS[d],
        isToday: d === currentDay,
        slots: dayMap[d],
    }));
    const todaySlots = dayMap[currentDay] || [];
    return {
        batchId: batch.id,
        batchName: batch.name,
        academicYear: batch.academicYear || null,
        rawSchedule: rawBatchSchedule,
        isParsed: batchScheduleParsed,
        unparsedWarning,
        days,
        todaySlots,
    };
}
