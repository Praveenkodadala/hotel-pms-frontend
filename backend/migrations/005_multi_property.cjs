/**
 * Migration 005: Multi-property architecture (CJS for knex CLI)
 *
 * Creates:
 *   properties        — hotel property registry
 *   user_properties   — many-to-many: users ↔ properties
 *
 * Adds property_id to:
 *   rooms, reservations, invoices, housekeeping_tasks,
 *   inventory_closures, channels, rates, channel_sync_log
 *
 * Adds default_property_id to users.
 *
 * SECURITY: property_id is indexed on every table for fast WHERE scoping.
 */

exports.up = async function (knex) {

  // ── 1. Properties table ──────────────────────────────────────────
  await knex.schema.createTable('properties', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.string('slug').unique().notNullable();
    t.string('code', 10).unique().notNullable();
    t.string('email');
    t.string('phone');
    t.string('website');
    t.text('address');
    t.string('city');
    t.string('state');
    t.string('country').defaultTo('India');
    t.string('pincode');
    t.string('gstin');
    t.string('pan');
    t.string('logo_url');
    t.string('primary_color').defaultTo('#185FA5');
    t.integer('total_rooms').defaultTo(0);
    t.string('star_rating', 5);
    t.string('timezone').defaultTo('Asia/Kolkata');
    t.string('currency').defaultTo('INR');
    t.string('currency_symbol').defaultTo('₹');
    t.uuid('tenant_id').references('id').inTable('tenants').nullable();
    t.string('status', 20).defaultTo('active');
    t.text('disable_reason');
    t.jsonb('settings').defaultTo('{}');
    t.timestamps(true, true);
  });

  // ── 2. User ↔ Property junction ──────────────────────────────────
  await knex.schema.createTable('user_properties', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('property_id').notNullable().references('id').inTable('properties').onDelete('CASCADE');
    t.string('role_override', 30).nullable();
    t.boolean('is_default').defaultTo(false);
    t.unique(['user_id', 'property_id']);
    t.timestamps(true, true);
  });
  await knex.raw('CREATE INDEX idx_user_properties_user_id     ON user_properties(user_id)');
  await knex.raw('CREATE INDEX idx_user_properties_property_id ON user_properties(property_id)');

  // ── 3. Add property_id to major tables ──────────────────────────
  const tables = [
    'rooms', 'reservations', 'invoices', 'housekeeping_tasks',
    'inventory_closures', 'channels', 'rates',
  ];

  for (const tableName of tables) {
    const exists = await knex.schema.hasTable(tableName);
    if (!exists) continue;
    const hasCol = await knex.schema.hasColumn(tableName, 'property_id');
    if (hasCol) continue;

    await knex.schema.alterTable(tableName, (t) => {
      t.uuid('property_id').references('id').inTable('properties').nullable();
    });
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${tableName}_property_id ON ${tableName}(property_id)`);
  }

  // channel_sync_log
  const hasSyncLog = await knex.schema.hasTable('channel_sync_log');
  if (hasSyncLog) {
    const hasCol = await knex.schema.hasColumn('channel_sync_log', 'property_id');
    if (!hasCol) {
      await knex.schema.alterTable('channel_sync_log', (t) => {
        t.uuid('property_id').references('id').inTable('properties').nullable();
      });
      await knex.raw('CREATE INDEX IF NOT EXISTS idx_channel_sync_log_property_id ON channel_sync_log(property_id)');
    }
  }

  // ── 4. default_property_id on users ──────────────────────────────
  const hasDefaultProp = await knex.schema.hasColumn('users', 'default_property_id');
  if (!hasDefaultProp) {
    await knex.schema.alterTable('users', (t) => {
      t.uuid('default_property_id').references('id').inTable('properties').nullable();
    });
  }
};

exports.down = async function (knex) {
  const tables = ['rooms','reservations','invoices','housekeeping_tasks',
    'inventory_closures','channels','rates','channel_sync_log'];

  for (const tableName of tables) {
    const exists = await knex.schema.hasTable(tableName);
    if (!exists) continue;
    const hasCol = await knex.schema.hasColumn(tableName, 'property_id');
    if (!hasCol) continue;
    await knex.raw(`DROP INDEX IF EXISTS idx_${tableName}_property_id`);
    await knex.schema.alterTable(tableName, (t) => t.dropColumn('property_id'));
  }

  const hasDefaultProp = await knex.schema.hasColumn('users', 'default_property_id');
  if (hasDefaultProp) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('default_property_id'));
  }
  await knex.raw('DROP INDEX IF EXISTS idx_user_properties_user_id');
  await knex.raw('DROP INDEX IF EXISTS idx_user_properties_property_id');
  await knex.schema.dropTableIfExists('user_properties');
  await knex.schema.dropTableIfExists('properties');
};
