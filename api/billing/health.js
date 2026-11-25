const L = require('../_lib');
const TZ = require('./_tz');
// Faqat sozlash holatini ko'rsatadi — hech qanday maxfiy qiymat chiqarmaydi.
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();

  const q = new URL(req.url || '/', 'https://x').searchParams;

  if (req.method !== 'GET') return L.send(res, 405, { ok: false });

  // Kunlik tozalash (Vercel Cron yoki qo'lda). Muddati o'tgan bot-login va
  // auth-nonce qatorlari to'planib ketmasin. Bu endpoint boshqa so'rovlarni
  // ko'paytirmaydi: baza tomonida pg_cron ham sozlanishi mumkin.
  const isCron = !!req.headers['x-vercel-cron'] || String(q.get('cron') || '') === '1';
  if (isCron) {
    const secret = String(process.env.CRON_SECRET || '');
    const auth = String(req.headers.authorization || '');
    if (!secret || auth !== 'Bearer ' + secret) {
      return L.send(res, 401, { ok: false, description: 'cron ruxsati yo\'q' });
    }
    try {
      const purged = await L.rpc('mh_purge_expired', {});
      return L.send(res, 200, { ok: true, purged: purged });
    } catch (e) {
      return L.send(res, 200, { ok: false, description: 'tozalash funksiyasi topilmadi' });
    }
  }

  // Diagnostika faqat ADMIN_TELEGRAM_IDS dagi akkauntlar uchun
  if (!L.isAdmin(L.verifyToken(L.getToken(req)))) {
    return L.send(res, 403, { ok: false, description: 'Ruxsat yo\'q' });
  }

  const result = {
    ok: true,
    apiKeySet: !!TZ.API_KEY,
    cashDeskCodeSet: !!TZ.DESK_CODE,
    webhookSecretSet: !!TZ.WEBHOOK_SECRET,
    priceMinor: TZ.PRICE_MINOR,
    creditsPerPayment: TZ.CREDITS_PER_PAYMENT,
    apiBase: TZ.API_BASE
  };

  // ?check=1 — Tezcheckga haqiqiy so'rov yuboradi, lekin hech qanday
  // maxfiy qiymat yoki to'liq javob qaytarilmaydi (faqat xulosa).
  if (String((new URL(req.url || '/', 'https://x')).searchParams.get('check') || '') === '1') {
    try {
      const r = await TZ.tzRequest('/me', { method: 'GET' });
      result.tezcheckReachable = r.ok;
      result.credentialValid = r.ok && !!(r.data && r.data.data);
      result.httpStatus = r.status;
      // Faqat kalit turini ko'rsatamiz — to'liq qiymat emas
      // Kalit prefiksi/uzunligi va xato tafsilotlari chiqarilmaydi
      if (!r.ok) result.credentialValid = false;
    } catch (e) {
      result.tezcheckReachable = false;
      result.credentialValid = false;
    }
  }

  // ?db=1 — database jadvallari va funksiyalari tayyorligini tekshiradi
  if (String((new URL(req.url || '/', 'https://x')).searchParams.get('db') || '') === '1') {
    result.db = {};
    try {
      const a = await L.sb('/rest/v1/mh_payments?select=id&limit=1');
      result.db.mh_payments = Array.isArray(a);
    } catch (e) { result.db.mh_payments = false; }
    try {
      const b = await L.sb('/rest/v1/mh_webhook_events?select=id&limit=1');
      result.db.mh_webhook_events = Array.isArray(b);
    } catch (e) { result.db.mh_webhook_events = false; }
    try {
      const c = await L.sb('/rest/v1/mh_users?select=download_credits&limit=1');
      result.db.download_credits_column = Array.isArray(c);
    } catch (e) { result.db.download_credits_column = false; }
    result.db.ready = !!(result.db.mh_payments && result.db.mh_webhook_events && result.db.download_credits_column);
  }

  return L.send(res, 200, result);
};
