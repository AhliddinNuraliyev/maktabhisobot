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
    const uid = await L.userIdFromToken(token);
    if (!uid) return L.send(res, 401, { ok: false, description: 'Foydalanuvchi topilmadi' });

    if (!TZ.API_KEY || !TZ.DESK_CODE) {
      return L.send(res, 500, { ok: false, description: 'To\'lov tizimi sozlanmagan (kalitlar yo\'q)' });
    }

    // Har bir buyurtma uchun noyob reference — idempotency kaliti ham shu
    const reference = 'MH-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();

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
        environment: 'test'
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
      const msg = (result.data && (result.data.message || result.data.description)) || ('Tezcheck HTTP ' + result.status);
      return L.send(res, 502, { ok: false, description: 'To\'lov havolasi yaratilmadi: ' + msg, detail: result.data });
    }

    const bill = result.data && result.data.data && result.data.data.bill;
    const paymentUrl = result.data && result.data.data && result.data.data.payment_url;
    if (!paymentUrl) {
      return L.send(res, 502, { ok: false, description: 'To\'lov havolasi olinmadi', detail: result.data });
    }

    // Bill ID ni saqlaymiz
    if (bill && bill.id) {
      await L.sb('/rest/v1/mh_payments?reference=eq.' + encodeURIComponent(reference), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ bill_id: bill.id })
      });
    }

    return L.send(res, 200, {
      ok: true,
      reference,
      paymentUrl,
      amountMinor: TZ.PRICE_MINOR,
      credits: TZ.CREDITS_PER_PAYMENT
    });
  } catch (e) {
    return L.send(res, 500, { ok: false, description: String((e && e.message) || e) });
  }
};
