/**
 * Check-in / Check-out Router — /api/checkin (ESM)
 * On checkout: locks room + auto-creates housekeeping task.
 */

import express          from 'express';
import db               from '../db.js';
import auth             from '../middleware/auth.js';
import { propertyScope, atLeast } from '../middleware/rbac.js';
import { createInvoice } from '../services/invoiceService.js';

const router = express.Router();
router.use(auth, propertyScope);

// POST /api/checkin/:reservation_id
router.post('/:reservation_id', atLeast('receptionist'), async (req, res) => {
  const { id_type, id_number, notes } = req.body;
  if (!id_type || !id_number)
    return res.status(400).json({ error: 'id_type and id_number required' });

  try {
    let q = db('reservations').where({ id: req.params.reservation_id });
    if (req.propertyId) q = q.andWhere({ property_id: req.propertyId });
    const r = await q.first();
    if (!r) return res.status(404).json({ error: 'Reservation not found' });
    if (r.status !== 'confirmed')
      return res.status(400).json({ error: `Cannot check in — status is '${r.status}'` });

    const [updated] = await db('reservations').where({ id: r.id }).update({
      status:          'checked_in',
      id_type, id_number,
      actual_check_in: new Date(),
      notes:           notes || r.notes,
      checked_in_by:   req.user.id,
      updated_at:      new Date(),
    }).returning('*');

    await db('rooms').where({ id: r.room_id }).update({
      status:              'occupied',
      housekeeping_status: 'dirty',
      updated_at:          new Date(),
    });

    res.json({ success: true, reservation: updated });
  } catch (e) {
    console.error('[checkin]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/checkin/checkout/:reservation_id
router.post('/checkout/:reservation_id', atLeast('receptionist'), async (req, res) => {
  try {
    let q = db('reservations').where({ id: req.params.reservation_id });
    if (req.propertyId) q = q.andWhere({ property_id: req.propertyId });
    const r = await q.first();
    if (!r) return res.status(404).json({ error: 'Reservation not found' });
    if (r.status !== 'checked_in')
      return res.status(400).json({ error: 'Guest is not currently checked in' });

    const room = await db('rooms').where({ id: r.room_id }).first();

    // Create invoice via service
    const invoice = await createInvoice({
      reservation: { ...r, actual_check_out: new Date() },
      room,
      propertyId: req.propertyId,
      tenantId:   req.tenantId,
      createdBy:  req.user.id,
      lineItems:  [],
    });

    // Update reservation
    await db('reservations').where({ id: r.id }).update({
      status:           'checked_out',
      actual_check_out: new Date(),
      checked_out_by:   req.user.id,
      updated_at:       new Date(),
    });

    // Lock room for housekeeping
    await db('rooms').where({ id: r.room_id }).update({
      status:              'maintenance',
      housekeeping_status: 'dirty',
      updated_at:          new Date(),
    });

    // Auto-create housekeeping task
    const [hkTask] = await db('housekeeping_tasks').insert({
      property_id:    req.propertyId || null,
      tenant_id:      req.tenantId   || null,
      room_id:        r.room_id,
      reservation_id: r.id,
      created_by:     req.user.id,
      status:         'pending',
      priority:       'normal',
      notes:          `Auto-created on checkout of ${r.first_name} ${r.last_name} (${invoice.inv_number})`,
      checklist: JSON.stringify([
        { item: 'Change bed linen and pillowcases', done: false },
        { item: 'Clean and sanitise bathroom',      done: false },
        { item: 'Vacuum / mop floor',               done: false },
        { item: 'Replenish toiletries and amenities', done: false },
        { item: 'Check and restock minibar',         done: false },
        { item: 'Check for lost & found items',      done: false },
        { item: 'Inspect for damage or maintenance', done: false },
        { item: 'Wipe down surfaces and mirrors',    done: false },
      ]),
    }).returning('*');

    res.json({ success: true, invoice, housekeeping_task: hkTask });
  } catch (e) {
    console.error('[checkout]', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
