import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [syncLog, setSyncLog] = useState([]);
  const [form, setForm] = useState({ name: 'Booking.com', api_key: '', hotel_id_on_channel: '', commission_pct: 15 });

  const load = () => {
    api.get('/channels').then(r => setChannels(r.data)).catch(() => {});
    api.get('/channels/sync-log').then(r => setSyncLog(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.api_key || !form.hotel_id_on_channel) return toast.error('API key and hotel ID required');
    try {
      await api.post('/channels', form);
      toast.success(`${form.name} connected`);
      setForm(f => ({ ...f, api_key: '', hotel_id_on_channel: '' }));
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const toggle = async (id) => {
    try { await api.patch(`/channels/${id}/toggle`); load(); }
    catch (e) { toast.error('Failed'); }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try { await api.delete(`/channels/${id}`); toast.success('Channel removed'); load(); }
    catch (e) { toast.error('Failed'); }
  };

  const sync = async (id, name) => {
    try { await api.post(`/channels/${id}/sync`); toast.success(`Sync triggered for ${name}`); load(); }
    catch (e) { toast.error('Failed'); }
  };

  const fmtTime = d => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Channel manager</h1>
      <p className="text-sm text-gray-400 mb-6">Connect OTAs and distribution channels for automated availability and rate sync.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Connected channels */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Connected channels ({channels.length})</h2>
          {channels.length === 0 && <p className="text-sm text-gray-400">No channels connected yet.</p>}
          <div className="space-y-0">
            {channels.map(c => (
              <div key={c.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                    <span className={`badge text-xs ${c.active ? 'badge-green' : 'badge-gray'}`}>{c.active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">Hotel ID: {c.hotel_id_on_channel} · Commission: {c.commission_pct}%</div>
                  <div className="text-xs text-gray-300">API: {c.api_key}</div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <button
                    onClick={() => sync(c.id, c.name)}
                    className="btn btn-sm text-xs"
                    title="Trigger manual sync"
                  >↻ Sync</button>
                  <button
                    onClick={() => toggle(c.id)}
                    className={`relative w-10 h-6 rounded-full border-0 cursor-pointer transition-colors ${c.active ? 'bg-emerald-500' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${c.active ? 'left-4' : 'left-0.5'}`}></span>
                  </button>
                  <button onClick={() => remove(c.id, c.name)} className="btn btn-sm btn-danger">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add channel */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Add channel</h2>
          <label className="label">Channel</label>
          <select className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}>
            {['Booking.com','Expedia','Airbnb','MakeMyTrip','Goibibo','Agoda','TripAdvisor','Direct / Website','GDS'].map(n => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <label className="label mt-3">API key</label>
          <input className="input" type="password" placeholder="Paste API key from channel extranet" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} />
          <label className="label mt-3">Hotel ID (from channel)</label>
          <input className="input" placeholder="e.g. INH20021" value={form.hotel_id_on_channel} onChange={e => setForm(f => ({ ...f, hotel_id_on_channel: e.target.value }))} />
          <label className="label mt-3">Commission / markup (%)</label>
          <input className="input" type="number" min="0" max="50" value={form.commission_pct} onChange={e => setForm(f => ({ ...f, commission_pct: +e.target.value }))} />
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
            <strong>Integration note:</strong> After connecting, implement the channel's XML/REST webhook in <code>backend/src/routes/channels.js</code> inside the <code>/sync</code> endpoint to push live availability and rates.
          </div>
          <button onClick={add} className="btn btn-primary mt-4">Connect channel</button>
        </div>
      </div>

      {/* Sync log */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Sync log (last 50 events)</h2>
        {syncLog.length === 0 && <p className="text-sm text-gray-400">No sync events yet.</p>}
        <div className="space-y-1 font-mono text-xs">
          {syncLog.map(l => (
            <div key={l.id} className="flex items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-gray-300 flex-shrink-0 w-36">{fmtTime(l.created_at)}</span>
              <span className={`flex-shrink-0 w-16 font-medium ${l.status === 'success' ? 'text-emerald-600' : l.status === 'error' ? 'text-red-500' : 'text-blue-500'}`}>{l.status}</span>
              <span className="text-gray-500 font-medium flex-shrink-0">{l.channel_name}</span>
              <span className="text-gray-600">{l.event}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
