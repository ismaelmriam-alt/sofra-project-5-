import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const EMPTY_FORM = {
  customerName: '',
  phone: '',
  email: '',
  guestCount: '1',
  date: '',
  time: '',
  specialRequest: '',
};

export default function Reservations() {
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [availability, setAvailability] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reservation, setReservation] = useState(null);

  useEffect(() => {
    let active = true;
    api.getReservationAvailability()
      .then((result) => {
        if (!active) return;
        setConfig(result);
        if (result.configured) {
          setForm((current) => ({ ...current, date: result.today }));
        }
      })
      .catch((error) => { if (active) setConfigError(error.message); })
      .finally(() => { if (active) setConfigLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!config?.configured || !form.date || !form.guestCount) {
      setAvailability(null);
      return undefined;
    }
    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    api.getReservationAvailability(form.date, form.guestCount)
      .then((result) => { if (active) setAvailability(result); })
      .catch((error) => { if (active) setAvailabilityError(error.message); })
      .finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; };
  }, [config?.configured, form.date, form.guestCount]);

  const setField = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(['date', 'guestCount'].includes(field) ? { time: '' } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (!availability?.availableTimes?.includes(form.time)) {
      setSubmitError('Choose one of the currently available times.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.createReservation({
        ...form,
        guestCount: Number(form.guestCount),
      });
      setReservation(result.reservation);
    } catch (error) {
      setSubmitError(error.message || 'We could not submit your reservation. Please try again.');
      if (form.date && config?.configured) {
        api.getReservationAvailability(form.date, form.guestCount)
          .then(setAvailability)
          .catch(() => setAvailability(null));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setReservation(null);
    setForm(EMPTY_FORM);
    setAvailability(null);
    setSubmitError('');
  };

  return (
    <main className="page reservation-page">
      <header className="reservation-heading container">
        <p className="eyebrow">SOFRA · YOUR TABLE</p>
        <h1 className="serif">Book a Table</h1>
        <p>Share a few details and we’ll prepare a place for your party.</p>
      </header>

      <div className="container reservation-layout">
        <aside className="reservation-story">
          <span className="reservation-mark" aria-hidden="true">سُفْرَة</span>
          <p className="eyebrow light">Gather around</p>
          <h2 className="serif">Good food is better shared.</h2>
          <p>Choose a day, find an available time, and send us your reservation request.</p>
          <p className="reservation-note">Your booking is a request until the SOFRA team confirms it.</p>
        </aside>

        <section className="reservation-card" aria-labelledby="reservation-form-title">
          {reservation ? (
            <div className="reservation-success" role="status">
              <span className="reservation-success-mark" aria-hidden="true">✓</span>
              <p className="eyebrow">Request received</p>
              <h2 id="reservation-form-title">Your table is on our list.</h2>
              <p>Reservation <strong>{reservation.reservationId}</strong> is pending confirmation.</p>
              <p>{reservation.date} at {reservation.time} · {reservation.guestCount} {reservation.guestCount === 1 ? 'guest' : 'guests'}</p>
              <button className="btn btn-ghost" onClick={startAnother}>Make another reservation</button>
            </div>
          ) : configLoading ? (
            <div className="reservation-state"><span className="spinner" /><p>Checking reservation availability…</p></div>
          ) : configError ? (
            <div className="reservation-state" role="alert"><p className="warn">{configError}</p><button className="btn btn-ghost" onClick={() => window.location.reload()}>Try again</button></div>
          ) : !config?.configured ? (
            <div className="reservation-state reservation-unavailable" role="status">
              <p className="eyebrow">Reservations are being prepared</p>
              <h2 id="reservation-form-title">Online booking is not available yet.</h2>
              <p>The restaurant team is still setting up its booking schedule. Please check back soon.</p>
            </div>
          ) : (
            <>
              <div className="reservation-card-heading">
                <p className="eyebrow">A few details</p>
                <h2 id="reservation-form-title">Find your time</h2>
                <p>All fields marked required are needed. Times shown in {config.restaurantTimezone}.</p>
              </div>
              <form className="reservation-form" onSubmit={submit}>
                <div className="reservation-fields">
                  <label>
                    <span>Your name</span>
                    <input name="customerName" autoComplete="name" maxLength={80} required value={form.customerName} onChange={setField('customerName')} />
                  </label>
                  <label>
                    <span>Phone number</span>
                    <input name="phone" type="tel" autoComplete="tel" maxLength={30} required value={form.phone} onChange={setField('phone')} />
                  </label>
                  <label>
                    <span>Email address</span>
                    <input name="email" type="email" autoComplete="email" maxLength={254} required value={form.email} onChange={setField('email')} />
                  </label>
                  <label>
                    <span>Number of guests</span>
                    <select name="guestCount" required value={form.guestCount} onChange={setField('guestCount')}>
                      {Array.from({ length: config.maximumGuests }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Date</span>
                    <input name="date" type="date" min={config.today} required value={form.date} onChange={setField('date')} />
                  </label>
                  <label>
                    <span>Available time</span>
                    <select name="time" required value={form.time} onChange={setField('time')} disabled={availabilityLoading || !availability?.availableTimes?.length}>
                      <option value="">{availabilityLoading ? 'Checking times…' : 'Choose a time'}</option>
                      {(availability?.availableTimes || []).map((time) => <option key={time} value={time}>{time}</option>)}
                    </select>
                  </label>
                  <label className="reservation-request">
                    <span>Special request <small>(optional)</small></span>
                    <textarea name="specialRequest" maxLength={500} rows={4} value={form.specialRequest} onChange={setField('specialRequest')} placeholder="Let us know if there is anything we should prepare." />
                  </label>
                </div>
                {availabilityError && <p className="reservation-error" role="alert">{availabilityError}</p>}
                {!availabilityLoading && availability && !availabilityError && availability.availableTimes.length === 0 && (
                  <p className="reservation-hint" role="status">No times are available for this date and party size. Please choose another date or guest count.</p>
                )}
                {submitError && <p className="reservation-error" role="alert">{submitError}</p>}
                <button className="btn btn-primary block reservation-submit" disabled={submitting || availabilityLoading || !form.time || !availability?.availableTimes?.includes(form.time)}>
                  {submitting ? <><span className="spinner small" /> Sending request…</> : 'Request a table'}
                </button>
                <p className="reservation-privacy">No account is needed. The SOFRA team will confirm your request.</p>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
