import crypto from 'crypto';

function hmacSHA256(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('base64');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path, api } = req.query;
  if (!path) return res.status(400).json({ error: 'No path provided' });

  const decodedPath = decodeURIComponent(Array.isArray(path) ? path.join('/') : path);
  
  // api=data uses Data API, default is CLOB API
  const baseUrl = api === 'data' 
    ? 'https://data-api.polymarket.com/' 
    : 'https://clob.polymarket.com/';
  
  const url = baseUrl + decodedPath;

  let credentials = null;
  let bodyToForward = undefined;

  if (req.method === 'POST' && req.body) {
    const { _creds, ...rest } = req.body;
    credentials = _creds || null;
    bodyToForward = Object.keys(rest).length > 0 ? JSON.stringify(rest) : undefined;
  }

  const { apiKey, secret, passphrase, address } = req.query;
  if (!credentials && apiKey && secret && passphrase && address) {
    credentials = { apiKey, secret, passphrase, address };
  }

  const headers = { 'Content-Type': 'application/json' };

  if (credentials) {
    const { apiKey: key, secret: sec, passphrase: pass, address: addr } = credentials;
    const ts = Math.floor(Date.now() / 1000).toString();
    const bodyStr = bodyToForward || '';
    const message = ts + req.method.toUpperCase() + '/' + decodedPath + bodyStr;
    const signature = hmacSHA256(sec, message);

    headers['POLY_ADDRESS'] = addr;
    headers['POLY_API_KEY'] = key;
    headers['POLY_SIGNATURE'] = signature;
    headers['POLY_TIMESTAMP'] = ts;
    headers['POLY_PASSPHRASE'] = pass;
  }

  try {
    const fetchOptions = { method: req.method, headers };
    if (bodyToForward) fetchOptions.body = bodyToForward;

    const r = await fetch(url, fetchOptions);
    const contentType = r.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const d = await r.json();
      return res.status(r.status).json(d);
    } else {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Non-JSON response', body: text.slice(0, 500) });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
