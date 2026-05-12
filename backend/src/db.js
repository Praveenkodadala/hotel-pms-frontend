/**
 * Database instance (ESM)
 *
 * FIX from v2: db.js was importing knexfile.cjs using
 *   import config from './knexfile.cjs'
 * which partially works but is not spec-compliant and can cause
 * issues with named exports from CJS. We now use createRequire
 * to properly require the CJS knexfile.
 */

import knex from 'knex';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config/index.js';

const require   = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// knexfile.cjs is at the backend root (one level up from src/)
const knexConfig = require(join(__dirname, '../knexfile.cjs'));

const env = config.env;
const db  = knex(knexConfig[env] || knexConfig.development);

// Verify connection on startup
db.raw('SELECT 1')
  .then(() => {
    const { host, port, name } = config.db;
    console.log(`[DB] Connected ✓  ${host}:${port}/${name}  (env: ${env})`);
  })
  .catch((e) => {
    console.error('[DB] Connection failed:', e.message);
    // Don't exit — let the health check reflect the failure
  });

export default db;
