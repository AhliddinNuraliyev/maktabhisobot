const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const BOT_USERNAME = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
const MAX_AGE = 60 * 60 * 24 * 30;
const ADMIN_IDS = String(process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
let cachedBotId = '';
let cachedBotUsername = '';

function isAdmin(payload) {
  return !!(payload && payload.sub && ADMIN_IDS.includes(String(payload.sub)));
}

// Sessiya tokenidagi uid ni qaytaradi. Token imzolangan, shuning uchun har
// so'rovda bazadan qayta qidirish (userIdFromToken) shart emas — bu Supabase
// so'rovlarini sezilarli kamaytiradi (free plan uchun muhim).
function uidFromPayload(payload) {
  const u = payload && payload.uid ? String(payload.uid) : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u) ? u : '';
}

// Mijoz IP si (Vercel x-forwarded-for beradi).
function clientIp(req) {
  const h = (req && req.headers) || {};
  const raw = String(h['x-forwarded-for'] || h['x-real-ip'] || '');
  return raw.split(',')[0].trim() || 'unknown';
}

// Jarayon ichidagi oddiy rate limit. Serverless'da instanslar ko'p bo'lishi
// mumkin, shuning uchun bu to'liq himoya emas — lekin oddiy skript/loop ni
// to'xtatadi va Supabase'ga ortiqcha yozuv tushishining oldini oladi.
const rlBuckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = rlBuckets.get(key);
  if (!b || now - b.start > windowMs) { b = { start: now, count: 0 }; rlBuckets.set(key, b); }
  b.count += 1;
  if (rlBuckets.size > 4000) {
    for (const [k, v] of rlBuckets) { if (now - v.start > windowMs) rlBuckets.delete(k); }
  }
  return b.count <= max;
}

async function getBotUsername() {
  if (BOT_USERNAME) return BOT_USERNAME;
  // Keshlanadi: aks holda har /api/me so'rovida Telegram API ga chiqilardi.
  if (cachedBotUsername) return cachedBotUsername;
  if (!BOT_TOKEN) return '';
  try {
    const r = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/getMe');
    const j = await r.json();
    if (j && j.ok && j.result && j.result.username) {
      cachedBotUsername = String(j.result.username);
      return cachedBotUsername;
    }
    return '';
  } catch (e) { return ''; }
}
// Telegram OAuth sessiyasini tozalash uchun botning raqamli ID si kerak.
async function getBotId() {
  if (cachedBotId) return cachedBotId;
  if (!BOT_TOKEN) return '';
  try {
    const r = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/getMe');
    const j = await r.json();
    if (j && j.ok && j.result && j.result.id) cachedBotId = String(j.result.id);
  } catch (e) { /* keyinroq qayta urunib ko'ramiz */ }
  return cachedBotId;
}
function requestOrigin(req) {
  const h = (req && req.headers) || {};
  const rawProto = String(h['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = rawProto || (/^localhost(:\d+)?$/.test(String(h.host || '')) ? 'http' : 'https');
  let host = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  if (!host && process.env.VERCEL_URL) host = String(process.env.VERCEL_URL);
  return host ? proto + '://' + host : '';
}

// Saytning tashqi manzili (bot tugmalari va qaytish havolalari uchun).
// PUBLIC_SITE_URL sozlangan bo'lsa — o'sha, aks holda so'rov domeni.
function siteUrl(req) {
  const fixed = String(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '').replace(/\/+$/, '');
  if (fixed) return fixed;
  return requestOrigin(req).replace(/\/+$/, '');
}

// Telegram Bot API ga so'rov. Xato bo'lsa null qaytaradi (chaqiruvchi jim davom etadi).
async function botApi(method, payload) {
  if (!BOT_TOKEN) return null;
  try {
    const r = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) {
      console.error('[bot] ' + method + ' failed:', j && j.description);
      return null;
    }
    return j.result;
  } catch (e) {
    console.error('[bot] ' + method + ' error:', e && e.message);
    return null;
  }
}

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signToken(payload) {
  if (!SESSION_SECRET) throw new Error('SESSION_SECRET sozlanmagan');
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
  const c = (req && req.headers && req.headers.cookie) || '';
  const m = c.match(/(?:^|;\s*)mh_session=([^;]+)/);
  if (!m) return '';
  try { return decodeURIComponent(m[1]); }
  catch (e) { return ''; } // masalan mh_session=% — barcha endpointlar 500 bo'lmasligi kerak
}
function isSecureRequest(req) {
  const h = (req && req.headers) || {};
  const proto = String(h['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (proto) return proto === 'https';
  const host = String(h.host || '').split(':')[0].toLowerCase();
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]';
}
function cookie(token, req) {
  const secure = isSecureRequest(req) ? ' Secure;' : '';
  return 'mh_session=' + encodeURIComponent(token) + '; Path=/; HttpOnly;' + secure + ' SameSite=Lax; Max-Age=' + MAX_AGE;
}
function clearCookie(req) {
  const secure = isSecureRequest(req) ? ' Secure;' : '';
  return 'mh_session=; Path=/; HttpOnly;' + secure + ' SameSite=Lax; Max-Age=0';
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
      '&select=download_count,is_premium,download_credits&limit=1');
    const u = rows && rows.length ? rows[0] : {};
    return {
      downloads: +(u.download_count || 0),
      premium: !!u.is_premium,
      credits: +(u.download_credits || 0)
    };
  } catch (e) {
    return { downloads: 0, premium: false, credits: 0 };
  }
}
function bump(uid, kind) {
  return rpc('mh_bump', { p_uid: uid, p_kind: kind });
}
// Telegram orqali kirganda foydalanuvchini yaratadi/yangilaydi.
// Yangi foydalanuvchiga 3 ta bepul hisobot krediti beriladi; eski
// foydalanuvchilarda kredit va yuklab olishlar ikkisi ham 0 bo'lsa, bir marta beriladi.
async function upsertTelegramUser(tid, profile) {
  const telegramId = String(tid);
  const clean = {
    first_name: String(profile.first_name || ''),
    last_name: String(profile.last_name || ''),
    username: String(profile.username || ''),
    photo_url: String(profile.photo_url || '')
  };
  // Bitta so'rov: haqiqiy PostgREST upsert (on_conflict=telegram_id).
  // Ilgari SELECT -> PATCH/INSERT edi: ikki parallel login bir vaqtda kelsa
  // unique cheklov buzilib, biri 500 olardi. Endi poyga yo'q va so'rov kamroq.
  // download_credits ni yubormaymiz — aks holda har loginda kredit 3 ga qaytardi.
  const rows = await sb('/rest/v1/mh_users?on_conflict=telegram_id&select=*', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(Object.assign({ telegram_id: telegramId }, clean))
  });
  const user = Array.isArray(rows) ? rows[0] : rows;
  if (!user || !user.id) throw new Error('foydalanuvchi saqlanmadi');

  // Bonus faqat kerak bo'lganda so'raladi (kredit ham, yuklab olish ham 0,
  // premium emas) — shu bilan oddiy loginda ortiqcha RPC ketmaydi.
  let bonus = false;
  const credits = +(user.download_credits || 0);
  const downloads = +(user.download_count || 0);
  if (!user.is_premium && credits === 0 && downloads === 0) {
    try {
      bonus = !!(await rpc('mh_grant_signup_bonus', { p_uid: user.id }));
      if (bonus) user.download_credits = 3;
    } catch (e) {
      console.warn('[auth] signup bonus RPC not available:', e.message);
    }
  }
  return {
    bonus: bonus,
    user: {
      id: user.id,
      telegram_id: telegramId,
      first_name: clean.first_name,
      last_name: clean.last_name,
      username: clean.username,
      photo_url: clean.photo_url,
      premium: !!user.is_premium,
      credits: +(user.download_credits || 0)
    }
  };
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
// Telegram imzosini bir marta ishlatish. SQL funksiyasi o'rnatilmagan bo'lsa,
// jarayon ichidagi vaqtinchalik xotitadan foydalanamiz (eng kam darajadagi himoya).
const authMemory = new Map();
async function useAuthHash(hash, telegramId, authDate) {
  const raw = String(hash || '');
  if (!raw) return false;
  const h = crypto.createHash('sha256').update(String(telegramId) + ':' + raw).digest('hex');
  try {
    return !!(await rpc('mh_use_auth_hash', {
      p_hash: h, p_telegram_id: String(telegramId), p_auth_date: Math.floor(Number(authDate) || 0)
    }));
  } catch (e) {
    const missing = /could not find the function|PGRST202|404/i.test(String(e && e.message));
    if (!missing) { console.error('[auth] replay check failed:', e.message); return false; }
    console.warn('[auth] replay RPC missing, using process-local dedup');
    const now = Date.now();
    for (const [k, v] of authMemory) if (now - v > 10 * 60 * 1000) authMemory.delete(k);
    if (authMemory.has(h)) return false;
    authMemory.set(h, now);
    return true;
  }
}

async function releaseAuthHash(hash, telegramId) {
  const h = crypto.createHash('sha256').update(String(telegramId) + ':' + String(hash || '')).digest('hex');
  authMemory.delete(h);
  try { await rpc('mh_release_auth_hash', { p_hash: h, p_telegram_id: String(telegramId) }); }
  catch (e) { /* eski SQL o'rnatilmagan bo'lishi mumkin */ }
}

function verifyTelegram(data) {
  if (!data || !data.hash || !BOT_TOKEN) return null;
  const authDate = Number(data.auth_date || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 300) return null;
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
  SUPABASE_URL, BOT_USERNAME, MAX_AGE, getBotUsername, getBotId, requestOrigin, siteUrl, botApi, signToken, verifyToken, getToken,
  cookie, clearCookie, isSecureRequest, sb, rpc, userIdFromToken, uidFromPayload, clientIp, rateLimit, getUserStats, isAdmin, send, parseBody,
  verifyTelegram, useAuthHash, releaseAuthHash, bump, upsertTelegramUser
};
