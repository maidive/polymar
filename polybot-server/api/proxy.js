export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'No path' });

  const decodedPath = decodeURIComponent(path);
  const url = `https://clob.polymarket.com/${decodedPath}`;

  const headers = { 'Content-Type': 'application/json' };
  const forward = ['POLY_ADDRESS','POLY_API_KEY','POLY_SIGNATURE','POLY_TIMESTAMP','POLY_PASSPHRASE','POLY_NONCE'];
  forward.forEach(h => {
    const val = req.headers[h.toLowerCase()] || req.headers[h];
    if (val) headers[h] = val;
  });

  const fetchOpts = { method: req.method, headers };
  if (req.method === 'POST' && req.body) {
    fetchOpts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const r = await fetch(url, fetchOpts);
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
