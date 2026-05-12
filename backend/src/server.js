/**
 * Hotel PMS API — server.js (ESM)
 *
 * FIXES from v2:
 *  - CORS: origin whitelist from env (not `origin: true`)
 *  - CORS: allowedHeaders includes X-Property-ID for multi-property
 *  - /api/properties route added
 *  - /ready endpoint properly waits for DB
 *  - Graceful shutdown on SIGTERM/SIGINT
 */

import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import morgan  from 'morgan';

import config from './config/index.js';
import db     from './db.js';
import { startSubscriptionJob } from './services/subscriptionJob.js';

// Routes
import authRoutes         from './routes/auth.js';
import propertiesRoutes   from './routes/properties.js';
import roomRoutes         from './routes/rooms.js';
import reservationRoutes  from './routes/reservations.js';
import checkinRoutes      from './routes/checkin.js';
import invoiceRoutes      from './routes/invoices.js';
import rateRoutes         from './routes/rates.js';
import channelRoutes      from './routes/channels.js';
import housekeepingRoutes from './routes/housekeeping.js';
import dashboardRoutes    from './routes/dashboard.js';
import calendarRoutes     from './routes/calendar.js';
import hotelAdminRoutes   from './routes/hotelAdmin.js';
import superAdminRoutes   from './routes/superAdmin.js';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────
// FIX: was `origin: true` (allow all) — now uses whitelist from env
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (config.server.allowedOrigins.includes(origin)) return callback(null, true);
    // In development be more permissive
    if (config.isDev) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  // FIX: X-Property-ID must be explicitly allowed for multi-property to work
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Property-ID'],
  exposedHeaders: ['X-Property-ID'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.isProd ? 'combined' : 'dev'));

// ── Health / Readiness ───────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  status: 'ok', env: config.env, time: new Date(),
  version: process.env.npm_package_version || '3.0.0',
}));

app.get('/ready', async (_, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ready', db: 'connected' });
  } catch (e) {
    res.status(503).json({ status: 'not ready', db: e.message });
  }
});

// ── Public routes (no auth) ───────────────────────────────────────
app.use('/api/auth',       authRoutes);

// ── Property management ───────────────────────────────────────────
app.use('/api/properties', propertiesRoutes);

// ── Hotel-scoped routes (require auth + propertyScope) ────────────
app.use('/api/rooms',        roomRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/checkin',      checkinRoutes);
app.use('/api/invoices',     invoiceRoutes);
app.use('/api/rates',        rateRoutes);
app.use('/api/channels',     channelRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/calendar',     calendarRoutes);

// ── Hotel admin ───────────────────────────────────────────────────
app.use('/api/admin',        hotelAdminRoutes);

// ── Super admin (platform level) ─────────────────────────────────
app.use('/api/super-admin',  superAdminRoutes);

// ── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ─────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Don't log CORS errors verbosely
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('[Error]', err.stack || err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start server ─────────────────────────────────────────────────
const server = app.listen(config.server.port, () => {
  console.log(`\n🏨  Hotel PMS API — ${config.env.toUpperCase()}`);
  console.log(`    Port     : ${config.server.port}`);
  console.log(`    Frontend : ${config.server.frontendUrl}`);
  console.log(`    Origins  : ${config.server.allowedOrigins.join(', ')}`);
  console.log(`    DB       : ${config.db.url ? 'DATABASE_URL' : `${config.db.host}:${config.db.port}/${config.db.name}`}`);
  console.log(`    GST Rate : ${config.gst.roomRate}%\n`);
  startSubscriptionJob();
});

// ── Graceful shutdown ─────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await db.destroy();
    console.log('[Server] Connections closed. Exiting.');
    process.exit(0);
  });
  // Force exit if cleanup takes too long
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
