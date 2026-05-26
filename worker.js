export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    if (path === '_ip') {
      const ipResp = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResp.json();
      return new Response(JSON.stringify({ outboundIP: ipData.ip, colo: request.cf?.colo, country: request.cf?.country }), { headers: cors });
    }

    if (!path) return new Response(JSON.stringify({ error: 'No path' }), { status: 400, headers: cors });

    const api     = url.searchParams.get('api');
    const baseUrl = api === 'data' ? 'https://data-api.polymarket.com/' : 'https://clob.polymarket.com/';
    const decoded = decodeURIComponent(path);
    const target  = baseUrl + decoded;

    const apiKey     = url.searchParams.get('apiKey');
    const secret     = url.searchParams.get('secret');
    const passphrase = url.searchParams.get('passphrase');
    const address    = url.searchParams.get('address');

    let bodyText = undefined;
    if (request.method === 'POST') bodyText = await request.text();

    // POST body may contain _creds — strip them, keep order fields
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
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://polymarket.com',
      'Referer': 'https://polymarket.com/',
    };

    if (apiKey && secret && passphrase && address) {
      const ts      = Math.floor(Date.now() / 1000).toString();
      const bodyStr = forwardBody || '';
      const message = ts + request.method + '/' + decoded + bodyStr;

      const keyBytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
      const key = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
      const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

      headers['POLY_ADDRESS']    = address;
      headers['POLY_API_KEY']    = apiKey;
      headers['POLY_SIGNATURE']  = signature;
      headers['POLY_TIMESTAMP']  = ts;
      headers['POLY_PASSPHRASE'] = passphrase;
    }

    const opts = { method: request.method, headers };
    if (forwardBody) opts.body = forwardBody;

    const r    = await fetch(target, opts);
    const body = await r.text();

    return new Response(body, {
      status: r.status,
      headers: { ...cors, 'Content-Type': r.headers.get('Content-Type') || 'application/json' },
    });
  }
};
