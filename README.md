# Hotel PMS v3 — Multi-Property Edition

Full-stack Hotel Property Management System with multi-property architecture,
RBAC, housekeeping, invoicing, channel manager, and calendar view.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js 18 + Express + ES Modules |
| Database | PostgreSQL 15 |
| ORM | Knex.js |
| Auth | JWT + bcrypt |
| Containers | Docker + Docker Compose |

---

## Quick Start (Docker)

```bash
# 1. Clone / unzip
cd hotel-pms-v3

# 2. Create backend env file (edit JWT_SECRET for security)
cp backend/.env.example backend/.env
# Edit: set a real JWT_SECRET (at least 32 chars)

# 3. Start everything
docker compose up --build

# Wait ~90 seconds on first run (builds images, runs 5 migrations, seeds demo data)
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000 |
| API Health | http://localhost:4000/health |
| pgAdmin | http://localhost:5050 |

---

## Local Development (without Docker)

### Prerequisites
- Node.js 18+
- PostgreSQL 15 running locally

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set DB_HOST=localhost, DB_PASSWORD, JWT_SECRET

npm run migrate   # run all 5 migrations
npm run seed      # insert demo data
npm run dev       # starts at http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
# .env.development already has: VITE_API_URL=/api, VITE_API_TARGET=http://localhost:4000
npm run dev       # starts at http://localhost:3000
```

---

## Demo Logins

| Role | Email | Password | Property Access |
|------|-------|----------|----------------|
| Super Admin | superadmin@hotelpms.io | SuperAdmin@999 | All properties |
| Hotel Admin | admin@hotel.com | Admin@1234 | GP01 + GP02 (switch between them) |
| Manager | manager@hotel.com | Staff@1234 | GP01 only |
| Receptionist | frontdesk@hotel.com | Staff@1234 | GP01 only |
| Housekeeping | housekeeping@hotel.com | Staff@1234 | GP01 only |

**Hotel Admin**: log in and use the property dropdown in the sidebar to switch between
Grand Palace Mysuru (GP01) and Grand Palace Bengaluru (GP02).

---

## Multi-Property Architecture

### How it works

1. **Login** → backend resolves all properties the user has access to → included in JWT
2. **Every API call** → frontend sends `X-Property-ID` header automatically → backend validates
3. **Property switch** → `POST /auth/switch-property` → new JWT issued → all data reloads

### Security

- `propertyScope` middleware verifies the user has a row in `user_properties` for the requested property
- `scopeQuery(q, req)` applies `WHERE property_id = ?` to every database query
- Cross-property access is blocked at the middleware level — impossible even with a valid token
- Super admin bypasses property checks (can access all data)

### Database

```
properties          ← hotel property registry
user_properties     ← user ↔ property many-to-many (with optional role_override)

rooms               ← property_id column + index
reservations        ← property_id column + index
invoices            ← property_id column + index
housekeeping_tasks  ← property_id column + index
channels            ← property_id column + index
rates               ← property_id column + index
inventory_closures  ← property_id column + index
```

---

## Scripts

### Backend
```bash
npm run dev             # development with nodemon
npm start               # production
npm run migrate         # run pending migrations
npm run migrate:rollback # rollback last migration batch
npm run seed            # reseed demo data
npm run db:reset        # rollback + migrate + seed
npm run db:fresh        # rollback all + migrate + seed
```

### Frontend
```bash
npm run dev             # development server (port 3000)
npm run build           # production build → dist/
npm run preview         # preview production build locally
```

---

## Environment Files

### Backend
| File | Purpose |
|------|---------|
| `.env` | Active env (gitignored, copy from .env.example) |
| `.env.example` | Template with all variables documented |
| `.env.development` | Dev defaults |
| `.env.staging` | Staging template |
| `.env.production` | Production template |

### Frontend
| File | Purpose |
|------|---------|
| `.env.development` | Local dev (`VITE_API_TARGET=http://localhost:4000`) |
| `.env.docker` | Docker Compose (`VITE_API_TARGET=http://backend:4000`) |
| `.env.production` | Production (`VITE_API_URL=https://api.domain.com/api`) |

---

## API Reference

Base URL: `http://localhost:4000/api`

All routes (except `/auth/login`) require: `Authorization: Bearer <token>`
All hotel-scoped routes require: `X-Property-ID: <uuid>` (sent automatically by frontend)

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login — returns token + properties[] |
| POST | `/auth/switch-property` | Switch active property — returns new token |
| GET | `/auth/me` | Current user + properties |
| POST | `/auth/change-password` | Change own password |

### Properties
| Method | Endpoint | Min Role | Description |
|--------|----------|----------|-------------|
| GET | `/properties/mine` | any | My accessible properties |
| GET | `/properties/:id` | member | Property detail |
| POST | `/properties` | super_admin | Create property |
| PUT | `/properties/:id` | hotel_admin | Update property |
| PATCH | `/properties/:id/status` | super_admin | Enable / disable |
| GET | `/properties/:id/users` | manager | List assigned users |
| POST | `/properties/:id/users` | hotel_admin | Assign user to property |
| DELETE | `/properties/:id/users/:uid` | hotel_admin | Remove user |
| PATCH | `/properties/:id/users/:uid` | hotel_admin | Update role override |

### Rooms, Reservations, Check-in, Invoices, Housekeeping, Rates, Channels, Dashboard, Calendar
All follow the same property-scoped pattern. See `CHANGES.md` for full endpoint list.

---

## Deployment

### Render (backend) + Vercel (frontend) — free tier

**Backend on Render:**
1. Connect your GitHub repo
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `npm run migrate && npm run seed && npm start`
5. Set all env vars from `.env.production`

**Frontend on Vercel:**
1. Connect repo, root: `frontend`
2. Build: `npm run build`, Output: `dist`
3. Set `VITE_API_URL=https://your-render-api.onrender.com/api`

### AWS (production)

```
CloudFront → S3            (React build)
ALB → EC2 (Docker)         (Node.js API)
RDS PostgreSQL             (Database)
```

```bash
# Build frontend
cd frontend
VITE_API_URL=https://api.your-domain.com/api npm run build
aws s3 sync dist/ s3://your-bucket --delete

# Deploy backend on EC2
git pull && docker compose up -d backend postgres
docker compose exec backend npm run migrate
```

---

## File Structure

```
hotel-pms-v3/
├── docker-compose.yml
├── CHANGES.md
├── README.md
│
├── backend/
│   ├── knexfile.cjs              ← Root-level CJS (required by knex CLI)
│   ├── Dockerfile
│   ├── package.json              ← "type":"module" (ESM)
│   ├── .env.example
│   ├── migrations/
│   │   ├── 001_initial_schema.cjs
│   │   ├── 002_rbac_tenants.cjs
│   │   ├── 003_invoice_fixes.cjs
│   │   ├── 004_tenant_scope_channels.cjs
│   │   └── 005_multi_property.cjs  ← NEW
│   ├── seeds/
│   │   └── 001_initial_data.cjs    ← Updated with properties
│   └── src/
│       ├── config/index.js         ← Fixed: added hotel.* properties
│       ├── db.js                   ← Fixed: createRequire for CJS knexfile
│       ├── server.js               ← Fixed: CORS whitelist + X-Property-ID
│       ├── middleware/
│       │   ├── auth.js
│       │   ├── rbac.js             ← Added: propertyScope, scopeQuery
│       │   └── validate.js         ← New
│       ├── routes/
│       │   ├── auth.js             ← Updated: properties in JWT
│       │   ├── properties.js       ← New
│       │   ├── rooms.js            ← Updated: propertyScope
│       │   ├── reservations.js     ← Updated: propertyScope
│       │   ├── checkin.js          ← Updated: propertyScope
│       │   ├── invoices.js         ← Updated: propertyScope
│       │   ├── housekeeping.js     ← Updated: propertyScope
│       │   ├── rates.js            ← Updated: propertyScope (was global)
│       │   ├── channels.js         ← Updated: propertyScope
│       │   ├── dashboard.js        ← Updated: propertyScope
│       │   ├── calendar.js         ← Updated: propertyScope
│       │   ├── hotelAdmin.js
│       │   └── superAdmin.js
│       └── services/
│           ├── invoiceService.js   ← Fixed: property_id, cfg.hotel.*
│           └── subscriptionJob.js
│
└── frontend/
    ├── vite.config.js              ← Fixed: VITE_API_TARGET env var
    ├── Dockerfile
    ├── package.json
    ├── .env.development
    ├── .env.docker
    ├── .env.production
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── services/
        │   └── api.js              ← Fixed: X-Property-ID header interceptor
        ├── context/
        │   └── AuthContext.jsx     ← Updated: switchProperty(), properties state
        ├── components/
        │   ├── Layout.jsx          ← Updated: PropertySwitcher added
        │   └── PropertySwitcher.jsx ← New
        ├── hooks/
        │   └── usePropertyData.js  ← New: auto-refetch on property switch
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardPage.jsx
            ├── RoomsPage.jsx
            ├── ReservationsPage.jsx
            ├── CheckInOutPage.jsx
            ├── HousekeepingPage.jsx
            ├── InvoicesPage.jsx
            ├── RatesPage.jsx
            ├── ChannelsPage.jsx
            ├── HotelAdminPage.jsx
            ├── CalendarPage.jsx
            └── superadmin/
                └── SuperAdminPage.jsx
```

=======

docker compose down -v
docker compose build --no-cache
docker compose up