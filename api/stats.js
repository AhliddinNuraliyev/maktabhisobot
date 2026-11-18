const { put, list } = require('@vercel/blob');

const PREFIX = { pdf: 'dl/pdf/', xlsx: 'dl/xlsx/' };
const MAX_PAGES = 25;

async function countKind(kind) {
  let total = 0, cursor = undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const r = await list({ prefix: PREFIX[kind], cursor, limit: 1000 });
    total += r.blobs.length;
    if (!r.hasMore || !r.cursor) break;
    cursor = r.cursor;
  }
  return total;
}

async function totals() {
  const [pdf, xlsx] = await Promise.all([countKind('pdf'), countKind('xlsx')]);
  return { pdf, xlsx, all: pdf + xlsx };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, counts: await totals() });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      const kind = String((body && body.kind) || '').toLowerCase();
      if (kind !== 'pdf' && kind !== 'xlsx') {
        return res.status(400).json({ ok: false, description: 'kind must be pdf or xlsx' });
      }
      const key = PREFIX[kind] + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      const before = await totals();
      await put(key, '1', { access: 'private', addRandomSuffix: false, contentType: 'text/plain', cacheControlMaxAge: 60 });
      before[kind] += 1;
      before.all = before.pdf + before.xlsx;
      return res.status(200).json({ ok: true, counts: before });
    }

    return res.status(405).json({ ok: false, description: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ ok: false, description: String((e && e.message) || e) });
  }
};
