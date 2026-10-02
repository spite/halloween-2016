const SC_TOKEN_URL = 'https://secure.soundcloud.com/oauth/token';
const SC_API = 'https://api.soundcloud.com';
const SC_HOSTS = ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com'];
const TOKEN_KEY = 'sc-token';

let memoryToken = null;

function allowedOrigin(origin, env) {
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) return origin;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')) return origin;
  } catch (e) {}
  return null;
}

function json(body, status, origin) {
  const headers = { 'Content-Type': 'application/json', 'Vary': 'Origin' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

// Client-credentials tokens are rate limited by SoundCloud, so share one across isolates via KV.
async function getToken(env, force) {
  const now = Date.now();
  if (!force && memoryToken && memoryToken.expires > now) return memoryToken.token;
  if (!force) {
    const stored = await env.TOKENS.get(TOKEN_KEY, 'json');
    if (stored && stored.expires > now) {
      memoryToken = stored;
      return stored.token;
    }
  }
  const res = await fetch(SC_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(env.SC_CLIENT_ID + ':' + env.SC_CLIENT_SECRET),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('token request failed: ' + res.status);
  const data = await res.json();
  const ttl = Math.max(60, data.expires_in - 300);
  memoryToken = { token: data.access_token, expires: now + ttl * 1000 };
  await env.TOKENS.put(TOKEN_KEY, JSON.stringify(memoryToken), { expirationTtl: ttl });
  return memoryToken.token;
}

async function scFetch(env, url, init = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken(env, attempt > 0);
    const res = await fetch(url, {
      ...init,
      headers: { 'Authorization': 'OAuth ' + token, 'Accept': 'application/json' },
    });
    if (res.status !== 401) return res;
  }
  throw new Error('SoundCloud rejected the token');
}

async function resolve(env, songURL) {
  const res = await scFetch(env, SC_API + '/resolve?url=' + encodeURIComponent(songURL));
  if (res.status === 404) return { status: 404, body: { error: 'Track not found' } };
  if (!res.ok) return { status: 502, body: { error: 'SoundCloud resolve failed (' + res.status + ')' } };
  const track = await res.json();
  if (track.kind !== 'track') return { status: 400, body: { error: 'Only track URLs are supported' } };
  if (track.access !== 'playable') return { status: 403, body: { error: 'This track is not playable outside SoundCloud' } };

  const streamsRes = await scFetch(env, SC_API + '/tracks/' + encodeURIComponent(track.urn) + '/streams');
  if (!streamsRes.ok) return { status: 502, body: { error: 'SoundCloud streams failed (' + streamsRes.status + ')' } };
  const streams = await streamsRes.json();
  const streamURL = streams.hls_mp3_128_url || streams.hls_aac_160_url || streams.http_mp3_128_url;
  if (!streamURL) return { status: 403, body: { error: 'No full-length stream available' } };

  // The stream endpoint needs the token, so follow its redirect here and hand back the signed CDN URL.
  const redirect = await scFetch(env, streamURL, { redirect: 'manual' });
  const location = redirect.headers.get('Location');
  if (!location) return { status: 502, body: { error: 'SoundCloud stream redirect failed (' + redirect.status + ')' } };

  return {
    status: 200,
    body: {
      title: track.title,
      permalink_url: track.permalink_url,
      user: { username: track.user.username, permalink_url: track.user.permalink_url },
      hls: streamURL !== streams.http_mp3_128_url,
      stream: location,
    },
  };
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request.headers.get('Origin'), env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin',
        },
      });
    }
    if (request.method !== 'GET' || url.pathname !== '/resolve') return json({ error: 'Not found' }, 404, origin);
    if (!origin) return json({ error: 'Origin not allowed' }, 403, null);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.LIMITER.limit({ key: ip });
    if (!success) return json({ error: 'Too many requests' }, 429, origin);

    let songURL;
    try {
      songURL = new URL(url.searchParams.get('url'));
    } catch (e) {
      return json({ error: 'Missing or invalid url' }, 400, origin);
    }
    if (songURL.protocol !== 'https:' || !SC_HOSTS.includes(songURL.hostname)) {
      return json({ error: 'Only soundcloud.com URLs are supported' }, 400, origin);
    }

    try {
      const result = await resolve(env, songURL.href);
      return json(result.body, result.status, origin);
    } catch (e) {
      return json({ error: e.message }, 502, origin);
    }
  },
};
