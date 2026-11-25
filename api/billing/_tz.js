const crypto = require('crypto');

const API_BASE = 'https://api.tezcheck.uz/api/merchant/v1';
const API_KEY = process.env.TEZCHECK_API_KEY || '';
const DESK_CODE = process.env.TEZCHECK_CASH_DESK_CODE || '';
const WEBHOOK_SECRET = process.env.TEZCHECK_WEBHOOK_SECRET || '';

// 40 000 so'm = 4 000 000 tiyin. 40 ta yuklab olish.
const CREDITS_PER_PAYMENT = 40;
const PRICE_MINOR = 4000000;

function tzHeaders(extra) {
  return Object.assign({
    'Authorization': 'Bearer ' + API_KEY,
    'X-Cash-Desk-Code': DESK_CODE,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }, extra || {});
}

async function tzRequest(path, options) {
  const opts = options || {};
  const r = await fetch(API_BASE + path, {
    method: opts.method || 'POST',
    headers: tzHeaders(opts.headers),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
  return { ok: r.ok, status: r.status, data: json, headers: r.headers };
}

function verifyWebhook(rawBody, headers) {
  if (!WEBHOOK_SECRET) return { ok: false, reason: 'secret_not_configured' };
  const ts = String(headers['x-checkout-timestamp'] || '');
  const delivery = String(headers['x-checkout-delivery'] || '');
  const sigHeader = String(headers['x-checkout-signature'] || '');

  const now = Math.floor(Date.now() / 1000);
  const tsNum = Number(ts);
  if (!ts || !Number.isFinite(tsNum) || Math.abs(now - tsNum) > 300) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  const expected = 'v1=' + crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(ts + '.' + delivery + '.' + rawBody)
    .digest('hex');

  const candidates = sigHeader.split(',').map(s => s.trim()).filter(Boolean);
  for (const c of candidates) {
    const a = Buffer.from(c);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return { ok: true };
  }
  return { ok: false, reason: 'signature_mismatch' };
}

module.exports = {
  API_BASE, API_KEY, DESK_CODE, WEBHOOK_SECRET,
  CREDITS_PER_PAYMENT, PRICE_MINOR,
  tzHeaders, tzRequest, verifyWebhook
};
