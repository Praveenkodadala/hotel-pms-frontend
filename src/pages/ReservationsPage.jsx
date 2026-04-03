import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const today   = new Date().toISOString().split('T')[0];
const addDays = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0]; };
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const nights  = (a, b) => Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000));

const STATUS_BADGE = {
  confirmed:   'badge-amber',
  checked_in:  'badge-green',
  checked_out: 'badge-gray',
  cancelled:   'badge-red',
  no_show:     'badge-red',
};

const FILTERS = [
  ['', 'All'], ['confirmed', 'Confirmed'], ['checked_in', 'Checked in'],
  ['checked_out', 'Checked out'], ['cancelled', 'Cancelled'],
];

export default function ReservationsPage() {
  const { isAtLeast } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [rooms,        setRooms]        = useState([]);
  const [showModal,    setShowModal]    = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search,       setSearch]       = useState('');
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    room_id: '', check_in: today, check_out: addDays(today, 1),
    adults: 1, children: 0, source: 'direct', notes: '',
  });

  const load = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search)       params.set('search', search);
    api.get(`/reservations?${params}`).then(r => setReservations(r.data)).catch(() => {});
    api.get('/rooms/availability?check_in=' + form.check_in + '&check_out=' + form.check_out)
      .then(r => setRooms(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, [statusFilter, search]);

  // Requery available rooms when dates change in modal
  useEffect(() => {
    if (showModal && form.check_in && form.check_out) {
      api.get(`/rooms/availability?check_in=${form.check_in}&check_out=${form.check_out}`)
        .then(r => setRooms(r.data)).catch(() => {});
    }
  }, [form.check_in, form.check_out, showModal]);

  const totalAmount = () => {
    const room = rooms.find(r => r.id === form.room_id);
    if (!room || !form.check_in || !form.check_out) return null;
    const n = nights(form.check_in, form.check_out);
    return { nights: n, rate: room.base_rate, total: room.base_rate * n };
  };

  const create = async () => {
    if (!form.first_name || !form.last_name || !form.room_id || !form.check_in || !form.check_out)
      return toast.error('Name, room, and dates are required');
    if (form.check_out <= form.check_in)
      return toast.error('Check-out must be after check-in');
    try {
      await api.post('/reservations', form);
      toast.success('Reservation created');
      setShowModal(false);
      setForm({ first_name:'', last_name:'', email:'', phone:'', room_id:'', check_in: today, check_out: addDays(today,1), adults:1, children:0, source:'direct', notes:'' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this reservation?')) return;
    try { await api.patch(`/reservations/${id}/cancel`); toast.success('Cancelled'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const markNoShow = async (id) => {
    if (!window.confirm('Mark as no-show?')) return;
    try { await api.patch(`/reservations/${id}/no-show`); toast.success('Marked no-show'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const amt = totalAmount();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Reservations</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">+ New reservation</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <input
          className="input max-w-xs text-sm"
          placeholder="Search name, email, res #…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${statusFilter === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-gray-100">
            <th className="th">Res #</th>
            <th className="th">Guest</th>
            <th className="th">Room</th>
            <th className="th">Check-in</th>
            <th className="th">Check-out</th>
            <th className="th">Nights</th>
            <th className="th">Amount</th>
            <th className="th">Source</th>
            <th className="th">Status</th>
            <th className="th"></th>
          </tr></thead>
          <tbody>
            {reservations.map(r => (
              <tr key={r.id} className="table-row">
                <td className="td font-mono text-xs font-medium text-brand-600">{r.res_number}</td>
                <td className="td">
                  <div className="font-medium">{r.first_name} {r.last_name}</div>
                  <div className="text-xs text-gray-400">{r.email}</div>
                </td>
                <td className="td">{r.room_number} <span className="text-gray-400 text-xs">({r.room_type})</span></td>
                <td className="td text-xs">{fmtDate(r.check_in)}</td>
                <td className="td text-xs">{fmtDate(r.check_out)}</td>
                <td className="td">{nights(r.check_in, r.check_out)}</td>
                <td className="td font-medium">₹{Number(r.total_amount).toLocaleString('en-IN')}</td>
                <td className="td text-xs text-gray-500 capitalize">{r.source}</td>
                <td className="td">
                  <span className={`badge text-xs ${STATUS_BADGE[r.status] || 'badge-gray'}`}>
                    {r.status.replace('_',' ')}
                  </span>
                </td>
                <td className="td">
                  <div className="flex gap-1.5">
                    {r.status === 'confirmed' && (
                      <button onClick={() => cancel(r.id)} className="btn btn-sm btn-danger">Cancel</button>
                    )}
                    {r.status === 'confirmed' && isAtLeast('manager') && (
                      <button onClick={() => markNoShow(r.id)} className="btn btn-sm">No-show</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {reservations.length === 0 && (
              <tr><td colSpan={10} className="td text-center text-gray-400 py-10">
                {search ? `No reservations matching "${search}"` : 'No reservations yet'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Reservation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">New reservation</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">First name</label><input className="input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div><label className="label">Last name</label><input className="input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><label className="label">Adults</label><input className="input" type="number" min="1" value={form.adults} onChange={e => setForm(f => ({ ...f, adults: +e.target.value }))} /></div>
              <div><label className="label">Children</label><input className="input" type="number" min="0" value={form.children} onChange={e => setForm(f => ({ ...f, children: +e.target.value }))} /></div>
              <div><label className="label">Check-in</label><input className="input" type="date" value={form.check_in} min={today} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} /></div>
              <div><label className="label">Check-out</label><input className="input" type="date" value={form.check_out} min={addDays(form.check_in, 1)} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))} /></div>
            </div>

            <label className="label mt-3">Available room</label>
            <select className="input" value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}>
              <option value="">Select room…</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  Room {r.number} — {r.type} (₹{Number(r.base_rate).toLocaleString('en-IN')}/night)
                </option>
              ))}
            </select>
            {rooms.length === 0 && form.check_in && form.check_out && (
              <p className="text-xs text-amber-600 mt-1">No available rooms for selected dates</p>
            )}

            <label className="label mt-3">Source</label>
            <select className="input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
              {['direct','Booking.com','Expedia','MakeMyTrip','Goibibo','Agoda','Agent','Walk-in'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <label className="label mt-3">Special requests</label>
            <textarea className="input h-16" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Early check-in, extra pillow, dietary needs…" />

            {amt && (
              <div className="mt-3 p-3 bg-brand-50 rounded-lg text-sm text-brand-700 font-medium">
                {amt.nights} night{amt.nights > 1 ? 's' : ''} × ₹{Number(amt.rate).toLocaleString('en-IN')} = ₹{Number(amt.total).toLocaleString('en-IN')}
                <span className="text-xs font-normal text-brand-500 ml-2">(+ 12% GST at checkout)</span>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={create} className="btn btn-primary flex-1 justify-center">Create reservation</button>
              <button onClick={() => setShowModal(false)} className="btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
