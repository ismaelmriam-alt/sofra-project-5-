import { randomUUID } from 'node:crypto';
import Reservation, { RESERVATION_STATUSES } from '../models/Reservation.js';
import ReservationSettings from '../models/ReservationSettings.js';
import { HttpError } from '../middleware/errorHandler.js';
import {
  isValidDateString,
  isValidTime,
  isValidTimezone,
  localDateTimeParts,
  localDateTimeToUtc,
  occupiedMinuteKeys,
  weekdayForDate,
} from '../reservationTime.js';

const SETTINGS_ID = 'sofra-reservations';
const DAY_COUNT = 7;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACTIVE_STATUSES = ['Pending', 'Confirmed'];

const cleanText = (value) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim()
  : '';

const timeMinutes = (time) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

function addDateDays(date, days) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function timeFromMinutes(minutes) {
  const clockMinutes = minutes % (24 * 60);
  return `${String(Math.floor(clockMinutes / 60)).padStart(2, '0')}:${String(clockMinutes % 60).padStart(2, '0')}`;
}

function isOvernight(day) {
  return timeMinutes(day.closeTime) < timeMinutes(day.openTime);
}

function settingsDto(settings) {
  if (!settings) return { configured: false, settings: null };
  return {
    configured: Boolean(settings.configured),
    settings: {
      restaurantTimezone: settings.restaurantTimezone,
      weeklySchedule: settings.weeklySchedule.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        isOpen: day.isOpen,
        openTime: day.openTime,
        closeTime: day.closeTime,
      })),
      reservationDurationMinutes: settings.reservationDurationMinutes,
      numberOfTables: settings.numberOfTables,
      tables: settings.tables,
      maximumGuests: settings.maximumGuests,
    },
  };
}

function validateSettings(input) {
  const errors = {};
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  // Booking starts are derived at request time from weeklySchedule and the
  // reservation duration. Ignore legacy/manual bookingTimes fields entirely.
  const restaurantTimezone = cleanText(source.restaurantTimezone);
  const reservationDurationMinutes = Number(source.reservationDurationMinutes);
  const numberOfTables = Number(source.numberOfTables);
  const maximumGuests = Number(source.maximumGuests);
  const scheduleInput = Array.isArray(source.weeklySchedule) ? source.weeklySchedule : [];
  const tablesInput = Array.isArray(source.tables) ? source.tables : [];

  if (!isValidTimezone(restaurantTimezone)) errors.restaurantTimezone = 'Enter a valid IANA timezone.';
  if (!Number.isInteger(reservationDurationMinutes) || reservationDurationMinutes < 1 || reservationDurationMinutes > 1440) {
    errors.reservationDurationMinutes = 'Enter a duration between 1 and 1440 minutes.';
  }
  if (!Number.isInteger(numberOfTables) || numberOfTables < 1 || numberOfTables > 100) {
    errors.numberOfTables = 'Enter a table count between 1 and 100.';
  }
  if (tablesInput.length !== numberOfTables) {
    errors.tables = 'Provide one capacity entry for every table.';
  }
  if (!Number.isInteger(maximumGuests) || maximumGuests < 1 || maximumGuests > 1000) {
    errors.maximumGuests = 'Enter a positive maximum guest count.';
  }

  if (scheduleInput.length !== DAY_COUNT) {
    errors.weeklySchedule = 'Configure each day of the week exactly once.';
  }

  const daysSeen = new Set();
  const weeklySchedule = scheduleInput.map((day) => {
    const dayOfWeek = Number(day?.dayOfWeek);
    const isOpen = day?.isOpen;
    const openTime = cleanText(day?.openTime);
    const closeTime = cleanText(day?.closeTime);

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || daysSeen.has(dayOfWeek)) {
      errors.weeklySchedule = 'Configure each day of the week exactly once.';
    }
    daysSeen.add(dayOfWeek);
    if (typeof isOpen !== 'boolean') errors.weeklySchedule = 'Choose open or closed for every day.';

    if (isOpen === true) {
      if (!TIME_PATTERN.test(openTime) || !TIME_PATTERN.test(closeTime) || openTime === closeTime) {
        errors.weeklySchedule = 'Each open day needs different, valid opening and closing times.';
      }
    }

    return {
      dayOfWeek,
      isOpen,
      openTime: isOpen ? openTime : '',
      closeTime: isOpen ? closeTime : '',
    };
  });

  if (daysSeen.size !== DAY_COUNT) errors.weeklySchedule = 'Configure each day of the week exactly once.';

  const tableIds = new Set();
  const tableNames = new Set();
  const tables = tablesInput.map((table) => {
    const tableId = cleanText(table?.tableId) || randomUUID();
    const name = cleanText(table?.name);
    const capacity = Number(table?.capacity);
    const normalizedName = name.toLocaleLowerCase();
    if (tableId.length > 64 || !/^[\w-]+$/.test(tableId) || tableIds.has(tableId)) errors.tables = 'Table identifiers must be unique.';
    if (!name || name.length > 40 || tableNames.has(normalizedName)) errors.tables = 'Give each table a unique name of at most 40 characters.';
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) errors.tables = 'Each table needs a positive seating capacity.';
    tableIds.add(tableId);
    tableNames.add(normalizedName);
    return { tableId, name, capacity };
  });

  const largestTable = Math.max(0, ...tables.map((table) => table.capacity).filter(Number.isInteger));
  if (Number.isInteger(maximumGuests) && maximumGuests > largestTable) {
    errors.maximumGuests = 'Maximum guests cannot exceed the largest configured table capacity.';
  }

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Complete all reservation settings before enabling bookings.', errors);
  }

  return {
    restaurantTimezone,
    weeklySchedule,
    reservationDurationMinutes,
    numberOfTables,
    tables,
    maximumGuests,
  };
}

function getDaySettings(settings, date) {
  return settings.weeklySchedule.find((day) => day.dayOfWeek === weekdayForDate(date));
}

function reservationRange(settings, date, time, serviceDate, day) {
  const startAt = localDateTimeToUtc(date, time, settings.restaurantTimezone);
  const endAt = new Date(startAt.getTime() + settings.reservationDurationMinutes * 60000);
  const closingDate = isOvernight(day) ? addDateDays(serviceDate, 1) : serviceDate;
  const openingAt = localDateTimeToUtc(serviceDate, day.openTime, settings.restaurantTimezone);
  const closingAt = localDateTimeToUtc(closingDate, day.closeTime, settings.restaurantTimezone);
  if (startAt < openingAt || endAt > closingAt) return null;
  return { time, startAt, endAt };
}

function slotsForServiceDate(settings, serviceDate, targetDate, day) {
  const openingMinute = timeMinutes(day.openTime);
  let closingMinute = timeMinutes(day.closeTime);
  if (closingMinute < openingMinute) closingMinute += 24 * 60;

  const slots = [];
  for (
    // Booking starts stay on the clock's :00/:30 grid, even when the
    // restaurant opens at an off-grid minute (for example, 10:15 -> 10:30).
    let startMinute = Math.ceil(openingMinute / 30) * 30;
    startMinute + settings.reservationDurationMinutes <= closingMinute;
    startMinute += 30
  ) {
    const slotDate = addDateDays(serviceDate, Math.floor(startMinute / (24 * 60)));
    if (slotDate !== targetDate) continue;

    const time = timeFromMinutes(startMinute);
    try {
      const range = reservationRange(settings, targetDate, time, serviceDate, day);
      if (range) slots.push(range);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  return slots;
}

function reservationRangesForDate(settings, date) {
  const ranges = [];
  const day = getDaySettings(settings, date);
  if (day?.isOpen) ranges.push(...slotsForServiceDate(settings, date, date, day));

  const previousDate = addDateDays(date, -1);
  const previousDay = getDaySettings(settings, previousDate);
  if (previousDay?.isOpen && isOvernight(previousDay)) {
    ranges.push(...slotsForServiceDate(settings, previousDate, date, previousDay));
  }

  return [...new Map(ranges.map((range) => [range.time, range])).values()]
    .sort((a, b) => a.time.localeCompare(b.time));
}

function isPastDateOrTime(date, startAt, timezone, now = new Date()) {
  const localNow = localDateTimeParts(now, timezone);
  return date < localNow.date || startAt <= now;
}

function reservationIdFor(date) {
  return `SOF-R-${date.replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

function publicReservation(reservation) {
  return {
    reservationId: reservation.reservationId,
    date: reservation.date,
    time: reservation.time,
    guestCount: reservation.guestCount,
    status: reservation.status,
  };
}

function adminReservation(reservation) {
  const result = reservation.toObject ? reservation.toObject() : reservation;
  delete result.occupiedMinutes;
  return result;
}

export async function getReservationSettings(req, res) {
  const settings = await ReservationSettings.findById(SETTINGS_ID).lean();
  res.json(settingsDto(settings));
}

export async function saveReservationSettings(req, res) {
  const settings = validateSettings(req.body);
  const current = await ReservationSettings.findById(SETTINGS_ID);

  if (current) {
    const nextTables = new Map(settings.tables.map((table) => [table.tableId, table]));
    const now = new Date();
    for (const table of current.tables) {
      const next = nextTables.get(table.tableId);
      const conflict = await Reservation.exists({
        tableId: table.tableId,
        occupiesTable: true,
        endAt: { $gt: now },
        ...(next ? { guestCount: { $gt: next.capacity } } : {}),
      });
      if (conflict) {
        throw new HttpError(409, `Cannot remove or reduce ${table.name} while it has an active future reservation.`);
      }
    }
  }

  const saved = await ReservationSettings.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $set: { ...settings, configured: true } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(settingsDto(saved));
}

export async function getReservationAvailability(req, res) {
  const settings = await ReservationSettings.findById(SETTINGS_ID).lean();
  if (!settings?.configured) return res.json({ configured: false, availableTimes: [] });

  const today = localDateTimeParts(new Date(), settings.restaurantTimezone).date;
  const base = {
    configured: true,
    restaurantTimezone: settings.restaurantTimezone,
    today,
    maximumGuests: settings.maximumGuests,
    availableTimes: [],
  };
  const hasDate = req.query.date !== undefined;
  const hasGuests = req.query.guests !== undefined;
  if (!hasDate && !hasGuests) return res.json(base);
  if (!hasDate || !hasGuests || !isValidDateString(req.query.date)) {
    throw new HttpError(400, 'Choose a valid reservation date and guest count.');
  }

  const guests = Number(req.query.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > settings.maximumGuests) {
    throw new HttpError(400, `Guest count must be between 1 and ${settings.maximumGuests}.`);
  }
  if (req.query.date < today) return res.json({ ...base, date: req.query.date });

  const tables = settings.tables
    .filter((table) => table.capacity >= guests)
    .sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name));
  if (!tables.length) return res.json({ ...base, date: req.query.date });

  const ranges = reservationRangesForDate(settings, req.query.date);
  if (!ranges.length) return res.json({ ...base, date: req.query.date });

  const earliest = new Date(Math.min(...ranges.map((range) => range.startAt.getTime())));
  const latest = new Date(Math.max(...ranges.map((range) => range.endAt.getTime())));
  const reservations = await Reservation.find({
    tableId: { $in: tables.map((table) => table.tableId) },
    occupiesTable: true,
    startAt: { $lt: latest },
    endAt: { $gt: earliest },
  }).select('tableId startAt endAt').lean();
  const now = new Date();
  const availableTimes = ranges
    .filter((range) => (
      !isPastDateOrTime(req.query.date, range.startAt, settings.restaurantTimezone, now)
      && tables.some((table) => !reservations.some((reservation) => (
        reservation.tableId === table.tableId
        && reservation.startAt < range.endAt
        && reservation.endAt > range.startAt
      )))
    ))
    .map((range) => range.time)
    .sort();

  res.json({ ...base, date: req.query.date, availableTimes });
}

export async function createReservation(req, res) {
  const settings = await ReservationSettings.findById(SETTINGS_ID).lean();
  if (!settings?.configured) {
    throw new HttpError(503, 'Online reservations are not available until the restaurant completes its reservation settings.');
  }

  const input = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const customerName = cleanText(input.customerName);
  const phone = cleanText(input.phone);
  const email = cleanText(input.email).toLowerCase();
  const specialRequest = cleanText(input.specialRequest);
  const date = cleanText(input.date);
  const time = cleanText(input.time);
  const guestCount = Number(input.guestCount);
  const details = {};
  if (!customerName || customerName.length > 80) details.customerName = 'Enter a name of at most 80 characters.';
  if (!/^\+?[\d\s().-]{6,30}$/.test(phone) || (phone.match(/\d/g) || []).length < 7) details.phone = 'Enter a valid phone number.';
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) details.email = 'Enter a valid email address.';
  if (specialRequest.length > 500) details.specialRequest = 'Special requests must be 500 characters or fewer.';
  if (!isValidDateString(date)) details.date = 'Choose a valid reservation date.';
  if (!isValidTime(time)) details.time = 'Choose a valid reservation time.';
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > settings.maximumGuests) {
    details.guestCount = `Guest count must be between 1 and ${settings.maximumGuests}.`;
  }
  if (Object.keys(details).length) throw new HttpError(400, 'Check the reservation details and try again.', details);

  const range = reservationRangesForDate(settings, date).find((candidate) => candidate.time === time);
  if (!range) throw new HttpError(400, 'That time is not available for reservations.');
  if (isPastDateOrTime(date, range.startAt, settings.restaurantTimezone)) {
    throw new HttpError(400, 'Choose a future available reservation time.');
  }

  const tables = settings.tables
    .filter((table) => table.capacity >= guestCount)
    .sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name));
  if (!tables.length) throw new HttpError(409, 'No table can accommodate that guest count.');

  await Reservation.init();
  const occupiedMinutes = occupiedMinuteKeys(range.startAt, settings.reservationDurationMinutes);
  for (const table of tables) {
    try {
      const reservation = await Reservation.create({
        reservationId: reservationIdFor(date),
        customerName,
        phone,
        email,
        specialRequest,
        date,
        time,
        restaurantTimezone: settings.restaurantTimezone,
        guestCount,
        durationMinutes: settings.reservationDurationMinutes,
        startAt: range.startAt,
        endAt: range.endAt,
        tableId: table.tableId,
        tableName: table.name,
        tableCapacity: table.capacity,
        status: 'Pending',
        occupiesTable: true,
        occupiedMinutes,
      });
      return res.status(201).json({ reservation: publicReservation(reservation) });
    } catch (error) {
      if (error.code === 11000) continue;
      throw error;
    }
  }

  throw new HttpError(409, 'That time was just booked. Please choose another available time.');
}

export async function listReservations(req, res) {
  const filter = {};
  if (req.query.date !== undefined) {
    if (!isValidDateString(req.query.date)) throw new HttpError(400, 'Filter date must be a valid YYYY-MM-DD date.');
    filter.date = req.query.date;
  }
  if (req.query.status !== undefined && req.query.status !== '') {
    if (!RESERVATION_STATUSES.includes(req.query.status)) throw new HttpError(400, 'Invalid reservation status filter.');
    filter.status = req.query.status;
  }
  const reservations = await Reservation.find(filter).select('-occupiedMinutes').sort({ date: 1, time: 1, createdAt: 1 }).lean();
  res.json(reservations);
}

export async function updateReservationStatus(req, res) {
  const status = cleanText(req.body?.status);
  if (!RESERVATION_STATUSES.includes(status)) throw new HttpError(400, 'Choose a valid reservation status.');
  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { $set: { status, occupiesTable: ACTIVE_STATUSES.includes(status) } },
      { new: true, runValidators: true }
    ).select('-occupiedMinutes');
    if (!reservation) throw new HttpError(404, 'Reservation not found.');
    res.json(adminReservation(reservation));
  } catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'That table has another reservation during this time.');
    throw error;
  }
}
