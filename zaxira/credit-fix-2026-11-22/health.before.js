const L = require('../_lib');
const TZ = require('./_tz');
// Faqat sozlash holatini ko'rsatadi — hech qanday maxfiy qiymat chiqarmaydi.
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();

  const q = new URL(req.url || '/', 'https://x').searchParams;

  if (req.method !== 'GET') return L.send(res, 405, { ok: false });

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
      result.apiKeyPrefix = TZ.API_KEY ? TZ.API_KEY.slice(0, 4) : null;
      result.apiKeyLength = TZ.API_KEY ? TZ.API_KEY.length : 0;
      result.deskPrefix = TZ.DESK_CODE ? TZ.DESK_CODE.slice(0, 4) : null;
      if (!r.ok) {
        const d = r.data && r.data.data;
        const details = d && Array.isArray(d.details) ? d.details.map(x => x && x.code).filter(Boolean) : [];
        result.errorCode = (d && (d.code || d.error)) || (r.data && (r.data.code || r.data.error)) || null;
        result.errorDetails = details.length ? details : null;
        result.errorKeys = r.data && typeof r.data === 'object' ? Object.keys(r.data).slice(0, 10) : null;
      }
    } catch (e) {
      result.tezcheckReachable = false;
      result.errorCode = 'network_error';
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
