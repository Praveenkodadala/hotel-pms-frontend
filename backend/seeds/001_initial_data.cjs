/**
 * Seed 001 — Full demo data (CJS for knex CLI)
 * Creates: plans, tenants, super admin, hotel users,
 *          3 properties, user-property assignments, rooms, rates,
 *          reservations, HK tasks, channels, audit log.
 */

const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  // ── Clear in safe dependency order ────────────────────────────
  await knex('channel_sync_log').del();
  await knex('channels').del();
  await knex('housekeeping_tasks').del();
  await knex('invoices').del();
  await knex('invoice_sequences').del();
  await knex('reservations').del();
  await knex('rates').del();
  await knex('inventory_closures').del();
  await knex('rooms').del();
  await knex('user_properties').del();
  await knex('tenant_audit_log').del();
  await knex('users').whereNot({ role: 'super_admin' }).del();
  await knex('users').where({ role: 'super_admin' }).del();
  await knex('properties').del();
  await knex('tenants').del();
  await knex('subscription_plans').del();

  // ── Subscription Plans ─────────────────────────────────────────
  const [starterPlan, proPlan, entPlan] = await knex('subscription_plans').insert([
    { name: 'Starter',      description: 'Up to 20 rooms, 3 users',       price_monthly: 1999,  max_rooms: 20,   max_users: 3,    features: JSON.stringify({ channel_manager: false, housekeeping: false, invoicing: true }) },
    { name: 'Professional', description: 'Up to 75 rooms, all features',  price_monthly: 4999,  max_rooms: 75,   max_users: 10,   features: JSON.stringify({ channel_manager: true,  housekeeping: true,  invoicing: true }) },
    { name: 'Enterprise',   description: 'Unlimited',                     price_monthly: 12999, max_rooms: 9999, max_users: 9999, features: JSON.stringify({ channel_manager: true,  housekeeping: true,  invoicing: true, api_access: true }) },
  ]).returning('*');

  // ── Super Admin ────────────────────────────────────────────────
  const superHash = await bcrypt.hash('SuperAdmin@999', 10);
  const [superAdmin] = await knex('users').insert({
    tenant_id: null, name: 'Super Admin', email: 'superadmin@hotelpms.io',
    password_hash: superHash, role: 'super_admin', status: 'active',
  }).returning('*');

  // ── Tenant 1: Grand Palace Hotel ─────────────────────────────
  const subEnd = new Date(Date.now() + 365 * 86400000);
  const [tenant1] = await knex('tenants').insert({
    name: 'Grand Palace Hotel', slug: 'grand-palace',
    email: 'admin@grandpalace.com', phone: '+91 821 234 5678',
    address: '123 MG Road, Mysuru, Karnataka 570001',
    city: 'Mysuru', state: 'Karnataka', country: 'India',
    gstin: '29AABCU9603R1ZX', plan_id: proPlan.id,
    subscription_start: new Date(), subscription_end: subEnd,
    subscription_active: true, status: 'active',
  }).returning('*');

  // ── Tenant 2: Sunrise Inn (expired subscription) ──────────────
  const [tenant2] = await knex('tenants').insert({
    name: 'Sunrise Inn', slug: 'sunrise-inn',
    email: 'admin@sunriseinn.com', phone: '+91 80 9876 5432',
    address: '45 Brigade Road, Bengaluru', city: 'Bengaluru',
    state: 'Karnataka', country: 'India', plan_id: starterPlan.id,
    subscription_start: new Date(Date.now() - 400 * 86400000),
    subscription_end:   new Date(Date.now() -  30 * 86400000),
    subscription_active: false, status: 'active',
  }).returning('*');

  // ── Hotel users for Grand Palace ──────────────────────────────
  const adminHash = await bcrypt.hash('Admin@1234', 10);
  const staffHash = await bcrypt.hash('Staff@1234', 10);

  const [hotelAdmin, manager, receptionist, hkStaff] = await knex('users').insert([
    { tenant_id: tenant1.id, name: 'Priya Sharma',  email: 'admin@hotel.com',        password_hash: adminHash, role: 'hotel_admin',  status: 'active', phone: '+91 98765 10001', created_by: superAdmin.id },
    { tenant_id: tenant1.id, name: 'Arjun Menon',   email: 'manager@hotel.com',      password_hash: staffHash, role: 'manager',      status: 'active', phone: '+91 98765 10002', created_by: superAdmin.id },
    { tenant_id: tenant1.id, name: 'Ravi Kumar',    email: 'frontdesk@hotel.com',    password_hash: staffHash, role: 'receptionist', status: 'active', phone: '+91 98765 10003', created_by: superAdmin.id },
    { tenant_id: tenant1.id, name: 'Lakshmi Devi',  email: 'housekeeping@hotel.com', password_hash: staffHash, role: 'housekeeping', status: 'active', phone: '+91 98765 10004', created_by: superAdmin.id },
  ]).returning('*');

  // ── Properties ─────────────────────────────────────────────────
  const [prop1] = await knex('properties').insert({
    name: 'Grand Palace — Mysuru', slug: 'grand-palace-mysuru', code: 'GP01',
    email: 'mysuru@grandpalace.com', phone: '+91 821 234 5678',
    address: '123 MG Road, Mysuru, Karnataka 570001',
    city: 'Mysuru', state: 'Karnataka', country: 'India', gstin: '29AABCU9603R1ZX',
    primary_color: '#185FA5', star_rating: '5', total_rooms: 9,
    timezone: 'Asia/Kolkata', currency: 'INR', currency_symbol: '₹',
    tenant_id: tenant1.id, status: 'active',
  }).returning('*');

  const [prop2] = await knex('properties').insert({
    name: 'Grand Palace — Bengaluru', slug: 'grand-palace-bengaluru', code: 'GP02',
    email: 'bengaluru@grandpalace.com', phone: '+91 80 9876 1234',
    address: '200 Residency Road, Bengaluru 560025',
    city: 'Bengaluru', state: 'Karnataka', country: 'India',
    primary_color: '#185FA5', star_rating: '4', total_rooms: 6,
    timezone: 'Asia/Kolkata', currency: 'INR', currency_symbol: '₹',
    tenant_id: tenant1.id, status: 'active',
  }).returning('*');

  const [prop3] = await knex('properties').insert({
    name: 'Sunrise Inn — Bengaluru', slug: 'sunrise-inn-bengaluru', code: 'SI01',
    email: 'admin@sunriseinn.com', phone: '+91 80 9876 5432',
    address: '45 Brigade Road, Bengaluru 560001',
    city: 'Bengaluru', state: 'Karnataka', country: 'India',
    primary_color: '#0F6E56', star_rating: '3', total_rooms: 4,
    timezone: 'Asia/Kolkata', currency: 'INR', currency_symbol: '₹',
    tenant_id: tenant2.id, status: 'active',
  }).returning('*');

  // ── User ↔ Property assignments ─────────────────────────────
  await knex('user_properties').insert([
    // hotelAdmin → prop1 (default) + prop2
    { user_id: hotelAdmin.id,    property_id: prop1.id, is_default: true  },
    { user_id: hotelAdmin.id,    property_id: prop2.id, is_default: false },
    // manager → prop1 only
    { user_id: manager.id,       property_id: prop1.id, is_default: true  },
    // receptionist → prop1 only
    { user_id: receptionist.id,  property_id: prop1.id, is_default: true  },
    // HK staff → prop1 only
    { user_id: hkStaff.id,       property_id: prop1.id, is_default: true  },
  ]);

  // Update default_property_id on users
  await knex('users').where({ id: hotelAdmin.id   }).update({ default_property_id: prop1.id });
  await knex('users').where({ id: manager.id      }).update({ default_property_id: prop1.id });
  await knex('users').where({ id: receptionist.id }).update({ default_property_id: prop1.id });
  await knex('users').where({ id: hkStaff.id      }).update({ default_property_id: prop1.id });

  // ── Rooms for Property 1 (Grand Palace Mysuru) ─────────────────
  const rooms = await knex('rooms').insert([
    { property_id: prop1.id, tenant_id: tenant1.id, number: '101', type: 'Standard',     floor: 1, max_occupancy: 2, base_rate: 3500,  status: 'available',   housekeeping_status: 'clean' },
    { property_id: prop1.id, tenant_id: tenant1.id, number: '102', type: 'Standard',     floor: 1, max_occupancy: 2, base_rate: 3500,  status: 'available',   housekeeping_status: 'clean' },
    { property_id: prop1.id, tenant_id: tenant1.id, number: '103', type: 'Standard',     floor: 1, max_occupancy: 3, base_rate: 3800,  status: 'available',   housekeeping_status: 'clean' },
    { property_id: prop1.id, tenant_id: tenant1.id, number: '201', type: 'Deluxe',       floor: 2, max_occupancy: 2, base_rate: 5500,  status: 'available',   housekeeping_status: 'clean' },
    { property_id: prop1.id, tenant_id: tenant1.id, number: '202', type: 'Deluxe',       floor: 2, max_occupancy: 2, base_rate: 5500,  status: 'available',   housekeeping_status: 'clean' },
    { property_id: prop1.id, tenant_id: tenant1.id, number: '203', type: 'Deluxe',       floor: 2, max_occupancy: 3, base_rate: 6000,  status: 'available',   housekeeping_status: 'clean' },
    { property_id: prop1.id, tenant_id: tenant1.id, number: '301', type: 'Junior Suite', floor: 3, max_occupancy: 3, base_rate: 8000,  status: 'available',   housekeeping_status: 'clean' },
    { property_id: prop1.id, tenant_id: tenant1.id, number: '302', type: 'Suite',        floor: 3, max_occupancy: 4, base_rate: 9500,  status: 'available',   housekeeping_status: 'clean' },
    { property_id: prop1.id, tenant_id: tenant1.id, number: '401', type: 'Presidential', floor: 4, max_occupancy: 4, base_rate: 18000, status: 'maintenance', housekeeping_status: 'dirty' },
  ]).returning('*');

  // ── Rates for Property 1 ──────────────────────────────────────
  await knex('rates').insert([
    { property_id: prop1.id, tenant_id: tenant1.id, room_type: 'Standard',     season: 'Peak',     price_per_night: 4500,  valid_from: '2025-10-01', valid_to: '2026-01-31' },
    { property_id: prop1.id, tenant_id: tenant1.id, room_type: 'Standard',     season: 'Off-peak', price_per_night: 3000,  valid_from: '2026-02-01', valid_to: '2026-09-30' },
    { property_id: prop1.id, tenant_id: tenant1.id, room_type: 'Deluxe',       season: 'Peak',     price_per_night: 7000,  valid_from: '2025-10-01', valid_to: '2026-01-31' },
    { property_id: prop1.id, tenant_id: tenant1.id, room_type: 'Suite',        season: 'Peak',     price_per_night: 12000, valid_from: '2025-10-01', valid_to: '2026-01-31' },
    { property_id: prop1.id, tenant_id: tenant1.id, room_type: 'Presidential', season: 'Peak',     price_per_night: 22000, valid_from: '2025-10-01', valid_to: '2026-01-31' },
  ]);

  // ── Sample reservations ───────────────────────────────────────
  const today   = new Date().toISOString().split('T')[0];
  const addDays = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().split('T')[0]; };

  await knex('reservations').insert([
    { property_id: prop1.id, res_number: 'RES000001', room_id: rooms[3].id,
      first_name: 'Meera', last_name: 'Sharma', email: 'meera@example.com', phone: '+91 98765 00001',
      check_in: today, check_out: addDays(today, 3), adults: 2, source: 'direct',
      rate_per_night: 5500, total_amount: 16500, status: 'confirmed' },
    { property_id: prop1.id, res_number: 'RES000002', room_id: rooms[7].id,
      first_name: 'Vikram', last_name: 'Nair', email: 'vikram@example.com', phone: '+91 98765 00002',
      check_in: addDays(today,2), check_out: addDays(today,5), adults: 2, source: 'Booking.com',
      notes: 'Late checkout requested', rate_per_night: 9500, total_amount: 28500, status: 'confirmed' },
  ]);
  await knex('rooms').where({ id: rooms[3].id }).update({ status: 'reserved' });

  // ── HK task for Presidential Suite ───────────────────────────
  await knex('housekeeping_tasks').insert({
    property_id: prop1.id, tenant_id: tenant1.id, room_id: rooms[8].id,
    assigned_to: hkStaff.id, created_by: receptionist.id,
    status: 'assigned', priority: 'high',
    notes: 'Presidential suite — deep clean required before VIP guest arrival',
    checklist: JSON.stringify([
      { item: 'Change premium bed linen', done: false },
      { item: 'Deep clean bathroom + jacuzzi', done: false },
      { item: 'Polish all surfaces', done: false },
      { item: 'Replenish premium amenities', done: false },
      { item: 'Check and restock minibar', done: false },
    ]),
  });

  // ── Channels for Property 1 ───────────────────────────────────
  const [bdc, mmt] = await knex('channels').insert([
    { property_id: prop1.id, tenant_id: tenant1.id, name: 'Booking.com', api_key: 'bdc_test_xxxx', hotel_id_on_channel: 'INH20021', commission_pct: 15, active: true },
    { property_id: prop1.id, tenant_id: tenant1.id, name: 'MakeMyTrip',  api_key: 'mmt_test_xxxx', hotel_id_on_channel: 'HTL45221', commission_pct: 12, active: true },
    { property_id: prop1.id, tenant_id: tenant1.id, name: 'Expedia',     api_key: 'exp_test_xxxx', hotel_id_on_channel: 'EXP88712', commission_pct: 18, active: false },
  ]).returning('*');

  await knex('channel_sync_log').insert([
    { channel_id: bdc.id, property_id: prop1.id, event: 'Channel connected', status: 'success' },
    { channel_id: bdc.id, property_id: prop1.id, event: 'Availability pushed: 8 rooms, 90 days', status: 'success' },
    { channel_id: mmt.id, property_id: prop1.id, event: 'Channel connected', status: 'success' },
  ]);

  // ── Audit log ─────────────────────────────────────────────────
  await knex('tenant_audit_log').insert([
    { tenant_id: tenant1.id, user_id: superAdmin.id, action: 'TENANT_CREATED', payload: JSON.stringify({ name: tenant1.name }) },
    { tenant_id: tenant2.id, user_id: superAdmin.id, action: 'TENANT_CREATED', payload: JSON.stringify({ name: tenant2.name }) },
    { tenant_id: tenant2.id, user_id: null, action: 'SUBSCRIPTION_EXPIRED', payload: JSON.stringify({ subscription_end: tenant2.subscription_end }) },
  ]);

  console.log('\n✅  Seed complete.\n');
  console.log('    Role            Email                         Password');
  console.log('    ─────────────────────────────────────────────────────────');
  console.log('    Super Admin     superadmin@hotelpms.io        SuperAdmin@999');
  console.log('    Hotel Admin     admin@hotel.com               Admin@1234  (GP01 + GP02)');
  console.log('    Manager         manager@hotel.com             Staff@1234  (GP01)');
  console.log('    Receptionist    frontdesk@hotel.com           Staff@1234  (GP01)');
  console.log('    Housekeeping    housekeeping@hotel.com        Staff@1234  (GP01)');
  console.log('\n    Properties: GP01 (Mysuru), GP02 (Bengaluru), SI01 (Sunrise Inn)');
  console.log('    Hotel Admin can switch between GP01 and GP02.\n');
};
