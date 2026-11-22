const L = require('../_lib');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return L.send(res, 405, { ok: false, description: 'method not allowed' });

  const payload = L.verifyToken(L.getToken(req));
  if (!payload) return L.send(res, 401, { ok: false, description: 'Kirish talab qilinadi' });
  if (!L.isAdmin(payload)) return L.send(res, 403, { ok: false, description: "Ruxsat yo'q" });

  try {
    const users = await L.sb('/rest/v1/mh_users?select=id,telegram_id,username,first_name,last_name,viloyat,tuman,maktab,oqituvchi,is_premium,download_count&order=id.asc&limit=1000');

    const rows = (users || []).map(u => ({
      id: u.id,
      telegram_id: String(u.telegram_id),
      username: u.username || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      viloyat: u.viloyat || '',
      tuman: u.tuman || '',
      maktab: u.maktab || '',
      oqituvchi: u.oqituvchi || '',
      premium: !!u.is_premium,
      downloads: +(u.download_count || 0)
    }));

    const totals = rows.reduce((a, r) => {
      a.users += 1;
      a.premium += r.premium ? 1 : 0;
      return a;
    }, { users: 0, premium: 0 });

    return L.send(res, 200, { ok: true, count: rows.length, totals, users: rows });
  } catch (e) {
    return L.send(res, 500, { ok: false, description: String((e && e.message) || e) });
  }
};
