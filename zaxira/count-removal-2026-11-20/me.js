const L = require('./_lib');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  const payload = L.verifyToken(L.getToken(req));
  const base = { ok: true, botUsername: await L.getBotUsername(), isAdmin: L.isAdmin(payload) };
  if (!payload) return L.send(res, 200, Object.assign({}, base, { authenticated: false }));

  try {
    const rows = await L.sb('/rest/v1/mh_users?telegram_id=eq.' + encodeURIComponent(String(payload.sub)) + '&select=*&limit=1');
    if (!rows || !rows.length) return L.send(res, 200, Object.assign({}, base, { authenticated: false }));
    const user = rows[0];
    const stats = await L.getUserStats(user.id);
    return L.send(res, 200, Object.assign({}, base, {
      authenticated: true,
      user: {
        id: user.id,
        telegram_id: String(user.telegram_id),
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        username: user.username || '',
        photo_url: user.photo_url || '',
        premium: !!user.is_premium
      },
      profile: {
        viloyat: user.viloyat || '',
        tuman: user.tuman || '',
        maktab: user.maktab || '',
        oqituvchi: user.oqituvchi || ''
      },
      premium: !!user.is_premium,
      stats: stats
    }));
  } catch (e) {
    return L.send(res, 200, Object.assign({}, base, {
      authenticated: false, warning: String((e && e.message) || e)
    }));
  }
};
