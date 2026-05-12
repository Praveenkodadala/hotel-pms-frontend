/**
 * Invoice Service (ESM)
 *
 * FIXES from v2:
 *  1. property_id stored on every invoice (for multi-property scoping)
 *  2. seq_key uses property_id (preferred) or tenant_id or 'global'
 *  3. getInvoiceById joins properties table for branding (not just tenants)
 *  4. cfg.hotel.* values now exist in config — no more silent empty strings
 */

import db  from '../db.js';
import cfg from '../config/index.js';

/** Next invoice number — per-property sequence */
async function nextInvNumber(seqKey, trx) {
  const q   = trx || db;
  const key = seqKey || 'global';
  const ym  = new Date().toISOString().slice(0,7).replace('-','');

  await q.raw(`
    INSERT INTO invoice_sequences (seq_key, last_seq)
    VALUES (?, 1)
    ON CONFLICT (seq_key)
    DO UPDATE SET last_seq = invoice_sequences.last_seq + 1
  `, [key]);

  const row = await q('invoice_sequences').where({ seq_key: key }).select('last_seq').first();
  return `INV-${ym}-${String(row.last_seq).padStart(5,'0')}`;
}

/** Create invoice from checkout data */
async function createInvoice({ reservation, room, propertyId, tenantId, createdBy, lineItems = [] }, trx) {
  const q        = trx || db;
  const checkIn  = new Date(reservation.actual_check_in  || reservation.check_in);
  const checkOut = new Date(reservation.actual_check_out || new Date());
  const nights   = Math.max(1, Math.ceil((checkOut - checkIn) / 86400000));

  const roomCharges = Number(reservation.rate_per_night) * nights;
  const extrasTotal = lineItems.reduce((s,i) => s + Number(i.amount||0), 0);
  const subtotal    = roomCharges + extrasTotal;
  const taxRate     = cfg.gst.roomRate;
  const taxAmount   = Math.round(subtotal * taxRate / 100);
  const grandTotal  = subtotal + taxAmount;

  // Use property_id as seq key if available, else tenant_id, else 'global'
  const seqKey   = propertyId || tenantId || 'global';
  const invNumber = await nextInvNumber(seqKey, q);

  const [invoice] = await q('invoices').insert({
    inv_number:     invNumber,
    property_id:    propertyId || null,
    tenant_id:      tenantId   || null,
    reservation_id: reservation.id,
    room_id:        reservation.room_id,
    guest_name:     `${reservation.first_name} ${reservation.last_name}`,
    guest_email:    reservation.email || '',
    guest_phone:    reservation.phone || '',
    check_in:       checkIn,
    check_out:      checkOut,
    nights,
    rate_per_night: reservation.rate_per_night,
    room_charges:   roomCharges,
    line_items:     JSON.stringify(lineItems),
    extras_total:   extrasTotal,
    tax_rate:       taxRate,
    tax_amount:     taxAmount,
    grand_total:    grandTotal,
    status:         'unpaid',
    invoice_type:   'standard',
    created_by:     createdBy,
  }).returning('*');

  return { ...invoice, room_number: room.number, room_type: room.type };
}

/** Fetch invoice with joins — safe with LEFT JOINs */
async function getInvoiceById(id) {
  const inv = await db('invoices as i')
    .leftJoin('rooms as r',      'i.room_id',    'r.id')
    .leftJoin('tenants as t',    'i.tenant_id',  't.id')
    .leftJoin('properties as p', 'i.property_id','p.id')
    .select(
      'i.*',
      'r.number as room_number', 'r.type as room_type',
      // Property branding (preferred over tenant)
      db.raw("COALESCE(p.name,    t.name)     as hotel_name"),
      db.raw("COALESCE(p.address, t.address)  as hotel_address"),
      db.raw("COALESCE(p.phone,   t.phone)    as hotel_phone"),
      db.raw("COALESCE(p.email,   t.email)    as hotel_email"),
      db.raw("COALESCE(p.gstin,   t.gstin)    as hotel_gstin"),
      db.raw("COALESCE(p.logo_url, t.logo_url) as hotel_logo"),
    )
    .where('i.id', id).first();

  if (!inv) throw new Error('Invoice not found');
  return inv;
}

/** Generate printable HTML — uses property/tenant branding with cfg.hotel fallback */
function generateHtml(inv) {
  const fmt    = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
  const fmtCur = n => `₹${Number(n||0).toLocaleString('en-IN', { minimumFractionDigits:2 })}`;

  // cfg.hotel.* now guaranteed to exist (fixed in config/index.js)
  const hotelName    = inv.hotel_name    || cfg.hotel.name;
  const hotelAddress = inv.hotel_address || cfg.hotel.address;
  const hotelPhone   = inv.hotel_phone   || cfg.hotel.phone;
  const hotelEmail   = inv.hotel_email   || cfg.hotel.email;
  const hotelGstin   = inv.hotel_gstin   || cfg.hotel.gstin;
  const logoUrl      = inv.hotel_logo    || cfg.hotel.logoUrl;

  let lineItemRows = '';
  try {
    const items = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items||[]);
    lineItemRows = items.map(item => `
      <tr>
        <td class="desc">${item.description||'Extra charge'}</td>
        <td class="center">${item.qty||1}</td>
        <td class="right">${fmtCur(item.unit_price||item.amount)}</td>
        <td class="right">${fmtCur(item.amount)}</td>
      </tr>`).join('');
  } catch(_) {}

  const statusColor = inv.status === 'paid' ? '#059669' : '#D97706';
  const statusLabel = (inv.status||'UNPAID').toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${inv.inv_number}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;background:#fff}
  .page{max-width:780px;margin:0 auto;padding:44px 40px}
  .inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
  .hotel-name{font-size:21px;font-weight:700;color:#185FA5;margin-bottom:4px}
  .hotel-meta{font-size:12px;color:#666;line-height:1.7}
  .inv-title-block{text-align:right}
  .inv-title{font-size:30px;font-weight:700;color:#185FA5;letter-spacing:2px}
  .inv-number{font-size:14px;color:#444;margin-top:2px;font-weight:600}
  .inv-date{font-size:12px;color:#666;margin-top:2px}
  .status-pill{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;color:#fff;margin-top:8px;background:${statusColor}}
  .rule{border:none;border-top:2px solid #185FA5;margin:20px 0}
  .two-col{display:flex;gap:48px;margin-bottom:28px}
  .two-col>div{flex:1}
  .section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#185FA5;margin-bottom:8px}
  .guest-name{font-size:15px;font-weight:600;margin-bottom:4px}
  .meta-line{font-size:12px;color:#555;line-height:1.8}
  .stay-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px}
  .stay-row span:first-child{color:#777}
  table.charges{width:100%;border-collapse:collapse;margin-bottom:20px}
  table.charges thead tr{background:#185FA5;color:#fff}
  table.charges th{padding:10px 12px;text-align:left;font-size:12px;font-weight:600}
  table.charges td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;vertical-align:top}
  td.desc{font-weight:500} td.center{text-align:center} td.right{text-align:right}
  th.center{text-align:center} th.right{text-align:right}
  .totals-wrap{display:flex;justify-content:flex-end;margin-bottom:24px}
  table.totals{width:290px;font-size:13px;border-collapse:collapse}
  table.totals td{padding:6px 12px}
  table.totals td:last-child{text-align:right;font-weight:500}
  table.totals tr.grand td{font-size:16px;font-weight:700;color:#185FA5;border-top:2px solid #185FA5;padding-top:10px}
  .payment-stamp{margin:16px 0;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#065f46;font-weight:500}
  .inv-footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end}
  .footer-note{font-size:11px;color:#888;line-height:1.8}
  .print-btn{position:fixed;bottom:24px;right:24px;padding:11px 22px;background:#185FA5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px}
  @media print{.page{padding:20px}.print-btn{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style>
</head>
<body>
<div class="page">
  <div class="inv-header">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" style="height:48px;display:block;margin-bottom:8px">` : ''}
      <div class="hotel-name">${hotelName}</div>
      <div class="hotel-meta">
        ${hotelAddress ? hotelAddress+'<br>' : ''}
        ${hotelPhone ? 'Ph: '+hotelPhone+(hotelEmail ? ' | ' : '') : ''}${hotelEmail ? hotelEmail+'<br>' : ''}
        ${hotelGstin ? 'GSTIN: '+hotelGstin : ''}
      </div>
    </div>
    <div class="inv-title-block">
      <div class="inv-title">INVOICE</div>
      <div class="inv-number">${inv.inv_number}</div>
      <div class="inv-date">Date: ${fmt(inv.created_at)}</div>
      <div><span class="status-pill">${statusLabel}</span></div>
    </div>
  </div>
  <hr class="rule">
  <div class="two-col">
    <div>
      <div class="section-label">Bill to</div>
      <div class="guest-name">${inv.guest_name}</div>
      ${inv.guest_email ? `<div class="meta-line">${inv.guest_email}</div>` : ''}
      ${inv.guest_phone ? `<div class="meta-line">${inv.guest_phone}</div>` : ''}
    </div>
    <div>
      <div class="section-label">Stay details</div>
      <div class="stay-row"><span>Room</span><span><strong>${inv.room_number||'—'}</strong> (${inv.room_type||'—'})</span></div>
      <div class="stay-row"><span>Check-in</span><span>${fmt(inv.check_in)}</span></div>
      <div class="stay-row"><span>Check-out</span><span>${fmt(inv.check_out)}</span></div>
      <div class="stay-row"><span>Duration</span><span>${inv.nights} night${inv.nights!==1?'s':''}</span></div>
    </div>
  </div>
  <table class="charges">
    <thead><tr>
      <th style="width:46%">Description</th>
      <th class="center" style="width:10%">Nights</th>
      <th class="right" style="width:22%">Rate/Night</th>
      <th class="right" style="width:22%">Amount</th>
    </tr></thead>
    <tbody>
      <tr>
        <td class="desc">Room ${inv.room_number||''} — ${inv.room_type||'Accommodation'}<br>
          <span style="font-size:11px;color:#999">${fmt(inv.check_in)} → ${fmt(inv.check_out)}</span></td>
        <td class="center">${inv.nights}</td>
        <td class="right">${fmtCur(inv.rate_per_night)}</td>
        <td class="right">${fmtCur(inv.room_charges)}</td>
      </tr>
      ${lineItemRows}
    </tbody>
  </table>
  <div class="totals-wrap">
    <table class="totals">
      <tbody>
        <tr><td style="color:#666">Room charges</td><td>${fmtCur(inv.room_charges)}</td></tr>
        ${Number(inv.extras_total)>0 ? `<tr><td style="color:#666">Extras &amp; services</td><td>${fmtCur(inv.extras_total)}</td></tr>` : ''}
        <tr><td style="color:#666">GST (${inv.tax_rate}%)</td><td>${fmtCur(inv.tax_amount)}</td></tr>
      </tbody>
      <tbody><tr class="grand"><td>Total</td><td>${fmtCur(inv.grand_total)}</td></tr></tbody>
    </table>
  </div>
  ${inv.status==='paid' ? `<div class="payment-stamp">✓ Paid via ${inv.payment_method||'—'}${inv.paid_at?' on '+fmt(inv.paid_at):''}${inv.payment_reference?' · Ref: '+inv.payment_reference:''}</div>` : ''}
  ${inv.notes ? `<p style="font-size:12px;color:#555;margin-bottom:16px"><strong>Notes:</strong> ${inv.notes}</p>` : ''}
  <div class="inv-footer">
    <div class="footer-note">Thank you for your stay.<br>Queries: ${hotelEmail||hotelPhone||'—'}</div>
    <div style="text-align:right;font-size:11px;color:#bbb">Generated by Hotel PMS<br>${new Date().toLocaleString('en-IN')}</div>
  </div>
</div>
<button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
</body></html>`;
}

export { createInvoice, getInvoiceById, generateHtml, nextInvNumber };
