/**
 * Reservations Router — /api/reservations (ESM)
 * All queries scoped to req.propertyId via scopeQuery or explicit WHERE.
 */

import express from 'express';
import db      from '../db.js';
import auth    from '../middleware/auth.js';
import { propertyScope, atLeast, scopeQuery } from '../middleware/rbac.js';

const router = express.Router();
router.use(auth, propertyScope);

// GET /api/reservations
router.get('/', async (req, res) => {
  try {
    const { status, date_from, date_to, search } = req.query;
    let q = db('reservations as r')
      .join('rooms as rm', 'r.room_id', 'rm.id')
      .select('r.*', 'rm.number as room_number', 'rm.type as room_type', 'rm.base_rate')
      .orderBy('r.created_at', 'desc');

    if (req.propertyId) q = q.where('r.property_id', req.propertyId);
    if (status)    q = q.where('r.status', status);
    if (date_from) q = q.where('r.check_in', '>=', date_from);
    if (date_to)   q = q.where('r.check_out', '<=', date_to);
    if (search) {
      q = q.where(function () {
        this.whereILike('r.first_name', `%${search}%`)
            .orWhereILike('r.last_name',  `%${search}%`)
            .orWhereILike('r.email',      `%${search}%`)
            .orWhereILike('r.res_number', `%${search}%`);
      });
    }
    res.json(await q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reservations/:id
router.get('/:id', async (req, res) => {
  try {
    let q = db('reservations as r')
      .join('rooms as rm', 'r.room_id', 'rm.id')
      .select('r.*', 'rm.number as room_number', 'rm.type as room_type', 'rm.base_rate', 'rm.floor')
      .where('r.id', req.params.id);
    if (req.propertyId) q = q.where('r.property_id', req.propertyId);
    const r = await q.first();
    if (!r) return res.status(404).json({ error: 'Reservation not found' });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/reservations
router.post('/', atLeast('receptionist'), async (req, res) => {
  const { room_id, first_name, last_name, email, phone,
    check_in, check_out, adults, children, source, notes, rate_override } = req.body;

  if (!room_id || !first_name || !last_name || !check_in || !check_out)
    return res.status(400).json({ error: 'room_id, guest name, check_in, check_out required' });
  if (check_out <= check_in)
    return res.status(400).json({ error: 'check_out must be after check_in' });

  try {
    // Verify room belongs to this property
    const roomQ = db('rooms').where({ id: room_id });
    if (req.propertyId) roomQ.andWhere({ property_id: req.propertyId });
    const room = await roomQ.first();
    if (!room) return res.status(404).json({ error: 'Room not found in this property' });
    if (['closed','maintenance'].includes(room.status))
      return res.status(409).json({ error: `Room ${room.number} is currently ${room.status}` });

    // Availability check scoped to property
    let conflictQ = db('reservations').where({ room_id })
      .whereNotIn('status', ['cancelled','checked_out','no_show'])
      .where('check_in', '<', check_out).andWhere('check_out', '>', check_in);
    if (req.propertyId) conflictQ = conflictQ.andWhere({ property_id: req.propertyId });
    const conflict = await conflictQ.first();
    if (conflict) return res.status(409).json({ error: 'Room not available for selected dates' });

    const nights       = Math.ceil((new Date(check_out) - new Date(check_in)) / 86400000);
    const rate         = rate_override || room.base_rate;
    const total_amount = rate * nights;
    const rand         = Math.random().toString(36).slice(2,5).toUpperCase();
    const ts           = new Date().toISOString().replace(/[-T:\.Z]/g,'').slice(0,14);
    const res_number   = `RES${ts}${rand}`;

    const [reservation] = await db('reservations').insert({
      property_id: req.propertyId || null,
      tenant_id:   req.tenantId   || null,
      res_number, room_id, first_name, last_name, email, phone,
      check_in, check_out,
      adults:      adults   || 1,
      children:    children || 0,
      source:      source   || 'direct',
      notes, rate_per_night: rate, total_amount,
      status:      'confirmed',
      created_by:  req.user.id,
    }).returning('*');

    await db('rooms').where({ id: room_id })
      .update({ status: 'reserved', updated_at: new Date() });

    res.status(201).json({ ...reservation, room_number: room.number, room_type: room.type });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/reservations/:id
router.put('/:id', atLeast('receptionist'), async (req, res) => {
  try {
    let q = db('reservations').where({ id: req.params.id });
    if (req.propertyId) q = q.andWhere({ property_id: req.propertyId });
    const r = await q.first();
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (['checked_in','checked_out','cancelled'].includes(r.status))
      return res.status(400).json({ error: `Cannot edit reservation with status '${r.status}'` });
    const { first_name, last_name, email, phone, adults, children, notes, source } = req.body;
    const [updated] = await db('reservations').where({ id: req.params.id })
      .update({ first_name, last_name, email, phone, adults, children, notes, source, updated_at: new Date() })
      .returning('*');
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/reservations/:id/cancel
router.patch('/:id/cancel', atLeast('receptionist'), async (req, res) => {
  try {
    let q = db('reservations').where({ id: req.params.id });
    if (req.propertyId) q = q.andWhere({ property_id: req.propertyId });
    const r = await q.first();
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (['checked_in','checked_out'].includes(r.status))
      return res.status(400).json({ error: 'Cannot cancel active or completed reservation' });
    await db('reservations').where({ id: r.id })
      .update({ status: 'cancelled', updated_at: new Date() });
    const room = await db('rooms').where({ id: r.room_id }).first();
    if (room?.status === 'reserved')
      await db('rooms').where({ id: r.room_id })
        .update({ status: 'available', updated_at: new Date() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/reservations/:id/no-show
router.patch('/:id/no-show', atLeast('manager'), async (req, res) => {
  try {
    let q = db('reservations').where({ id: req.params.id, status: 'confirmed' });
    if (req.propertyId) q = q.andWhere({ property_id: req.propertyId });
    const r = await q.first();
    if (!r) return res.status(400).json({ error: 'Confirmed reservation not found' });
    await db('reservations').where({ id: r.id })
      .update({ status: 'no_show', updated_at: new Date() });
    await db('rooms').where({ id: r.room_id })
      .update({ status: 'available', updated_at: new Date() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
