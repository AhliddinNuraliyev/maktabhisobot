const L = require('./_lib');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  const payload = L.verifyToken(L.getToken(req));
  const base = { ok: true, botUsername: await L.getBotUsername(), isAdmin: L.isAdmin(payload) };
  if (!payload) return L.send(res, 200, Object.assign({}, base, { authenticated: false }));

  try {
    // Faqat kerakli ustunlar: select=* ortiqcha ma'lumot (va egress) qaytaradi.
    const rows = await L.sb('/rest/v1/mh_users?telegram_id=eq.' + encodeURIComponent(String(payload.sub)) +
      '&select=id,telegram_id,first_name,last_name,username,photo_url,is_premium,download_credits,download_count,viloyat,tuman,maktab,oqituvchi&limit=1');
    if (!rows || !rows.length) return L.send(res, 200, Object.assign({}, base, { authenticated: false }));
    const user = rows[0];
    // Kredit faqat kirish paytida atomik RPC bilan beriladi (mh_grant_signup_bonus).
    // /api/me faqat o'qiydi. Statistika allaqachon kelgan qatordan olinadi —
    // ilgari getUserStats alohida so'rov yuborardi (bir chaqiruvda 2 so'rov edi).
    const stats = {
      downloads: +(user.download_count || 0),
      premium: !!user.is_premium,
      credits: +(user.download_credits || 0)
    };
    return L.send(res, 200, Object.assign({}, base, {
      authenticated: true,
      user: {
        id: user.id,
        telegram_id: String(user.telegram_id),
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        username: user.username || '',
        photo_url: user.photo_url || '',
        premium: !!user.is_premium,
        credits: +(user.download_credits || 0)
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
    console.warn('[me] load failed:', e && e.message);
    return L.send(res, 200, Object.assign({}, base, {
      authenticated: false, warning: 'Ma\'lumotlar vaqtincha olinmadi'
    }));
  }
};
