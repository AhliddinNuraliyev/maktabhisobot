const L = require('./_lib');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Boshqa Telegram akkaunti bilan kirish:
  // GET /api/logout?switch=1&return_to=/bsb sayt sessiyasini o'chiradi va
  // brauzerni oauth.telegram.org/auth/logout ga yo'naltiradi. Telegram o'z
  // keshini tozalagach, yana saytga qaytadi va mh_switch cookie kirish
  // oynasini ochadi. return_to faqat o'z saytimiz ichidagi yo'l bo'lishi mumkin.
  const switching = req.method === 'GET' && String((req.query && req.query.switch) || '') === '1';
  if (switching) {
    // CSRF: faqat o'z saytimizdan kelgan yuqori darajali o'tishga ruxsat.
    // SameSite=Lax cookie cross-site GET navigatsiyada ham yuboriladi, shuning
    // uchun brauzerning Fetch Metadata sarlavhasini tekshiramiz.
    const h = req.headers || {};
    const site = String(h['sec-fetch-site'] || '').toLowerCase();
    const ownOrigin = L.requestOrigin(req);
    const reqOrigin = String(h.origin || '').replace(/\/$/, '');
    if ((site && site !== 'same-origin' && site !== 'none') ||
        (reqOrigin && ownOrigin && reqOrigin !== ownOrigin)) {
      return L.send(res, 403, { ok: false, description: 'Noto\'g\'ri so\'rov manbasi' });
    }
    const origin = ownOrigin;
    const botId = await L.getBotId();
    const rawReturn = String((req.query && req.query.return_to) || '') || '/';
    let returnTo = '/';
    try {
      const u = new URL(rawReturn, origin || 'https://localhost');
      if (u.origin === (origin || 'https://localhost') && u.pathname.charAt(0) === '/') {
        returnTo = u.pathname + u.search + u.hash;
      }
    } catch (e) { /* xato qiymat — asosiy sahifaga qaytamiz */ }
    const secure = L.isSecureRequest(req) ? ' Secure;' : '';
    res.setHeader('Set-Cookie', [
      L.clearCookie(req),
      'mh_switch=1; Path=/; Max-Age=180; SameSite=Lax;' + secure,
      'mh_return=' + encodeURIComponent(returnTo) + '; Path=/; Max-Age=180; SameSite=Lax;' + secure
    ]);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (!botId || !origin) {
      res.setHeader('Location', '/?tgswitch=1');
      return res.status(302).end();
    }
    const target = 'https://oauth.telegram.org/auth/logout?bot_id=' +
      encodeURIComponent(botId) + '&origin=' + encodeURIComponent(origin);
    res.setHeader('Location', target);
    return res.status(302).end();
  }

  if (req.method !== 'POST') return L.send(res, 405, { ok: false, description: 'method not allowed' });
  return L.send(res, 200, { ok: true }, { 'Set-Cookie': L.clearCookie(req) });
};
