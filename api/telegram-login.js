const L = require('./_lib');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, description: 'method not allowed' });

  const body = L.parseBody(req);
  const tg = L.verifyTelegram(body);
  if (!tg) return L.send(res, 401, { ok: false, description: 'Telegram malumoti tasdiqlanmadi yoki vaxti otdi' });

  try {
    const tid = String(tg.id);
    const profile = {
      first_name: String(tg.first_name || ''),
      last_name: String(tg.last_name || ''),
      username: String(tg.username || ''),
      photo_url: String(tg.photo_url || '')
    };
    let rows = await L.sb('/rest/v1/mh_users?telegram_id=eq.' + encodeURIComponent(tid) + '&select=*&limit=1');
    let user;
    if (rows && rows.length) {
      user = rows[0];
      await L.sb('/rest/v1/mh_users?id=eq.' + encodeURIComponent(user.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(profile)
      });
    } else {
      const created = await L.sb('/rest/v1/mh_users', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(Object.assign({ telegram_id: tid }, profile))
      });
      user = Array.isArray(created) ? created[0] : created;
    }
    const token = L.signToken({ sub: tid, uid: user.id, name: tg.first_name || tg.username || 'Foydalanuvchi' });
    return L.send(res, 200, {
      ok: true,
      user: {
        id: user.id,
        telegram_id: tid,
        first_name: profile.first_name,
        last_name: profile.last_name,
        username: profile.username,
        photo_url: profile.photo_url
      }
    }, { 'Set-Cookie': L.cookie(token) });
  } catch (e) {
    return L.send(res, 500, { ok: false, description: String((e && e.message) || e) });
  }
};
