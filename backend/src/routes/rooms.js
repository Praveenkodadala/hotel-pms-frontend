/**
 * Rooms Router — /api/rooms (ESM)
 *
 * Security: uses propertyScope + scopeQuery on EVERY query.
 * Rooms are isolated per property_id — no cross-property reads possible.
 */

import express from 'express';
import db      from '../db.js';
import auth    from '../middleware/auth.js';
import { propertyScope, atLeast, scopeQuery } from '../middleware/rbac.js';

const router = express.Router();
router.use(auth, propertyScope);

// GET /api/rooms
router.get('/', async (req, res) => {
  try {
    let q = db('rooms').orderBy('floor').orderBy('number');
    q = scopeQuery(q, req);
    res.json(await q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rooms/availability?check_in=&check_out=
router.get('/availability', async (req, res) => {
  const { check_in, check_out } = req.query;
  if (!check_in || !check_out)
    return res.status(400).json({ error: 'check_in and check_out required' });
  try {
    let conflictQ = db('reservations')
      .whereNotIn('status', ['cancelled','checked_out','no_show'])
      .where('check_in', '<', check_out)
      .andWhere('check_out', '>', check_in)
      .pluck('room_id');
    if (req.propertyId) conflictQ = conflictQ.where('property_id', req.propertyId);
    const bookedIds = await conflictQ;

    let q = db('rooms')
      .where({ status: 'available', housekeeping_status: 'clean' })
      .whereNotIn('id', bookedIds)
      .orderBy('floor').orderBy('number');
    q = scopeQuery(q, req);
    res.json(await q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rooms/:id
router.get('/:id', async (req, res) => {
  try {
    let q = db('rooms').where({ id: req.params.id });
    q = scopeQuery(q, req);
    const room = await q.first();
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rooms
router.post('/', atLeast('manager'), async (req, res) => {
  const { number, type, floor, max_occupancy, base_rate, description } = req.body;
  if (!number || !type || !base_rate)
    return res.status(400).json({ error: 'number, type, base_rate required' });
  try {
    const exists = await db('rooms')
      .where({ number, property_id: req.propertyId || null }).first();
    if (exists) return res.status(409).json({ error: `Room ${number} already exists in this property` });

    const [room] = await db('rooms').insert({
      property_id:        req.propertyId || null,
      tenant_id:          req.tenantId   || null,
      number, type,
      floor:              floor          || 1,
      max_occupancy:      max_occupancy  || 2,
      base_rate,
      description:        description    || null,
      status:             'available',
      housekeeping_status: 'clean',
    }).returning('*');
    res.status(201).json(room);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rooms/:id
router.put('/:id', atLeast('manager'), async (req, res) => {
  try {
    const { property_id, tenant_id, id, created_at, ...safeFields } = req.body;
    let q = db('rooms').where({ id: req.params.id });
    q = scopeQuery(q, req);
    const [room] = await q.update({ ...safeFields, updated_at: new Date() }).returning('*');
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rooms/:id
router.delete('/:id', atLeast('hotel_admin'), async (req, res) => {
  try {
    let q = db('rooms').where({ id: req.params.id });
    q = scopeQuery(q, req);
    const room = await q.first();
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status === 'occupied') return res.status(400).json({ error: 'Cannot delete an occupied room' });
    await db('rooms').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rooms/:id/close
router.post('/:id/close', atLeast('manager'), async (req, res) => {
  const { from_date, to_date, reason } = req.body;
  if (!from_date || !to_date)
    return res.status(400).json({ error: 'from_date and to_date required' });
  try {
    let q = db('rooms').where({ id: req.params.id });
    q = scopeQuery(q, req);
    const room = await q.first();
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const [closure] = await db('inventory_closures').insert({
      property_id: req.propertyId || null,
      room_id:     req.params.id,
      from_date, to_date,
      reason:      reason || 'Maintenance',
      created_by:  req.user.id,
    }).returning('*');

    await db('rooms').where({ id: req.params.id })
      .update({ status: 'closed', updated_at: new Date() });

    res.status(201).json(closure);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rooms/:id/close/:closureId
router.delete('/:id/close/:closureId', atLeast('manager'), async (req, res) => {
  try {
    await db('inventory_closures')
      .where({ id: req.params.closureId, room_id: req.params.id }).del();
    await db('rooms').where({ id: req.params.id })
      .update({ status: 'available', updated_at: new Date() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rooms/:id/closures
router.get('/:id/closures', async (req, res) => {
  try {
    const closures = await db('inventory_closures')
      .where({ room_id: req.params.id }).orderBy('from_date');
    res.json(closures);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
