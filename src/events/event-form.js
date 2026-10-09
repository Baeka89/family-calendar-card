import { formatLocalDate, parseLocalDate, parsePossiblyLocalDateTime } from '../utils/date-utils.js';

function parseEventDateTime(value) {
  if (typeof value === 'string') {
    const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:[zZ]|[+-]\d{2}:?\d{2})?$/);
    if (parts) {
      const [year, month, day, hour, minute, second] = parts.slice(1).map(part => Number(part ?? 0));
      const calendarDate = new Date(0);
      calendarDate.setUTCFullYear(year, month - 1, day);
      if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 ||
          calendarDate.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return new Date(NaN);
      if (!/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value)) {
        const parsed = parsePossiblyLocalDateTime(value);
        if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day ||
            parsed.getHours() !== hour || parsed.getMinutes() !== minute || parsed.getSeconds() !== second) return new Date(NaN);
        return parsed;
      }
    }
  }
  return parsePossiblyLocalDateTime(value);
}

export const resolveTimedEventRange = (startValue, endValue, fallbackDurationMs = 60 * 60 * 1000) => {
  const start = parseEventDateTime(startValue);
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    return { start: null, end: null };
  }

  const parsedEnd = endValue ? parseEventDateTime(endValue) : null;
  if (endValue) {
    return {
      start,
      end: parsedEnd instanceof Date && Number.isFinite(parsedEnd.getTime()) ? parsedEnd : null
    };
  }

  return {
    start,
    end: new Date(start.getTime() + fallbackDurationMs)
  };
};

export const buildRRuleFromInputs = ({ frequency, interval, untilDate, count, byDay, isAllDay = false }) => {
  const parts = [`FREQ=${frequency}`];
  const parsedInterval = parseInt(interval, 10);

  if (!Number.isNaN(parsedInterval) && parsedInterval > 1) {
    parts.push(`INTERVAL=${parsedInterval}`);
  }

  if (Array.isArray(byDay) && byDay.length > 0) {
    parts.push(`BYDAY=${byDay.join(',')}`);
  }

  const parsedCount = parseInt(count, 10);
  if (!Number.isNaN(parsedCount) && parsedCount > 0) {
    parts.push(`COUNT=${parsedCount}`);
  } else if (untilDate) {
    const until = new Date(`${untilDate}T23:59:59`);
    if (!Number.isNaN(until.getTime())) {
      const compactUntil = isAllDay ? untilDate.replace(/-/g, '') : until.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      parts.push(`UNTIL=${compactUntil}`);
    }
  }

  return parts.join(';');
};

export const normalizeEventFormData = ({
  title,
  location,
  description,
  isAllDay,
  startDate,
  endDate,
  startDateTime,
  endDateTime,
  fallbackDurationMs = 60 * 60 * 1000,
  recurrence = null
}) => {
  if (!title) {
    return { valid: false, errorKey: 'eventTitleRequired' };
  }

  const eventData = {
    summary: title,
    location: location ?? undefined,
    description: description ?? undefined
  };

  if (isAllDay) {
    if (!startDate || !endDate) {
      return { valid: false, errorKey: 'startEndDatesRequired' };
    }

    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
        formatLocalDate(start) !== startDate || formatLocalDate(end) !== endDate) {
      return { valid: false, errorKey: 'startEndDatesRequired' };
    }

    if (end < start) {
      return { valid: false, errorKey: 'endDateBeforeStart' };
    }

    const exclusiveEndDate = new Date(end);
    exclusiveEndDate.setDate(exclusiveEndDate.getDate() + 1);
    const exclusiveEndDateStr = formatLocalDate(exclusiveEndDate);

    eventData.start = { date: startDate };
    eventData.end = { date: exclusiveEndDateStr };
  } else {
    if (!startDateTime) {
      return { valid: false, errorKey: 'startEndTimesRequired' };
    }

    const { start, end } = resolveTimedEventRange(startDateTime, endDateTime, fallbackDurationMs);

    if (!start || !end || !Number.isFinite(end.getTime())) {
      return { valid: false, errorKey: 'startEndTimesRequired' };
    }

    if (end <= start) {
      return { valid: false, errorKey: 'endTimeBeforeStart' };
    }

    eventData.start = { dateTime: start.toISOString() };
    eventData.end = { dateTime: end.toISOString() };
  }

  if (recurrence?.enabled) {
    if (recurrence.endMode === 'after') {
      const count = String(recurrence.count ?? '');
      if (!/^[1-9]\d*$/.test(count) || !Number.isSafeInteger(Number(count))) {
        return { valid: false, errorKey: 'recurrenceEndRequired' };
      }
    }
    if (recurrence.endMode === 'on') {
      const untilDate = recurrence.untilDate;
      const until = parseLocalDate(untilDate);
      const firstDate = isAllDay ? startDate : String(startDateTime).slice(0, 10);
      if (!untilDate || !Number.isFinite(until.getTime()) || formatLocalDate(until) !== untilDate || untilDate < firstDate) {
        return { valid: false, errorKey: 'recurrenceEndRequired' };
      }
    }
    if (recurrence.frequency === 'WEEKLY' && (!Array.isArray(recurrence.byDay) || recurrence.byDay.length === 0)) {
      return { valid: false, errorKey: 'recurrenceSelectWeekday' };
    }

    eventData.rrule = buildRRuleFromInputs({
      isAllDay,
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      untilDate: recurrence.untilDate,
      count: recurrence.count,
      byDay: recurrence.frequency === 'WEEKLY' ? recurrence.byDay : []
    });
  }

  return { valid: true, eventData };
};
