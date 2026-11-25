const L = require('../_lib');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, description: 'method not allowed' });

  const payload = L.verifyToken(L.getToken(req));
  if (!payload) return L.send(res, 401, { ok: false, description: 'Kirish talab qilinadi' });
  if (!L.isAdmin(payload)) return L.send(res, 403, { ok: false, description: "Ruxsat yo'q" });

  try {
    const b = L.parseBody(req);
    const id = String(b.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return L.send(res, 400, { ok: false, description: 'id noto`g`ri' });
    const premium = !!b.premium;

    await L.sb('/rest/v1/mh_users?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_premium: premium })
    });

    return L.send(res, 200, { ok: true, id: id, premium: premium });
  } catch (e) {
    console.error('[admin] premium error:', e && e.message);
    return L.send(res, 500, { ok: false, description: 'Tarif o\'zgartirilmadi' });
  }
};
