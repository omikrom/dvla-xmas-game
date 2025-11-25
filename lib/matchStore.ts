// Lightweight wrapper to claim and read a canonical match token using Vercel KV
// Falls back to an in-memory implementation when `@vercel/kv` is not available

let hasKv = false;
let kvClient: any = null;
try {
  // runtime import; different versions/export shapes exist so normalize
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@vercel/kv');
  // Common shapes:
  // - { kv } where kv has get/set
  // - export default { kv }
  // - direct client object with get/set
  // - function that returns client when invoked
  let client: any = null;
  if (mod) {
    client = mod.kv || mod.default?.kv || mod.default || mod;
    if (typeof client === 'function') {
      try {
        const maybe = client();
        if (maybe && (maybe.get || maybe.set)) client = maybe;
      } catch (e) {
        // ignore - will try other shapes
      }
    }
    // final sanity: ensure client exposes set/get
    if (client && (client.get || client.set)) {
      kvClient = client;
      hasKv = true;
    }
  }
} catch (e) {
  // not available locally — we'll fallback to in-memory
}

const KEY = 'game:match:current';
let inMemoryToken: string | null = null;
let inMemoryExpiresAt = 0;

export async function claimMatchToken(token: string, ttlMs: number) {
  // returns true if claim succeeded, false if another token exists
  if (hasKv && kvClient) {
    try {
      // Try to atomically set the token only if the key does not exist.
      // Vercel KV supports `kv.set(key, value, { nx: true, ex: seconds })`
      // in some versions; wrap in try/catch in case API differs.
      const exSeconds = Math.ceil((ttlMs + 60000) / 1000); // add buffer
      // Try atomic set if supported (some versions accept options)
      let res: any = null;
      if (typeof kvClient.set === 'function') {
        try {
          // @ts-ignore
          res = await kvClient.set(KEY, token, { nx: true, ex: exSeconds });
        } catch (e) {
          // Some client shapes don't accept options; fall through to fallback
          res = null;
        }
      }
      // Interpret common success responses
      if (res === 'OK' || res === true) return true;
      // If res === null, we couldn't perform atomic set with options — fallthrough
    } catch (e) {
      console.warn('[matchStore] KV claim failed, falling back to read-check', e);
      // Non-atomic fallback: use get then set only if missing. This is not
      // truly atomic but acceptable as a best-effort fallback for dev/test.
      try {
        if (typeof kvClient.get === 'function') {
          // @ts-ignore
          const existing = await kvClient.get(KEY);
          if (existing) return false;
        }
        if (typeof kvClient.set === 'function') {
          // @ts-ignore
          await kvClient.set(KEY, token);
          return true;
        }
        return false;
      } catch (err) {
        console.warn('[matchStore] KV fallback write failed', err);
        return false;
      }
    }
  }

  // In-memory fallback (only for local/dev)
  const now = Date.now();
  if (inMemoryToken && inMemoryExpiresAt > now) return false;
  inMemoryToken = token;
  inMemoryExpiresAt = now + ttlMs + 60000;
  return true;
}

export async function getCurrentMatchToken() {
  if (hasKv && kvClient) {
    try {
      // @ts-ignore
      const val = await kvClient.get(KEY);
      return val || null;
    } catch (e) {
      console.warn('[matchStore] KV read failed', e);
      return null;
    }
  }
  const now = Date.now();
  if (inMemoryToken && inMemoryExpiresAt > now) return inMemoryToken;
  return null;
}

export async function releaseMatchToken() {
  if (hasKv && kvClient) {
    try {
      // @ts-ignore
      await kvClient.del(KEY);
      return true;
    } catch (e) {
      console.warn('[matchStore] KV delete failed', e);
      return false;
    }
  }
  inMemoryToken = null;
  inMemoryExpiresAt = 0;
  return true;
}
