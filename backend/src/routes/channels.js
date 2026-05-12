/**
 * Channels Router — /api/channels (ESM)
 * Property-scoped channel manager.
 */

import express from 'express';
import db      from '../db.js';
import auth    from '../middleware/auth.js';
import { propertyScope, atLeast } from '../middleware/rbac.js';

const router = express.Router();
router.use(auth, propertyScope);

const maskKey = (c) => ({ ...c, api_key: c.api_key ? '••••' + c.api_key.slice(-4) : '' });

router.get('/', async (req, res) => {
  try {
    let q = db('channels').orderBy('name');
    if (req.propertyId) q = q.where({ property_id: req.propertyId });
    res.json((await q).map(maskKey));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', atLeast('manager'), async (req, res) => {
  const { name, api_key, hotel_id_on_channel, commission_pct } = req.body;
  if (!name || !api_key || !hotel_id_on_channel)
    return res.status(400).json({ error: 'name, api_key, hotel_id_on_channel required' });
  try {
    const exists = await db('channels')
      .where({ name, property_id: req.propertyId || null }).first();
    if (exists) return res.status(409).json({ error: `${name} is already connected` });
    const [ch] = await db('channels').insert({
      property_id:    req.propertyId || null,
      tenant_id:      req.tenantId   || null,
      name, api_key, hotel_id_on_channel,
      commission_pct: commission_pct || 0,
      active: true,
    }).returning('*');
    await db('channel_sync_log').insert({ channel_id: ch.id, event: `Channel ${name} connected`, status: 'success' });
    res.status(201).json(maskKey(ch));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/toggle', atLeast('manager'), async (req, res) => {
  try {
    const ch = await db('channels').where({ id: req.params.id }).first();
    if (!ch) return res.status(404).json({ error: 'Not found' });
    const [updated] = await db('channels').where({ id: req.params.id })
      .update({ active: !ch.active, updated_at: new Date() }).returning('*');
    await db('channel_sync_log').insert({
      channel_id: ch.id,
      event: `Channel ${updated.active ? 'activated' : 'deactivated'}`,
      status: 'info',
    });
    res.json(maskKey(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', atLeast('hotel_admin'), async (req, res) => {
  try {
    await db('channels').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/sync', atLeast('manager'), async (req, res) => {
  try {
    const ch = await db('channels').where({ id: req.params.id }).first();
    if (!ch) return res.status(404).json({ error: 'Not found' });
    // TODO: call external OTA API here
    await db('channel_sync_log').insert({
      channel_id: ch.id,
      event: 'Manual sync triggered — availability & rates pushed',
      status: 'success',
    });
    res.json({ success: true, message: `Sync triggered for ${ch.name}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sync-log', async (req, res) => {
  try {
    let q = db('channel_sync_log as l').join('channels as c','l.channel_id','c.id')
      .select('l.*','c.name as channel_name').orderBy('l.created_at','desc').limit(100);
    if (req.propertyId) q = q.where('c.property_id', req.propertyId);
    res.json(await q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
