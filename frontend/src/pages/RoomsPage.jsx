import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  available: 'border-l-emerald-500 bg-white',
  occupied: 'border-l-red-500 bg-red-50',
  reserved: 'border-l-amber-500 bg-amber-50',
  closed: 'border-l-gray-400 bg-gray-50',
  maintenance: 'border-l-purple-500 bg-purple-50',
};
const STATUS_TEXT = {
  available: 'text-emerald-700', occupied: 'text-red-700',
  reserved: 'text-amber-700', closed: 'text-gray-500', maintenance: 'text-purple-700',
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ number: '', type: 'Standard', floor: 1, max_occupancy: 2, base_rate: '' });
  const [closure, setClosure] = useState({ room_id: '', from_date: '', to_date: '', reason: 'Maintenance' });

  const load = () => api.get('/rooms').then(r => setRooms(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const addRoom = async () => {
    if (!form.number || !form.base_rate) return toast.error('Room number and base rate required');
    try {
      await api.post('/rooms', form);
      toast.success(`Room ${form.number} added`);
      setForm({ number: '', type: 'Standard', floor: 1, max_occupancy: 2, base_rate: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const blockRoom = async () => {
    if (!closure.room_id || !closure.from_date || !closure.to_date) return toast.error('Select room and dates');
    try {
      await api.post(`/rooms/${closure.room_id}/close`, { from_date: closure.from_date, to_date: closure.to_date, reason: closure.reason });
      toast.success('Room blocked');
      setClosure(c => ({ ...c, from_date: '', to_date: '' }));
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Room inventory</h1>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap mb-5 text-xs text-gray-500">
        {Object.entries(STATUS_COLORS).map(([s]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_COLORS[s].split(' ')[0].replace('border-l-', 'bg-').replace('500','400').replace('400','400')}`}
              style={{background: {available:'#059669',occupied:'#DC2626',reserved:'#D97706',closed:'#9CA3AF',maintenance:'#9333EA'}[s]}}
            ></span>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ))}
      </div>

      {/* Room grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 mb-8">
        {rooms.map(r => (
          <div
            key={r.id}
            onClick={() => setSelected(r)}
            className={`border border-gray-100 border-l-4 ${STATUS_COLORS[r.status] || 'bg-white'} rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${selected?.id === r.id ? 'ring-2 ring-brand-400' : ''}`}
          >
            <div className="text-base font-semibold text-gray-900">{r.number}</div>
            <div className="text-xs text-gray-400 mt-0.5">{r.type}</div>
            <div className={`text-xs font-medium mt-1 ${STATUS_TEXT[r.status]}`}>{r.status}</div>
            <div className="text-xs text-gray-400">₹{Number(r.base_rate).toLocaleString('en-IN')}</div>
          </div>
        ))}
        {rooms.length === 0 && <p className="col-span-8 text-sm text-gray-400 py-4">No rooms added yet.</p>}
      </div>

      {/* Selected room detail */}
      {selected && (
        <div className="card mb-6 bg-brand-50 border-brand-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-brand-700 mb-2">Room {selected.number} — {selected.type}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-400">Floor:</span> {selected.floor}</div>
                <div><span className="text-gray-400">Max occupancy:</span> {selected.max_occupancy}</div>
                <div><span className="text-gray-400">Base rate:</span> ₹{Number(selected.base_rate).toLocaleString('en-IN')}/night</div>
                <div><span className="text-gray-400">Status:</span> <span className={STATUS_TEXT[selected.status]}>{selected.status}</span></div>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add room */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Add room</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Room number</label>
              <input className="input" placeholder="e.g. 205" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} /></div>
            <div><label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {['Standard','Deluxe','Suite','Junior Suite','Presidential'].map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div><label className="label">Floor</label>
              <input className="input" type="number" min="1" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} /></div>
            <div><label className="label">Max occupancy</label>
              <input className="input" type="number" min="1" max="10" value={form.max_occupancy} onChange={e => setForm(f => ({ ...f, max_occupancy: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Base rate (₹/night)</label>
              <input className="input" type="number" placeholder="3500" value={form.base_rate} onChange={e => setForm(f => ({ ...f, base_rate: e.target.value }))} /></div>
          </div>
          <button onClick={addRoom} className="btn btn-primary mt-4">Add room</button>
        </div>

        {/* Inventory closure */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Inventory closure</h2>
          <p className="text-xs text-gray-400 mb-4">Block a room from bookings for maintenance or events.</p>
          <label className="label">Room</label>
          <select className="input" value={closure.room_id} onChange={e => setClosure(c => ({ ...c, room_id: e.target.value }))}>
            <option value="">Select room…</option>
            {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number} — {r.type}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div><label className="label">From</label>
              <input className="input" type="date" value={closure.from_date} onChange={e => setClosure(c => ({ ...c, from_date: e.target.value }))} /></div>
            <div><label className="label">To</label>
              <input className="input" type="date" value={closure.to_date} onChange={e => setClosure(c => ({ ...c, to_date: e.target.value }))} /></div>
          </div>
          <label className="label mt-3">Reason</label>
          <select className="input" value={closure.reason} onChange={e => setClosure(c => ({ ...c, reason: e.target.value }))}>
            {['Maintenance','Renovation','Owner block','Event','Other'].map(r => <option key={r}>{r}</option>)}
          </select>
          <button onClick={blockRoom} className="btn btn-danger mt-4">Block room</button>
        </div>
      </div>
    </div>
  );
}
