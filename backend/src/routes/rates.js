/**
 * Rates Router — /api/rates (ESM)
 * Property-scoped rate management.
 */

import express from 'express';
import db      from '../db.js';
import auth    from '../middleware/auth.js';
import { propertyScope, atLeast } from '../middleware/rbac.js';

const router = express.Router();
router.use(auth, propertyScope);

router.get('/', async (req, res) => {
  try {
    let q = db('rates').orderBy('room_type').orderBy('season');
    if (req.propertyId) q = q.where({ property_id: req.propertyId });
    res.json(await q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', atLeast('manager'), async (req, res) => {
  const { room_type, season, price_per_night, valid_from, valid_to } = req.body;
  if (!room_type || !season || !price_per_night)
    return res.status(400).json({ error: 'room_type, season, price_per_night required' });
  try {
    const [rate] = await db('rates').insert({
      property_id:   req.propertyId || null,
      tenant_id:     req.tenantId   || null,
      room_type, season, price_per_night,
      valid_from:    valid_from || null,
      valid_to:      valid_to   || null,
    }).returning('*');
    res.status(201).json(rate);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', atLeast('manager'), async (req, res) => {
  try {
    const { property_id, tenant_id, id, created_at, ...safeFields } = req.body;
    const [rate] = await db('rates').where({ id: req.params.id })
      .update({ ...safeFields, updated_at: new Date() }).returning('*');
    if (!rate) return res.status(404).json({ error: 'Rate not found' });
    res.json(rate);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', atLeast('manager'), async (req, res) => {
  try {
    await db('rates').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
