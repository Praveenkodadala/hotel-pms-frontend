/**
 * Dashboard — /api/dashboard (ESM)
 * All queries scoped to req.propertyId.
 */

import express from 'express';
import db      from '../db.js';
import auth    from '../middleware/auth.js';
import { propertyScope } from '../middleware/rbac.js';

const router = express.Router();
router.use(auth, propertyScope);

const scope = (q, req, col = 'property_id') =>
  req.propertyId ? q.where(col, req.propertyId) : q;

router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [rooms, reservations, hkTasks, invoiceSummary, monthRevSummary] = await Promise.all([
      scope(db('rooms'), req).select(db.raw('status, count(*) as count')).groupBy('status'),
      scope(db('reservations as r').join('rooms as rm','r.room_id','rm.id'), req, 'r.property_id')
        .select(db.raw('r.status, count(*) as count')).groupBy('r.status'),
      scope(db('housekeeping_tasks'), req).select(db.raw('status, count(*) as count')).groupBy('status'),
      scope(db('invoices'), req).where('created_at', '>=', today + 'T00:00:00')
        .select(db.raw("coalesce(sum(grand_total),0) as today_revenue"), db.raw('count(*) as today_invoices'))
        .first(),
      scope(db('invoices'), req)
        .whereRaw("date_trunc('month', created_at) = date_trunc('month', now())")
        .select(db.raw("coalesce(sum(grand_total),0) as month_revenue")).first(),
    ]);

    const [arrivals, departures, pendingHk] = await Promise.all([
      scope(db('reservations as r').join('rooms as rm','r.room_id','rm.id'), req, 'r.property_id')
        .select('r.id','r.res_number','r.first_name','r.last_name','r.adults',
          'r.check_in','r.source','rm.number as room_number','rm.type as room_type')
        .where('r.check_in', today).where('r.status','confirmed').orderBy('r.check_in'),

      scope(db('reservations as r').join('rooms as rm','r.room_id','rm.id'), req, 'r.property_id')
        .select('r.id','r.res_number','r.first_name','r.last_name',
          'rm.number as room_number','rm.type as room_type','r.check_out')
        .where('r.check_out', today).where('r.status','checked_in').orderBy('r.check_out'),

      scope(db('housekeeping_tasks as ht').join('rooms as r','ht.room_id','r.id'), req, 'ht.property_id')
        .leftJoin('users as u','ht.assigned_to','u.id')
        .select('ht.id','ht.status','ht.priority',
          'r.number as room_number','r.type as room_type','u.name as assigned_to')
        .whereIn('ht.status',['pending','assigned','in_progress'])
        .orderBy('ht.priority','desc').limit(10),
    ]);

    const roomMap = rooms.reduce((a,r) => { a[r.status]=parseInt(r.count); return a; }, {});
    const total   = Object.values(roomMap).reduce((s,v) => s+v, 0);
    const hkMap   = hkTasks.reduce((a,h) => { a[h.status]=parseInt(h.count); return a; }, {});

    res.json({
      property:        req.property || null,
      rooms:           { ...roomMap, total },
      occupancy_pct:   total ? Math.round((roomMap.occupied||0) / total * 100) : 0,
      today_revenue:   parseFloat(invoiceSummary?.today_revenue || 0),
      month_revenue:   parseFloat(monthRevSummary?.month_revenue || 0),
      today_invoices:  parseInt(invoiceSummary?.today_invoices || 0),
      arrivals_today:  arrivals.length,
      departures_today: departures.length,
      arrivals,
      departures,
      reservation_counts: reservations.reduce((a,r) => { a[r.status]=parseInt(r.count); return a; }, {}),
      housekeeping: {
        pending:       hkMap.pending     || 0,
        assigned:      hkMap.assigned    || 0,
        in_progress:   hkMap.in_progress || 0,
        completed:     hkMap.completed   || 0,
        pending_tasks: pendingHk,
      },
    });
  } catch (e) {
    console.error('[dashboard]', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
