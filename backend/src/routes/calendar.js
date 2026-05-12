/**
 * Calendar Router — /api/calendar (ESM)
 * Provides tape-chart data — rooms grouped + reservations with layout coords.
 * Property-scoped.
 */

import express from 'express';
import db      from '../db.js';
import auth    from '../middleware/auth.js';
import { propertyScope } from '../middleware/rbac.js';

const router = express.Router();
router.use(auth, propertyScope);

const addDays  = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().split('T')[0]; };
const dayRange = (start, end) => {
  const days = []; const cur = new Date(start); const last = new Date(end);
  while (cur < last) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate()+1); }
  return days;
};

// GET /api/calendar
router.get('/', async (req, res) => {
  try {
    const { start = new Date().toISOString().split('T')[0], end = addDays(new Date().toISOString().split('T')[0], 30) } = req.query;

    let roomsQ = db('rooms')
      .select('id','number','type','floor','max_occupancy','base_rate','status','housekeeping_status')
      .orderBy('type').orderBy('number');
    if (req.propertyId) roomsQ = roomsQ.where({ property_id: req.propertyId });
    const rooms = await roomsQ;

    const roomGroups = []; const typeMap = {};
    rooms.forEach(r => {
      if (!typeMap[r.type]) { typeMap[r.type] = { type: r.type, rooms: [] }; roomGroups.push(typeMap[r.type]); }
      typeMap[r.type].rooms.push(r);
    });

    let resQ = db('reservations as r').join('rooms as rm','r.room_id','rm.id')
      .select('r.id','r.res_number','r.room_id','r.first_name','r.last_name',
        'r.check_in','r.check_out','r.status','r.source','r.adults',
        'r.notes','r.rate_per_night','r.total_amount',
        'rm.number as room_number','rm.type as room_type')
      .where('r.check_in','<', end).where('r.check_out','>', start)
      .whereNotIn('r.status',['cancelled','no_show']).orderBy('r.check_in');
    if (req.propertyId) resQ = resQ.where('r.property_id', req.propertyId);
    const reservations = await resQ;

    const startDate = new Date(start); const roomRowMap = {}; let rowIdx = 0;
    roomGroups.forEach(g => {
      g.rows = [];
      g.rooms.forEach(r => { roomRowMap[r.id] = rowIdx; g.rows.push(rowIdx); rowIdx++; });
    });

    const layoutBookings = reservations.map(r => {
      const xDays     = Math.max(0, (new Date(r.check_in) - startDate) / 86400000);
      const widthDays = Math.max(0.5, (new Date(r.check_out) - new Date(r.check_in)) / 86400000);
      return { ...r, guest_name: `${r.first_name} ${r.last_name}`,
        layout: { row: roomRowMap[r.room_id] ?? -1, xDays, widthDays } };
    }).filter(b => b.layout.row >= 0);

    const totalRooms = rooms.length;
    const days       = dayRange(start, end);
    const occupancy  = days.map(day => {
      const occupied = reservations.filter(r => r.check_in <= day && r.check_out > day).length;
      return { date: day, occupied, available: totalRooms - occupied, pct: totalRooms ? Math.round(occupied/totalRooms*100) : 0 };
    });

    res.json({ start, end, total_rooms: totalRooms, total_rows: rowIdx, room_groups: roomGroups, bookings: layoutBookings, occupancy });
  } catch (e) {
    console.error('[GET /calendar]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/calendar/occupancy
router.get('/occupancy', async (req, res) => {
  try {
    const { start = new Date().toISOString().split('T')[0], end = addDays(new Date().toISOString().split('T')[0], 30) } = req.query;
    let totalQ = db('rooms').count('id as count');
    if (req.propertyId) totalQ = totalQ.where({ property_id: req.propertyId });
    const [{ count: totalRooms }] = await totalQ;

    let resQ = db('reservations as r').join('rooms as rm','r.room_id','rm.id')
      .select('r.check_in','r.check_out')
      .where('r.check_in','<',end).where('r.check_out','>',start)
      .whereNotIn('r.status',['cancelled','no_show']);
    if (req.propertyId) resQ = resQ.where('r.property_id', req.propertyId);
    const reservations = await resQ;

    const occupancy = dayRange(start, end).map(day => {
      const occupied = reservations.filter(r => r.check_in <= day && r.check_out > day).length;
      return { date: day, occupied, available: parseInt(totalRooms)-occupied, pct: totalRooms ? Math.round(occupied/totalRooms*100) : 0 };
    });
    res.json({ start, end, total_rooms: parseInt(totalRooms), occupancy });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
