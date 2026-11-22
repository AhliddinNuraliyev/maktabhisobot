const L = require('../_lib');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return L.send(res, 405, { ok: false, description: 'method not allowed' });

  const payload = L.verifyToken(L.getToken(req));
  if (!payload) return L.send(res, 401, { ok: false, description: 'Kirish talab qilinadi' });
  if (!L.isAdmin(payload)) return L.send(res, 403, { ok: false, description: "Ruxsat yo'q" });

  try {
    const users = await L.sb('/rest/v1/mh_users?select=id,telegram_id,username,first_name,last_name,viloyat,tuman,maktab,oqituvchi,is_premium,login_count,download_count,created_at,last_login_at&order=last_login_at.desc&limit=1000');

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
      created_at: u.created_at,
      last_login_at: u.last_login_at,
      logins: +(u.login_count || 0),
      downloads: +(u.download_count || 0)
    }));

    const totals = rows.reduce((a, r) => {
      a.users += 1;
      a.premium += r.premium ? 1 : 0;
      a.logins += r.logins;
      a.downloads += r.downloads;
      return a;
    }, { users: 0, premium: 0, logins: 0, downloads: 0 });

    return L.send(res, 200, { ok: true, count: rows.length, totals, users: rows });
  } catch (e) {
    return L.send(res, 500, { ok: false, description: String((e && e.message) || e) });
  }
};
