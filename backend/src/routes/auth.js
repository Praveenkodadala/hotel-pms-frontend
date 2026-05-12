/**
 * Auth Routes (ESM)
 *
 * FIXES / ADDITIONS from v2:
 *  - Login response now includes properties[] and active_property
 *  - JWT payload includes active_property_id + accessible_property_ids
 *  - POST /auth/switch-property — validate access then issue new JWT
 *  - GET  /auth/me — returns full property list for session restore
 *  - Tenant + subscription check before issuing token
 */

import express       from 'express';
import bcrypt        from 'bcryptjs';
import jwt           from 'jsonwebtoken';
import db            from '../db.js';
import auth          from '../middleware/auth.js';
import config        from '../config/index.js';

const router = express.Router();

// ── helpers ───────────────────────────────────────────────────────
async function getAccessibleProperties(userId, role) {
  if (role === 'super_admin') {
    return db('properties')
      .where('status', 'active')
      .select('id','name','slug','code','city','logo_url','primary_color','currency_symbol','star_rating','total_rooms')
      .orderBy('name');
  }
  return db('properties as p')
    .join('user_properties as up', 'p.id', 'up.property_id')
    .where('up.user_id', userId)
    .where('p.status', 'active')
    .select('p.id','p.name','p.slug','p.code','p.city','p.logo_url',
      'p.primary_color','p.currency_symbol','p.star_rating','p.total_rooms',
      'up.is_default','up.role_override')
    .orderBy('up.is_default', 'desc')
    .orderBy('p.name');
}

function buildToken(user, activePropertyId, properties) {
  const payload = {
    id:                      user.id,
    email:                   user.email,
    role:                    user.role,
    name:                    user.name,
    tenant_id:               user.tenant_id || null,
    active_property_id:      activePropertyId || null,
    default_property_id:     user.default_property_id || activePropertyId || null,
    accessible_property_ids: properties.map(p => p.id),
  };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

// ── POST /api/auth/login ──────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.status === 'disabled')
      return res.status(403).json({ error: 'Account is disabled. Contact your administrator.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Tenant check for hotel users
    if (user.tenant_id) {
      const tenant = await db('tenants').where({ id: user.tenant_id })
        .select('status', 'subscription_active').first();
      if (tenant?.status !== 'active')
        return res.status(403).json({ error: `Hotel account is ${tenant?.status}. Contact support.` });
      if (!tenant?.subscription_active)
        return res.status(403).json({ error: 'Subscription expired. Please renew.' });
    }

    const properties       = await getAccessibleProperties(user.id, user.role);
    const defaultProp      = properties.find(p => p.is_default) || properties[0] || null;
    const activePropertyId = user.default_property_id || defaultProp?.id || null;
    const activeProp       = properties.find(p => p.id === activePropertyId) || defaultProp;

    const token = buildToken(user, activePropertyId, properties);

    await db('users').where({ id: user.id }).update({ last_login_at: new Date() });

    res.json({
      token,
      user: {
        id:                  user.id,
        name:                user.name,
        email:               user.email,
        role:                user.role,
        tenant_id:           user.tenant_id || null,
        active_property_id:  activePropertyId,
      },
      properties,
      active_property: activeProp || null,
    });
  } catch (e) {
    console.error('[login]', e.message);
    res.status(500).json({ error: 'Login failed', detail: e.message });
  }
});

// ── POST /api/auth/switch-property ────────────────────────────────
// Security: validates user has access before issuing new token
router.post('/switch-property', auth, async (req, res) => {
  const { property_id } = req.body;
  if (!property_id) return res.status(400).json({ error: 'property_id required' });

  try {
    // super_admin can switch to any property
    if (req.user.role !== 'super_admin') {
      const access = await db('user_properties')
        .where({ user_id: req.user.id, property_id }).first();
      if (!access)
        return res.status(403).json({ error: 'You do not have access to this property.' });
    }

    const property = await db('properties')
      .where({ id: property_id, status: 'active' })
      .select('id','name','slug','code','city','logo_url','primary_color','currency_symbol')
      .first();
    if (!property) return res.status(404).json({ error: 'Property not found or inactive.' });

    const user       = await db('users').where({ id: req.user.id }).first();
    const properties = await getAccessibleProperties(user.id, user.role);
    const token      = buildToken(user, property_id, properties);

    res.json({ token, active_property: property });
  } catch (e) {
    console.error('[switch-property]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const user = await db('users as u')
      .leftJoin('tenants as t', 'u.tenant_id', 't.id')
      .select('u.id','u.name','u.email','u.role','u.status','u.tenant_id',
        'u.last_login_at','u.default_property_id',
        't.name as tenant_name','t.status as tenant_status','t.logo_url','t.primary_color')
      .where('u.id', req.user.id).first();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const properties       = await getAccessibleProperties(user.id, user.role);
    const activePropertyId = req.user.active_property_id || properties[0]?.id || null;
    const activeProp       = properties.find(p => p.id === activePropertyId) || null;

    res.json({
      ...user,
      active_property_id: activePropertyId,
      active_property:    activeProp,
      properties,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth/change-password ───────────────────────────────
router.post('/change-password', auth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Both passwords required' });
  if (new_password.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  try {
    const user  = await db('users').where({ id: req.user.id }).first();
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await db('users').where({ id: req.user.id }).update({ password_hash: hash, updated_at: new Date() });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
