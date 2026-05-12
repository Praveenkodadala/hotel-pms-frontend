import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function Metric({ label, value, color, sub }) {
  return (
    <div className="card py-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${color || 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const HK_STATUS = {
  pending:    { label: 'Pending',     color: '#9CA3AF' },
  assigned:   { label: 'Assigned',    color: '#3B82F6' },
  in_progress:{ label: 'In Progress', color: '#F59E0B' },
  completed:  { label: 'Completed',   color: '#8B5CF6' },
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const { isAtLeast } = useAuth();
  const navigate = useNavigate();

  const load = () => api.get('/dashboard').then(r => setData(r.data)).catch(() => {});
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, []);

  if (!data) return <div className="p-8 text-gray-400 text-sm">Loading dashboard…</div>;

  const roomChart = [
    { name: 'Available', value: data.rooms.available || 0, color: '#059669' },
    { name: 'Occupied',  value: data.rooms.occupied  || 0, color: '#DC2626' },
    { name: 'Reserved',  value: data.rooms.reserved  || 0, color: '#D97706' },
    { name: 'Maint.',    value: (data.rooms.maintenance || 0) + (data.rooms.closed || 0), color: '#9CA3AF' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <div className="text-xs text-gray-400">Refreshes every 30s</div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <Metric label="Total rooms"    value={data.rooms.total || 0} />
        <Metric label="Occupied"       value={data.rooms.occupied || 0}   color="text-red-600" />
        <Metric label="Available"      value={data.rooms.available || 0}  color="text-emerald-600" />
        <Metric label="Occupancy"      value={`${data.occupancy_pct}%`}   color="text-brand-600" />
        <Metric label="Arrivals today" value={data.arrivals_today}         color="text-amber-600" />
        <Metric label="Today revenue"  value={`₹${Number(data.today_revenue).toLocaleString('en-IN')}`}  color="text-emerald-600" />
        <Metric label="Month revenue"  value={`₹${Number(data.month_revenue||0).toLocaleString('en-IN')}`} color="text-brand-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Room chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Room status</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={roomChart} barSize={40}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={24} />
              <Tooltip />
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {roomChart.map((e,i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Reservation counts */}
        <div className="card">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Reservations</h2>
          {Object.entries(data.reservation_counts || {}).map(([k,v]) => (
            <div key={k} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600 capitalize">{k.replace('_',' ')}</span>
              <span className="text-sm font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Arrivals */}
        <div className="card">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Today's arrivals ({data.arrivals?.length || 0})</h2>
          {data.arrivals?.length ? data.arrivals.map(a => (
            <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <div className="text-sm font-medium">{a.first_name} {a.last_name}</div>
                <div className="text-xs text-gray-400">Room {a.room_number} · {a.room_type} · {a.source}</div>
              </div>
              <span className="badge badge-amber text-xs">Arriving</span>
            </div>
          )) : <p className="text-sm text-gray-400">No arrivals today</p>}
        </div>

        {/* Departures */}
        <div className="card">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Today's departures ({data.departures?.length || 0})</h2>
          {data.departures?.length ? data.departures.map(d => (
            <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <div className="text-sm font-medium">{d.first_name} {d.last_name}</div>
                <div className="text-xs text-gray-400">Room {d.room_number} · {d.room_type}</div>
              </div>
              <span className="badge badge-blue text-xs">Due out</span>
            </div>
          )) : <p className="text-sm text-gray-400">No departures today</p>}
        </div>

        {/* Housekeeping summary */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700">Housekeeping</h2>
            {isAtLeast('receptionist') && (
              <button onClick={() => navigate('/housekeeping')} className="text-xs text-brand-600 hover:underline">View all →</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Object.entries(HK_STATUS).map(([k, cfg]) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background: cfg.color}}></span>
                <span className="text-gray-500 text-xs">{cfg.label}</span>
                <span className="font-semibold ml-auto">{data.housekeeping?.[k] || 0}</span>
              </div>
            ))}
          </div>
          {data.housekeeping?.pending_tasks?.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Pending tasks</div>
              {data.housekeeping.pending_tasks.slice(0,4).map(t => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="text-sm">Room {t.room_number}</div>
                  <div className="flex items-center gap-2">
                    {t.assigned_to && <span className="text-xs text-gray-400">{t.assigned_to}</span>}
                    <span className={`badge text-xs ${t.status === 'in_progress' ? 'badge-amber' : t.status === 'assigned' ? 'badge-blue' : 'badge-gray'}`}>{t.status.replace('_',' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!data.housekeeping?.pending_tasks?.length && (
            <p className="text-sm text-emerald-600">✓ All rooms clean</p>
          )}
        </div>
      </div>
    </div>
  );
}
