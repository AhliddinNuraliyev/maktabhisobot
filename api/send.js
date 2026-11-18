module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, description: 'method not allowed' });
  try {
    const body = req.body || {};
    const chat_id = body.chat_id, filename = body.filename, caption = body.caption, data = body.data;
    if (!chat_id || !filename || !data) return res.status(400).json({ ok: false, description: 'chat_id, filename, data required' });
    const token = process.env.BOT_TOKEN;
    if (!token) return res.status(500).json({ ok: false, description: 'BOT_TOKEN missing' });
    const buf = Buffer.from(String(data), 'base64');
    if (!buf.length) return res.status(400).json({ ok: false, description: 'empty file' });
    const isPdf = /\.pdf$/i.test(filename);
    const fd = new FormData();
    fd.append('chat_id', String(chat_id));
    fd.append('caption', caption || filename);
    fd.append('document', new Blob([buf], { type: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
    const r = await fetch('https://api.telegram.org/bot' + token + '/sendDocument', { method: 'POST', body: fd });
    const j = await r.json();
    return res.status(200).json(j);
  } catch (e) { return res.status(500).json({ ok: false, description: String((e && e.message) || e) }); }
};
