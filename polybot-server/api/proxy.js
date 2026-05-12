export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'No path' });

  const url = 'https://clob.polymarket.com/' + decodeURIComponent(Array.isArray(path) ? path.join('/') : path);

  const headers = { 'Content-Type': 'application/json' };
  ['POLY_ADDRESS','POLY_API_KEY','POLY_SIGNATURE','POLY_TIMESTAMP','POLY_PASSPHRASE','POLY_NONCE'].forEach(h => {
    const v = req.headers[h.toLowerCase()];
    if (v) headers[h] = v;
  });

  try {
    const r = await fetch(url, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
    });
    const d = await r.json();
    return res.status(r.status).json(d);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
