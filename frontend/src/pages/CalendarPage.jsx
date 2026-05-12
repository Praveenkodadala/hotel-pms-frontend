/**
 * CalendarPage.jsx — Hotel PMS Reservation Calendar (v2)
 * Sub-page linked from Reservations page.
 *
 * Grid: Room rows × Date columns
 * Each cell shows pills for: Arriving (↓) | In-house | Departing (↑)
 * A guest appears on BOTH check-out day AND check-in day if another guest arrives.
 *
 * Features:
 *  - 7-day / 14-day toggle (top-right)
 *  - Navigate back/forward by range
 *  - Today button
 *  - Hover tooltip with full booking info
 *  - Stats table below: Arrivals / Departures / In-house / Available / Occupancy %
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const isoDate  = d => d.toISOString().split('T')[0];
const addDays  = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtShort = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtFull  = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtCur   = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const DAYS     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// A booking is visible on `date` if check_in <= date <= check_out
// (inclusive both ends so departing guest and arriving guest both show on same day)
function bookingsForCell(bookings, roomId, date) {
  return bookings.filter(b => b.room_id === roomId && b.check_in <= date && b.check_out >= date);
}

function pillType(b, date) {
  if (b.check_in  === date) return 'arriving';
  if (b.check_out === date) return 'departing';
  return 'inhouse';
}

function pillLabel(b, date) {
  const name = b.first_name + ' ' + b.last_name;
  const t = pillType(b, date);
  return t === 'arriving' ? '↓ ' + name : t === 'departing' ? '↑ ' + name : name;
}

const PILL = {
  arriving:  { bg: '#E1F5EE', color: '#0F6E56', borderLeft: '2px solid #1D9E75' },
  inhouse:   { bg: '#E6F1FB', color: '#185FA5', borderLeft: '2px solid #185FA5' },
  departing: { bg: '#FAEEDA', color: '#854F0B', borderLeft: '2px solid #EF9F27' },
};

function Tooltip({ tip }) {
  if (!tip) return null;
  const { booking: b, date, x, y } = tip;
  const t = pillType(b, date);
  const statusLabel = { arriving: 'Arriving', departing: 'Departing', inhouse: 'In-house' }[t];
  const nights = Math.round((new Date(b.check_out) - new Date(b.check_in)) / 86400000);
  let lx = x + 14, ly = y - 10;
  if (lx + 240 > window.innerWidth)  lx = x - 254;
  if (ly + 220 > window.innerHeight) ly = y - 220;
  return (
    <div style={{
      position: 'fixed', left: lx, top: ly, zIndex: 9999,
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-secondary)',
      borderRadius: '12px', padding: '10px 14px',
      fontSize: 12, pointerEvents: 'none',
      boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
      minWidth: 190,
    }}>
      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>
        {b.first_name} {b.last_name}
      </div>
      {[
        ['Status',     statusLabel],
        ['Check-in',   fmtFull(b.check_in)],
        ['Check-out',  fmtFull(b.check_out)],
        ['Nights',     nights],
        ['Rate/night', fmtCur(b.rate_per_night)],
        ['Total',      fmtCur(b.total_amount)],
        ['Source',     b.source || 'Direct'],
        ['Res #',      b.res_number],
      ].map(([l, v]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 2 }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>{l}</span>
          <span style={{ fontWeight: 500 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function StatsTable({ days, bookings, totalRooms, today }) {
  const stats = days.map(d => {
    const arrivals   = bookings.filter(b => b.check_in  === d).length;
    const departures = bookings.filter(b => b.check_out === d).length;
    const inhouse    = bookings.filter(b => b.check_in < d && b.check_out > d).length;
    const occupied   = arrivals + inhouse;
    const available  = Math.max(0, totalRooms - occupied);
    const occ        = totalRooms ? Math.round(occupied / totalRooms * 100) : 0;
    return { date: d, arrivals, departures, inhouse, available, occ };
  });

  const rows = [
    { label: 'Arrivals',        key: 'arrivals',   color: '#0F6E56' },
    { label: 'Departures',      key: 'departures', color: '#854F0B' },
    { label: 'In-house',        key: 'inhouse',    color: '#185FA5' },
    { label: 'Available rooms', key: 'available',  color: 'var(--color-text-secondary)' },
    { label: 'Occupancy %',     key: 'occ',        color: '#3C3489', suffix: '%' },
  ];

  const tdStyle = (isFirst, isToday, ri) => ({
    padding: isFirst ? '7px 12px' : '7px 10px',
    textAlign: isFirst ? 'left' : 'center',
    fontSize: isFirst ? 12 : 13,
    fontWeight: isFirst ? 500 : 500,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    borderRight: '0.5px solid var(--color-border-tertiary)',
    background: isFirst
      ? ri % 2 === 1 ? 'var(--color-background-secondary)' : 'var(--color-background-primary)'
      : isToday ? 'rgba(24,95,165,0.03)' : 'transparent',
    color: isFirst ? 'var(--color-text-secondary)' : undefined,
    position: isFirst ? 'sticky' : undefined,
    left: isFirst ? 0 : undefined,
    zIndex: isFirst ? 1 : undefined,
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
        Daily stats for displayed dates
      </div>
      <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: '12px', overflow: 'hidden', overflowX: 'auto', background: 'var(--color-background-primary)' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-secondary)', borderRight: '0.5px solid var(--color-border-secondary)', position: 'sticky', left: 0, zIndex: 2, whiteSpace: 'nowrap' }}>
                Metric
              </th>
              {days.map(d => {
                const dt = new Date(d + 'T00:00:00');
                const isToday = d === today;
                const isWknd  = dt.getDay() === 0 || dt.getDay() === 6;
                return (
                  <th key={d} style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: 500, borderBottom: '0.5px solid var(--color-border-secondary)', borderRight: '0.5px solid var(--color-border-tertiary)', background: isToday ? 'rgba(24,95,165,0.06)' : 'var(--color-background-secondary)', color: isToday ? '#185FA5' : isWknd ? '#E24B4A' : 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {DAYS[dt.getDay()]} {dt.getDate()}<br />
                    <span style={{ fontSize: 10, fontWeight: 400 }}>{MONTHS[dt.getMonth()]}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.key}>
                <td style={tdStyle(true, false, ri)}>{row.label}</td>
                {stats.map(sd => (
                  <td key={sd.date} style={tdStyle(false, sd.date === today, ri)}>
                    <span style={{ color: row.color }}>{sd[row.key]}{row.suffix || ''}</span>
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ background: 'var(--color-background-secondary)' }}>
              <td style={{ padding: '7px 12px', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', borderRight: '0.5px solid var(--color-border-secondary)', position: 'sticky', left: 0, background: 'var(--color-background-secondary)', zIndex: 1 }}>
                Total bookings
              </td>
              {stats.map(sd => (
                <td key={sd.date} style={{ padding: '7px 10px', textAlign: 'center', fontSize: 13, fontWeight: 500, borderRight: '0.5px solid var(--color-border-tertiary)' }}>
                  {sd.arrivals + sd.inhouse + sd.departures}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const today    = isoDate(new Date());

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 2); return d;
  });
  const [rangeDays, setRangeDays] = useState(7);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [tip,       setTip]       = useState(null);

  const days = Array.from({ length: rangeDays }, (_, i) => isoDate(addDays(startDate, i)));

  useEffect(() => {
    setLoading(true);
    const start = isoDate(addDays(startDate, -1));
    const end   = isoDate(addDays(startDate, rangeDays + 1));
    api.get(`/calendar?start=${start}&end=${end}`)
      .then(r => setData(r.data))
      .catch(e => console.error('[Calendar]', e))
      .finally(() => setLoading(false));
  }, [isoDate(startDate), rangeDays]);

  const rooms    = data?.room_groups?.flatMap(g => g.rooms) || [];
  const bookings = data?.bookings || [];
  const groups   = data?.room_groups || [];

  const navBack  = () => setStartDate(d => addDays(d, -rangeDays));
  const navFwd   = () => setStartDate(d => addDays(d, rangeDays));
  const goToday  = () => { const d = new Date(); d.setDate(d.getDate() - 2); setStartDate(d); };

  const onEnter  = useCallback((e, b, date) => setTip({ booking: b, date, x: e.clientX, y: e.clientY }), []);
  const onMove   = useCallback(e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t), []);
  const onLeave  = useCallback(() => setTip(null), []);

  const COL_W      = rangeDays <= 7 ? 120 : 90;
  const ROOM_COL_W = 72;

  const btnBase = {
    border: '0.5px solid var(--color-border-secondary)', borderRadius: '8px',
    background: 'var(--color-background-primary)', cursor: 'pointer',
    color: 'var(--color-text-secondary)', fontFamily: 'inherit',
  };

  return (
    <div style={{ padding: '16px 20px', fontFamily: 'var(--font-sans)', minHeight: '100vh', background: 'var(--color-background-tertiary)', color: 'var(--color-text-primary)' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/reservations')} style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12 }}>
            ← Reservations
          </button>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Calendar view</span>
          {loading && <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Loading…</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={goToday} style={{ ...btnBase, padding: '5px 12px', fontSize: 12 }}>Today</button>

          <button onClick={navBack} style={{ ...btnBase, width: 30, height: 30, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>

          <div style={{ ...btnBase, padding: '5px 12px', fontSize: 12, fontWeight: 500, minWidth: 164, textAlign: 'center', pointerEvents: 'none' }}>
            {fmtShort(days[0])} – {fmtFull(days[days.length - 1])}
          </div>

          <button onClick={navFwd} style={{ ...btnBase, width: 30, height: 30, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>

          <div style={{ display: 'flex', border: '0.5px solid var(--color-border-secondary)', borderRadius: '8px', overflow: 'hidden', background: 'var(--color-background-secondary)' }}>
            {[7, 14].map(n => (
              <button key={n} onClick={() => setRangeDays(n)} style={{ padding: '5px 14px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: rangeDays === n ? 'var(--color-background-primary)' : 'transparent', color: rangeDays === n ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: rangeDays === n ? 500 : 400, transition: 'all 0.1s' }}>
                {n} days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: '12px', background: 'var(--color-background-primary)', overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: ROOM_COL_W + COL_W * rangeDays }}>
          <thead>
            <tr>
              <th style={{ width: ROOM_COL_W, minWidth: ROOM_COL_W, padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', background: 'var(--color-background-primary)', borderBottom: '0.5px solid var(--color-border-secondary)', borderRight: '0.5px solid var(--color-border-secondary)', position: 'sticky', left: 0, top: 0, zIndex: 10 }}>
                Room
              </th>
              {days.map(d => {
                const dt      = new Date(d + 'T00:00:00');
                const isToday = d === today;
                const isWknd  = dt.getDay() === 0 || dt.getDay() === 6;
                return (
                  <th key={d} style={{ width: COL_W, minWidth: COL_W, padding: '6px 4px', textAlign: 'center', borderBottom: '0.5px solid var(--color-border-secondary)', borderRight: '0.5px solid var(--color-border-tertiary)', position: 'sticky', top: 0, zIndex: 5, background: isToday ? 'rgba(24,95,165,0.07)' : isWknd ? 'var(--color-background-secondary)' : 'var(--color-background-primary)', color: isToday ? '#185FA5' : isWknd ? '#E24B4A' : 'var(--color-text-primary)' }}>
                    <div style={{ fontSize: 10, marginBottom: 1, color: isToday ? '#185FA5' : isWknd ? '#E24B4A' : 'var(--color-text-secondary)' }}>{DAYS[dt.getDay()]}</div>
                    <div style={{ fontSize: isToday ? 16 : 13, fontWeight: isToday ? 600 : 500 }}>{dt.getDate()}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{MONTHS[dt.getMonth()]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <>
                <tr key={'g-' + group.type}>
                  <td colSpan={rangeDays + 1} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)', letterSpacing: '0.04em' }}>
                    {group.type}
                    <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 6 }}>({group.rooms.length})</span>
                  </td>
                </tr>
                {group.rooms.map((room, ri) => (
                  <tr key={room.id}>
                    <td style={{ width: ROOM_COL_W, minWidth: ROOM_COL_W, padding: '0 12px', fontSize: 12, fontWeight: 500, height: 46, verticalAlign: 'middle', borderBottom: '0.5px solid var(--color-border-tertiary)', borderRight: '0.5px solid var(--color-border-secondary)', position: 'sticky', left: 0, background: ri % 2 === 1 ? 'var(--color-background-secondary)' : 'var(--color-background-primary)', zIndex: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {room.number}
                        {room.housekeeping_status && room.housekeeping_status !== 'clean' && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: { dirty: '#E24B4A', in_progress: '#EF9F27', inspected: '#185FA5' }[room.housekeeping_status] || '#888' }} />
                        )}
                      </div>
                    </td>
                    {days.map(d => {
                      const dt      = new Date(d + 'T00:00:00');
                      const isToday = d === today;
                      const isWknd  = dt.getDay() === 0 || dt.getDay() === 6;
                      const bks     = bookingsForCell(bookings, room.id, d);
                      return (
                        <td key={d} style={{ width: COL_W, minWidth: COL_W, padding: '3px 4px', verticalAlign: 'top', height: 46, borderBottom: '0.5px solid var(--color-border-tertiary)', borderRight: '0.5px solid var(--color-border-tertiary)', background: isToday ? 'rgba(24,95,165,0.03)' : isWknd && ri % 2 !== 1 ? 'rgba(0,0,0,0.01)' : 'transparent' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%', justifyContent: 'center' }}>
                            {bks.slice(0, 2).map(b => {
                              const t  = pillType(b, d);
                              const st = PILL[t];
                              return (
                                <div key={b.id}
                                  onMouseEnter={e => onEnter(e, b, d)}
                                  onMouseMove={onMove}
                                  onMouseLeave={onLeave}
                                  style={{ ...st, background: st.bg, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 500, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', maxWidth: '100%' }}>
                                  {pillLabel(b, d)}
                                </div>
                              );
                            })}
                            {bks.length > 2 && (
                              <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', paddingLeft: 5 }}>+{bks.length - 2} more</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Arriving',  ...PILL.arriving  },
          { label: 'In-house',  ...PILL.inhouse   },
          { label: 'Departing', ...PILL.departing  },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
            <span style={{ width: 28, height: 13, borderRadius: 3, background: s.bg, borderLeft: s.borderLeft, display: 'inline-block' }} />
            {s.label}
          </div>
        ))}
      </div>

      {/* Stats table */}
      <StatsTable days={days} bookings={bookings} totalRooms={rooms.length} today={today} />

      {/* Tooltip */}
      <Tooltip tip={tip} />
    </div>
  );
}
