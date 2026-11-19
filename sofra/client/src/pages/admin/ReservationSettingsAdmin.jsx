import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_SETTINGS = {
  restaurantTimezone: 'Asia/Beirut',
  reservationDurationMinutes: 120,
  numberOfTables: 40,
  maximumGuests: 6,
};

function defaultCapacity(index) {
  if (index < 10) return 2;
  if (index < 30) return 4;
  return 6;
}

function blankForm(settings = null) {
  const savedDays = new Map((settings?.weeklySchedule || []).map((day) => [day.dayOfWeek, day]));
  const weeklySchedule = DAY_NAMES.map((_, dayOfWeek) => {
    const day = savedDays.get(dayOfWeek);
    const defaultCloseTime = dayOfWeek === 0 ? '04:00' : '02:00';
    const isOpen = typeof day?.isOpen === 'boolean' ? day.isOpen : true;
    return {
      dayOfWeek,
      isOpen,
      openTime: isOpen ? (day?.openTime || '10:00') : '',
      closeTime: isOpen ? (day?.closeTime || defaultCloseTime) : '',
    };
  });
  const savedTables = settings?.tables || [];
  const savedTableCount = Number(settings?.numberOfTables);
  const requestedTableCount = Number.isInteger(savedTableCount) && savedTableCount > 0
    ? savedTableCount
    : DEFAULT_SETTINGS.numberOfTables;
  const numberOfTables = Math.max(savedTables.length, requestedTableCount);
  const tables = Array.from({ length: numberOfTables }, (_, index) => {
    const table = savedTables[index] || {};
    return {
      ...table,
      tableId: table.tableId || '',
      name: table.name || `Table ${index + 1}`,
      capacity: String(table.capacity || defaultCapacity(index)),
    };
  });

  return {
    restaurantTimezone: settings?.restaurantTimezone || DEFAULT_SETTINGS.restaurantTimezone,
    weeklySchedule,
    reservationDurationMinutes: settings?.reservationDurationMinutes || DEFAULT_SETTINGS.reservationDurationMinutes,
    numberOfTables,
    tables,
    maximumGuests: settings?.maximumGuests || DEFAULT_SETTINGS.maximumGuests,
  };
}

export default function ReservationSettingsAdmin() {
  const [form, setForm] = useState(() => blankForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let active = true;
    api.getReservationSettings()
      .then((result) => {
        if (active) {
          setForm(blankForm(result.settings));
          setConfigured(result.configured);
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const setValue = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setSaved('');
  };

  const setDay = (dayOfWeek, changes) => {
    setForm((current) => ({
      ...current,
      weeklySchedule: current.weeklySchedule.map((day) => (
        day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day
      )),
    }));
    setSaved('');
  };

  const setTableCount = (event) => {
    const value = event.target.value;
    const count = value === '' ? 0 : Number(value);
    setForm((current) => {
      const tables = current.tables.slice(0, count);
      while (tables.length < count) {
        const index = tables.length;
        tables.push({ tableId: '', name: `Table ${index + 1}`, capacity: '' });
      }
      return { ...current, numberOfTables: value, tables };
    });
    setSaved('');
  };

  const setTable = (index, field, value) => {
    setForm((current) => ({
      ...current,
      tables: current.tables.map((table, tableIndex) => (
        tableIndex === index ? { ...table, [field]: value } : table
      )),
    }));
    setSaved('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved('');
    try {
      const payload = {
        restaurantTimezone: form.restaurantTimezone,
        reservationDurationMinutes: Number(form.reservationDurationMinutes),
        numberOfTables: Number(form.numberOfTables),
        maximumGuests: Number(form.maximumGuests),
        tables: form.tables.map((table) => ({
          tableId: table.tableId,
          name: table.name,
          capacity: Number(table.capacity),
        })),
        weeklySchedule: form.weeklySchedule.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          isOpen: day.isOpen,
          openTime: day.openTime,
          closeTime: day.closeTime,
        })),
      };
      const result = await api.saveReservationSettings(payload);
      setForm(blankForm(result.settings));
      setConfigured(true);
      setSaved('Reservation settings saved. Public booking availability is now enabled.');
    } catch (requestError) {
      const details = Object.values(requestError.details || {}).filter(Boolean);
      setError(details[0] || requestError.message || 'Could not save reservation settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="a-state"><span className="spinner" /><p>Loading reservation settings…</p></div>;

  return (
    <>
      <header className="a-head row">
        <div><h1>Reservation Settings</h1><p className="muted">Set the restaurant’s actual schedule and seating before accepting bookings.</p></div>
        <span className={`pill ${configured ? 'confirmed' : 'pending'}`}>{configured ? 'Configured' : 'Not configured'}</span>
      </header>
      <form className="reservation-settings-form" onSubmit={save}>
        <section className="a-card">
          <h2>Booking rules</h2>
          <p className="muted">No default hours, tables, or capacities are provided. Customers will not see booking times until a complete configuration is saved. Times are generated every 30 minutes using the saved hours and duration.</p>
          <div className="reservation-settings-grid">
            <label className="a-field"><span>Restaurant timezone</span><input required value={form.restaurantTimezone} onChange={setValue('restaurantTimezone')} placeholder="IANA timezone, e.g. Asia/Beirut" /></label>
            <label className="a-field"><span>Reservation duration (minutes)</span><input type="number" min="1" max="1440" required value={form.reservationDurationMinutes} onChange={setValue('reservationDurationMinutes')} /></label>
            <label className="a-field"><span>Number of tables</span><input type="number" min="1" max="100" required value={form.numberOfTables} onChange={setTableCount} /></label>
            <label className="a-field"><span>Maximum guests per reservation</span><input type="number" min="1" max="1000" required value={form.maximumGuests} onChange={setValue('maximumGuests')} /></label>
          </div>
        </section>

        <section className="a-card">
          <h2>Hours and available times</h2>
          <p className="muted">Choose whether each day is open and enter 24-hour HH:MM times. Times are generated every 30 minutes from opening. If closing is earlier than opening, the schedule continues overnight.</p>
          <div className="reservation-day-list">
            {form.weeklySchedule.map((day) => (
              <div className="reservation-day-row" key={day.dayOfWeek}>
                <div className="reservation-day-name">{DAY_NAMES[day.dayOfWeek]}</div>
                <label className="a-field">
                  <span>Day status</span>
                  <select required value={day.isOpen === null ? '' : String(day.isOpen)} onChange={(event) => {
                    const isOpen = event.target.value === '' ? null : event.target.value === 'true';
                    setDay(day.dayOfWeek, { isOpen, ...(isOpen === false ? { openTime: '', closeTime: '' } : {}) });
                  }}>
                    <option value="">Choose…</option>
                    <option value="true">Open</option>
                    <option value="false">Closed</option>
                  </select>
                </label>
                {day.isOpen === true ? (
                  <>
                    <label className="a-field"><span>Opening</span><input type="time" required value={day.openTime} onChange={(event) => setDay(day.dayOfWeek, { openTime: event.target.value })} /></label>
                    <label className="a-field"><span>Closing</span><input type="time" required value={day.closeTime} onChange={(event) => setDay(day.dayOfWeek, { closeTime: event.target.value })} /></label>
                  </>
                ) : <p className="reservation-day-note">{day.isOpen === false ? 'Closed — no booking times.' : 'Select whether this day is open or closed.'}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="a-card">
          <h2>Table seating</h2>
          <p className="muted">One table is assigned per reservation. A table cannot be assigned to overlapping bookings. Maximum guests cannot exceed the largest table capacity.</p>
          {form.tables.length === 0 ? <p className="reservation-day-note">Set the number of tables above to enter each table’s seating capacity.</p> : (
            <div className="reservation-tables-grid">
              {form.tables.map((table, index) => (
                <div className="reservation-table-fields" key={table.tableId || index}>
                  <label className="a-field"><span>Table name</span><input required maxLength={40} value={table.name} onChange={(event) => setTable(index, 'name', event.target.value)} /></label>
                  <label className="a-field"><span>Seating capacity</span><input type="number" min="1" max="1000" required value={table.capacity} onChange={(event) => setTable(index, 'capacity', event.target.value)} /></label>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && <p className="a-toast err reservation-settings-message" role="alert">{error}</p>}
        {saved && <p className="a-toast reservation-settings-message" role="status">{saved}</p>}
        <div className="a-actions"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save reservation settings'}</button></div>
      </form>
    </>
  );
}
