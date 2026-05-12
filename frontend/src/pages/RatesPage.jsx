import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function RatesPage() {
  const [rates, setRates] = useState([]);
  const [form, setForm] = useState({ room_type: 'Standard', season: 'Peak', price_per_night: '', valid_from: '', valid_to: '' });

  const load = () => api.get('/rates').then(r => setRates(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.price_per_night) return toast.error('Enter price per night');
    try { await api.post('/rates', form); toast.success('Rate saved'); setForm(f => ({ ...f, price_per_night: '', valid_from: '', valid_to: '' })); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };
  const del = async (id) => {
    try { await api.delete(`/rates/${id}`); toast.success('Rate deleted'); load(); }
    catch (e) { toast.error('Failed'); }
  };

  const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Room rates</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Add / update rate</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Room type</label>
              <select className="input" value={form.room_type} onChange={e => setForm(f => ({ ...f, room_type: e.target.value }))}>
                {['Standard','Deluxe','Suite','Junior Suite','Presidential'].map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div><label className="label">Season</label>
              <select className="input" value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}>
                {['Peak','Off-peak','Weekend','Holiday','Corporate','Long stay'].map(s => <option key={s}>{s}</option>)}
              </select></div>
            <div className="col-span-2"><label className="label">Price per night (₹)</label>
              <input className="input" type="number" placeholder="5000" value={form.price_per_night} onChange={e => setForm(f => ({ ...f, price_per_night: e.target.value }))} /></div>
            <div><label className="label">Valid from</label>
              <input className="input" type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} /></div>
            <div><label className="label">Valid to</label>
              <input className="input" type="date" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} /></div>
          </div>
          <button onClick={add} className="btn btn-primary mt-4">Save rate</button>
        </div>

        <div className="card overflow-x-auto">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Rate schedule ({rates.length})</h2>
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              <th className="th">Room type</th><th className="th">Season</th><th className="th">Rate</th><th className="th">Valid</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {rates.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="td font-medium">{r.room_type}</td>
                  <td className="td"><span className="badge badge-blue">{r.season}</span></td>
                  <td className="td font-semibold">₹{Number(r.price_per_night).toLocaleString('en-IN')}</td>
                  <td className="td text-xs text-gray-400">{fmtDate(r.valid_from)} – {fmtDate(r.valid_to)}</td>
                  <td className="td"><button onClick={() => del(r.id)} className="btn btn-sm btn-danger">×</button></td>
                </tr>
              ))}
              {rates.length === 0 && <tr><td colSpan={5} className="td text-center text-gray-400 py-6">No rates defined</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
