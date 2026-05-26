// Vercel Serverless Function (Node.js) — AWS fra1 Frankfurt, не Cloudflare IP

async function hmac(secret, message) {
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', Buffer.from(secret, 'base64'))
    .update(message)
    .digest('base64');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url    = new URL(req.url, 'http://localhost');
  const path   = url.searchParams.get('path');
  const api    = url.searchParams.get('api');

  if (!path) return res.status(400).json({ error: 'No path' });

  const decoded = decodeURIComponent(path);
  const base    = api === 'data' ? 'https://data-api.polymarket.com/' : 'https://clob.polymarket.com/';
  const target  = base + decoded;

  const apiKey     = url.searchParams.get('apiKey');
  const secret     = url.searchParams.get('secret');
  const passphrase = url.searchParams.get('passphrase');
  const address    = url.searchParams.get('address');

  let bodyText = undefined;
  if (req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    bodyText = Buffer.concat(chunks).toString();
  }

  let forwardBody = bodyText;
  if (bodyText) {
    try {
      const { _creds, ...rest } = JSON.parse(bodyText);
      forwardBody = Object.keys(rest).length ? JSON.stringify(rest) : undefined;
    } catch(e) {}
  }

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://polymarket.com',
    'Referer': 'https://polymarket.com/',
  };

  if (apiKey && secret && passphrase && address) {
    const ts      = Math.floor(Date.now() / 1000).toString();
    const bodyStr = forwardBody || '';
    const message = ts + req.method + '/' + decoded + bodyStr;
    const sig     = await hmac(secret, message);

    headers['POLY_ADDRESS']    = address;
    headers['POLY_API_KEY']    = apiKey;
    headers['POLY_SIGNATURE']  = sig;
    headers['POLY_TIMESTAMP']  = ts;
    headers['POLY_PASSPHRASE'] = passphrase;
  }

  const opts = { method: req.method, headers };
  if (forwardBody) opts.body = forwardBody;

  const r    = await fetch(target, opts);
  const body = await r.text();

  res.setHeader('Content-Type', r.headers.get('Content-Type') || 'application/json');
  return res.status(r.status).send(body);
}
