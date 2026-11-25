const L = require('./_lib');

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, description: 'method not allowed' });

  const token = L.getToken(req);
  const payload = L.verifyToken(token);
  if (!payload) return L.send(res, 401, { ok: false, description: 'Kirish talab qilinadi' });

  try {
    // uid tokendan olinadi — bazaga ortiqcha so'rov ketmaydi.
    const uid = L.uidFromPayload(payload) || await L.userIdFromToken(token);
    if (!uid) return L.send(res, 401, { ok: false, description: 'Foydalanuvchi topilmadi' });

    const b = L.parseBody(req);
    const profile = {
      viloyat: clean(b.viloyat, 80),
      tuman: clean(b.tuman, 80),
      maktab: clean(b.maktab, 40),
      oqituvchi: clean(b.oqituvchi, 120)
    };

    // Maktab raqami faqat raqam bo'lishi kerak (inputmode faqat UI da ishlaydi)
    const school = profile.maktab.replace(/\s+/g, '');
    if (school && !/^\d{1,4}$/.test(school)) {
      return L.send(res, 400, { ok: false, description: 'Maktab raqami faqat raqamlardan iborat bo\'lishi kerak' });
    }
    profile.maktab = school;

    await L.sb('/rest/v1/mh_users?id=eq.' + encodeURIComponent(uid), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(profile)
    });

    return L.send(res, 200, { ok: true, profile: profile });
  } catch (e) {
    console.error('[profile] save error:', e && e.message);
    return L.send(res, 500, { ok: false, description: 'Ma\'lumotlar saqlanmadi' });
  }
};
