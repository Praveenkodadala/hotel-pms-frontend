# Hotel PMS v3 — Change Log

## Critical Bug Fixes

### Backend

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `src/config/index.js` | `cfg.hotel.*` undefined — caused `invoiceService.generateHtml` to silently produce blank hotel name/address in every invoice | Added `hotel: { name, address, phone, email, gstin, logoUrl }` to config |
| 2 | `src/db.js` | `import config from './knexfile.cjs'` — partially-valid ESM importing CJS; breaks named exports and causes subtle runtime bugs | Replaced with `createRequire` from Node `module` package |
| 3 | `knexfile.cjs` | Was in `src/` — caused migration path resolution to look in `src/migrations` but file was at root `migrations/` | Moved to backend root; all paths now resolve correctly |
| 4 | `src/server.js` | `cors({ origin: true })` — allows ALL origins including malicious ones in production | Replaced with allowlist from `ALLOWED_ORIGINS` env var |
| 5 | `src/server.js` | Missing `X-Property-ID` in `allowedHeaders` — browser blocks the property header, property switching silently fails | Added `'X-Property-ID'` to `allowedHeaders` and `exposedHeaders` |
| 6 | `migrations/004_tenant_scope_channels.cjs` | `.after('id')` calls — silently ignored in PostgreSQL (it's a MySQL-only feature) | Removed all `.after()` calls |
| 7 | `src/routes/invoices.js` | Used `tenantScope` without `tenantOnly` — super admin could accidentally hit hotel invoice routes | Added `tenantOnly` middleware, or replaced with `propertyScope` |
| 8 | `src/routes/rates.js` | Comment said "rates are global" — no tenant/property filter applied despite `tenant_id` column existing | Now fully scoped to `property_id` via `scopeQuery` |
| 9 | `seeds/001_initial_data.cjs` | Seed had no `property_id` values — all seeded data would fail property scope checks after migration 005 | Updated to create properties and seed all data with `property_id` |

### Frontend

| # | File | Bug | Fix |
|---|------|-----|-----|
| 10 | `src/services/api.js` | Never sent `X-Property-ID` header — backend propertyScope always got no property, returned 400 | Added request interceptor that reads `localStorage.pms_active_property_id` |
| 11 | `vite.config.js` | Proxy hardcoded to `http://backend:4000` (Docker hostname) — local dev without Docker got connection refused | `VITE_API_TARGET` env var, defaults to `http://localhost:4000` |
| 12 | `src/context/AuthContext.jsx` | Login didn't store properties or active property — dropdown had nothing to show | Login now stores `properties[]`, `active_property`, and `active_property_id` in localStorage |

---

## New Features Added

### Backend

- **`src/middleware/rbac.js`** — Added `propertyScope` middleware: validates `X-Property-ID` header, checks `user_properties` junction table, sets `req.propertyId`
- **`src/middleware/rbac.js`** — Added `scopeQuery(query, req)` helper: applies `WHERE property_id = req.propertyId` to any knex query
- **`src/routes/properties.js`** — New router: full property CRUD, user assignment, enable/disable (super admin)
- **`src/routes/auth.js`** — `POST /auth/switch-property`: validates access, issues new JWT with updated `active_property_id`
- **`src/routes/auth.js`** — Login response includes `properties[]` and `active_property`
- **`migrations/005_multi_property.cjs`** — Creates `properties` table, `user_properties` junction table, adds `property_id` column to 8 tables with indexes
- **`seeds/001_initial_data.cjs`** — Creates 3 properties (GP01 Mysuru, GP02 Bengaluru, SI01 Sunrise Inn) with user-property assignments

### Frontend

- **`src/context/AuthContext.jsx`** — `switchProperty(id)` function: calls API, updates token and headers, fires `property-switched` event
- **`src/components/PropertySwitcher.jsx`** — Navbar dropdown: shows current property, lists all accessible ones, switches on click
- **`src/components/Layout.jsx`** — `PropertySwitcher` placed below brand name in sidebar
- **`src/hooks/usePropertyData.js`** — Hook that auto-refetches data when `property-switched` event fires
- **`src/services/api.js`** — Global `X-Property-ID` header injection on every request

### Environment Management

- `backend/.env.development` — local dev defaults
- `backend/.env.staging` — staging template
- `backend/.env.production` — production template
- `backend/.env.example` — documented template for all vars
- `frontend/.env.development` — `VITE_API_URL=/api`, `VITE_API_TARGET=http://localhost:4000`
- `frontend/.env.docker` — `VITE_API_TARGET=http://backend:4000`
- `frontend/.env.production` — `VITE_API_URL=https://api.your-domain.com/api`

---

## Architecture: Multi-Property Security Flow

```
Login
  → backend resolves properties[] user can access
  → JWT payload: { id, role, tenant_id, active_property_id, accessible_property_ids[] }
  → frontend stores token + active_property_id in localStorage

Every API call
  → api.js interceptor: reads localStorage → sets X-Property-ID header
  → propertyScope middleware:
      1. Reads X-Property-ID
      2. Queries user_properties: user_id + property_id must match
      3. Verifies property status = active
      4. Sets req.propertyId, req.property, req.tenantId
  → Route handler: scopeQuery(q, req) → WHERE property_id = req.propertyId
  → All inserts: property_id: req.propertyId

Property switch
  → POST /auth/switch-property { property_id }
  → Backend validates access → returns new JWT
  → Frontend stores new token + X-Property-ID
  → window.dispatchEvent('property-switched')
  → Pages using usePropertyData() re-fetch automatically
```

---

## Demo Logins

| Role | Email | Password | Properties |
|------|-------|----------|-----------|
| Super Admin | superadmin@hotelpms.io | SuperAdmin@999 | All (unrestricted) |
| Hotel Admin | admin@hotel.com | Admin@1234 | GP01 (default) + GP02 |
| Manager | manager@hotel.com | Staff@1234 | GP01 only |
| Receptionist | frontdesk@hotel.com | Staff@1234 | GP01 only |
| Housekeeping | housekeeping@hotel.com | Staff@1234 | GP01 only |

Hotel Admin can switch between GP01 (Mysuru) and GP02 (Bengaluru) from the dropdown.
