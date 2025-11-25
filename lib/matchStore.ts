// Lightweight wrapper to claim and read a canonical match token.
// Priority: REDIS_URL (node-redis) -> Vercel KV (@vercel/kv) -> in-memory fallback

let hasKv = false;
let kvClient: any = null;
let redisClient: any = null;
let redisReady = false;
const KEY = "game:match:current";
let inMemoryToken: string | null = null;
let inMemoryExpiresAt = 0;

async function getRedisClient() {
  if (redisClient && redisReady) return redisClient;
  const url = process.env.REDIS_URL || process.env.REDIS_URI || null;
  if (!url) return null;
  try {
    const { createClient } = require("redis");
    redisClient = createClient({ url });
    redisClient.on("error", (err: any) => {
      console.warn(
        "[matchStore] redis client error",
        err && err.message ? err.message : err
      );
      redisReady = false;
    });
    await redisClient.connect();
    redisReady = true;
    return redisClient;
  } catch (e) {
    console.warn("[matchStore] failed to init redis client", String(e));
    redisClient = null;
    redisReady = false;
    return null;
  }
}

// Lazy init for Vercel KV to avoid bundler resolving it when not installed
async function getKvClient() {
  if (kvClient && hasKv) return kvClient;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@vercel/kv");
    let client: any = null;
    if (mod) {
      client = mod.kv || mod.default?.kv || mod.default || mod;
      if (typeof client === "function") {
        try {
          const maybe = client();
          if (maybe && (maybe.get || maybe.set)) client = maybe;
        } catch (e) {
          // ignore
        }
      }
      if (client && (client.get || client.set)) {
        kvClient = client;
        hasKv = true;
        return kvClient;
      }
    }
  } catch (e) {
    // not available locally
  }
  return null;
}

export async function claimMatchToken(token: string, ttlMs: number) {
  try {
    const r = await getRedisClient();
    if (r) {
      try {
        const res = await r.set(KEY, token, { NX: true, PX: ttlMs + 60000 });
        return res === "OK";
      } catch (e) {
        console.warn(
          "[matchStore] redis claim failed, falling back",
          String(e)
        );
      }
    }
  } catch (e) {}

  const kv = await getKvClient();
  if (kv) {
    try {
      const exSeconds = Math.ceil((ttlMs + 60000) / 1000);
      let res: any = null;
      if (typeof kvClient.set === "function") {
        try {
          res = await kvClient.set(KEY, token, { nx: true, ex: exSeconds });
        } catch (e) {
          res = null;
        }
      }
      if (res === "OK" || res === true) return true;
      try {
        if (typeof kvClient.get === "function") {
          const existing = await kvClient.get(KEY);
          if (existing) return false;
        }
        if (typeof kvClient.set === "function") {
          await kvClient.set(KEY, token);
          return true;
        }
        return false;
      } catch (err) {
        console.warn("[matchStore] KV fallback write failed", String(err));
        return false;
      }
    } catch (e) {
      console.warn("[matchStore] KV claim failed", String(e));
    }
  }

  const now = Date.now();
  if (inMemoryToken && inMemoryExpiresAt > now) return false;
  inMemoryToken = token;
  inMemoryExpiresAt = now + ttlMs + 60000;
  return true;
}

export async function getCurrentMatchToken() {
  try {
    const r = await getRedisClient();
    if (r) {
      try {
        const val = await r.get(KEY);
        return val || null;
      } catch (e) {
        console.warn("[matchStore] redis get failed", String(e));
      }
    }
  } catch (e) {}

  try {
    const kv = await getKvClient();
    if (kv) {
      try {
        const val = await kvClient.get(KEY);
        return val || null;
      } catch (e) {
        console.warn("[matchStore] KV read failed", String(e));
      }
    }
  } catch (e) {}

  const now = Date.now();
  if (inMemoryToken && inMemoryExpiresAt > now) return inMemoryToken;
  return null;
}

export async function releaseMatchToken() {
  try {
    const r = await getRedisClient();
    if (r) {
      try {
        await r.del(KEY);
        return true;
      } catch (e) {
        console.warn("[matchStore] redis del failed", String(e));
      }
    }
  } catch (e) {}

  try {
    const kv = await getKvClient();
    if (kv) {
      try {
        await kvClient.del(KEY);
        return true;
      } catch (e) {
        console.warn("[matchStore] KV delete failed", String(e));
      }
    }
  } catch (e) {}

  inMemoryToken = null;
  inMemoryExpiresAt = 0;
  return true;
}
