const crypto = require('crypto');
const L = require('./_lib');

// Telegram Mini App initData (WebAppData usuli)
function readInitUser(initData) {
  const p = new URLSearchParams(String(initData || ''));
  const hash = p.get('hash');
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
  if (!hash || !botToken) return null;
  const authDate = Number(p.get('auth_date') || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) return null;
  const pairs = [];
  p.forEach((v, k) => { if (k !== 'hash') pairs.push(k + '=' + v); });
  pairs.sort();
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(pairs.join('\n')).digest('hex');
  if (expected.length !== hash.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null;
  } catch (e) { return null; }
  try {
    const user = JSON.parse(p.get('user') || '');
    return user && user.id ? user : null;
  } catch (e) { return null; }
}

const LOGIN_TTL_SEC = 600; // bot havolasi 10 daqiqa amal qiladi

function cleanNonce(v) {
  return String(v || '').replace(/[^a-f0-9]/gi, '').slice(0, 64);
}

// 1-qadam: sayt bir martalik havola yaratadi.
// Foydalanuvchi shu havolani ochib botda «Start» bosadi — xabar botdan keladi.
async function startBotLogin(req, res) {
  // Maktablarda bitta tashqi IP orqasida ko'p o'quvchi bo'lishi mumkin,
  // shuning uchun chegara yumshoq: skriptni to'xtatadi, darsni emas.
  if (!L.rateLimit('botstart:' + L.clientIp(req), 20, 60000)) {
    return L.send(res, 429, { ok: false, description: 'Juda ko\'p urinish. Bir daqiqadan keyin qayta urinib ko\'ring' });
  }
  const bot = await L.getBotUsername();
  if (!bot) {
    console.error('[auth] bot username aniqlanmadi (BOT_TOKEN?)');
    return L.send(res, 503, { ok: false, description: 'Bot sozlanmagan' });
  }
  const nonce = crypto.randomBytes(24).toString('hex');
  console.log('[auth] bot_start');
  const expiresAt = new Date(Date.now() + LOGIN_TTL_SEC * 1000).toISOString();
  try {
    await L.sb('/rest/v1/mh_bot_logins', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ nonce: nonce, expires_at: expiresAt })
    });
  } catch (e) {
    console.error('[auth] bot login nonce saqlanmadi:', e && e.message);
    return L.send(res, 503, { ok: false, description: 'Kirish jadvali topilmadi — SQL o‘rnatilishi kerak' });
  }
  return L.send(res, 200, {
    ok: true,
    status: 'pending',
    state: nonce,
    url: 'https://t.me/' + bot + '?start=login_' + nonce,    expiresIn: LOGIN_TTL_SEC
  });
}

// 2-qadam: brauzer holatni so'rab turadi. Bot tasdiqlagan bo'lsa — sessiya beriladi.
async function pollBotLogin(req, res) {
  const state = cleanNonce(req.query && req.query.state);
  if (!state) return L.send(res, 200, { ok: true, status: 'expired' });

  let row;
  try {
    const rows = await L.sb('/rest/v1/mh_bot_logins?nonce=eq.' + encodeURIComponent(state) +
      '&select=nonce,telegram_id,first_name,last_name,username,photo_url,confirmed_at,used_at,expires_at&limit=1');
    row = rows && rows[0];
  } catch (e) {
    console.error('[auth] bot login o‘qilmadi:', e && e.message);
    return L.send(res, 503, { ok: false, description: 'Kirish holati vaqtincha olinmadi' });
  }

  if (!row) return L.send(res, 200, { ok: true, status: 'expired' });
  if (row.used_at) {
    // Havola bir martalik, LEKIN shu brauzerda sessiya allaqachon ochilgan bo'lishi
    // mumkin: sahifa fonda poll qilib, nonce ni birinchi bo'lib ishlatgan, botdagi
    // «Saytga qaytish» tugmasi esa xuddi shu nonce bilan yangi oyna ochadi. Bunday
    // holatda «used» qaytarish foydalanuvchini «havola ishlatilgan» degan xato bilan
    // chalg'itadi. Cookie dagi sessiya shu telegram_id ga tegishli bo'lsa — ok.
    const tok = L.verifyToken(L.getToken(req));
    if (tok && String(tok.sub) === String(row.telegram_id)) {
      return L.send(res, 200, { ok: true, status: 'ok', already: true });
    }
    return L.send(res, 200, { ok: true, status: 'used' });
  }
  if (!row.confirmed_at) {
    if (new Date(row.expires_at).getTime() < Date.now()) return L.send(res, 200, { ok: true, status: 'expired' });
    return L.send(res, 200, { ok: true, status: 'pending' });
  }
  if (!process.env.SESSION_SECRET) {
    console.error('[auth] SESSION_SECRET sozlanmagan');
    return L.send(res, 500, { ok: false, description: 'Kirish tizimi sozlanmagan' });
  }

  // Nonce ni atomik "ishlatilgan" deb belgilaymiz: parallel so'rovlardan
  // faqat bittasi sessiya oladi (replay himoyasi).
  const nowIso = new Date().toISOString();
  try {
    const used = await L.sb('/rest/v1/mh_bot_logins?nonce=eq.' + encodeURIComponent(state) +
      '&used_at=is.null&confirmed_at=not.is.null', {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ used_at: nowIso })
    });
    if (!Array.isArray(used) || !used.length) return L.send(res, 200, { ok: true, status: 'used' });
  } catch (e) {
    console.error('[auth] nonce belgilanmadi:', e && e.message);
    return L.send(res, 503, { ok: false, description: 'Kirishni tasdiqlashda xatolik' });
  }

  const telegramId = String(row.telegram_id || '');
  if (!telegramId) return L.send(res, 200, { ok: true, status: 'expired' });

  try {
    const profile = {
      first_name: String(row.first_name || ''),
      last_name: String(row.last_name || ''),
      username: String(row.username || ''),
      photo_url: String(row.photo_url || '')
    };
    const saved = await L.upsertTelegramUser(telegramId, profile);
    console.log('[auth] bot_login ok');
    const token = L.signToken({
      sub: telegramId,
      uid: saved.user.id,
      name: profile.first_name || profile.username || 'Foydalanuvchi'
    });
    return L.send(res, 200, { ok: true, status: 'ok', bonus: saved.bonus, user: saved.user },
      { 'Set-Cookie': L.cookie(token, req) });
  } catch (e) {
    console.error('[auth] bot login failed:', e && e.message);
    // Qayta urinish mumkin bo'lsin: nonce ni bo'shatamiz.
    try {
      await L.sb('/rest/v1/mh_bot_logins?nonce=eq.' + encodeURIComponent(state), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ used_at: null })
      });
    } catch (e2) { /* jim */ }
    return L.send(res, 500, { ok: false, description: 'Kirishda xatolik' });
  }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Telegram webhook ham shu funksiyaga keladi (Hobby rejasida alohida
  // /api/telegram-bot funksiyasi uchun joy yo'q). Mantiq api/_bot.js da.
  let q = req.query;
  if (!q) {
    try { q = Object.fromEntries(new URL(req.url || '/', 'https://x').searchParams); }
    catch (e) { q = {}; }
  }
  if (String(q.action || '') === 'bot_webhook') {
    console.log('[auth] webhook kirish');
    return require('./_bot')(req, res);
  }

  if (req.method === 'GET') return pollBotLogin(req, res);
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, description: 'method not allowed' });

  if (!process.env.SESSION_SECRET) {
    console.error('[auth] SESSION_SECRET sozlanmagan');
    return L.send(res, 500, { ok: false, description: 'Kirish tizimi sozlanmagan' });
  }

  const body = L.parseBody(req);
  // Bot orqali kirish: birinchi qadam — havola yaratish.
  if (String(body.action || '') === 'bot_start') return startBotLogin(req, res);

  // Imzo tekshiruvidan oldin arzon IP cheklovi (qayta urinishlar bazaga
  // yetib bormasin).
  if (!L.rateLimit('tlogin:' + L.clientIp(req), 30, 60000)) {
    return L.send(res, 429, { ok: false, description: 'Juda ko\'p urinish. Bir daqiqadan keyin qayta urinib ko\'ring' });
  }

  // Ikki kirish usuli: Login Widget ma'lumoti yoki Mini App init_data.
  const isMiniApp = !!(body && body.init_data);
  const tg = isMiniApp ? readInitUser(body.init_data) : L.verifyTelegram(body);
  if (!tg) return L.send(res, 401, { ok: false, description: 'Telegram malumoti tasdiqlanmadi yoki vaxti otdi' });

  // Bir xil imzo/eshki havola bilan qayta kirish mumkin emas (replay).
  const p = isMiniApp ? new URLSearchParams(String(body.init_data)) : null;
  const authHash = p ? p.get('hash') : tg.hash;
  // Mini App da auth_date initData ichida bo'ladi, user obyektida emas.
  const authDate = p ? Number(p.get('auth_date') || 0) : Number(tg.auth_date || 0);
  try {
    const used = await L.useAuthHash(authHash, tg.id, authDate);
    if (!used) return L.send(res, 401, { ok: false, description: 'Bu kirish havolasi allaqachon ishlatilgan' });
  } catch (e) {
    console.error('[auth] replay check error:', e && e.message);
    return L.send(res, 500, { ok: false, description: 'Kirishni tasdiqlashda xatolik' });
  }

  try {
    const profile = {
      first_name: String(tg.first_name || ''),
      last_name: String(tg.last_name || ''),
      username: String(tg.username || ''),
      photo_url: String(tg.photo_url || '')
    };
    const saved = await L.upsertTelegramUser(String(tg.id), profile);
    const token = L.signToken({
      sub: String(tg.id),
      uid: saved.user.id,
      name: profile.first_name || profile.username || 'Foydalanuvchi'
    });
    return L.send(res, 200, { ok: true, bonus: saved.bonus, user: saved.user },
      { 'Set-Cookie': L.cookie(token, req) });
  } catch (e) {
    console.error('[auth] login failed:', e && e.message);
    await L.releaseAuthHash(authHash, tg.id); // qayta urinib ko'rish imkoni qolsin
    return L.send(res, 500, { ok: false, description: 'Kirishda xatolik' });
  }
};
