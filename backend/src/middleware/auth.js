/**
 * JWT Authentication middleware (ESM)
 *
 * Verifies the Bearer token and attaches req.user.
 * req.user contains: { id, email, role, name, tenant_id,
 *                      active_property_id, accessible_property_ids }
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export default function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error:  'Authentication required',
      code:   'NO_TOKEN',
      detail: 'Send Authorization: Bearer <token> header',
    });
  }

  const token = authHeader.slice(7); // remove "Bearer "

  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error:  isExpired ? 'Session expired, please log in again' : 'Invalid token',
      code:   isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }
}
