import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import Reservation from '../src/models/Reservation.js';

let passed = 0;
let failed = 0;
const check = (name, condition) => {
  if (condition) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.log(`  ✖ ${name}`);
  }
};

const db = await MongoMemoryServer.create();
let server;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.ADMIN_PASSWORD = 'reservation-admin-test-password';

try {
  await mongoose.connect(db.getUri('sofra-reservation-test'));
  server = await new Promise((resolve) => {
    const appServer = createApp().listen(0, () => resolve(appServer));
  });
  const base = `http://localhost:${server.address().port}/api`;
  const request = async (method, path, body, admin = false) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(admin ? { 'x-admin-key': process.env.ADMIN_PASSWORD } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await response.json(); } catch { /* empty */ }
    return { status: response.status, data };
  };
  const reserve = (date, time, guestCount, extra = {}) => request('POST', '/reservations', {
    customerName: 'Reservation Test',
    phone: '+961 70 123 456',
    email: 'reservation.test@example.com',
    date,
    time,
    guestCount,
    ...extra,
  });

  console.log('Unconfigured reservation behavior');
  const unavailable = await request('GET', '/reservations/availability');
  check('availability hides all times before configuration', unavailable.status === 200 && unavailable.data.configured === false && unavailable.data.availableTimes.length === 0);
  check('public booking is unavailable before configuration', (await reserve('2030-01-01', '10:00', 2)).status === 503);
  check('settings require admin authentication', (await request('GET', '/reservation-settings')).status === 401);
  check('reservation listing requires admin authentication', (await request('GET', '/reservations')).status === 401);

  const date = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const schedule = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek === weekday,
    openTime: dayOfWeek === weekday ? '10:00' : '',
    closeTime: dayOfWeek === weekday ? '14:00' : '',
  }));
  const settings = {
    restaurantTimezone: 'UTC',
    weeklySchedule: schedule,
    reservationDurationMinutes: 120,
    numberOfTables: 2,
    tables: [
      { tableId: '', name: 'Table 1', capacity: 2 },
      { tableId: '', name: 'Table 2', capacity: 4 },
    ],
    maximumGuests: 4,
  };

  console.log('Settings validation and public availability');
  check('incomplete settings rejected without enabling bookings', (await request('PUT', '/reservation-settings', { ...settings, weeklySchedule: schedule.slice(1) }, true)).status === 400);
  const saved = await request('PUT', '/reservation-settings', settings, true);
  check('admin can save complete settings', saved.status === 200 && saved.data.configured);
  check('unconfigured public summary returns no slots', (await request('GET', '/reservations/availability')).data.availableTimes.length === 0);
  const availability = await request('GET', `/reservations/availability?date=${date}&guests=2`);
  check('public availability generates 30-minute slots', availability.status === 200 && availability.data.availableTimes.join(',') === '10:00,10:30,11:00,11:30,12:00');
  const offGridSettings = {
    ...saved.data.settings,
    weeklySchedule: schedule.map((day) => day.dayOfWeek === weekday
      ? { ...day, openTime: '10:15', closeTime: '14:00' }
      : day),
  };
  const offGridSaved = await request('PUT', '/reservation-settings', offGridSettings, true);
  const offGridAvailability = await request('GET', `/reservations/availability?date=${date}&guests=2`);
  check('off-grid opening hours generate clock-aligned 30-minute times',
    offGridSaved.status === 200
      && offGridAvailability.data.availableTimes.join(',') === '10:30,11:00,11:30,12:00');
  const noValidStarts = await request('PUT', '/reservation-settings', {
    ...saved.data.settings,
    // Legacy clients may still submit a manual list. It is ignored; availability
    // is derived from opening hours and reservation duration.
    bookingTimes: [],
    weeklySchedule: schedule.map((day) => day.dayOfWeek === weekday
      ? { ...day, openTime: '10:00', closeTime: '10:30' }
      : day),
  }, true);
  const noStartAvailability = await request('GET', `/reservations/availability?date=${date}&guests=2`);
  check('invalid legacy bookingTimes do not block settings save', noValidStarts.status === 200);
  check('availability derives zero slots when the reservation duration cannot fit',
    noStartAvailability.status === 200 && noStartAvailability.data.availableTimes.length === 0);
  const restoredSettings = await request('PUT', '/reservation-settings', saved.data.settings, true);
  check('valid saved settings remain restorable after schedule validation', restoredSettings.status === 200);
  check('availability rejects guest counts above configured maximum', (await request('GET', `/reservations/availability?date=${date}&guests=5`)).status === 400);
  check('equal opening and closing times are rejected as ambiguous', (await request('PUT', '/reservation-settings', {
    ...settings,
    weeklySchedule: schedule.map((day) => day.dayOfWeek === weekday ? { ...day, closeTime: day.openTime } : day),
  }, true)).status === 400);

  console.log('Public booking and table conflicts');
  const first = await reserve(date, '10:00', 2, { status: 'Confirmed', tableId: 'client-selected-table' });
  const second = await reserve(date, '10:00', 2);
  check('customer can book without login and starts pending', first.status === 201 && first.data.reservation.status === 'Pending');
  check('server ignores client table/status and chooses a fitting table', first.status === 201 && first.data.reservation.reservationId.startsWith('SOF-R-'));
  const savedReservations = await Reservation.find({ date }).sort({ createdAt: 1 });
  check('same start time uses different tables', second.status === 201 && savedReservations[0]?.tableId !== savedReservations[1]?.tableId);
  check('overlapping booking rejected when all suitable tables are occupied', (await reserve(date, '10:30', 2)).status === 409);
  check('availability hides occupied and overlapping slots', (await request('GET', `/reservations/availability?date=${date}&guests=2`)).data.availableTimes.join(',') === '12:00');
  check('unsupported slot rejected by backend', (await reserve(date, '10:15', 2)).status === 400);
  check('excess party size rejected by backend', (await reserve(date, '11:00', 5)).status === 400);

  console.log('Status management and race protection');
  const deniedStatusUpdate = await request('PATCH', `/reservations/${savedReservations[0]._id}/status`, { status: 'Rejected' });
  check('reservation status changes require admin authentication', deniedStatusUpdate.status === 401);
  const rejected = await request('PATCH', `/reservations/${savedReservations[0]._id}/status`, { status: 'Rejected' }, true);
  check('admin can reject a reservation and release its table', rejected.status === 200 && rejected.data.status === 'Rejected' && rejected.data.occupiesTable === false);
  const released = await request('GET', `/reservations/availability?date=${date}&guests=2`);
  check('rejected reservation no longer blocks availability', released.data.availableTimes.includes('10:00'));

  const concurrent = await Promise.all([
    reserve(date, '10:00', 2),
    reserve(date, '10:00', 2),
  ]);
  check('concurrent bookings cannot double-book a table', concurrent.filter((result) => result.status === 201).length === 1 && concurrent.filter((result) => result.status === 409).length === 1);
  const cancel = await request('PATCH', `/reservations/${savedReservations[1]._id}/status`, { status: 'Cancelled' }, true);
  check('admin can cancel a reservation', cancel.status === 200 && cancel.data.status === 'Cancelled');
  const filtered = await request('GET', `/reservations?date=${date}&status=Rejected`, undefined, true);
  check('admin can filter by date and status', filtered.status === 200 && filtered.data.length === 1 && filtered.data[0].status === 'Rejected');

  const nextTables = [saved.data.settings.tables[1]];
  const blockedSettings = await request('PUT', '/reservation-settings', {
    ...saved.data.settings,
    numberOfTables: 1,
    tables: nextTables,
  }, true);
  check('settings cannot remove a table with an active future booking', blockedSettings.status === 409);
  check('known nonexistent timezone is rejected', (await request('PUT', '/reservation-settings', { ...settings, restaurantTimezone: 'Not/A_Timezone' }, true)).status === 400);

  const overnightDate = '2030-01-04';
  const overnightWeekday = new Date(`${overnightDate}T00:00:00.000Z`).getUTCDay();
  const overnightSettings = {
    ...saved.data.settings,
    restaurantTimezone: 'Asia/Beirut',
    reservationDurationMinutes: 120,
    weeklySchedule: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      isOpen: dayOfWeek === overnightWeekday,
      openTime: dayOfWeek === overnightWeekday ? '18:00' : '',
      closeTime: dayOfWeek === overnightWeekday ? '02:00' : '',
    })),
  };
  const overnightSaved = await request('PUT', '/reservation-settings', overnightSettings, true);
  const eveningAvailability = await request('GET', `/reservations/availability?date=${overnightDate}&guests=2`);
  const afterMidnightAvailability = await request('GET', '/reservations/availability?date=2030-01-05&guests=2');
  check('overnight hours save with Asia/Beirut timezone', overnightSaved.status === 200 && overnightSaved.data.settings.restaurantTimezone === 'Asia/Beirut');
  check('overnight slots use 30-minute intervals and fit the full duration', eveningAvailability.data.availableTimes.join(',') === '18:00,18:30,19:00,19:30,20:00,20:30,21:00,21:30,22:00,22:30,23:00,23:30');
  check('after-midnight slot is offered on its local calendar date', afterMidnightAvailability.data.availableTimes.join(',') === '00:00');
  const overnightBooking = await reserve('2030-01-05', '00:00', 2);
  check('public booking accepts a generated after-midnight slot', overnightBooking.status === 201 && overnightBooking.data.reservation.date === '2030-01-05');

  const enteredSettings = {
    restaurantTimezone: 'Asia/Beirut',
    reservationDurationMinutes: 120,
    numberOfTables: 40,
    maximumGuests: 6,
    weeklySchedule: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      isOpen: true,
      openTime: '10:00',
      closeTime: dayOfWeek === 0 ? '04:00' : '02:00',
    })),
    tables: Array.from({ length: 40 }, (_, index) => ({
      tableId: overnightSaved.data.settings.tables[index]?.tableId || '',
      name: `Table ${index + 1}`,
      capacity: index < 10 ? 2 : index < 30 ? 4 : 6,
    })),
  };
  const enteredSettingsSave = await request('PUT', '/reservation-settings', enteredSettings, true);
  const persistedSettings = (await request('GET', '/reservation-settings', undefined, true)).data.settings;
  check('requested 40-table configuration saves without manual slots', enteredSettingsSave.status === 200);
  check(
    'saved booking rules and all seven overnight schedules are preserved',
    persistedSettings?.restaurantTimezone === 'Asia/Beirut'
      && persistedSettings?.reservationDurationMinutes === 120
      && persistedSettings?.numberOfTables === 40
      && persistedSettings?.maximumGuests === 6
      && persistedSettings?.weeklySchedule.every((day, index) => (
        day.isOpen === true
        && day.openTime === '10:00'
        && day.closeTime === (index === 0 ? '04:00' : '02:00')
      ))
  );
  check(
    'saved seating capacities preserve the 10/20/10 distribution',
    persistedSettings?.tables.length === 40
      && persistedSettings.tables.every((table, index) => (
        table.name === `Table ${index + 1}`
        && table.capacity === (index < 10 ? 2 : index < 30 ? 4 : 6)
      ))
  );

  console.log(`\n${passed} passed, ${failed} failed`);
} catch (error) {
  failed++;
  console.error(error);
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await db.stop();
  if (failed) process.exitCode = 1;
}
