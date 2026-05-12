/**
 * RBAC + Property Scope Middleware (ESM)
 *
 * Role hierarchy:
 *   super_admin(100) > hotel_admin(80) > manager(60) > receptionist(40) > housekeeping(20)
 *
 * Multi-property security:
 *   Every hotel user request goes through propertyScope which:
 *   1. Reads X-Property-ID header (set by frontend api.js on every call)
 *   2. Verifies user has access in user_properties junction table
 *   3. Verifies the property is active
 *   4. Sets req.propertyId and req.property for route handlers
 *
 * Route handlers use scopeQuery(q, req) to apply WHERE property_id = ?
 * They NEVER do manual WHERE property_id checks — always use scopeQuery.
 */

import db from '../db.js';

const ROLE_WEIGHTS = {
  super_admin: 100,
  hotel_admin:  80,
  manager:      60,
  receptionist: 40,
  housekeeping: 20,
};

// ── Exact role match ──────────────────────────────────────────────
export const roles = (...allowed) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
  if (allowed.includes(req.user.role)) return next();
  return res.status(403).json({
    error:    `Access denied. Required: ${allowed.join(' or ')}`,
    your_role: req.user.role,
  });
};

// ── Minimum role weight ───────────────────────────────────────────
export const atLeast = (minRole) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
  const userW = ROLE_WEIGHTS[req.user.role] || 0;
  const minW  = ROLE_WEIGHTS[minRole]       || 0;
  if (userW >= minW) return next();
  return res.status(403).json({
    error:       `Minimum role required: ${minRole}`,
    your_role:   req.user.role,
  });
};

// ── Block super_admin from hotel-scoped routes ────────────────────
export const tenantOnly = (req, res, next) => {
  if (req.user?.role === 'super_admin') {
    return res.status(403).json({
      error: 'Super admin must use /api/super-admin/* routes',
      code:  'USE_SUPER_ADMIN_ROUTES',
    });
  }
  next();
};

// ── Tenant scope (legacy — for backward compat with non-property routes) ──
export const tenantScope = async (req, res, next) => {
  try {
    if (req.user?.role === 'super_admin') {
      req.tenantId = req.params.tenantId || req.query.tenant_id || null;
      return next();
    }

    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'No tenant associated with user' });

    if (!req._tenantChecked) {
      const tenant = await db('tenants')
        .where({ id: tenantId })
        .select('status', 'subscription_active')
        .first();
      if (!tenant)                    return res.status(403).json({ error: 'Tenant not found' });
      if (tenant.status !== 'active') return res.status(403).json({ error: 'Hotel account is disabled. Contact support.' });
      if (!tenant.subscription_active) return res.status(403).json({ error: 'Subscription expired. Please renew.' });
      req._tenantChecked = true;
    }

    req.tenantId = tenantId;
    next();
  } catch (e) {
    console.error('[tenantScope]', e.message);
    res.status(500).json({ error: 'Tenant validation failed' });
  }
};

// ── Property scope — multi-property security layer ────────────────
export const propertyScope = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });

    // super_admin can access any property without an entry in user_properties
    if (req.user.role === 'super_admin') {
      const pid = req.headers['x-property-id'] || req.query.property_id || req.user.active_property_id || null;
      req.propertyId   = pid;
      req.isSuperAdmin = true;
      return next();
    }

    const requestedPropertyId =
      req.headers['x-property-id'] ||
      req.query.property_id         ||
      req.user.active_property_id   ||
      req.user.default_property_id  ||
      null;

    if (!requestedPropertyId) {
      return res.status(400).json({
        error: 'No property selected. Send X-Property-ID header.',
        code:  'NO_PROPERTY_SELECTED',
      });
    }

    // Verify user has access to this specific property
    const access = await db('user_properties')
      .where({ user_id: req.user.id, property_id: requestedPropertyId })
      .first();

    if (!access) {
      // Security: log attempted cross-property access
      console.warn(
        `[SECURITY] Cross-property attempt: user=${req.user.id} ` +
        `(${req.user.email}) property=${requestedPropertyId} ip=${req.ip}`
      );
      return res.status(403).json({
        error: 'Access denied to this property.',
        code:  'PROPERTY_ACCESS_DENIED',
      });
    }

    // Verify property is active
    const property = await db('properties')
      .where({ id: requestedPropertyId })
      .select('id', 'name', 'status', 'slug', 'currency_symbol', 'timezone', 'tenant_id')
      .first();

    if (!property) return res.status(404).json({ error: 'Property not found', code: 'PROPERTY_NOT_FOUND' });
    if (property.status !== 'active') {
      return res.status(403).json({
        error: `Property "${property.name}" is ${property.status}.`,
        code:  'PROPERTY_INACTIVE',
      });
    }

    req.propertyId   = requestedPropertyId;
    req.propertyRole = access.role_override || req.user.role;
    req.property     = property;
    // Also set tenantId for backward compat with old tenant-scoped routes
    req.tenantId     = property.tenant_id || req.user.tenant_id || null;
    next();
  } catch (e) {
    console.error('[propertyScope]', e.message);
    res.status(500).json({ error: 'Property access check failed' });
  }
};

// ── Super admin only ──────────────────────────────────────────────
export const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access only' });
  }
  next();
};

/**
 * scopeQuery — apply WHERE property_id = req.propertyId to any knex query.
 *
 * ALWAYS use this helper instead of manually adding .where('property_id', ...).
 * This makes it easy to audit all property-scoped queries.
 *
 * Usage:
 *   let q = db('rooms').select('*');
 *   q = scopeQuery(q, req);
 *   return res.json(await q);
 */
export function scopeQuery(query, req, column = 'property_id') {
  if (req.propertyId) return query.where(column, req.propertyId);
  return query; // super_admin without a specific property = unscoped
}
