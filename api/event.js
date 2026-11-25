const L = require('./_lib');
const ALLOWED = new Set(['download_pdf', 'download_xlsx', 'import_excel', 'refund']);
const MAP = { download_pdf: 'pdf', download_xlsx: 'xlsx' };

// SQL funksiyasi hali o'rnatilmaganini aniqlash (eski bazaga mos ishlash uchun).
function isMissingRpc(e) {
  return /could not find the function|PGRST202|404/i.test(String(e && e.message));
}

function statsOf(r) {
  return {
    credits: +((r && r.credits) || 0),
    downloads: +((r && r.downloads) || 0),
    premium: !!(r && r.premium)
  };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, description: 'method not allowed' });
  const token = L.getToken(req);
  const payload = L.verifyToken(token);
  if (!payload) return L.send(res, 401, { ok: false, description: 'Kirish talab qilinadi' });

  const kind = String((L.parseBody(req).kind) || '');
  if (!ALLOWED.has(kind)) return L.send(res, 400, { ok: false, description: 'noto\'g\'ri kind' });

  try {
    // uid token ichida imzolangan — bazadan qayta qidirmaymiz (1 so'rov tejaladi).
    let uid = L.uidFromPayload(payload);
    if (!uid) uid = await L.userIdFromToken(token); // eski tokenlar uchun zaxira
    if (!uid) return L.send(res, 401, { ok: false, description: 'Foydalanuvchi topilmadi' });

    // Bitta foydalanuvchi daqiqada 30 tadan ko'p amal qilmasin (loop/skript).
    if (!L.rateLimit('event:' + uid, 30, 60000)) {
      return L.send(res, 429, { ok: false, description: 'Juda ko\'p so\'rov. Bir daqiqadan keyin urinib ko\'ring' });
    }

    // Kreditni qaytarish: generatsiya muvaffaqiyatsiz bo'lsa mijoz shu kind ni yuboradi.
    // SQL funksiyasi 2 daqiqalik oyna va "bir marta" qoidasini o'zi ta'minlaydi.
    if (kind === 'refund') {
      try {
        const ok = await L.rpc('mh_refund_credit', { p_uid: uid });
        const stats = await L.getUserStats(uid);
        return L.send(res, 200, { ok: true, refunded: !!ok, stats: stats });
      } catch (e) {
        if (isMissingRpc(e)) return L.send(res, 200, { ok: true, refunded: false });
        console.error('[event] refund failed:', e.message);
        return L.send(res, 200, { ok: true, refunded: false });
      }
    }

    if (MAP[kind]) {
      // ---- Tez yo'l: bitta RPC kreditni kamaytiradi, hisoblagichni oshiradi
      // va yangi statistikani qaytaradi. Ilgari 4 ta so'rov ketardi:
      // userIdFromToken + mh_consume_credit + mh_bump + getUserStats.
      try {
        const r = await L.rpc('mh_download', { p_uid: uid });
        if (r && typeof r === 'object') {
          if (!r.ok) {
            return L.send(res, 402, { ok: false, description: 'Kreditlaringiz tugadi', stats: statsOf(r) });
          }
          return L.send(res, 200, { ok: true, stats: statsOf(r) });
        }
      } catch (e) {
        if (!isMissingRpc(e)) {
          console.error('[event] download RPC failed:', e.message);
          return L.send(res, 503, { ok: false, description: 'Kredit hisobi vaqtincha ishlamayapti' });
        }
        // SQL yangilanmagan — eski atomik yo'lga qaytamiz.
      }

      let consumed;
      try {
        consumed = await L.rpc('mh_consume_credit', { p_uid: uid });
      } catch (e) {
        console.error('[event] consume_credit RPC failed:', e.message);
        return L.send(res, 503, { ok: false, description: 'Kredit hisobi vaqtincha ishlamayapti' });
      }
      if (consumed !== true) return L.send(res, 402, { ok: false, description: 'Kreditlaringiz tugadi' });
      try { await L.bump(uid, MAP[kind]); } catch (e) { console.warn('[event] bump failed:', e.message); }
      return L.send(res, 200, { ok: true, stats: await L.getUserStats(uid) });
    }

    // import_excel — hisoblagichga ta'sir qilmaydi.
    return L.send(res, 200, { ok: true, stats: await L.getUserStats(uid) });
  } catch (e) {
    console.error('[event] handler error:', e && e.message);
    return L.send(res, 500, { ok: false, description: 'Ichki xatolik' });
  }
};
