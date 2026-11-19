const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatterFor(timezone) {
  return new Intl.DateTimeFormat('en-US-u-nu-latn', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

function partsAt(timestamp, formatter) {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    date: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

export function isValidDateString(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function isValidTime(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function weekdayForDate(value) {
  if (!isValidDateString(value)) return -1;
  return new Date(`${value}T00:00:00.000Z`).getUTCDay();
}

export function isValidTimezone(timezone) {
  if (typeof timezone !== 'string' || !timezone.trim()) return false;
  try {
    formatterFor(timezone.trim());
    return true;
  } catch {
    return false;
  }
}

export function localDateTimeParts(timestamp, timezone) {
  return partsAt(new Date(timestamp).getTime(), formatterFor(timezone));
}

export function localDateTimeToUtc(date, time, timezone) {
  if (!isValidDateString(date) || !isValidTime(time) || !isValidTimezone(timezone)) {
    throw new RangeError('Invalid local date, time, or timezone');
  }

  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = formatterFor(timezone);
  const samples = [desired - DAY_MS, desired, desired + DAY_MS];
  const offsets = new Set(samples.map((sample) => {
    const local = partsAt(sample, formatter);
    return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - sample;
  }));
  const candidates = [...offsets]
    .map((offset) => desired - offset)
    .filter((candidate) => {
      const local = partsAt(candidate, formatter);
      return local.date === date && local.time === time && local.second === 0;
    });

  if (!candidates.length) throw new RangeError('This local time does not exist in the selected timezone');
  return new Date(Math.min(...candidates));
}

export function occupiedMinuteKeys(startAt, durationMinutes) {
  const start = startAt.getTime();
  return Array.from({ length: durationMinutes }, (_, index) => Math.floor(start / 60000) + index);
}
