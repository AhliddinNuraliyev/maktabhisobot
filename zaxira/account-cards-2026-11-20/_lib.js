const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const BOT_USERNAME = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
const MAX_AGE = 60 * 60 * 24 * 30;
const ADMIN_IDS = String(process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function isAdmin(payload) {
  return !!(payload && payload.sub && ADMIN_IDS.includes(String(payload.sub)));
}

async function getBotUsername() {
  if (BOT_USERNAME) return BOT_USERNAME;
  if (!BOT_TOKEN) return '';
  try {
    const r = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/getMe');
    const j = await r.json();
    return j && j.ok && j.result && j.result.username ? String(j.result.username) : '';
  } catch (e) { return ''; }
}

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, { iat: now, exp: now + MAX_AGE });
  const data = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return data + '.' + sig;
}
function verifyToken(token) {
  if (!token || !SESSION_SECRET) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const data = parts[0] + '.' + parts[1];
  const expect = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (expect.length !== parts[2].length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(parts[2]))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) { return null; }
}
function getToken(req) {
  const c = req.headers.cookie || '';
  const m = c.match(/(?:^|;\s*)mh_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}
function cookie(token) {
  return 'mh_session=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + MAX_AGE;
}
function clearCookie() {
  return 'mh_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

async function sb(path, options) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase env not configured');
  const opts = options || {};
  const headers = Object.assign({
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json'
  }, opts.headers || {});
  const r = await fetch(SUPABASE_URL + path, Object.assign({}, opts, { headers }));
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
  if (!r.ok) {
    const msg = (json && (json.message || json.description || json.error)) || text || ('HTTP ' + r.status);
    const err = new Error(String(msg)); err.status = r.status; throw err;
  }
  return json;
}
function rpc(name, body) {
  return sb('/rest/v1/rpc/' + encodeURIComponent(name), {
    method: 'POST', body: JSON.stringify(body || {})
  });
}
async function userIdFromToken(token) {
  const p = verifyToken(token);
  if (!p || !p.sub) return null;
  const rows = await sb('/rest/v1/mh_users?telegram_id=eq.' + encodeURIComponent(String(p.sub)) + '&select=id&limit=1');
  return rows && rows.length ? rows[0].id : null;
}
async function getUserStats(uid) {
  try {
    const rows = await sb('/rest/v1/mh_users?id=eq.' + encodeURIComponent(uid) +
      '&select=login_count,is_premium&limit=1');
    const u = rows && rows.length ? rows[0] : {};
    return {
      logins: +(u.login_count || 0),
      premium: !!u.is_premium
    };
  } catch (e) {
    return { logins: 0, premium: false };
  }
}
function bump(uid, kind) {
  return rpc('mh_bump', { p_uid: uid, p_kind: kind });
}
function send(res, code, obj, headers) {
  Object.keys(headers || {}).forEach(k => res.setHeader(k, headers[k]));
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(code).json(obj);
}
function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}
function verifyTelegram(data) {
  if (!data || !data.hash || !BOT_TOKEN) return null;
  const authDate = Number(data.auth_date || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) return null;
  const hash = String(data.hash);
  const check = Object.keys(data).filter(k => k !== 'hash' && data[k] != null).sort()
    .map(k => k + '=' + data[k]).join('\n');
  const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(check).digest('hex');
  if (calc.length !== hash.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  } catch (e) { return null; }
  return data;
}

module.exports = {
  SUPABASE_URL, BOT_USERNAME, MAX_AGE, getBotUsername, signToken, verifyToken, getToken,
  cookie, clearCookie, sb, rpc, userIdFromToken, getUserStats, isAdmin, send, parseBody, verifyTelegram, bump
};
