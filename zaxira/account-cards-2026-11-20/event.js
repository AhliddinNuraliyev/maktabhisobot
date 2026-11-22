const L = require('./_lib');
const ALLOWED = new Set(['import_excel']);

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
    const stats = await L.getUserStats(uid);
    return L.send(res, 200, { ok: true, stats: stats });
  } catch (e) {
    return L.send(res, 500, { ok: false, description: String((e && e.message) || e) });
  }
};
