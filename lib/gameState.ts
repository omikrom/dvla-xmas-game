// Shared game state that persists across API calls
export type PlayerCar = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number; // vertical position for jumping
  angle: number;
  speed: number;
  verticalSpeed: number; // for jump physics
  steer: number;
  throttle: number;
  color: string;
  lastUpdate: number;
  ready?: boolean;
  damage?: number; // 0-100, higher = more damage
  missingParts?: string[]; // parts that fell off
  lastCollisionSpeed?: number; // speed during last collision
  destroyed?: boolean;
  score?: number;
  carryingDeliveryId?: string;
  activePowerUps?: Array<{
    type: string;
    activatedAt: number;
    expiresAt: number;
    value?: number;
  }>;
};

type DestructibleType =
  | "tree"
  | "building"
  | "snowman"
  | "candy"
  | "santa"
  | "reindeer";
type ImpactZone = "front" | "rear" | "left" | "right";

type DebrisChunk = {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  ttl: number;
  // If true, the client should treat this debris as static/persistent on the ground
  // (do not animate fade; leave until match end).
  persistent?: boolean;
};

type PowerUpType =
  | "speed"
  | "heal"
  | "shield"
  | "magnet"
  | "doublePoints"
  | "repel"
  | "invisibility"
  | "teleport";

type PowerUpItem = {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  z?: number;
  collected?: boolean;
  collectedBy?: string;
  collectedAt?: number;
  respawnAt?: number;
};

export type Destructible = {
  id: string;
  type: DestructibleType;
  x: number;
  y: number;
  radius: number;
  height: number;
  width?: number;
  depth?: number;
  color?: string;
  // optional model key to guide client-side rendering (e.g. 'mybuilding')
  model?: string;
  maxHealth: number;
  health: number;
  destroyed: boolean;
  debris: DebrisChunk[];
  // internal server flags to avoid repeated debris bursts
  debrisEmitted?: boolean;
  lastDebrisAt?: number;
  // last time this destructible was damaged (ms)
  lastHitAt?: number;
};

type GameState = "lobby" | "racing" | "finished";

type DeliveryItemState = "waiting" | "carried" | "cooldown";

type DeliveryItem = {
  id: string;
  spawnX: number;
  spawnY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetRadius: number;
  targetIndex?: number;
  state: DeliveryItemState;
  carrierId?: string;
  previousCarrierId?: string;
  respawnAt?: number;
};

type MatchEvent = {
  id: string;
  playerId: string;
  playerName: string;
  description: string;
  points: number;
  timestamp: number;
  matchTimeMs: number;
};

type Room = {
  players: Map<string, PlayerCar>;
  lastPhysicsUpdate: number;
  // server tick metrics for diagnostics
  serverTickCount?: number;
  lastTickSampleAt?: number;
  serverFps?: number;
  // when a match finishes we schedule a reset back to lobby at this timestamp
  resetScheduledAt?: number;
  gameState: GameState;
  destructibles: Map<string, Destructible>;
  matchDurationMs: number;
  raceStartTime?: number;
  raceEndTime?: number;
  // server-side timeout handle to ensure finalizeRace runs even if no client polls
  scheduledFinalize?: ReturnType<typeof setTimeout> | null;
  // scheduled repairs for destroyed players (playerId -> timeout handle)
  scheduledRepairs?: Map<string, ReturnType<typeof setTimeout>>;
  // periodic repair interval handle (heals players every N ms)
  periodicRepairHandle?: ReturnType<typeof setInterval> | null;
  leaderboard: Array<{
    id: string;
    name: string;
    score: number;
    color: string;
  }>;
  deliveries: DeliveryItem[];
  powerUps: PowerUpItem[];
  events: MatchEvent[];
};

// Clean up inactive players (not updated in 10 seconds)
const PLAYER_TIMEOUT = 10000;
// Increase destroy threshold so cars are a bit tougher (more health)
export const CAR_DESTROY_THRESHOLD = 150;
// reduce TTL so debris clears faster and feels less spammy
const DEBRIS_TTL = 4000; // ms
const MATCH_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const MIN_PHYSICS_STEP_MS = 16; // avoid running the full solver more than ~60fps per server tick
// Server-side repair tuning
const SERVER_REPAIR_DELAY_MS = 20000; // 20s (legacy per-destruction delay)
const SERVER_REPAIR_AMOUNT = 10; // repair amount (reduce damage by 10)
// Periodic server heal - runs for all players every X ms
const SERVER_PERIODIC_REPAIR_MS = 30000; // 30s
const SERVER_PERIODIC_REPAIR_AMOUNT = 10; // amount healed per tick
const TREE_HEALTH = 45;
const BUILDING_HEALTH = 360;
const DELIVERY_SPAWN_POINTS = [
  { x: -40, y: -28 },
  { x: 0, y: -46 },
  { x: 40, y: -28 },
  { x: -34, y: 34 },
  { x: 34, y: 34 },
  { x: -46, y: 0 },
  { x: 46, y: 0 },
  { x: -30, y: -46 },
  { x: 30, y: -46 },
  { x: 0, y: 40 },
];
// Player spawn candidates: generate a grid of candidate positions across the playable area.
// We keep this list broad and filter at runtime to avoid collisions with objects/players.
const SPAWN_GRID_MIN = -85;
const SPAWN_GRID_MAX = 85;
const SPAWN_GRID_STEP = 8; // spacing between candidates
const PLAYER_SPAWN_CLEARANCE = 6; // minimum distance from objects/players

const PLAYER_SPAWN_CANDIDATES: Array<{ x: number; y: number }> = (() => {
  const out: Array<{ x: number; y: number }> = [];
  for (let x = SPAWN_GRID_MIN; x <= SPAWN_GRID_MAX; x += SPAWN_GRID_STEP) {
    for (let y = SPAWN_GRID_MIN; y <= SPAWN_GRID_MAX; y += SPAWN_GRID_STEP) {
      out.push({ x, y });
    }
  }
  return out;
})();

// Static map obstacles (approximate positions of large static scene models)
// These are used by the server to avoid spawning players inside non-destructible
// scene geometry such as the DVLA building and lobby.
const STATIC_MAP_OBSTACLES: Array<{ x: number; y: number; radius: number }> = [
  // Main DVLA tower (approximate)
  { x: 0, y: -4, radius: 18 },
  // Lower office block in front of tower
  { x: 0, y: 3, radius: 14 },
  // Circular lobby
  { x: 5, y: 9, radius: 7 },
  // Side ramps / car park
  { x: -10, y: 4, radius: 5 },
  { x: 10, y: 4, radius: 5 },
  // ModelBuilder: custom house placed at (-20, 0, 10) in the scene
  { x: -20, y: 10, radius: 9 },
];

// Per-process instance id to help diagnose multi-worker routing issues.
// This is generated once at module load and returned in API responses
// to help determine whether different requests are hitting different
// server instances (causes inconsistent in-memory room state).
const INSTANCE_ID = `${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

export function getInstanceId() {
  return INSTANCE_ID;
}

// Stateless signed match token helpers so serverless workers can agree on
// a race start time without a shared datastore. Tokens are HMAC-signed
// payloads containing `startedAt` and `durationMs`.
import crypto from "crypto";

const MATCH_SECRET = process.env.MATCH_SECRET || "dev-match-secret";

function signPayload(payloadB64: string) {
  return crypto
    .createHmac("sha256", MATCH_SECRET)
    .update(payloadB64)
    .digest("base64");
}

export function createMatchToken(startedAt: number, durationMs: number) {
  const payload = JSON.stringify({ startedAt, durationMs });
  const payloadB64 = Buffer.from(payload).toString("base64");
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyMatchToken(token: string | undefined) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  try {
    const expected = signPayload(payloadB64);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64").toString("utf8")
    );
    if (
      typeof payload.startedAt === "number" &&
      typeof payload.durationMs === "number"
    ) {
      return payload as { startedAt: number; durationMs: number };
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function getMatchToken() {
  // Return current room token if set, otherwise null
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return (room as any).currentMatchToken || null;
  } catch (e) {
    return null;
  }
}

export function adoptMatchFromToken(token?: string | null) {
  const payload = verifyMatchToken(token || undefined);
  if (!payload) return false;
  try {
    // Only adopt if we don't already have a later end time
    if (
      !room.raceEndTime ||
      room.raceEndTime < payload.startedAt + payload.durationMs
    ) {
      room.raceStartTime = payload.startedAt;
      room.raceEndTime = payload.startedAt + payload.durationMs;
      room.matchDurationMs = payload.durationMs;
      // store the token for this instance
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      room.currentMatchToken = token;
      recordSystemEvent(
        `Adopted match token: start=${new Date(
          payload.startedAt
        ).toISOString()}`
      );
    }
    return true;
  } catch (e) {
    return false;
  }
}

function shuffleArray<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Deterministic color derived from player id to avoid worker-to-worker
// color mismatches in multi-instance deployments.
function colorFromId(id: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const c = h & 0xffffff;
  return "#" + c.toString(16).padStart(6, "0");
}

function isSafeSpawn(x: number, y: number, minDist = PLAYER_SPAWN_CLEARANCE) {
  // check destructibles
  for (const d of room.destructibles.values()) {
    const dx = x - d.x;
    const dy = y - d.y;
    if (Math.hypot(dx, dy) < (d.radius || 4) + minDist) {
      console.debug(
        `[GameState] isSafeSpawn: rejected by destructible ${d.id} at ${d.x},${
          d.y
        } for candidate ${x},${y} (dist=${Math.hypot(dx, dy).toFixed(2)} need>${
          (d.radius || 4) + minDist
        })`
      );
      return false;
    }
  }
  // static map obstacles (e.g. big buildings, lobby) - avoid spawning inside them
  for (const o of STATIC_MAP_OBSTACLES) {
    const dx = x - o.x;
    const dy = y - o.y;
    if (Math.hypot(dx, dy) < o.radius + minDist) {
      console.debug(
        `[GameState] isSafeSpawn: rejected by static obstacle at ${o.x},${
          o.y
        } for candidate ${x},${y} (dist=${Math.hypot(dx, dy).toFixed(2)} need>${
          o.radius + minDist
        })`
      );
      return false;
    }
  }
  // deliveries
  for (const dv of room.deliveries) {
    const dx = x - dv.x;
    const dy = y - dv.y;
    if (Math.hypot(dx, dy) < minDist + (dv.targetRadius || 6)) return false;
    if (Math.hypot(x - dv.spawnX, y - dv.spawnY) < minDist) return false;
  }
  // powerups
  for (const pu of room.powerUps) {
    if (pu.collected) continue;
    const dx = x - pu.x;
    const dy = y - pu.y;
    if (Math.hypot(dx, dy) < minDist + 3) return false;
  }
  // other players
  for (const p of room.players.values()) {
    const dx = x - p.x;
    const dy = y - p.y;
    if (Math.hypot(dx, dy) < minDist + 2) return false;
  }
  return true;
}

function findSpawnPosition(): { x: number; y: number } {
  // try candidates in random order first
  const candidates = PLAYER_SPAWN_CANDIDATES.slice();
  shuffleArray(candidates);
  for (const c of candidates) {
    if (isSafeSpawn(c.x, c.y))
      return {
        x: c.x + (Math.random() - 0.5) * 2,
        y: c.y + (Math.random() - 0.5) * 2,
      };
  }
  // fallback: sample random positions until one is safe (bounded attempts)
  for (let i = 0; i < 120; i++) {
    const x =
      Math.random() * (SPAWN_GRID_MAX - SPAWN_GRID_MIN) + SPAWN_GRID_MIN;
    const y =
      Math.random() * (SPAWN_GRID_MAX - SPAWN_GRID_MIN) + SPAWN_GRID_MIN;
    if (isSafeSpawn(x, y, PLAYER_SPAWN_CLEARANCE * 0.8)) return { x, y };
  }
  // final fallback: keep existing behavior (start line)
  console.warn(
    "[GameState] findSpawnPosition: no safe candidate found - falling back to start line"
  );
  return { x: (Math.random() - 0.5) * 8, y: -27 };
}
const DELIVERY_DROP_POINTS = [
  { x: 0, y: 65, radius: 7 },
  { x: -55, y: 45, radius: 6.2 },
  { x: 55, y: 45, radius: 6.2 },
  { x: -50, y: -50, radius: 6 },
  { x: 50, y: -50, radius: 6 },
  { x: 0, y: -65, radius: 6.5 },
  { x: -60, y: 0, radius: 6.5 },
  { x: 60, y: 0, radius: 6.5 },
  { x: -35, y: 55, radius: 6 },
  { x: 35, y: 55, radius: 6 },
];
const DELIVERY_ITEM_COUNT = Math.min(
  DELIVERY_DROP_POINTS.length,
  DELIVERY_SPAWN_POINTS.length
);
const DELIVERY_ITEM_RESPAWN_MS = 2000;
const DELIVERY_PICKUP_RADIUS = 4.5;
const DELIVERY_DROP_RADIUS = 6.5;
const DELIVERY_STEAL_MIN_SPEED = 8;
const DELIVERY_PICKUP_BONUS = 25;
const DELIVERY_STEAL_BONUS = 75;
const DELIVERY_DELIVERY_POINTS = 200;
const IMPACT_ZONE_RULES: Record<
  ImpactZone,
  Array<{ part: string; minSeverity: number }>
> = {
  front: [
    { part: "frontBumper", minSeverity: 12 },
    { part: "hood", minSeverity: 18 },
  ],
  rear: [
    { part: "rearBumper", minSeverity: 12 },
    { part: "trunk", minSeverity: 18 },
  ],
  left: [{ part: "leftDoor", minSeverity: 14 }],
  right: [{ part: "rightDoor", minSeverity: 14 }],
};

// Server-side powerup spawn candidates and configs
// Generate a wider spread of powerup candidate positions programmatically.
// This produces a grid across the playable area plus several concentric
// ring positions so powerups are distributed broadly (not clustered at the center).
const ROOM_POWERUP_CANDIDATES: Array<{ x: number; y: number }> = (() => {
  const out: Array<{ x: number; y: number }> = [];

  // Keep the outer corners and edge centers for good coverage
  const outer = [
    { x: 80, y: 80 },
    { x: -80, y: 80 },
    { x: 80, y: -80 },
    { x: -80, y: -80 },
    { x: 0, y: 88 },
    { x: 0, y: -88 },
    { x: 88, y: 0 },
    { x: -88, y: 0 },
  ];
  out.push(...outer);

  // Concentric rings (angles every 30deg) at radii 24, 44, 64
  const rings = [24, 44, 64];
  for (const r of rings) {
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      out.push({
        x: Math.round(r * Math.cos(rad)),
        y: Math.round(r * Math.sin(rad)),
      });
    }
  }

  // Grid across the map with moderate spacing to cover middle areas without heavy clustering
  const SPACING = 22;
  const LIMIT = 74;
  for (let x = -LIMIT; x <= LIMIT; x += SPACING) {
    for (let y = -LIMIT; y <= LIMIT; y += SPACING) {
      out.push({ x, y });
    }
  }

  // Small manual extras near some track lines for variety
  out.push(
    { x: 40, y: 0 },
    { x: -40, y: 0 },
    { x: 0, y: 40 },
    { x: 0, y: -40 }
  );

  // Deduplicate coordinates (avoid doubles from rings/grid) and clamp to integers
  const seen = new Set<string>();
  const unique: Array<{ x: number; y: number }> = [];
  for (const p of out) {
    const key = `${p.x},${p.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ x: Math.round(p.x), y: Math.round(p.y) });
    }
  }

  return unique;
})();

// Maximum number of initial power-ups to spawn at the start of a race.
// Lower this to reduce clutter; tuning value can be adjusted as needed.
const MAX_INITIAL_POWERUPS = 10;

// Simple logger to control noisy output. Set `process.env.GAME_LOG_LEVEL` to
// `'debug'` to enable debug messages; otherwise noisy debug messages are
// suppressed to avoid causing server-side lag when many events occur.
const GAME_LOG_LEVEL = (process.env.GAME_LOG_LEVEL || "info").toLowerCase();
function logDebug(...args: any[]) {
  if (GAME_LOG_LEVEL === "debug") console.debug(...args);
}
function logInfo(...args: any[]) {
  if (GAME_LOG_LEVEL !== "silent") console.log(...args);
}

const SERVER_POWERUP_CONFIGS: Record<
  PowerUpType,
  {
    duration: number;
    respawnTime: number;
    effect?: {
      speedMultiplier?: number;
      healAmount?: number;
      repelRadius?: number;
    };
  }
> = {
  speed: {
    duration: 15000,
    respawnTime: 30000,
    effect: { speedMultiplier: 1.5 },
  },
  // Heal powerup restores more health to match increased destroy threshold
  heal: { duration: 0, respawnTime: 25000, effect: { healAmount: 75 } },
  shield: { duration: 10000, respawnTime: 35000 },
  magnet: { duration: 12000, respawnTime: 30000 },
  repel: { duration: 8000, respawnTime: 30000, effect: { repelRadius: 8 } },
  doublePoints: { duration: 10000, respawnTime: 35000 },
  invisibility: { duration: 8000, respawnTime: 35000 },
  teleport: { duration: 0, respawnTime: 35000 },
};

function createInitialPowerUps(): PowerUpItem[] {
  const types = Object.keys(SERVER_POWERUP_CONFIGS) as PowerUpType[];
  const result: PowerUpItem[] = [];
  // Reduce minimum distance slightly to allow moderate clustering while
  // keeping spacing; the MAX_INITIAL_POWERUPS cap prevents overcrowding.
  const minDist = 6;

  function isTooClose(x: number, y: number) {
    // Too close to players
    for (const p of room.players.values()) {
      if (Math.hypot(p.x - x, p.y - y) < minDist) return true;
    }
    // Too close to destructibles
    for (const d of room.destructibles.values()) {
      if (Math.hypot(d.x - x, d.y - y) < d.radius + minDist) return true;
    }
    // Too close to deliveries (spawn/target)
    for (const dv of room.deliveries) {
      if (Math.hypot(dv.x - x, dv.y - y) < minDist) return true;
      if (Math.hypot(dv.spawnX - x, dv.spawnY - y) < minDist) return true;
      if (dv.targetX && Math.hypot(dv.targetX - x, dv.targetY - y) < minDist)
        return true;
    }
    // Too close to existing powerups
    for (const pu of room.powerUps) {
      if (!pu.collected && Math.hypot(pu.x - x, pu.y - y) < minDist)
        return true;
    }
    return false;
  }

  // Shuffle candidate list so spawns are distributed differently each run
  const candidates = ROOM_POWERUP_CANDIDATES.slice();
  shuffleArray(candidates);
  let idx = 0;
  for (const pos of candidates) {
    if (result.length >= MAX_INITIAL_POWERUPS) break;
    if (isTooClose(pos.x, pos.y)) continue;
    const type = types[idx % types.length];
    result.push({
      id: `pu-${idx}-${Date.now()}`,
      type,
      x: pos.x,
      y: pos.y,
      z: 0.8,
      collected: false,
    });
    idx++;
  }

  return result;
}

function getPerformanceScale(damage?: number) {
  const clamped = Math.min(Math.max(damage ?? 0, 0), CAR_DESTROY_THRESHOLD);
  const ratio = clamped / CAR_DESTROY_THRESHOLD;
  return Math.max(0.25, 1 - ratio * 0.7);
}

export function recordMatchEvent(
  player: PlayerCar,
  points: number,
  description: string
) {
  if (!player) return;
  const timestamp = Date.now();
  const matchTimeMs = room.raceStartTime ? timestamp - room.raceStartTime : 0;
  room.events.push({
    id: `event-${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
    playerId: player.id,
    playerName: player.name,
    description,
    points: Math.round(points),
    timestamp,
    matchTimeMs,
  });
  // Debug: log every recorded match event to help trace missing events
  console.log(
    `[GameState] recordMatchEvent: player=${player.id} name=${
      player.name
    } points=${Math.round(points)} desc="${description}" ts=${new Date(
      timestamp
    ).toISOString()}`
  );
  if (room.events.length > 200) {
    room.events.splice(0, room.events.length - 200);
  }
}

function recordSystemEvent(description: string) {
  const timestamp = Date.now();
  const matchTimeMs = room.raceStartTime ? timestamp - room.raceStartTime : 0;
  room.events.push({
    id: `sys-${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
    playerId: "system",
    playerName: "system",
    description,
    points: 0,
    timestamp,
    matchTimeMs,
  });
  if (room.events.length > 200) room.events.splice(0, room.events.length - 200);
}

function autoStartRaceIfNeeded() {
  // Auto-start is only allowed from the `lobby` state and must be driven
  // by players explicitly toggling ready. Do not auto-start from `finished`.
  if (room.gameState === "lobby" && room.players.size > 0) {
    const allReady = Array.from(room.players.values()).every((p) => p.ready);
    if (allReady) {
      startRace();
    }
  }
}

const room: Room = {
  players: new Map(),
  lastPhysicsUpdate: Date.now(),
  serverTickCount: 0,
  lastTickSampleAt: Date.now(),
  serverFps: 0,
  gameState: "lobby",
  destructibles: createInitialDestructibles(),
  matchDurationMs: MATCH_DURATION_MS,
  leaderboard: [],
  deliveries: createInitialDeliveries(),
  powerUps: [],
  events: [],
};

// Start a periodic server-side repair interval that heals damaged players every
// SERVER_PERIODIC_REPAIR_MS. This is global and ensures players regain health
// over time (useful to recover from being wrecked).
if (!room.periodicRepairHandle) {
  room.periodicRepairHandle = setInterval(() => {
    try {
      const r = getRoom();
      const now = Date.now();
      for (const p of r.players.values()) {
        // Only heal players who actually have damage
        if ((p.damage || 0) > 0) {
          // apply periodic repair
          repairPlayer(p.id, SERVER_PERIODIC_REPAIR_AMOUNT);
          recordSystemEvent(
            `Periodic auto-repair ${p.id} by ${SERVER_PERIODIC_REPAIR_AMOUNT}`
          );
        }
      }
    } catch (e) {
      console.error("Periodic repair interval error:", e);
    }
  }, SERVER_PERIODIC_REPAIR_MS) as unknown as ReturnType<typeof setInterval>;
}

function createInitialDestructibles(): Map<string, Destructible> {
  const defs: Destructible[] = [
    {
      id: "tree-nw",
      type: "tree",
      x: -45,
      y: -45,
      radius: 2,
      height: 6,
      maxHealth: TREE_HEALTH,
      health: TREE_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "tree-ne",
      type: "tree",
      x: 45,
      y: -45,
      radius: 2,
      height: 6,
      maxHealth: TREE_HEALTH,
      health: TREE_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "tree-sw",
      type: "tree",
      x: -45,
      y: 45,
      radius: 2,
      height: 6,
      maxHealth: TREE_HEALTH,
      health: TREE_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "tree-se",
      type: "tree",
      x: 45,
      y: 45,
      radius: 2,
      height: 6,
      maxHealth: TREE_HEALTH,
      health: TREE_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "tree-n",
      type: "tree",
      x: 0,
      y: -50,
      radius: 2,
      height: 6,
      maxHealth: TREE_HEALTH,
      health: TREE_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "tree-s",
      type: "tree",
      x: 0,
      y: 50,
      radius: 2,
      height: 6,
      maxHealth: TREE_HEALTH,
      health: TREE_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "tree-w",
      type: "tree",
      x: -50,
      y: 0,
      radius: 2,
      height: 6,
      maxHealth: TREE_HEALTH,
      health: TREE_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "tree-e",
      type: "tree",
      x: 50,
      y: 0,
      radius: 2,
      height: 6,
      maxHealth: TREE_HEALTH,
      health: TREE_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "bldg-nw",
      type: "building",
      model: "mybuilding",
      x: -55,
      y: -55,
      radius: 7,
      height: 12,
      width: 8,
      depth: 8,
      maxHealth: BUILDING_HEALTH,
      health: BUILDING_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "bldg-ne",
      type: "building",
      model: "mybuilding",
      x: 55,
      y: -55,
      radius: 7,
      height: 15,
      width: 10,
      depth: 6,
      maxHealth: BUILDING_HEALTH,
      health: BUILDING_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "bldg-sw",
      type: "building",
      model: "mybuilding",
      x: -55,
      y: 55,
      radius: 7,
      height: 10,
      width: 6,
      depth: 10,
      maxHealth: BUILDING_HEALTH,
      health: BUILDING_HEALTH,
      destroyed: false,
      debris: [],
    },
    {
      id: "bldg-se",
      type: "building",
      model: "mybuilding",
      x: 55,
      y: 55,
      radius: 7,
      height: 18,
      width: 8,
      depth: 8,
      maxHealth: BUILDING_HEALTH,
      health: BUILDING_HEALTH,
      destroyed: false,
      debris: [],
    },
    // DVLA main building - non-destructible landmark handled as a building so
    // server-side collisions will push players away instead of letting them pass through.
    {
      id: "dvlab-main",
      type: "building",
      x: 0,
      // Move server-side DVLA landmark to match the client DVLA visuals
      // which were shifted out-of-map; this prevents an invisible
      // blocking area at the scene origin while preserving a blocker
      // where the building actually is rendered.
      y: -100,
      radius: 12,
      height: 40,
      maxHealth: 99999,
      health: 99999,
      destroyed: false,
      debris: [],
    },
    // Custom ModelBuilder house (MyBuilding) placed near (-20, 0, 10)
    {
      id: "mybuilding-1",
      type: "building",
      x: -20,
      y: 10,
      radius: 6,
      height: 8,
      width: 6,
      depth: 6,
      maxHealth: BUILDING_HEALTH,
      health: BUILDING_HEALTH,
      destroyed: false,
      debris: [],
    },
    // Decorative snowmen and candy canes placed around the map
    {
      id: "snowman-1",
      type: "snowman",
      x: -46,
      y: -36,
      radius: 1.6,
      height: 2.4,
      maxHealth: 22,
      health: 22,
      destroyed: false,
      debris: [],
    },
    {
      id: "snowman-2",
      type: "snowman",
      x: 36,
      y: -20,
      radius: 1.6,
      height: 2.4,
      maxHealth: 22,
      health: 22,
      destroyed: false,
      debris: [],
    },
    {
      id: "snowman-3",
      type: "snowman",
      x: 48,
      y: 32,
      radius: 1.6,
      height: 2.4,
      maxHealth: 22,
      health: 22,
      destroyed: false,
      debris: [],
    },
    {
      id: "snowman-4",
      type: "snowman",
      x: -52,
      y: 28,
      radius: 1.6,
      height: 2.4,
      maxHealth: 22,
      health: 22,
      destroyed: false,
      debris: [],
    },
    {
      id: "snowman-5",
      type: "snowman",
      x: 12,
      y: -56,
      radius: 1.6,
      height: 2.4,
      maxHealth: 22,
      health: 22,
      destroyed: false,
      debris: [],
    },
    {
      id: "candy-1",
      type: "candy",
      x: 40,
      y: 36,
      radius: 0.9,
      height: 1.6,
      maxHealth: 12,
      health: 12,
      destroyed: false,
      debris: [],
    },
    {
      id: "candy-2",
      type: "candy",
      x: -48,
      y: -28,
      radius: 0.9,
      height: 1.6,
      maxHealth: 12,
      health: 12,
      destroyed: false,
      debris: [],
    },
    {
      id: "candy-3",
      type: "candy",
      x: 56,
      y: -44,
      radius: 0.9,
      height: 1.6,
      maxHealth: 12,
      health: 12,
      destroyed: false,
      debris: [],
    },
    {
      id: "candy-4",
      type: "candy",
      x: -60,
      y: 40,
      radius: 0.9,
      height: 1.6,
      maxHealth: 12,
      health: 12,
      destroyed: false,
      debris: [],
    },
    {
      id: "candy-5",
      type: "candy",
      x: 12,
      y: -60,
      radius: 0.9,
      height: 1.6,
      maxHealth: 12,
      health: 12,
      destroyed: false,
      debris: [],
    },
    // Central Santa - destructible landmark (kept in defs list; positions for reindeer will be added below)
    {
      id: "santa-center",
      type: "santa",
      x: 0,
      y: 0,
      radius: 6,
      height: 6,
      maxHealth: 500,
      health: 500,
      destroyed: false,
      debris: [],
    },
  ];

  // Scatter reindeer across the playable area while avoiding center and other objects
  const REINDEER_COUNT = 8;
  const MAP_EDGE = 88; // keep inside walls (~100)
  const MIN_DIST_FROM_CENTER = 8;
  const MIN_DIST_BETWEEN = 4;
  const MAX_ATTEMPTS = 800;

  function randRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const existingPositions: Array<{ x: number; y: number; radius: number }> =
    defs.map((d) => ({ x: d.x, y: d.y, radius: d.radius || 1 }));
  const reindeerDefs: Destructible[] = [];
  let attempts = 0;
  while (reindeerDefs.length < REINDEER_COUNT && attempts < MAX_ATTEMPTS) {
    attempts++;
    const x = Math.round(randRange(-MAP_EDGE + 6, MAP_EDGE - 6));
    const y = Math.round(randRange(-MAP_EDGE + 6, MAP_EDGE - 6));

    // avoid center area where Santa sits
    if (Math.hypot(x, y) < MIN_DIST_FROM_CENTER) continue;

    // avoid static map obstacles
    let blocked = false;
    for (const o of STATIC_MAP_OBSTACLES) {
      if (Math.hypot(x - o.x, y - o.y) < o.radius + 3) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // avoid overlapping other destructibles and previously placed reindeer
    let tooClose = false;
    for (const p of existingPositions) {
      if (Math.hypot(x - p.x, y - p.y) < (p.radius || 1) + MIN_DIST_BETWEEN) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    for (const p of reindeerDefs) {
      if (Math.hypot(x - p.x, y - p.y) < (p.radius || 1) + MIN_DIST_BETWEEN) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const id = `reindeer-${reindeerDefs.length}`;
    const d: Destructible = {
      id,
      type: "reindeer",
      x,
      y,
      radius: 1.2,
      height: 1.0,
      maxHealth: 40,
      health: 40,
      destroyed: false,
      debris: [],
    };
    reindeerDefs.push(d);
    existingPositions.push({ x: d.x, y: d.y, radius: d.radius });
  }

  // Merge reindeer defs into main defs list
  for (const r of reindeerDefs) defs.push(r);

  return new Map(defs.map((d) => [d.id, d]));
}

function createInitialDeliveries(): DeliveryItem[] {
  const spawnPoints = DELIVERY_SPAWN_POINTS.slice(0, DELIVERY_ITEM_COUNT);

  return spawnPoints.map((spawn, index) => {
    const delivery: DeliveryItem = {
      id: `delivery-${index}`,
      spawnX: spawn.x,
      spawnY: spawn.y,
      x: spawn.x,
      y: spawn.y,
      targetX: 0,
      targetY: 0,
      targetRadius: DELIVERY_DROP_RADIUS,
      state: "waiting",
    };

    randomizeDeliveryPosition(delivery);
    return delivery;
  });
}

function resetPlayerForRace(player: PlayerCar) {
  const pos = findSpawnPosition();
  player.x = pos.x;
  player.y = pos.y;
  player.z = 0.3;
  player.angle = Math.random() * Math.PI * 2;
  player.speed = 0;
  player.verticalSpeed = 0;
  player.damage = 0;
  player.missingParts = [];
  player.destroyed = false;
  player.score = 0;
  player.ready = false;
  player.carryingDeliveryId = undefined;
  player.activePowerUps = [];
}

export function startRace() {
  if (room.gameState === "racing") {
    return;
  }
  room.gameState = "racing";
  room.matchDurationMs = MATCH_DURATION_MS;
  room.raceStartTime = Date.now();
  room.raceEndTime = room.raceStartTime + room.matchDurationMs;
  // Create and store a signed match token so other serverless workers can
  // adopt the same race timing without shared state.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  room.currentMatchToken = createMatchToken(
    room.raceStartTime,
    room.matchDurationMs
  );
  room.destructibles = createInitialDestructibles();
  room.deliveries = createInitialDeliveries();
  room.powerUps = createInitialPowerUps();
  // Log spawn of initial powerups
  for (const pu of room.powerUps) {
    console.log(`[GameState] Spawned powerup ${pu.type} at ${pu.x},${pu.y}`);
    recordSystemEvent(
      `Spawned powerup ${pu.type} at ${Math.round(pu.x)},${Math.round(pu.y)}`
    );
  }
  room.leaderboard = [];
  room.events = [];
  room.lastPhysicsUpdate = Date.now();

  for (const player of room.players.values()) {
    resetPlayerForRace(player);
  }
  console.log(
    `[GameState] Race started: start=${new Date(
      room.raceStartTime
    ).toISOString()} end=${new Date(
      room.raceEndTime!
    ).toISOString()} durationMs=${room.matchDurationMs}`
  );
  // Clear any previously scheduled finalize (safety)
  try {
    if (room.scheduledFinalize) {
      clearTimeout(room.scheduledFinalize as any);
      room.scheduledFinalize = null;
    }
  } catch (e) {}

  // Schedule a server-side finalize to ensure the match ends even if
  // clients stop polling the server near the end of the match.
  try {
    const delay = Math.max(0, (room.raceEndTime || Date.now()) - Date.now());
    room.scheduledFinalize = setTimeout(() => {
      try {
        if (room.gameState === "racing") {
          // Double-check timing to avoid races being finalized prematurely
          const now = Date.now();
          if (!room.raceEndTime || now >= room.raceEndTime) {
            finalizeRace();
          }
        }
      } catch (err) {
        console.error("Error in scheduled finalizeRace:", err);
      }
    }, delay + 50); // small buffer
  } catch (e) {}
}

function finalizeRace() {
  const now = Date.now();
  console.log(
    `[GameState] finalizeRace() called at ${new Date(now).toISOString()}`
  );
  console.log(
    `[GameState] raceStart=${
      room.raceStartTime ? new Date(room.raceStartTime).toISOString() : "nil"
    } raceEnd=${
      room.raceEndTime ? new Date(room.raceEndTime).toISOString() : "nil"
    } now=${new Date(now).toISOString()} durationMs=${room.matchDurationMs}`
  );
  room.gameState = "finished";
  const snapshot = Array.from(room.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    score: Math.round(player.score || 0),
    color: player.color,
  }));
  room.leaderboard = snapshot.sort((a, b) => b.score - a.score);
  room.raceEndTime = now;
  // Schedule a reset back to lobby in 60 seconds to give players time to
  // review the leaderboard and recap. The lobby will control starting
  // the next round (players must ready-up or lobby must trigger it).
  room.resetScheduledAt = now + 60 * 1000; // 60 seconds
  recordSystemEvent(
    `Match ended - resetting to lobby at ${new Date(
      room.resetScheduledAt
    ).toLocaleTimeString()}`
  );
  // Immediately clear debris now that the match is finished so clients
  // will stop rendering debris on the next snapshot.
  try {
    updateDestructibleDebris(room.destructibles, 0, 0);
  } catch (err) {
    console.error("Error clearing destructible debris at finalizeRace:", err);
  }
  // Clear any scheduled finalize timer
  try {
    if (room.scheduledFinalize) {
      clearTimeout(room.scheduledFinalize as any);
      room.scheduledFinalize = null;
    }
  } catch (e) {}
}

export function getTimerState() {
  if (!room.raceStartTime || !room.raceEndTime) {
    return null;
  }

  const now = Date.now();
  return {
    startedAt: room.raceStartTime,
    endsAt: room.raceEndTime,
    durationMs: room.matchDurationMs,
    timeRemainingMs: Math.max(room.raceEndTime - now, 0),
  };
}

export function getLeaderboard() {
  if (room.leaderboard.length) {
    return room.leaderboard;
  }

  return Array.from(room.players.values())
    .map((player) => ({
      id: player.id,
      name: player.name,
      score: Math.round(player.score || 0),
      color: player.color,
    }))
    .sort((a, b) => b.score - a.score);
}

export function getRoom(): Room {
  return room;
}

export function setGameState(state: GameState) {
  room.gameState = state;
}

export function getGameState(): GameState {
  return room.gameState;
}

export function getServerFps(): number {
  return room.serverFps || 0;
}

export function createOrUpdatePlayer(
  playerId: string,
  name: string,
  steer: number,
  throttle: number,
  lastKnown?: { lastX?: number; lastY?: number; lastAngle?: number }
): PlayerCar {
  const currentRoom = getRoom();

  if (!currentRoom.players.has(playerId)) {
    // Create new player - if the client provided a last-known position
    // use that to initialize the player so serverless cold workers that
    // haven't yet seen this player synchronize to the client's location.
    const spawn = findSpawnPosition();
    const useX =
      typeof lastKnown?.lastX === "number" ? lastKnown!.lastX! : spawn.x;
    const useY =
      typeof lastKnown?.lastY === "number" ? lastKnown!.lastY! : spawn.y;
    const startAngle =
      typeof lastKnown?.lastAngle === "number"
        ? lastKnown!.lastAngle!
        : Math.random() * Math.PI * 0.2 - Math.PI * 0.1;
    const player: PlayerCar = {
      id: playerId,
      name,
      x: useX,
      y: useY,
      z: 0.3, // Car height off ground
      angle: startAngle,
      speed: 0,
      verticalSpeed: 0,
      steer,
      throttle,
      color: colorFromId(playerId),
      lastUpdate: Date.now(),
      ready: false,
      damage: 0,
      missingParts: [],
      destroyed: false,
      score: 0,
      carryingDeliveryId: undefined,
      activePowerUps: [],
    };
    currentRoom.players.set(playerId, player);
    console.log(
      `[${INSTANCE_ID}] Created new player ${playerId} at position (${player.x}, ${player.y})`
    );
    autoStartRaceIfNeeded();
    return player;
  } else {
    // Update existing player
    const player = currentRoom.players.get(playerId)!;
    player.steer = steer;
    player.throttle = throttle;
    player.lastUpdate = Date.now();
    autoStartRaceIfNeeded();
    return player;
  }
}

export function updatePlayerReady(
  playerId: string,
  name: string,
  ready: boolean
): PlayerCar {
  const currentRoom = getRoom();

  if (!currentRoom.players.has(playerId)) {
    const spawn = findSpawnPosition();
    const player: PlayerCar = {
      id: playerId,
      name,
      x: spawn.x,
      y: spawn.y,
      z: 0.3,
      angle: 0,
      speed: 0,
      verticalSpeed: 0,
      steer: 0,
      throttle: 0,
      color: colorFromId(playerId),
      lastUpdate: Date.now(),
      ready,
      damage: 0,
      missingParts: [],
      destroyed: false,
      score: 0,
      carryingDeliveryId: undefined,
    };
    currentRoom.players.set(playerId, player);
    return player;
  } else {
    const player = currentRoom.players.get(playerId)!;
    player.ready = ready;
    player.lastUpdate = Date.now();
    return player;
  }
}

export function setPlayerColor(playerId: string, color: string) {
  const currentRoom = getRoom();
  if (!currentRoom.players.has(playerId)) return null;
  const player = currentRoom.players.get(playerId)!;
  player.color = color;
  player.lastUpdate = Date.now();
  return player;
}

// Repair a player's car by reducing damage by `amount` (0-100).
// If damage falls below the destruction threshold the destroyed flag is cleared.
export function repairPlayer(playerId: string, amount: number) {
  const currentRoom = getRoom();
  if (!currentRoom.players.has(playerId)) return null;
  const player = currentRoom.players.get(playerId)!;
  const prev = player.damage || 0;
  player.damage = Math.max(0, prev - Math.abs(amount));
  if ((player.damage || 0) < CAR_DESTROY_THRESHOLD) {
    player.destroyed = false;
  }
  player.lastUpdate = Date.now();
  recordSystemEvent(
    `Repaired ${player.id} by ${amount} (damage ${prev} -> ${player.damage})`
  );
  return player;
}

export function checkAllReady(): boolean {
  const currentRoom = getRoom();
  const players = Array.from(currentRoom.players.values());
  return players.length > 0 && players.every((p) => p.ready);
}

export function updatePhysics(): PlayerCar[] {
  const currentRoom = getRoom();
  const now = Date.now();
  const elapsedMs = now - currentRoom.lastPhysicsUpdate;

  // Track server tick counts for diagnostics (sampled per second)
  try {
    currentRoom.serverTickCount = (currentRoom.serverTickCount || 0) + 1;
    if (!currentRoom.lastTickSampleAt) currentRoom.lastTickSampleAt = now;
    const sampleElapsed = now - currentRoom.lastTickSampleAt;
    if (sampleElapsed >= 1000) {
      const counted = currentRoom.serverTickCount || 0;
      currentRoom.serverFps = Math.round((counted * 1000) / sampleElapsed);
      currentRoom.serverTickCount = 0;
      currentRoom.lastTickSampleAt = now;
    }
  } catch (e) {
    console.warn("[GameState] server tick sampling failed", e);
  }

  // Clean up inactive players first
  for (const [playerId, player] of currentRoom.players.entries()) {
    if (now - player.lastUpdate > PLAYER_TIMEOUT) {
      console.log(`Removing inactive player: ${playerId}`);
      if (player.carryingDeliveryId) {
        dropDeliveryForPlayer(player);
      }
      currentRoom.players.delete(playerId);
    }
  }

  if (elapsedMs < MIN_PHYSICS_STEP_MS) {
    // Multiple clients poll the API every 50ms; only the first request after a tick should advance the simulation.
    return Array.from(currentRoom.players.values());
  }

  const dt = Math.min(elapsedMs / 1000, 0.1); // Cap dt to prevent huge jumps
  currentRoom.lastPhysicsUpdate = now;

  const baseMaxSpeed = 25; // Maximum speed before damage penalties
  const baseAcceleration = 20; // Acceleration rate before damage
  const baseDeceleration = 15; // Natural slowdown baseline
  const baseTurnSpeed = 3.0; // radians per second

  // Always update physics, regardless of game state
  const gravity = -25; // Gravity acceleration
  const groundHeight = 0.3; // Normal car height

  for (const player of currentRoom.players.values()) {
    const currentDamage = player.damage || 0;
    const wasDestroyed = !!player.destroyed;
    player.destroyed = currentDamage >= CAR_DESTROY_THRESHOLD;
    // Periodic server-side repairs handle healing for all players every
    // SERVER_PERIODIC_REPAIR_MS; no per-player timeout scheduling here.
    const performanceScale = getPerformanceScale(currentDamage);
    // Expire player's active powerups and compute speed multiplier
    player.activePowerUps = (player.activePowerUps || []).filter(
      (ap) => ap.expiresAt > now
    );
    let speedMultiplier = 1;
    for (const ap of player.activePowerUps || []) {
      if (ap.type === "speed" && ap.value) speedMultiplier *= ap.value;
    }

    const maxSpeed = baseMaxSpeed * performanceScale * speedMultiplier;
    const acceleration = baseAcceleration * performanceScale * speedMultiplier;
    const deceleration = baseDeceleration * (0.6 + 0.4 * performanceScale);
    const turnSpeed = baseTurnSpeed * (0.5 + 0.5 * performanceScale);

    if (player.destroyed) {
      // Immediately immobilize destroyed players to avoid them sliding or
      // responding to inputs after being marked destroyed. Keep them on the
      // ground and clear movement-related inputs/state.
      player.speed = 0;
      player.throttle = 0;
      player.steer = 0;
      player.verticalSpeed = 0;
      player.z = groundHeight;
      // Skip movement/turning for destroyed players
      continue;
    } else {
      // Apply acceleration/deceleration based on throttle
      if (player.throttle > 0) {
        player.speed += acceleration * player.throttle * dt;
        if (player.speed > maxSpeed) player.speed = maxSpeed;
      } else if (player.throttle < 0) {
        player.speed += acceleration * player.throttle * dt;
        if (player.speed < -maxSpeed * 0.5) player.speed = -maxSpeed * 0.5;
      } else {
        // Natural deceleration when no input
        if (player.speed > 0) {
          player.speed -= deceleration * dt;
          if (player.speed < 0) player.speed = 0;
        } else if (player.speed < 0) {
          player.speed += deceleration * dt;
          if (player.speed > 0) player.speed = 0;
        }
      }
    }

    // Only turn if moving (turning is proportional to speed)
    if (Math.abs(player.speed) > 0.5) {
      const turnFactor = Math.min(Math.abs(player.speed) / maxSpeed, 1);
      // Client steer: positive = right, negative = left. Subtract steer
      // here so a positive steer rotates the car to the right in world space.
      player.angle -=
        player.steer * turnSpeed * dt * turnFactor * Math.sign(player.speed);
    }

    // Calculate horizontal movement
    const dx = -Math.sin(player.angle) * player.speed * dt;
    const dy = -Math.cos(player.angle) * player.speed * dt;
    player.x += dx;
    player.y += dy;

    // Check if on ramp (ramp is at y ≈ 27, x between -6 and 6)
    const onRamp = Math.abs(player.y - 27) < 4 && Math.abs(player.x) < 6;

    if (onRamp && player.z <= groundHeight + 3) {
      const rampLocalZ = player.y - 27;
      let rampHeight = groundHeight;

      if (rampLocalZ < -1 && rampLocalZ > -4) {
        const progress = (-rampLocalZ - 1) / 3;
        rampHeight = groundHeight + progress * 2.5;
      } else if (rampLocalZ >= -1 && rampLocalZ <= 1) {
        rampHeight = groundHeight + 2.8;
        if (Math.abs(player.speed) > 8 && player.verticalSpeed <= 0) {
          player.verticalSpeed = Math.abs(player.speed) * 0.4;
        }
      } else if (rampLocalZ > 1 && rampLocalZ < 4) {
        const progress = (rampLocalZ - 1) / 3;
        rampHeight = groundHeight + 2.8 - progress * 2.5;
      }

      if (player.z < rampHeight) {
        player.z = rampHeight;
        player.verticalSpeed = 0;
      }
    }

    // Apply gravity
    player.verticalSpeed += gravity * dt;
    player.z += player.verticalSpeed * dt;

    if (player.z <= groundHeight) {
      const impactSpeed = Math.abs(player.verticalSpeed);
      if (impactSpeed > 10) {
        const damageAmount = (impactSpeed - 10) * 5;
        addCarDamage(player, damageAmount);
        player.lastCollisionSpeed = impactSpeed;
      }

      player.z = groundHeight;
      player.verticalSpeed = 0;
    }

    handleDestructibleCollisions(player, currentRoom.destructibles);
    handlePlayerCollisions(player, currentRoom.players);
  }

  updateDestructibleDebris(currentRoom.destructibles, dt, gravity);
  updateDeliveries(currentRoom.players);

  // Repel effect: players with active 'repel' push nearby other players away
  const REPEL_FORCE = 18; // tuning: how strong the push is
  for (const player of currentRoom.players.values()) {
    if (!player.activePowerUps) continue;
    const hasRepel = player.activePowerUps.some(
      (ap) => ap.type === "repel" && ap.expiresAt > now
    );
    if (!hasRepel) continue;
    const cfg = SERVER_POWERUP_CONFIGS.repel;
    const radius = cfg?.effect?.repelRadius || 8;
    for (const other of currentRoom.players.values()) {
      if (other.id === player.id) continue;
      if (other.destroyed) continue;
      const dx = other.x - player.x;
      const dy = other.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0 || dist > radius) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const strength = (1 - dist / radius) * REPEL_FORCE;
      // Nudge other player away (server-authoritative). Scale by dt so it's stable.
      other.x += nx * strength * dt;
      other.y += ny * strength * dt;
      // Slightly boost outward velocity so effect feels like a shove
      other.speed = Math.max(
        other.speed,
        Math.min(25, other.speed + strength * 0.2)
      );
    }
  }

  // Handle powerup pickups and respawns
  const pickupRadius = 3;
  for (const pu of currentRoom.powerUps) {
    // Respawn if time passed
    if (pu.collected && pu.respawnAt && now >= pu.respawnAt) {
      pu.collected = false;
      pu.collectedBy = undefined;
      pu.collectedAt = undefined;
      pu.respawnAt = undefined;
      console.log(
        `[GameState] Respawned powerup ${pu.type} id=${pu.id} at ${pu.x},${pu.y}`
      );
      recordSystemEvent(
        `Respawned powerup ${pu.type} at ${Math.round(pu.x)},${Math.round(
          pu.y
        )}`
      );
      continue;
    }

    if (pu.collected) continue;

    for (const player of currentRoom.players.values()) {
      if (player.destroyed) continue;
      const dx = player.x - pu.x;
      const dy = player.y - pu.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= pickupRadius) {
        pu.collected = true;
        pu.collectedBy = player.id;
        pu.collectedAt = now;
        const cfg = SERVER_POWERUP_CONFIGS[pu.type];
        pu.respawnAt = now + (cfg.respawnTime || 30000);

        console.log(
          `[GameState] PowerUp collected: ${pu.type} by ${player.id} at ${pu.x},${pu.y}`
        );
        recordSystemEvent(`PowerUp collected: ${pu.type} by ${player.id}`);

        // Apply effect
        if (cfg.duration && cfg.duration > 0) {
          if (!player.activePowerUps) player.activePowerUps = [];
          player.activePowerUps.push({
            type: pu.type,
            activatedAt: now,
            expiresAt: now + cfg.duration,
            value: cfg.effect?.speedMultiplier,
          });
          console.log(
            `[GameState] Applied active powerup ${pu.type} to ${
              player.id
            } expires=${new Date(now + cfg.duration).toISOString()} value=${
              cfg.effect?.speedMultiplier
            }`
          );
          recordMatchEvent(player, 0, `Activated powerup ${pu.type}`);
        } else {
          // Instant/one-off effects
          if (cfg.effect?.healAmount) {
            player.damage = Math.max(
              0,
              (player.damage || 0) - cfg.effect!.healAmount!
            );
            console.log(
              `[GameState] Applied heal ${cfg.effect!.healAmount} to ${
                player.id
              } -> damage=${player.damage}`
            );
            recordMatchEvent(player, 0, `Healed ${cfg.effect!.healAmount}`);
          }
          if (pu.type === "teleport") {
            // Teleport player to a random ROOM_POWERUP_CANDIDATES location that's not too close
            const candidates = ROOM_POWERUP_CANDIDATES.slice();
            // shuffle
            for (let i = candidates.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }
            let placed = false;
            for (const cand of candidates) {
              // avoid destructibles/players
              let tooClose = false;
              for (const d of room.destructibles.values()) {
                if (Math.hypot(d.x - cand.x, d.y - cand.y) < d.radius + 6) {
                  tooClose = true;
                  break;
                }
              }
              if (tooClose) continue;
              for (const p of room.players.values()) {
                if (Math.hypot(p.x - cand.x, p.y - cand.y) < 6) {
                  tooClose = true;
                  break;
                }
              }
              if (tooClose) continue;
              // perform teleport
              player.x = cand.x + (Math.random() - 0.5) * 1.5;
              player.y = cand.y + (Math.random() - 0.5) * 1.5;
              player.z = groundHeight;
              player.verticalSpeed = 0;
              console.log(
                `[GameState] Teleported ${player.id} to ${player.x},${player.y}`
              );
              recordMatchEvent(player, 0, `Teleported`);
              placed = true;
              break;
            }
            if (!placed) {
              console.log(
                `[GameState] Teleport failed for ${player.id} - no safe candidate`
              );
            }
          }
        }

        recordMatchEvent(player, 0, `Collected powerup ${pu.type}`);
        break;
      }
    }
  }

  // Spawn additional powerups dynamically based on number of carried deliveries.
  // Respect the configured `MAX_INITIAL_POWERUPS` so dynamic logic cannot
  // accidentally reduce the active powerup count below the intended initial
  // maximum (this was causing only 3 powerups to appear in some runs).
  const carriedCount = room.deliveries.filter(
    (d) => d.state === "carried"
  ).length;
  const maxPowerUps = Math.max(3, MAX_INITIAL_POWERUPS, 3 * carriedCount);
  const activeCount = room.powerUps.filter((p) => !p.collected).length;
  if (activeCount < maxPowerUps) {
    const need = maxPowerUps - activeCount;
    const candidates = ROOM_POWERUP_CANDIDATES.slice();
    // simple shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    let spawned = 0;
    for (const cand of candidates) {
      if (spawned >= need) break;
      // avoid spawning too close to existing active powerups, players, deliveries, destructibles
      const minDistSpawn = 8;
      let tooClose = false;
      for (const p of room.players.values()) {
        if (Math.hypot(p.x - cand.x, p.y - cand.y) < minDistSpawn) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      for (const d of room.destructibles.values()) {
        if (Math.hypot(d.x - cand.x, d.y - cand.y) < d.radius + minDistSpawn) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      for (const dv of room.deliveries) {
        if (Math.hypot(dv.x - cand.x, dv.y - cand.y) < minDistSpawn) {
          tooClose = true;
          break;
        }
        if (Math.hypot(dv.spawnX - cand.x, dv.spawnY - cand.y) < minDistSpawn) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      if (
        room.powerUps.some(
          (p) =>
            !p.collected &&
            Math.hypot(p.x - cand.x, p.y - cand.y) < minDistSpawn
        )
      )
        continue;
      const types = Object.keys(SERVER_POWERUP_CONFIGS) as PowerUpType[];
      const t = types[Math.floor(Math.random() * types.length)];
      const newPu: PowerUpItem = {
        id: `pu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: t,
        x: cand.x,
        y: cand.y,
        z: 0.8,
        collected: false,
      };
      room.powerUps.push(newPu);
      console.log(
        `[GameState] Dynamically spawned powerup ${t} at ${cand.x},${cand.y}`
      );
      recordSystemEvent(
        `Spawned powerup ${t} at ${Math.round(cand.x)},${Math.round(cand.y)}`
      );
      spawned++;
    }
  }

  if (currentRoom.gameState === "racing") {
    // Check if time is up
    if (currentRoom.raceEndTime && now >= currentRoom.raceEndTime) {
      console.log(
        `[GameState] updatePhysics: time is up (now=${new Date(
          now
        ).toISOString()} raceEnd=${new Date(
          currentRoom.raceEndTime
        ).toISOString()}) -> finalizeRace()`
      );
      finalizeRace();
    }
    // Check if all players are destroyed
    else {
      const allDestroyed = Array.from(currentRoom.players.values()).every(
        (p) => p.destroyed
      );
      if (allDestroyed && currentRoom.players.size > 0) {
        console.log(
          `[GameState] updatePhysics: all players destroyed -> finalizeRace()`
        );
        finalizeRace();
      }
    }
  }

  // If the room is in `finished` state and a reset was scheduled, perform
  // the reset when the scheduled time arrives. This clears the world and
  // returns the room to the lobby so players can ready-up for the next round.
  if (
    currentRoom.gameState === "finished" &&
    currentRoom.resetScheduledAt &&
    now >= currentRoom.resetScheduledAt
  ) {
    console.log(
      `[GameState] updatePhysics: resetScheduledAt reached -> resetting room to lobby at ${new Date(
        now
      ).toISOString()}`
    );
    // Reset world objects so next round starts clean. Do not auto-start;
    // the lobby must trigger the next round via ready / lobby API.
    currentRoom.gameState = "lobby";
    currentRoom.resetScheduledAt = undefined;
    currentRoom.destructibles = createInitialDestructibles();
    currentRoom.deliveries = createInitialDeliveries();
    currentRoom.powerUps = [];
    currentRoom.events = [];
    // Clear player ready flags so lobby can manage next-start explicitly
    for (const p of currentRoom.players.values()) {
      p.ready = false;
      // also ensure destroyed flags are reset for any player that might still be marked
      p.destroyed = false;
      p.damage = 0;
      p.carryingDeliveryId = undefined;
      p.activePowerUps = [];
    }
    recordSystemEvent("Server reset to lobby after match end");
  }

  return Array.from(currentRoom.players.values());
}

export function getRoomState(): PlayerCar[] {
  const currentRoom = getRoom();
  return Array.from(currentRoom.players.values());
}

export function getDestructibleState(): Destructible[] {
  return Array.from(room.destructibles.values());
}

export function getDeliveries(): DeliveryItem[] {
  return room.deliveries.map((delivery) => ({ ...delivery }));
}

export function getMatchEvents(): MatchEvent[] {
  return room.events.map((event) => ({ ...event }));
}

export function getPowerUps(): PowerUpItem[] {
  return room.powerUps.map((p) => ({ ...p }));
}

function addCarDamage(player: PlayerCar, amount: number) {
  if (amount <= 0) return;
  // If player has an active shield powerup, ignore damage
  if (
    player.activePowerUps &&
    player.activePowerUps.some(
      (ap) => ap.type === "shield" && ap.expiresAt > Date.now()
    )
  ) {
    return;
  }
  const base = player.damage || 0;
  const next = Math.min(base + amount, CAR_DESTROY_THRESHOLD);
  player.damage = next;
  updateMissingParts(player);
  if (next >= CAR_DESTROY_THRESHOLD) {
    player.destroyed = true;
    player.speed = 0;
    player.verticalSpeed = 0;
    try {
      // Per-player timeouts removed. Periodic server repairs will heal players
      // automatically every SERVER_PERIODIC_REPAIR_MS.
    } catch (e) {}
  }
}

function addScore(player: PlayerCar, amount: number, description?: string) {
  if (amount <= 0) return;
  // Double points powerup multiplies score gains
  let finalAmount = amount;
  if (
    player.activePowerUps &&
    player.activePowerUps.some(
      (ap) => ap.type === "doublePoints" && ap.expiresAt > Date.now()
    )
  ) {
    finalAmount = amount * 2;
  }
  player.score = (player.score || 0) + Math.round(finalAmount);
  if (description) {
    recordMatchEvent(player, finalAmount, description);
  }
}

function updateMissingParts(player: PlayerCar) {
  if (!player.missingParts) player.missingParts = [];
  const parts = player.missingParts;
  if (player.damage && player.damage > 85 && !parts.includes("cabin")) {
    parts.push("cabin");
  }
}

function getImpactZone(
  player: PlayerCar,
  normalX: number,
  normalY: number
): ImpactZone {
  const angle = player.angle ?? 0;
  const forwardX = -Math.sin(angle);
  const forwardY = -Math.cos(angle);
  const rightX = forwardY;
  const rightY = -forwardX;
  const forwardDot = normalX * forwardX + normalY * forwardY;
  const rightDot = normalX * rightX + normalY * rightY;
  if (Math.abs(forwardDot) >= Math.abs(rightDot)) {
    return forwardDot >= 0 ? "front" : "rear";
  }
  return rightDot >= 0 ? "right" : "left";
}

function applyDirectionalDamage(
  player: PlayerCar,
  zone: ImpactZone,
  severity: number
) {
  if (!player.missingParts) player.missingParts = [];
  const rules = IMPACT_ZONE_RULES[zone];
  if (!rules || !rules.length) return;
  const effective = Math.max(severity - 6, 0);
  for (const rule of rules) {
    if (
      effective + Math.random() * 3 >= rule.minSeverity &&
      !player.missingParts.includes(rule.part)
    ) {
      player.missingParts.push(rule.part);
    }
  }
}

function registerDirectionalImpact(
  player: PlayerCar,
  normalX: number,
  normalY: number,
  severity: number
) {
  if (!player || severity <= 0) return;
  applyDirectionalDamage(
    player,
    getImpactZone(player, normalX, normalY),
    severity
  );
}

function handleDestructibleCollisions(
  player: PlayerCar,
  destructibles: Map<string, Destructible>
) {
  if (player.destroyed) return;

  for (const destructible of destructibles.values()) {
    if (destructible.destroyed) continue;

    const dx = player.x - destructible.x;
    const dy = player.y - destructible.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = destructible.radius + 1.2;

    if (distance < hitRadius) {
      const normalX = distance === 0 ? 1 : dx / distance;
      const normalY = distance === 0 ? 0 : dy / distance;
      const horizontalSpeed = Math.abs(player.speed);
      const verticalInfluence = Math.abs(player.verticalSpeed) * 0.4;
      const impactVelocity = Math.hypot(horizontalSpeed, verticalInfluence);
      if (impactVelocity < 1.5) continue;

      // If this is the server-only DVLA landmark, treat it as a static
      // blocking object that should not damage the car. Push the player
      // out and damp speed, but do not apply destructible or car damage.
      if (destructible.id === "dvlab-main") {
        const penetration = hitRadius - distance + 0.2;
        player.x += normalX * penetration;
        player.y += normalY * penetration;
        player.speed *= 0.35;
        // don't spawn debris or apply damage for this landmark
        continue;
      }

      // Calculate raw damage from impact velocity, then clamp per-hit so
      // a single collision doesn't instantly destroy a tree/building.
      const rawDamage =
        impactVelocity * (destructible.type === "building" ? 6.5 : 6);
      // Per-hit caps (trees should take multiple hits to fully destroy)
      const PER_HIT_CAP = destructible.type === "building" ? 60 : 18;
      let destructibleDamage = Math.min(rawDamage, PER_HIT_CAP);

      // Debounce repeated hits when a car remains contacting the object.
      const HIT_COOLDOWN_MS = 450; // 450ms between allowed hits
      const now = Date.now();
      if (
        destructible.lastHitAt &&
        now - destructible.lastHitAt < HIT_COOLDOWN_MS
      ) {
        // Skip applying damage if within cooldown window (prevents rapid repeated damage)
        continue;
      }
      destructible.lastHitAt = now;
      const carDamage =
        impactVelocity * (destructible.type === "building" ? 1.35 : 1.2);
      const safeDistance = distance || destructible.radius || 1;
      const contactDistance = Math.min(safeDistance, destructible.radius);
      const contactX = destructible.x + normalX * contactDistance;
      const contactY = destructible.y + normalY * contactDistance;
      const contactZ = Math.min(
        destructible.height,
        Math.max(0.35, player.z + 0.6)
      );
      applyDestructibleDamage(destructible, destructibleDamage, {
        normalX,
        normalY,
        contactX,
        contactY,
        contactZ,
      });
      addCarDamage(player, carDamage);
      player.lastCollisionSpeed = impactVelocity;
      registerDirectionalImpact(player, normalX, normalY, impactVelocity);
      const destructionBonus = destructible.destroyed ? 50 : 0;
      const targetLabel =
        destructible.type === "building" ? "building" : "tree";
      const description = destructible.destroyed
        ? `Leveled a ${targetLabel}`
        : `Slammed a ${targetLabel} (${impactVelocity.toFixed(1)} m/s)`;
      addScore(player, destructibleDamage + destructionBonus, description);

      const penetration = hitRadius - distance + 0.2;
      player.x += normalX * penetration;
      player.y += normalY * penetration;
      player.speed *= 0.35;
    }
  }
}

function handlePlayerCollisions(
  player: PlayerCar,
  players: Map<string, PlayerCar>
) {
  for (const otherPlayer of players.values()) {
    if (otherPlayer.id <= player.id) continue;

    const dx = player.x - otherPlayer.x;
    const dy = player.y - otherPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 2 && Math.abs(player.z - otherPlayer.z) < 1) {
      const relativeSpeed = Math.abs(player.speed - otherPlayer.speed);
      if (relativeSpeed > 15) {
        const damageAmount = (relativeSpeed - 15) * 3;
        addCarDamage(player, damageAmount);
        addCarDamage(otherPlayer, damageAmount);
        addScore(
          player,
          damageAmount * 0.5,
          `Crashed into ${otherPlayer.name} (${damageAmount.toFixed(1)} dmg)`
        );
        addScore(
          otherPlayer,
          damageAmount * 0.5,
          `Crashed into ${player.name} (${damageAmount.toFixed(1)} dmg)`
        );
        player.lastCollisionSpeed = relativeSpeed;
        otherPlayer.lastCollisionSpeed = relativeSpeed;
        const nx = distance === 0 ? 1 : dx / distance;
        const ny = distance === 0 ? 0 : dy / distance;
        const pushX = nx * 2;
        const pushY = ny * 2;
        player.x += pushX;
        player.y += pushY;
        otherPlayer.x -= pushX;
        otherPlayer.y -= pushY;

        registerDirectionalImpact(player, nx, ny, relativeSpeed);
        registerDirectionalImpact(otherPlayer, -nx, -ny, relativeSpeed);

        player.speed *= 0.5;
        otherPlayer.speed *= 0.5;

        handleDeliveryCollision(player, otherPlayer, relativeSpeed);
      }
    }
  }
}

type DestructibleImpact = {
  normalX: number;
  normalY: number;
  contactX: number;
  contactY: number;
  contactZ: number;
};

function applyDestructibleDamage(
  destructible: Destructible,
  amount: number,
  impact: DestructibleImpact
) {
  if (amount <= 0) return;

  // Apply damage to destructibles. Buildings are now damageable like trees
  // (they previously only emitted debris for feedback). We still spawn debris
  // on impact; if health drops to 0 the destructible is marked destroyed.
  destructible.health = Math.max(destructible.health - amount, 0);
  const shatter = destructible.health <= 0;
  if (shatter) {
    destructible.destroyed = true;
  }

  // Spawn debris. For buildings we may choose to emit larger pieces.
  spawnDebris(destructible, impact, shatter);
}

function spawnDebris(
  destructible: Destructible,
  impact: DestructibleImpact,
  shatter: boolean
) {
  const now = Date.now();
  logDebug(
    `[GameState] spawnDebris called for ${destructible.id} shatter=${shatter}`
  );
  // If this destructible has already been shattered/emitted debris, don't
  // allow further non-shatter spawns. This prevents lingering repeated
  // debris when trees are already destroyed.
  if (destructible.destroyed && destructible.debrisEmitted) {
    console.log(
      `[GameState] spawnDebris: skipping ${destructible.id} because already destroyed and debrisEmitted`
    );
    return;
  }
  // Prevent repeated debris bursts for the same destructible.
  if (shatter) {
    if (destructible.debrisEmitted) {
      // already emitted the big shatter burst
      console.log(
        `[GameState] spawnDebris: skipping ${destructible.id} shatter already emitted`
      );
      return;
    }
    destructible.debrisEmitted = true;
    // avoid tiny follow-up spawns for a short cooldown window
    destructible.lastDebrisAt = now;
  } else {
    // For non-shatter hits (small chunks), rate-limit repeated spawns
    if (destructible.lastDebrisAt && now - destructible.lastDebrisAt < 600) {
      console.log(
        `[GameState] spawnDebris: rate-limited non-shatter spawn for ${destructible.id} (lastDebrisAt=${destructible.lastDebrisAt})`
      );
      return;
    }
    destructible.lastDebrisAt = now;
  }
  const { normalX, normalY, contactX, contactY, contactZ } = impact;
  const chunkCount = shatter
    ? destructible.type === "building"
      ? 10
      : 6
    : destructible.type === "building"
    ? 6
    : 3;

  // Determine color based on destructible type and custom color if available
  // Snowman debris should be white; trees/candy remain green-ish by default.
  const baseColor =
    destructible.type === "building"
      ? destructible.color || "#9ca3af"
      : destructible.type === "snowman"
      ? "#ffffff"
      : "#14532d";

  for (let i = 0; i < chunkCount; i++) {
    const size =
      destructible.type === "building"
        ? 0.6 + Math.random() * 1.2
        : 0.3 + Math.random() * 0.4;
    const spread = shatter ? 3 + Math.random() * 2 : 1 + Math.random();
    const vx = normalX * spread + (Math.random() - 0.5) * 1.5;
    const vy = normalY * spread + (Math.random() - 0.5) * 1.5;
    const vz = 4 + Math.random() * 4;

    destructible.debris.push({
      id: `${destructible.id}-debris-${Date.now()}-${i}-${Math.random()
        .toString(36)
        .slice(2, 5)}`,
      x: contactX + (Math.random() - 0.5) * 0.6,
      y: contactY + (Math.random() - 0.5) * 0.6,
      z: Math.min(destructible.height, contactZ + Math.random() * 0.6),
      vx,
      vy,
      vz,
      ttl: shatter ? 0 : DEBRIS_TTL,
      persistent: !!shatter,
      size,
      color: baseColor,
    });
    logDebug(
      `[GameState] spawnDebris: added chunk ${
        destructible.debris[destructible.debris.length - 1].id
      } to ${destructible.id} (persistent=${shatter}) total=${
        destructible.debris.length
      }`
    );
    // enforce a reasonable cap for server-side debris per destructible
    const MAX_DEBRIS_PER_DESTRUCTIBLE = 40;
    if (destructible.debris.length > MAX_DEBRIS_PER_DESTRUCTIBLE) {
      // drop the oldest pieces to keep the buffer bounded
      const removed = destructible.debris.splice(
        0,
        destructible.debris.length - MAX_DEBRIS_PER_DESTRUCTIBLE
      );
      logDebug(
        `[GameState] spawnDebris: pruned ${removed.length} old debris from ${destructible.id} -> now ${destructible.debris.length}`
      );
    }
  }
}

function updateDestructibleDebris(
  destructibles: Map<string, Destructible>,
  dt: number,
  gravity: number
) {
  // Debris physics now handled by RigidBody on client.
  // Debris physics now handled by RigidBody on client. Server retains
  // persistent (shatter) debris for the match, but transient debris
  // (with a ttl) should be cleaned up server-side so clients don't
  // repeatedly re-add the same pieces after they fade locally.
  const currentRoom = getRoom();

  // Iterate each destructible and update remaining ttl for transient debris.
  for (const destructible of destructibles.values()) {
    if (!destructible.debris || destructible.debris.length === 0) continue;
    const before = destructible.debris.length;

    // If match finished, clear all debris immediately (clients will stop rendering).
    if (currentRoom.gameState === "finished") {
      destructible.debris = [];
      if (before > 0)
        logDebug(
          `[GameState] cleared ${before} debris from ${destructible.id} at match end`
        );
      continue;
    }

    // Otherwise, decrement ttl for transient debris and keep persistent shards.
    const remaining: DebrisChunk[] = [];
    for (const chunk of destructible.debris) {
      // persistent pieces (ttl === 0) remain until match end
      if (chunk.persistent) {
        remaining.push(chunk);
        continue;
      }
      // chunk.ttl is milliseconds remaining; subtract dt*1000
      const nextTtl =
        (typeof chunk.ttl === "number" ? chunk.ttl : DEBRIS_TTL) -
        Math.round(dt * 1000);
      if (nextTtl > 0) {
        chunk.ttl = nextTtl;
        remaining.push(chunk);
      } else {
        // expired on server-side, drop it
        logDebug(
          `[GameState] updateDestructibleDebris: expiring chunk ${chunk.id} for ${destructible.id}`
        );
      }
    }
    if (remaining.length !== before) {
      console.debug(
        `[GameState] cleaned ${before - remaining.length} expired debris for ${
          destructible.id
        }`
      );
    }
    destructible.debris = remaining;
  }
}

function updateDeliveries(players: Map<string, PlayerCar>) {
  const now = Date.now();

  // Magnet attraction: if a player has magnet active, attract nearby waiting deliveries
  const MAGNET_RADIUS = 8;
  for (const player of room.players.values()) {
    if (!player.activePowerUps) continue;
    const hasMagnet = player.activePowerUps.some(
      (ap) => ap.type === "magnet" && ap.expiresAt > now
    );
    if (!hasMagnet) continue;
    // Don't magnet-pull if player is already carrying a delivery
    if (player.carryingDeliveryId) continue;
    for (const delivery of room.deliveries) {
      if (delivery.state !== "waiting") continue;
      const dx = player.x - delivery.x;
      const dy = player.y - delivery.y;
      const dist = Math.hypot(dx, dy);
      if (dist > MAGNET_RADIUS) continue;
      // Move delivery a fraction towards the player
      const pullFactor = 0.25; // fraction per tick
      delivery.x += dx * pullFactor;
      delivery.y += dy * pullFactor;
    }
  }

  for (const delivery of room.deliveries) {
    if (delivery.carrierId) {
      const carrier = players.get(delivery.carrierId);
      if (!carrier) {
        releaseDeliveryAt(delivery, delivery.spawnX, delivery.spawnY, false);
        randomizeDeliveryPosition(delivery);
        continue;
      }

      if (carrier.destroyed) {
        dropDeliveryForPlayer(carrier);
        continue;
      }

      delivery.x = carrier.x;
      delivery.y = carrier.y;

      if (isInsideDropZone(delivery, carrier.x, carrier.y)) {
        completeDelivery(delivery, carrier);
      }
    } else if (
      delivery.state === "cooldown" &&
      delivery.respawnAt &&
      now >= delivery.respawnAt
    ) {
      respawnDelivery(delivery);
    }
  }

  for (const player of players.values()) {
    if (player.destroyed || player.carryingDeliveryId) continue;

    for (const delivery of room.deliveries) {
      if (delivery.state !== "waiting" || delivery.carrierId) continue;
      const dx = player.x - delivery.x;
      const dy = player.y - delivery.y;
      if (Math.sqrt(dx * dx + dy * dy) <= DELIVERY_PICKUP_RADIUS) {
        attachDeliveryToPlayer(player, delivery);
        break;
      }
    }
  }
}

function handleDeliveryCollision(
  player: PlayerCar,
  otherPlayer: PlayerCar,
  relativeSpeed: number
) {
  if (relativeSpeed < DELIVERY_STEAL_MIN_SPEED) return;

  const now = Date.now();
  const playerHasShield =
    player.activePowerUps &&
    player.activePowerUps.some(
      (ap) => ap.type === "shield" && ap.expiresAt > now
    );
  const otherHasShield =
    otherPlayer.activePowerUps &&
    otherPlayer.activePowerUps.some(
      (ap) => ap.type === "shield" && ap.expiresAt > now
    );

  // If a player has an active shield, they should not drop the delivery when bumped.
  const droppedFromPlayer = playerHasShield
    ? null
    : dropDeliveryForPlayer(player);
  const droppedFromOther = otherHasShield
    ? null
    : dropDeliveryForPlayer(otherPlayer);

  if (
    droppedFromPlayer &&
    !otherPlayer.destroyed &&
    !otherPlayer.carryingDeliveryId
  ) {
    attachDeliveryToPlayer(otherPlayer, droppedFromPlayer);
  }

  if (droppedFromOther && !player.destroyed && !player.carryingDeliveryId) {
    attachDeliveryToPlayer(player, droppedFromOther);
  }
}

function dropDeliveryForPlayer(player: PlayerCar): DeliveryItem | null {
  const deliveryId = player.carryingDeliveryId;
  if (!deliveryId) return null;

  const delivery = room.deliveries.find((item) => item.id === deliveryId);
  player.carryingDeliveryId = undefined;
  if (!delivery) {
    return null;
  }

  releaseDeliveryAt(delivery, player.x, player.y, true);
  return delivery;
}

function attachDeliveryToPlayer(
  player: PlayerCar,
  delivery: DeliveryItem
): boolean {
  if (player.carryingDeliveryId && player.carryingDeliveryId !== delivery.id) {
    return false;
  }

  const priorCarrierId = delivery.previousCarrierId;
  const priorCarrier = priorCarrierId
    ? room.players.get(priorCarrierId)
    : undefined;
  const wasSteal = Boolean(priorCarrierId && priorCarrierId !== player.id);

  assignFreshDropTarget(delivery, true);
  delivery.carrierId = player.id;
  delivery.state = "carried";
  delivery.respawnAt = undefined;
  player.carryingDeliveryId = delivery.id;
  delivery.x = player.x;
  delivery.y = player.y;
  delivery.previousCarrierId = player.id;

  const pickupDescription = wasSteal
    ? `Stole licence from ${priorCarrier?.name ?? "another player"}`
    : "Picked up a licence";
  addScore(
    player,
    wasSteal ? DELIVERY_STEAL_BONUS : DELIVERY_PICKUP_BONUS,
    pickupDescription
  );
  return true;
}

function completeDelivery(delivery: DeliveryItem, carrier: PlayerCar) {
  if (delivery.carrierId !== carrier.id) return;

  addScore(
    carrier,
    DELIVERY_DELIVERY_POINTS,
    "Delivered a licence to the drop zone"
  );
  carrier.carryingDeliveryId = undefined;
  delivery.carrierId = undefined;
  delivery.state = "cooldown";
  delivery.previousCarrierId = undefined;
  delivery.respawnAt = Date.now() + DELIVERY_ITEM_RESPAWN_MS;
  delivery.x = carrier.x;
  delivery.y = carrier.y;
  clearDeliveryTarget(delivery);
}

function respawnDelivery(delivery: DeliveryItem) {
  delivery.state = "waiting";
  delivery.carrierId = undefined;
  delivery.previousCarrierId = undefined;
  delivery.respawnAt = undefined;
  clearDeliveryTarget(delivery);
  randomizeDeliveryPosition(delivery);
}

function releaseDeliveryAt(
  delivery: DeliveryItem,
  x: number,
  y: number,
  preservePrevious: boolean
) {
  const previousCarrier = delivery.carrierId;

  if (previousCarrier) {
    const carrier = room.players.get(previousCarrier);
    if (carrier && carrier.carryingDeliveryId === delivery.id) {
      carrier.carryingDeliveryId = undefined;
    }
  }

  delivery.carrierId = undefined;
  delivery.state = "waiting";
  delivery.respawnAt = undefined;
  delivery.x = x;
  delivery.y = y;
  delivery.previousCarrierId = preservePrevious
    ? previousCarrier || delivery.previousCarrierId
    : undefined;
  clearDeliveryTarget(delivery);
}

function randomizeDeliveryPosition(delivery: DeliveryItem) {
  delivery.x = delivery.spawnX + (Math.random() - 0.5) * 2.5;
  delivery.y = delivery.spawnY + (Math.random() - 0.5) * 2.5;
}

function clearDeliveryTarget(delivery: DeliveryItem) {
  delivery.targetIndex = undefined;
  delivery.targetX = 0;
  delivery.targetY = 0;
  delivery.targetRadius = DELIVERY_DROP_RADIUS;
}

function isInsideDropZone(delivery: DeliveryItem, x: number, y: number) {
  const dx = x - delivery.targetX;
  const dy = y - delivery.targetY;
  const radius = delivery.targetRadius || DELIVERY_DROP_RADIUS;
  return Math.sqrt(dx * dx + dy * dy) <= radius;
}

function applyDropTarget(delivery: DeliveryItem, targetIndex: number) {
  const target =
    DELIVERY_DROP_POINTS[targetIndex % DELIVERY_DROP_POINTS.length];
  delivery.targetIndex = targetIndex % DELIVERY_DROP_POINTS.length;
  delivery.targetX = target.x;
  delivery.targetY = target.y;
  delivery.targetRadius = target.radius ?? DELIVERY_DROP_RADIUS;
}

function assignFreshDropTarget(delivery: DeliveryItem, forceDifferent = false) {
  const usedIndices = new Set(
    room.deliveries
      .filter(
        (item) => item !== delivery && typeof item.targetIndex === "number"
      )
      .map((item) => item.targetIndex)
  );

  if (delivery.targetIndex !== undefined) {
    usedIndices.delete(delivery.targetIndex);
  }

  let candidates = DELIVERY_DROP_POINTS.map((_, idx) => idx).filter(
    (idx) => !usedIndices.has(idx)
  );

  if (!candidates.length) {
    candidates = DELIVERY_DROP_POINTS.map((_, idx) => idx);
  }

  if (
    forceDifferent &&
    candidates.length > 1 &&
    delivery.targetIndex !== undefined
  ) {
    const filtered = candidates.filter((idx) => idx !== delivery.targetIndex);
    if (filtered.length) {
      candidates = filtered;
    }
  }

  const nextIndex =
    candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
  applyDropTarget(delivery, nextIndex);
}
