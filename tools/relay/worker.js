/* Instant push relay for the Gomez Family Hub (Cloudflare Worker, free plan).
   A phone that just sent a chat message, took a game turn, gave a high-five… POSTs here with its Firebase
   sign-in token and the family members' push subscriptions; the relay checks the token was issued by the
   family's Firebase project, then encrypts (RFC 8291) and sends standard Web Push (RFC 8030 + VAPID RFC 8292).
   It stores nothing. Secrets/vars (set by .github/workflows/relay.yml): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
   FIREBASE_PROJECT_ID, ALLOWED_ORIGIN. */
const te = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));
const cat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };
const PUSH_HOSTS = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com|[a-z0-9.-]+\.push\.apple\.com)$/;

async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
// RFC 8291 aes128gcm: one record, rs 4096
export async function encryptPayload(payload, p256dh, auth, opts = {}) {
  const uaPub = unb64u(p256dh), authSecret = unb64u(auth);
  const as = opts.asKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, secret, cat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(payload, new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65;
  return cat(head, asPub, ct);
}
// RFC 8292 VAPID JWT (ES256)
// Apple turns down placeholder contacts, so the subject is the app's own site (https://…github.io)
export async function vapidHeader(endpoint, pub, priv, subject = 'https://github.com') {
  const p = unb64u(pub);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: priv, x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = (o) => b64u(te.encode(JSON.stringify(o)));
  const input = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(input));
  return `vapid t=${input}.${b64u(sig)}, k=${pub}`;
}
// Firebase ID token (RS256, Google's securetoken keys)
let jwks = { at: 0, keys: [] };
export async function verifyIdToken(token, projectId, jwksUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com') {
  const [h, p, s] = String(token || '').split('.');
  if (!s) throw new Error('bad token');
  const head = JSON.parse(new TextDecoder().decode(unb64u(h))), claims = JSON.parse(new TextDecoder().decode(unb64u(p)));
  if (head.alg !== 'RS256') throw new Error('bad alg');
  if (Date.now() - jwks.at > 3600e3 || !jwks.keys.some((k) => k.kid === head.kid)) jwks = { at: Date.now(), keys: (await (await fetch(jwksUrl)).json()).keys || [] };
  const jwk = jwks.keys.find((k) => k.kid === head.kid);
  if (!jwk) throw new Error('unknown key');
  const key = await crypto.subtle.importKey('jwk', { ...jwk, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), te.encode(`${h}.${p}`))) throw new Error('bad signature');
  const now = Date.now() / 1000;
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` || !(claims.exp > now) || !(claims.iat <= now + 300) || !claims.sub) throw new Error('wrong project or expired');
  if (claims.email && claims.email_verified === false) throw new Error('email not verified');
  return claims;
}

const recent = new Map(); // per-sender pacing within this worker instance
export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('origin') || '';
    const cors = { 'access-control-allow-origin': env.ALLOWED_ORIGIN || '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '86400', vary: 'origin' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method === 'GET') return reply(200, { ok: true, service: 'gomezfam push relay', key: env.VAPID_PUBLIC_KEY ? env.VAPID_PUBLIC_KEY.slice(0, 8) + '…' : null });
    if (req.method !== 'POST') return reply(405, { error: 'POST only' });
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) return reply(403, { error: 'origin' });
    let who;
    try { who = await verifyIdToken((req.headers.get('authorization') || '').replace(/^Bearer /, ''), env.FIREBASE_PROJECT_ID, env.JWKS_URL); }
    catch (e) { return reply(401, { error: 'sign-in: ' + e.message }); }
    const now = Date.now(), list = (recent.get(who.sub) || []).filter((t) => now - t < 60e3);
    if (list.length >= 30) return reply(429, { error: 'slow down' });
    list.push(now); recent.set(who.sub, list);
    let body;
    try { body = await req.json(); } catch { return reply(400, { error: 'json' }); }
    const subs = Array.isArray(body.subs) ? body.subs.slice(0, 12) : [];
    const payload = te.encode(JSON.stringify({ title: String(body.payload?.title || '').slice(0, 120), body: String(body.payload?.body || '').slice(0, 400), url: String(body.payload?.url || './').slice(0, 200), tag: String(body.payload?.tag || '').slice(0, 64) }));
    // Test with a delay: answer now and send a few seconds later (time to lock the phone)
    const delay = Math.min(20, Math.max(0, Number(body.delay) || 0));
    if (delay && ctx?.waitUntil) {
      ctx.waitUntil(new Promise((r) => setTimeout(r, delay * 1000)).then(() => sendAll(subs, payload, body, env)));
      return reply(202, { results: subs.map((s) => ({ endpoint: s.endpoint, status: 'scheduled' })) });
    }
    return reply(200, { results: await sendAll(subs, payload, body, env) });
  },
};
async function sendAll(subs, payload, body, env) {
    const results = [];
    for (const s of subs) {
      let host = '';
      try { const u = new URL(s.endpoint); if (u.protocol === 'https:') host = u.hostname; } catch { /* bad url */ }
      if (!PUSH_HOSTS.test(host) || !s.keys?.p256dh || !s.keys?.auth) { results.push({ endpoint: s.endpoint, status: 'rejected' }); continue; }
      try {
        const headers = { TTL: '21600', 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', urgency: body.urgent ? 'high' : 'normal',
          authorization: await vapidHeader(s.endpoint, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT || env.ALLOWED_ORIGIN || 'https://github.com') };
        const topic = String(body.payload?.tag || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
        if (topic) headers.topic = topic; // a newer message with the same topic replaces an undelivered one
        const res = await fetch(s.endpoint, { method: 'POST', body: await encryptPayload(payload, s.keys.p256dh, s.keys.auth), headers });
        // Push services explain refusals in the body (e.g. Apple: {"reason":"BadJwtToken"})
        results.push({ endpoint: s.endpoint, status: res.status, ...(res.ok ? {} : { reason: (await res.text().catch(() => '')).slice(0, 200) }) });
      } catch (e) { results.push({ endpoint: s.endpoint, status: 'error' }); }
    }
    return results;
}
