const L = require('../../_lib');
const TZ = require('../_tz');

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// Tezcheck to'lov ma'lumotlarini data.* yoki data.payment.* ichida yuborishi mumkin.
// Ikkala shaklni ham qo'llab-quvvatlaymiz.
function fields(event) {
  const d = (event && event.data) || {};
  const p = d.payment || {};
  const b = d.bill || {};
  const pick = (...keys) => {
    for (const k of keys) {
      for (const src of [d, p, b]) {
        const v = src[k];
        if (v != null) return v;
      }
    }
    return null;
  };
  return {
    billId: String(pick('bill_id', 'bill') || ''),
    reference: String(pick('external_reference', 'external_ref') || ''),
    paymentId: String(pick('payment_id') || ''),
    state: String(pick('state') || ''),
    environment: String(pick('environment') || ''),
    amountMinor: Number(pick('amount_minor') || 0),
    feeMinor: Number(pick('fee_minor') || 0),
    netMinor: Number(pick('net_minor') || 0),
    problem: d.problem || p.problem || null
  };
}

exports.POST = async function (request) {
  try {
    const rawBody = await request.text();
    const headers = {};
    request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    // 1) Imzo tekshiruvi
    const check = TZ.verifyWebhook(rawBody, headers);
    if (!check.ok) {
      if (check.reason === 'secret_not_configured') {
        console.error('[tezcheck] WEBHOOK_SECRET sozlanmagan — to\'lovlar qabul qilinmayapti');
        return json({ received: false, reason: 'secret_not_configured' }, 503);
      }
      return json({ received: false, reason: check.reason }, 401);
    }

    let event;
    try { event = JSON.parse(rawBody); } catch (e) {
      return json({ received: false, reason: 'invalid_json' }, 400);
    }

    const eventId = String(event.id || '');
    if (!eventId) return json({ received: false, reason: 'missing_event_id' }, 400);

    // 2) Dedup
    try {
      const seen = await L.sb('/rest/v1/mh_webhook_events?id=eq.' + encodeURIComponent(eventId) + '&select=id&limit=1');
      if (seen && seen.length) return json({ received: true, duplicate: true }, 200);
    } catch (e) {
      console.warn('[tezcheck] dedup check:', e.message);
    }

    const type = String(event.type || '');
    if (!type.startsWith('payment.')) return json({ received: true, ignored: 'not_payment', type }, 200);

    const f = fields(event);
    const problem = f.problem;
    const problemCategory = problem ? String(problem.category || 'unknown') : null;

    // 3) To'lovni topish: bill_id (eng ishonchli) yoki external_reference
    let payment = null;
    let matchedBy = null;
    if (f.billId) {
      try {
        const rows = await L.sb('/rest/v1/mh_payments?bill_id=eq.' + encodeURIComponent(f.billId) + '&select=*&limit=1');
        payment = rows && rows.length ? rows[0] : null;
        if (payment) matchedBy = 'bill_id';
      } catch (e) { console.warn('[tezcheck] bill lookup:', e.message); }
    }
    if (!payment && f.reference) {
      try {
        const rows = await L.sb('/rest/v1/mh_payments?reference=eq.' + encodeURIComponent(f.reference) + '&select=*&limit=1');
        payment = rows && rows.length ? rows[0] : null;
        if (payment) matchedBy = 'reference';
      } catch (e) { console.warn('[tezcheck] ref lookup:', e.message); }
    }
    if (!payment) {
      return json({ received: true, ignored: 'unknown_reference', lookedFor: { billId: f.billId, reference: f.reference } }, 200);
    }

    // 4) Natija noma'lum bo'lsa hech narsa qilmaymiz
    if (problem && problem.unknown_reason != null) {
      return json({ received: true, ignored: 'unknown_result' }, 200);
    }

    const succeeded = (f.state === 'succeeded') && !problemCategory;
    const environment = f.environment || payment.environment || 'test';
    // Idempotency: SQL funksiyasi FOR UPDATE bilan qulflaydi va credits_granted ni
    // tekshiradi. Bu tekshiruv esa eski SQL o'rnatilmagan holatda ham zaxira himoya.
    const alreadyGranted = payment.state === 'succeeded' && Number(payment.credits_granted || 0) > 0;
    const credits = (!alreadyGranted && succeeded && environment === 'live') ? TZ.CREDITS_PER_PAYMENT : 0;

    // 5) Atomik yangilash
    let granted = 0;
    try {
      granted = await L.rpc('mh_grant_payment', {
        p_reference: payment.reference,
        p_user_id: payment.user_id,
        p_bill_id: f.billId || payment.bill_id || '',
        p_payment_id: f.paymentId || '',
        p_amount_minor: f.amountMinor || payment.amount_minor,
        p_net_minor: f.netMinor || f.amountMinor,
        p_fee_minor: f.feeMinor || 0,
        p_environment: environment,
        p_credits: credits,
        p_problem_category: problemCategory,
        // Holatni to'g'ridan-to'g'ri yuboramiz: payment.processing kabi
        // hodisalarda problem null bo'ladi, lekin to'lov hali tugamagan.
        p_state: f.state || '',
        p_succeeded: succeeded
      });
    } catch (e) {
      console.error('[tezcheck] grant failed:', e.message);
      return json({ received: false, reason: 'grant_failed' }, 500);
    }

    // 6) Dedup belgisi
    try {
      await L.sb('/rest/v1/mh_webhook_events', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ id: eventId, type: type })
      });
    } catch (e) {
      console.warn('[tezcheck] event mark:', e.message);
    }

    return json({
      received: true,
      state: f.state,
      environment,
      credits_granted: Number(granted) || credits,
      matchedBy
    });
  } catch (e) {
    console.error('[tezcheck] handler error:', e);
    return json({ received: false, reason: 'internal_error' }, 500);
  }
};
