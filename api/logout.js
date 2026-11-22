const L = require('./_lib');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, description: 'method not allowed' });
  return L.send(res, 200, { ok: true }, { 'Set-Cookie': L.clearCookie() });
};
