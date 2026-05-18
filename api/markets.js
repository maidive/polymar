let cache = null;
let cacheAt = 0;
const TTL = 30_000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (cache && Date.now() - cacheAt < TTL) {
    return res.status(200).json(cache);
  }

  try {
    const r = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=500'
    );
    const data = await r.json();
    cache = data;
    cacheAt = Date.now();
    return res.status(200).json(data);
  } catch (e) {
    if (cache) return res.status(200).json(cache);
    return res.status(500).json({ error: e.message });
  }
}
