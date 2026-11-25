const crypto = require('crypto');
const L = require('./_lib');

// Vercel request body limiti ~4.5 MB. Base64 ~33% kattaroq bo'ladi,
// shuning uchun 3 MB dan katta faylni qabul qilmaymiz.
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_FILENAME = 120;
const ALLOWED_EXT = /\.(pdf|xlsx)$/i;

function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Telegram Mini App initData ni tekshiradi va foydalanuvchi ID sini qaytaradi.
// Manba: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData) {
  const token = botToken();
  if (!initData || !token) return null;

  let params;
  try { params = new URLSearchParams(String(initData)); } catch (e) { return null; }

  const hash = params.get('hash') || '';
  if (!hash) return null;

  params.delete('hash');
  const pairs = [];
  for (const [k, v] of params) pairs.push(k + '=' + v);
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (!safeEqualHex(calc, hash)) return null;

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) return null;

  try {
    const user = JSON.parse(params.get('user') || 'null');
    return user && user.id ? String(user.id) : null;
  } catch (e) { return null; }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, description: 'method not allowed' });
  }

  const body = L.parseBody(req);

  // 1) Kim so'rayapti? Mini App initData yoki sayt sessiyasi.
  const initId = verifyInitData(body.init_data);
  const session = L.verifyToken(L.getToken(req));
  const sessionId = session && session.sub ? String(session.sub) : '';
  const userId = initId || sessionId;

  if (!userId) {
    return res.status(401).json({ ok: false, description: 'Kirish talab qilinadi' });
  }

  // 2) Faqat o'ziga yuborishi mumkin.
  if (String(body.chat_id || '') !== userId) {
    return res.status(403).json({ ok: false, description: "Ruxsat yo'q" });
  }

  // 3) Fayl nomi va hajmini tekshirish.
  const filename = String(body.filename || '').trim();
  if (!filename || filename.length > MAX_FILENAME || !ALLOWED_EXT.test(filename)) {
    return res.status(400).json({ ok: false, description: "Fayl nomi noto'g'ri" });
  }

  const raw = String(body.data || '');
  if (!raw || raw.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 256) {
    return res.status(413).json({ ok: false, description: 'Fayl juda katta' });
  }

  const buf = Buffer.from(raw, 'base64');
  if (!buf.length || buf.length > MAX_FILE_BYTES) {
    return res.status(413).json({ ok: false, description: 'Fayl juda katta' });
  }

  // Mini App initData 24 soat yaroqli. Uni qayta ishlatib (replay) bot orqali
  // begona fayl yuborilmasligi uchun imzo + fayl kombinatsiyasini bir marta
  // ishlatiladigan kalit sifatida saqlaymiz (boshqa fayllarga ruxsat beriladi).
  if (initId) {
    try {
      const params = new URLSearchParams(String(body.init_data));
      const initHash = params.get('hash') || '';
      const authDate = Number(params.get('auth_date') || 0);
      const fileKey = crypto.createHash('sha256')
        .update(filename + '|' + raw).digest('hex').slice(0, 32);
      const used = await L.useAuthHash('send:' + initHash + ':' + fileKey, initId, authDate);
      if (!used) {
        return res.status(429).json({ ok: false, description: 'Bu so\'rov allaqachon bajarilgan' });
      }
    } catch (e) {
      console.error('[send] replay check failed:', e && e.message);
      return res.status(503).json({ ok: false, description: 'Tekshiruv vaqtincha ishlamayapti' });
    }
  }

  const token = botToken();
  if (!token) {
    console.error('[send] BOT_TOKEN / TELEGRAM_BOT_TOKEN sozlanmagan');
    return res.status(500).json({ ok: false, description: 'Bot sozlanmagan' });
  }

  try {
    const isPdf = /\.pdf$/i.test(filename);
    const fd = new FormData();
    fd.append('chat_id', userId);
    fd.append('caption', String(body.caption || filename).slice(0, 900));
    fd.append('document', new Blob([buf], {
      type: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }), filename);

    const r = await fetch('https://api.telegram.org/bot' + token + '/sendDocument', {
      method: 'POST',
      body: fd
    });
    const j = await r.json().catch(() => ({}));

    if (!r.ok || !j.ok) {
      console.error('[send] telegram error', r.status, j && j.description);
      return res.status(502).json({ ok: false, description: 'Telegramga yuborilmadi' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[send] error', e && e.message);
    return res.status(500).json({ ok: false, description: 'Ichki xatolik' });
  }
};
