const L = require('../_lib');
const TZ = require('./_tz');

// Foydalanuvchi o'z to'lov holatini so'raydi. Agar webhook kelmay qolgan
// bo'lsa, Tezcheckdan to'g'ridan-to'g'ri so'rab kreditni tiklaymiz.
async function reconcile(payment) {
  // Kredit berilgan bo'lsa, holat 'succeeded' bo'lsa ham qayta tekshirish shart emas.
  // Lekin eski xato tufayli 'succeeded' + 0 kredit bo'lib qolgan to'lovlarni tiklaymiz.
  if (!payment || Number(payment.credits_granted || 0) > 0 || !payment.bill_id) return false;
  const r = await TZ.tzRequest('/bills/' + encodeURIComponent(payment.bill_id), { method: 'POST' });
  const d = r.data && r.data.data;
  const bill = d && d.bill;
  const pay = d && d.payment;
  if (!r.ok || !bill || !bill.paid || !pay || pay.state !== 'succeeded') return false;

  // SQL funksiyasi qatorni FOR UPDATE bilan qulflaydi: webhook bilan poyga bo'lsa ham
  // kredit ikki marta berilmaydi. Qaytgan son — haqiqatda berilgan kreditlar.
  await L.rpc('mh_grant_payment', {
    p_reference: payment.reference,
    p_user_id: payment.user_id,
    p_bill_id: bill.id,
    p_payment_id: pay.id,
    p_amount_minor: Number(pay.amount_minor || 0),
    p_net_minor: Number(pay.net_minor || 0),
    p_fee_minor: Number(pay.fee_minor || 0),
    p_environment: String(bill.environment || 'test'),
    p_credits: bill.environment === 'live' ? TZ.CREDITS_PER_PAYMENT : 0,
    p_problem_category: null,
    p_state: 'succeeded',
    p_succeeded: true
  });
  return true;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return L.send(res, 405, { ok: false });

  const token = L.getToken(req);
  const payload = L.verifyToken(token);
  if (!payload || !payload.sub) return L.send(res, 401, { ok: false, description: 'Kirish talab qilinadi' });

  try {
    // uid tokendan — qo'shimcha SELECT yo'q.
    const uid = L.uidFromPayload(payload) || await L.userIdFromToken(token);
    if (!uid) return L.send(res, 401, { ok: false });

    const reference = String((req.method === 'GET'
      ? (new URL(req.url || '/', 'https://x').searchParams.get('ref') || '')
      : (L.parseBody(req).reference || ''))).trim();

    let rows;
    if (reference) {
      rows = await L.sb('/rest/v1/mh_payments?reference=eq.' + encodeURIComponent(reference) +
        '&user_id=eq.' + encodeURIComponent(uid) +
        '&select=reference,state,environment,credits_granted,bill_id,user_id&limit=1');
    } else {
      rows = await L.sb('/rest/v1/mh_payments?user_id=eq.' + encodeURIComponent(uid) +
        '&select=reference,state,environment,credits_granted,bill_id,user_id&order=created_at.desc&limit=1');
    }

    // Faqat aniq so'rov bo'lgandagina Tezcheckga murojaat (har safar emas)
    let recovered = false;
    const wantCheck = String((new URL(req.url || '/', 'https://x')).searchParams.get('check') || '') === '1';
    if (wantCheck && rows && rows.length &&
        Number(rows[0].credits_granted || 0) === 0 && rows[0].bill_id &&
        rows[0].state !== 'failed' && rows[0].state !== 'canceled') {
      try {
        recovered = await reconcile(rows[0]);
        if (recovered) {
          rows = await L.sb('/rest/v1/mh_payments?reference=eq.' + encodeURIComponent(rows[0].reference) +
            '&select=reference,state,environment,credits_granted&limit=1');
        }
      } catch (e) {
        console.warn('[billing] reconcile failed:', e.message);
      }
    }

    const user = await L.sb('/rest/v1/mh_users?id=eq.' + encodeURIComponent(uid) +
      '&select=is_premium,download_credits,download_count&limit=1');
    const u = user && user.length ? user[0] : {};

    return L.send(res, 200, {
      ok: true,
      recovered: recovered,
      payment: rows && rows.length ? {
        reference: rows[0].reference,
        state: rows[0].state,
        environment: rows[0].environment,
        creditsGranted: rows[0].credits_granted
      } : null,
      premium: !!u.is_premium,
      credits: +(u.download_credits || 0),
      downloads: +(u.download_count || 0)
    });
  } catch (e) {
    console.error('[billing] status error:', e && e.message);
    return L.send(res, 500, { ok: false, description: 'To\'lov holati olinmadi' });
  }
};
