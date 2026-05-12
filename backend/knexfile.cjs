/**
 * knexfile.cjs — Root level, CommonJS (required by knex CLI)
 *
 * KEY FIX: Moved from src/ to root so the --knexfile flag works
 * without path gymnastics, and migrations/seeds directories are
 * resolved relative to this file correctly.
 *
 * WHY .cjs: package.json has "type":"module" which makes all .js
 * files ESM. Knex CLI uses require() internally so the knexfile
 * MUST be .cjs to avoid "require is not defined" errors.
 */

require('dotenv').config();
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

const connection = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isProd ? { rejectUnauthorized: false } : false,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'hotel_pms',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
    };

const base = {
  client: 'pg',
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    loadExtensions: ['.cjs'],
  },
  seeds: {
    directory: path.join(__dirname, 'seeds'),
    loadExtensions: ['.cjs'],
  },
};

module.exports = {
  development: {
    ...base,
    connection,
    pool: { min: 1, max: 5 },
    debug: process.env.DB_DEBUG === 'true',
  },

  staging: {
    ...base,
    connection,
    pool: { min: 2, max: 10 },
  },

  production: {
    ...base,
    connection,
    pool: {
      min:  parseInt(process.env.DB_POOL_MIN || '2'),
      max:  parseInt(process.env.DB_POOL_MAX || '20'),
    },
    acquireConnectionTimeout: 10000,
  },
};
