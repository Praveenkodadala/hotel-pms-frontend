/**
 * Properties Router — /api/properties (ESM)
 *
 * Manages the multi-property architecture:
 *   - GET  /mine              — my accessible properties (frontend dropdown)
 *   - POST /                  — create property (super_admin)
 *   - PUT  /:id               — update property (hotel_admin+)
 *   - PATCH /:id/status       — enable/disable (super_admin)
 *   - GET  /:id/users         — list assigned users
 *   - POST /:id/users         — assign user to property
 *   - DELETE /:id/users/:uid  — remove user from property
 *   - PATCH /:id/users/:uid   — update role override
 */

import express from 'express';
import db      from '../db.js';
import auth    from '../middleware/auth.js';
import { superAdminOnly, atLeast, propertyScope } from '../middleware/rbac.js';

const router = express.Router();
router.use(auth);

// ── GET /api/properties/mine ──────────────────────────────────────
router.get('/mine', async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      const props = await db('properties')
        .select('id','name','slug','code','city','state','logo_url','status',
          'primary_color','currency_symbol','star_rating','total_rooms')
        .orderBy('name');
      return res.json(props);
    }
    const props = await db('properties as p')
      .join('user_properties as up', 'p.id', 'up.property_id')
      .where('up.user_id', req.user.id)
      .where('p.status', 'active')
      .select('p.id','p.name','p.slug','p.code','p.city','p.state',
        'p.logo_url','p.status','p.primary_color','p.currency_symbol',
        'p.star_rating','p.total_rooms','up.is_default','up.role_override')
      .orderBy('up.is_default', 'desc').orderBy('p.name');
    res.json(props);
  } catch (e) {
    console.error('[GET /properties/mine]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/properties/:id ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const prop = await db('properties').where({ id: req.params.id }).first();
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    if (req.user.role !== 'super_admin') {
      const access = await db('user_properties')
        .where({ user_id: req.user.id, property_id: req.params.id }).first();
      if (!access) return res.status(403).json({ error: 'Access denied' });
    }
    res.json(prop);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/properties — super_admin only ───────────────────────
router.post('/', superAdminOnly, async (req, res) => {
  const { name, code, email, phone, address, city, state, country, pincode,
    gstin, logo_url, primary_color, star_rating, timezone, currency,
    currency_symbol, tenant_id, admin_user_id } = req.body;

  if (!name || !code) return res.status(400).json({ error: 'name and code required' });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const trx  = await db.transaction();
  try {
    const [property] = await trx('properties').insert({
      name, slug, code: code.toUpperCase(), email, phone, address,
      city, state, country: country || 'India', pincode, gstin,
      logo_url, primary_color: primary_color || '#185FA5',
      star_rating, timezone: timezone || 'Asia/Kolkata',
      currency: currency || 'INR', currency_symbol: currency_symbol || '₹',
      tenant_id: tenant_id || null, status: 'active',
    }).returning('*');

    if (admin_user_id) {
      await trx('user_properties').insert({
        user_id: admin_user_id, property_id: property.id, is_default: true,
      });
    }
    await trx.commit();
    res.status(201).json(property);
  } catch (e) {
    await trx.rollback();
    if (e.code === '23505') return res.status(409).json({ error: 'Property code or slug already exists' });
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/properties/:id ───────────────────────────────────────
router.put('/:id', propertyScope, atLeast('hotel_admin'), async (req, res) => {
  try {
    const allowed = ['name','email','phone','address','city','state','pincode',
      'gstin','logo_url','primary_color','star_rating','timezone','total_rooms'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const [prop] = await db('properties').where({ id: req.params.id })
      .update({ ...updates, updated_at: new Date() }).returning('*');
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    res.json(prop);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/properties/:id/status — super_admin only ──────────
router.patch('/:id/status', superAdminOnly, async (req, res) => {
  const { status, reason } = req.body;
  if (!['active','disabled'].includes(status))
    return res.status(400).json({ error: 'status must be active or disabled' });
  try {
    const [prop] = await db('properties').where({ id: req.params.id })
      .update({ status, disable_reason: reason || null, updated_at: new Date() }).returning('*');
    if (!prop) return res.status(404).json({ error: 'Not found' });
    res.json(prop);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/properties/:id/users ────────────────────────────────
router.get('/:id/users', propertyScope, atLeast('manager'), async (req, res) => {
  try {
    const users = await db('user_properties as up')
      .join('users as u', 'up.user_id', 'u.id')
      .where('up.property_id', req.params.id)
      .select('u.id','u.name','u.email','u.role','u.status','u.phone',
        'up.role_override','up.is_default','up.created_at as assigned_at')
      .orderBy('u.name');
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/properties/:id/users — assign user ─────────────────
router.post('/:id/users', propertyScope, atLeast('hotel_admin'), async (req, res) => {
  const { user_id, role_override, is_default } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const validRoles = ['hotel_admin','manager','receptionist','housekeeping'];
  if (role_override && !validRoles.includes(role_override))
    return res.status(400).json({ error: `role_override must be one of: ${validRoles.join(', ')}` });

  try {
    const user = await db('users').where({ id: user_id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await db('user_properties')
      .where({ user_id, property_id: req.params.id }).first();

    let result;
    if (existing) {
      [result] = await db('user_properties')
        .where({ user_id, property_id: req.params.id })
        .update({ role_override: role_override || null, is_default: !!is_default, updated_at: new Date() })
        .returning('*');
    } else {
      [result] = await db('user_properties')
        .insert({ user_id, property_id: req.params.id, role_override: role_override || null, is_default: !!is_default })
        .returning('*');
    }

    if (is_default) {
      await db('user_properties').where({ user_id }).whereNot({ property_id: req.params.id })
        .update({ is_default: false });
    }
    res.status(201).json({ ...result, user_name: user.name, user_email: user.email });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'User already assigned' });
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/properties/:id/users/:uid ─────────────────────────
router.delete('/:id/users/:uid', propertyScope, atLeast('hotel_admin'), async (req, res) => {
  try {
    await db('user_properties')
      .where({ user_id: req.params.uid, property_id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/properties/:id/users/:uid — update role override ───
router.patch('/:id/users/:uid', propertyScope, atLeast('hotel_admin'), async (req, res) => {
  const { role_override, is_default } = req.body;
  try {
    const [updated] = await db('user_properties')
      .where({ user_id: req.params.uid, property_id: req.params.id })
      .update({ role_override: role_override || null, is_default: !!is_default, updated_at: new Date() })
      .returning('*');
    if (!updated) return res.status(404).json({ error: 'Assignment not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
