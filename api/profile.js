const L = require('./_lib');

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, description: 'method not allowed' });

  const token = L.getToken(req);
  if (!L.verifyToken(token)) return L.send(res, 401, { ok: false, description: 'Kirish talab qilinadi' });

  try {
    const uid = await L.userIdFromToken(token);
    if (!uid) return L.send(res, 401, { ok: false, description: 'Foydalanuvchi topilmadi' });

    const b = L.parseBody(req);
    const profile = {
      viloyat: clean(b.viloyat, 80),
      tuman: clean(b.tuman, 80),
      maktab: clean(b.maktab, 40),
      oqituvchi: clean(b.oqituvchi, 120)
    };

    await L.sb('/rest/v1/mh_users?id=eq.' + encodeURIComponent(uid), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(profile)
    });

    return L.send(res, 200, { ok: true, profile: profile });
  } catch (e) {
    return L.send(res, 500, { ok: false, description: String((e && e.message) || e) });
  }
};
