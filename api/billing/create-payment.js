const L = require('../_lib');
const TZ = require('./_tz');

const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, description: 'method not allowed' });

  const token = L.getToken(req);
  const payload = L.verifyToken(token);
  if (!payload || !payload.sub) return L.send(res, 401, { ok: false, description: 'Kirish talab qilinadi' });

  try {
    const uid = L.uidFromPayload(payload) || await L.userIdFromToken(token);
    if (!uid) return L.send(res, 401, { ok: false, description: 'Foydalanuvchi topilmadi' });

    // Har bosishda yangi "pending" qator yoziladi — spam bo'lmasin.
    if (!L.rateLimit('pay:' + uid, 5, 10 * 60 * 1000)) {
      return L.send(res, 429, { ok: false, description: 'Juda ko\'p urinish. 10 daqiqadan keyin qayta urinib ko\'ring' });
    }

    if (!TZ.API_KEY || !TZ.DESK_CODE) {
      return L.send(res, 500, { ok: false, description: 'To\'lov tizimi sozlanmagan (kalitlar yo\'q)' });
    }

    // Har bir buyurtma uchun noyob reference — idempotency kaliti ham shu
    const reference = 'MH-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const configuredEnv = String(process.env.TEZCHECK_ENVIRONMENT || 'test') === 'live' ? 'live' : 'test';

    // Avval o'z bazamizga pending yozuv qo'yamiz
    await L.sb('/rest/v1/mh_payments', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: uid,
        reference: reference,
        amount_minor: TZ.PRICE_MINOR,
        currency: 'UZS',
        state: 'pending',
        environment: configuredEnv
      })
    });

    // Tezcheckga hisob yaratish so'rovi
    const result = await TZ.tzRequest('/bills', {
      method: 'POST',
      headers: { 'Idempotency-Key': reference },
      body: {
        amount_minor: TZ.PRICE_MINOR,
        title: 'Maktab Hisobot — 40 ta yuklab olish',
        description: '40 ta hisobot yuklab olish huquqi',
        external_reference: reference
      }
    });

    if (!result.ok) {
      console.error('[billing] create bill failed:', result.status, JSON.stringify(result.data).slice(0, 500));
      // Yetim "pending" qator qolmasin: keyingi holat so'rovlarida chalkashlik bo'ladi.
      try {
        await L.sb('/rest/v1/mh_payments?reference=eq.' + encodeURIComponent(reference), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ state: 'failed' })
        });
      } catch (e2) { /* jim */ }
      return L.send(res, 502, { ok: false, description: 'To\'lov havolasi yaratilmadi. Iltimos, keyinroq urinib ko\'ring.' });
    }

    const bill = result.data && result.data.data && result.data.data.bill;
    const paymentUrl = result.data && result.data.data && result.data.data.payment_url;
    if (!paymentUrl) {
      console.error('[billing] payment_url missing:', JSON.stringify(result.data).slice(0, 500));
      return L.send(res, 502, { ok: false, description: 'To\'lov havolasi olinmadi' });
    }

    // Bill ID va Tezcheck qaytargan muhitni saqlaymiz (trust env from provider)
    if (bill) {
      const patch = {};
      if (bill.id) patch.bill_id = bill.id;
      if (bill.environment) patch.environment = String(bill.environment) === 'live' ? 'live' : 'test';
      if (Object.keys(patch).length) {
        await L.sb('/rest/v1/mh_payments?reference=eq.' + encodeURIComponent(reference), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(patch)
        });
      }
    }

    return L.send(res, 200, {
      ok: true,
      reference,
      paymentUrl,
      amountMinor: TZ.PRICE_MINOR,
      credits: TZ.CREDITS_PER_PAYMENT
    });
  } catch (e) {
    console.error('[billing] create-payment error:', e && e.message);
    return L.send(res, 500, { ok: false, description: 'To\'lov yaratishda ichki xatolik' });
  }
};
