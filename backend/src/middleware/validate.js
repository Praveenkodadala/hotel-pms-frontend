/**
 * Validation helper (ESM)
 * Lightweight field validation without extra dependencies.
 */

export function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => {
      const val = req.body[f];
      return val === undefined || val === null || val === '';
    });
    if (missing.length) {
      return res.status(400).json({
        error:   `Missing required fields: ${missing.join(', ')}`,
        missing,
      });
    }
    next();
  };
}

export function sanitize(obj, allowedKeys) {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => allowedKeys.includes(k))
  );
}
