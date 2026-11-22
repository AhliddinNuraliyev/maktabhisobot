const L = require('./_lib');
const ALLOWED = new Set(['download_pdf', 'download_xlsx', 'import_excel']);
const MAP = { download_pdf: 'pdf', download_xlsx: 'xlsx' };

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, description: 'method not allowed' });
  const token = L.getToken(req);
  if (!L.verifyToken(token)) return L.send(res, 401, { ok: false, description: 'Kirish talab qilinadi' });

  const kind = String((L.parseBody(req).kind) || '');
  if (!ALLOWED.has(kind)) return L.send(res, 400, { ok: false, description: 'noto\'g\'ri kind' });

  try {
    const uid = await L.userIdFromToken(token);
    if (!uid) return L.send(res, 401, { ok: false, description: 'Foydalanuvchi topilmadi' });
    if (MAP[kind]) {
      // Premium foydalanuvchining kreditini 1 ga kamaytirish.
      // DB funksiyasi faqat is_premium=true va download_credits>0 bo'lganda kamaytiradi.
      try {
        const consumed = await L.rpc('mh_consume_credit', { p_uid: uid });
        console.log('[event] consume_credit', kind, consumed);
      } catch (e) {
        console.warn('consume_credit', e.message);
      }
      try { await L.bump(uid, MAP[kind]); } catch (e) { console.warn('bump', e.message); }
    }
    const stats = await L.getUserStats(uid);
    return L.send(res, 200, { ok: true, stats: stats });
  } catch (e) {
    return L.send(res, 500, { ok: false, description: String((e && e.message) || e) });
  }
};
