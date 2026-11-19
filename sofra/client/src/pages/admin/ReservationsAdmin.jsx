import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { StateBlock, useToast } from './AdminUI.jsx';

const STATUSES = ['Pending', 'Confirmed', 'Rejected', 'Cancelled'];

export default function ReservationsAdmin() {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getReservations({ date, status }));
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [date, status]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (reservation, nextStatus) => {
    try {
      const updated = await api.updateReservationStatus(reservation._id, nextStatus);
      setData((current) => (current || []).filter((item) => item._id !== updated._id || !status || updated.status === status)
        .map((item) => item._id === updated._id ? updated : item));
      toast(`${reservation.reservationId} → ${nextStatus}`);
    } catch (requestError) {
      toast(requestError.message, 'err');
      load();
    }
  };

  return (
    <>
      <header className="a-head row">
        <div><h1>Reservations</h1><p className="muted">Review requests and manage their table status.</p></div>
        <div className="a-toolbar inline reservation-filters">
          <label><span className="sr-only">Filter by date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </header>
      <StateBlock loading={loading && !data} error={error} onRetry={load} empty={data && data.length === 0} emptyText="No reservations match these filters." />
      {data?.length > 0 && (
        <section className="a-card">
          <div className="a-table-wrap"><table className="a-table">
            <thead><tr><th>Reservation</th><th>Customer</th><th>Phone / Email</th><th>Date &amp; Time</th><th>Guests</th><th>Table</th><th>Status</th></tr></thead>
            <tbody>{data.map((reservation) => (
              <tr key={reservation._id}>
                <td data-label="Reservation"><strong>{reservation.reservationId}</strong></td>
                <td data-label="Customer">{reservation.customerName}</td>
                <td data-label="Phone / Email"><span>{reservation.phone}<br />{reservation.email}</span></td>
                <td data-label="Date & Time">{reservation.date}<br />{reservation.time} <small>{reservation.restaurantTimezone}</small></td>
                <td data-label="Guests">{reservation.guestCount}</td>
                <td data-label="Table">{reservation.tableName} · {reservation.tableCapacity} seats</td>
                <td data-label="Status">
                  <select className={`status-select ${reservation.status.toLowerCase()}`} value={reservation.status} onChange={(event) => updateStatus(reservation, event.target.value)} aria-label={`Status for ${reservation.reservationId}`}>
                    {STATUSES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  {reservation.specialRequest && <p className="reservation-admin-request"><strong>Request:</strong> {reservation.specialRequest}</p>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
