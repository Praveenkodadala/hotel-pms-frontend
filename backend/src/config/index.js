/**
 * Central configuration module (ESM)
 *
 * FIXES FROM v2:
 *  - Added hotel.* properties (were missing, caused invoiceService to crash)
 *  - Added environment validation on startup
 *  - Full multi-environment support (development | staging | production)
 *  - All env vars documented with sensible defaults
 */

const env    = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isStage = env === 'staging';

// Validate critical secrets in non-dev environments
if (isProd || isStage) {
  const required = ['JWT_SECRET', 'DATABASE_URL'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`[Config] FATAL: Missing required env vars in ${env}: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('[Config] FATAL: JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
}

const config = {
  env,
  isProd,
  isStage,
  isDev: env === 'development',

  server: {
    port:        parseInt(process.env.PORT || '4000'),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    // Comma-separated list for multiple allowed origins
    allowedOrigins: (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',').map(s => s.trim()),
  },

  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    name:     process.env.DB_NAME     || 'hotel_pms',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
    url:      process.env.DATABASE_URL || null,
    ssl:      isProd || isStage,
    debug:    process.env.DB_DEBUG === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || (isProd ? '2' : '1')),
      max: parseInt(process.env.DB_POOL_MAX || (isProd ? '20' : '5')),
    },
  },

  jwt: {
    secret:    process.env.JWT_SECRET    || 'dev_secret_DO_NOT_USE_IN_PROD_min32chars_xxxx',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  // Hotel branding — used in invoice generation as fallback when no tenant record
  // FIX: was missing in v2, caused invoiceService.generateHtml to silently output empty values
  hotel: {
    name:     process.env.HOTEL_NAME     || 'Hotel PMS',
    address:  process.env.HOTEL_ADDRESS  || '',
    phone:    process.env.HOTEL_PHONE    || '',
    email:    process.env.HOTEL_EMAIL    || '',
    gstin:    process.env.HOTEL_GSTIN    || '',
    logoUrl:  process.env.HOTEL_LOGO_URL || '',
  },

  gst: {
    roomRate: parseInt(process.env.GST_ROOM_RATE || '12'),
  },

  // Email (optional — for booking confirmations)
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@hotel.com',
  },

  // Storage driver — 'local' or 's3'
  storage: {
    driver:    process.env.STORAGE_DRIVER    || 'local',
    s3Bucket:  process.env.S3_BUCKET         || '',
    s3Region:  process.env.S3_REGION         || 'ap-south-1',
    awsKey:    process.env.AWS_ACCESS_KEY_ID || '',
    awsSecret: process.env.AWS_SECRET_ACCESS_KEY || '',
  },

  // Payment stub — expand later
  payment: {
    provider:         process.env.PAYMENT_PROVIDER      || 'none',
    razorpayKeyId:    process.env.RAZORPAY_KEY_ID       || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET  || '',
  },
};

export default config;
