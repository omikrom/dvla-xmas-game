// Lightweight wrapper to claim and read a canonical match token.
// Priority: REDIS_URL (node-redis) -> Vercel KV (@vercel/kv) -> in-memory fallback

let hasKv = false;
let kvClient: any = null;
let redisClient: any = null;
let redisReady = false;
const KEY = "game:match:current";
let inMemoryToken: string | null = null;
let inMemoryExpiresAt = 0;
let lastRedisConnectMs: number | null = null;
let inMemoryOwner: string | null = null;
let inMemorySnapshot: string | null = null;

function nowMs() {
  try {
    return Number(process.hrtime.bigint() / BigInt(1e6));
  } catch (e) {
    return Date.now();
  }
}

async function getRedisClient() {
  if (redisClient && redisReady) return redisClient;
  const url = process.env.REDIS_URL || process.env.REDIS_URI || null;
  if (!url) return null;
  try {
    const start = nowMs();
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
    const dt = nowMs() - start;
    lastRedisConnectMs = Date.now();
    console.log(`[matchStore] redis connected (${dt}ms)`);
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

export async function claimMatchToken(
  token: string,
  ttlMs: number,
  ownerId?: string
) {
  try {
    const r = await getRedisClient();
    if (r) {
      try {
        const t0 = nowMs();
        const res = await r.set(KEY, token, { NX: true, PX: ttlMs + 60000 });
        const dt = nowMs() - t0;
        if (dt > 10) console.log(`[matchStore] redis SET took ${dt}ms`);
        if (res === "OK") {
          if (ownerId) {
            try {
              await r.set(`${KEY}:owner`, ownerId, { PX: ttlMs + 60000 });
            } catch (err) {
              console.warn("[matchStore] redis set owner failed", String(err));
            }
          }
        }
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
      if (res === "OK" || res === true) {
        if (ownerId && typeof kvClient.set === "function") {
          try {
            await kvClient.set(`${KEY}:owner`, ownerId, { ex: exSeconds });
          } catch (err) {
            console.warn("[matchStore] KV set owner failed", String(err));
          }
        }
        return true;
      }
      try {
        if (typeof kvClient.get === "function") {
          const existing = await kvClient.get(KEY);
          if (existing) return false;
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
  if (ownerId) inMemoryOwner = ownerId;
  inMemoryExpiresAt = now + ttlMs + 60000;
  return true;
}

export function getLastRedisConnectMs() {
  return lastRedisConnectMs;
}

export async function getCurrentMatchToken() {
  try {
    const r = await getRedisClient();
    if (r) {
      try {
        const t0 = nowMs();
        const val = await r.get(KEY);
        const dt = nowMs() - t0;
        if (dt > 10) console.log(`[matchStore] redis GET took ${dt}ms`);
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

export async function getCurrentMatchOwner() {
  try {
    const r = await getRedisClient();
    if (r) {
      try {
        const t0 = nowMs();
        const val = await r.get(`${KEY}:owner`);
        const dt = nowMs() - t0;
        if (dt > 10) console.log(`[matchStore] redis GET owner took ${dt}ms`);
        return val || null;
      } catch (e) {
        console.warn("[matchStore] redis get owner failed", String(e));
      }
    }
  } catch (e) {}

  try {
    const kv = await getKvClient();
    if (kv) {
      try {
        const val = await kvClient.get(`${KEY}:owner`);
        return val || null;
      } catch (e) {
        console.warn("[matchStore] KV read owner failed", String(e));
      }
    }
  } catch (e) {}

  return inMemoryOwner;
}

export async function saveMatchSnapshot(
  token: string,
  snapshot: any,
  ttlMs: number
) {
  const json = JSON.stringify(snapshot);
  try {
    const r = await getRedisClient();
    if (r) {
      try {
        await r.set(`${KEY}:snapshot`, json, { PX: ttlMs + 60000 });
        return true;
      } catch (e) {
        console.warn("[matchStore] redis set snapshot failed", String(e));
      }
    }
  } catch (e) {}

  try {
    const kv = await getKvClient();
    if (kv) {
      try {
        const exSeconds = Math.ceil((ttlMs + 60000) / 1000);
        if (typeof kvClient.set === "function") {
          await kvClient.set(`${KEY}:snapshot`, json, { ex: exSeconds });
          return true;
        }
      } catch (e) {
        console.warn("[matchStore] KV set snapshot failed", String(e));
      }
    }
  } catch (e) {}

  inMemorySnapshot = json;
  return true;
}

export async function getMatchSnapshot() {
  try {
    const r = await getRedisClient();
    if (r) {
      try {
        const t0 = nowMs();
        const val = await r.get(`${KEY}:snapshot`);
        const dt = nowMs() - t0;
        if (dt > 10)
          console.log(`[matchStore] redis GET snapshot took ${dt}ms`);
        return val ? JSON.parse(val) : null;
      } catch (e) {
        console.warn("[matchStore] redis get snapshot failed", String(e));
      }
    }
  } catch (e) {}

  try {
    const kv = await getKvClient();
    if (kv) {
      try {
        const val = await kvClient.get(`${KEY}:snapshot`);
        return val ? JSON.parse(val) : null;
      } catch (e) {
        console.warn("[matchStore] KV read snapshot failed", String(e));
      }
    }
  } catch (e) {}

  return inMemorySnapshot ? JSON.parse(inMemorySnapshot) : null;
}

export async function refreshMatchOwner(ownerId: string, ttlMs: number) {
  try {
    const r = await getRedisClient();
    if (r) {
      try {
        await r.set(`${KEY}:owner`, ownerId, { PX: ttlMs + 60000 });
        return true;
      } catch (e) {
        console.warn("[matchStore] redis refresh owner failed", String(e));
      }
    }
  } catch (e) {}

  try {
    const kv = await getKvClient();
    if (kv) {
      try {
        const exSeconds = Math.ceil((ttlMs + 60000) / 1000);
        if (typeof kvClient.set === "function") {
          await kvClient.set(`${KEY}:owner`, ownerId, { ex: exSeconds });
          return true;
        }
      } catch (e) {
        console.warn("[matchStore] KV refresh owner failed", String(e));
      }
    }
  } catch (e) {}

  inMemoryOwner = ownerId;
  return true;
}

export async function releaseMatchToken() {
  try {
    const r = await getRedisClient();
    if (r) {
      try {
        const t0 = nowMs();
        await r.del(KEY);
        // also delete owner and snapshot
        try {
          await r.del(`${KEY}:owner`);
          await r.del(`${KEY}:snapshot`);
        } catch (e) {}
        const dt = nowMs() - t0;
        if (dt > 10) console.log(`[matchStore] redis DEL took ${dt}ms`);
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
        try {
          await kvClient.del(`${KEY}:owner`);
          await kvClient.del(`${KEY}:snapshot`);
        } catch (err) {}
        return true;
      } catch (e) {
        console.warn("[matchStore] KV delete failed", String(e));
      }
    }
  } catch (e) {}

  inMemoryToken = null;
  inMemoryExpiresAt = 0;
  inMemoryOwner = null;
  inMemorySnapshot = null;
  return true;
}

// Eagerly warm Redis connection at module load to avoid first-request
// connect latency in production when `REDIS_URL` is configured.
(async function eagerRedisWarmup() {
  try {
    const url = process.env.REDIS_URL || process.env.REDIS_URI || null;
    if (!url) return;
    // Fire-and-forget; log connection delay in getRedisClient
    await getRedisClient();
  } catch (e) {
    // ignore - we'll fall back gracefully
  }
})();
