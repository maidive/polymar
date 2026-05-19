export const config = { runtime: 'edge' };

async function hmac(secret, message) {
  const keyBytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const url     = new URL(req.url);
  const path    = url.searchParams.get('path');
  const api     = url.searchParams.get('api');

  if (!path) return new Response(JSON.stringify({ error: 'No path' }), { status: 400, headers: cors });

  const decoded = decodeURIComponent(path);
  const base    = api === 'data' ? 'https://data-api.polymarket.com/' : 'https://clob.polymarket.com/';
  const target  = base + decoded;

  const apiKey     = url.searchParams.get('apiKey');
  const secret     = url.searchParams.get('secret');
  const passphrase = url.searchParams.get('passphrase');
  const address    = url.searchParams.get('address');

  let bodyText = undefined;
  if (req.method === 'POST') bodyText = await req.text();

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

  return new Response(body, {
    status: r.status,
    headers: {
      ...cors,
      'Content-Type': r.headers.get('Content-Type') || 'application/json',
    },
  });
}
