import { NextRequest, NextResponse } from "next/server";
import {
  updatePhysics,
  createOrUpdatePlayer,
  getInstanceId,
  adoptMatchFromToken,
  ensureFinalizeIfDue,
  getMatchToken,
  getGameState,
  getRoomState,
  getDestructibleState,
  getTimerState,
  getLeaderboard,
  getDeliveries,
  getMatchEvents,
  getPowerUps,
  ensureOwnerPeriodicTasks,
  isPeriodicPhysicsRunning,
  isPeriodicSnapshotRunning,
  getServerFps,
  CAR_DESTROY_THRESHOLD,
} from "@/lib/gameState";
import {
  getLastRedisConnectMs,
  getMatchSnapshot,
  getCurrentMatchOwner,
  getCurrentMatchToken,
  getMatchOwnerTtl,
  refreshMatchOwner,
} from "@/lib/matchStore";
import { getRoom, MATCH_DURATION_MS } from "@/lib/gameState";

// Cache recent owner checks to avoid hitting Redis every poll when we already
// own the match and periodic loops are healthy.
let lastOwnerCheckAt = 0;
const OWNER_CHECK_CACHE_MS = 500;

const nowMs = () => Number(process.hrtime.bigint() / BigInt(1e6));
const LOG_THRESHOLD = 1;

// Dev helper: simulate network latency for testing higher RTTs. Controlled
// by the request header `x-simulate-latency-ms` or query param
// `?simulateLatencyMs=120`. Only active when not in production to avoid
// accidental delays in real deployments.
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
async function maybeSimulateLatency(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") return;
    const hdr = request.headers.get("x-simulate-latency-ms");
    const qp = request.nextUrl?.searchParams?.get("simulateLatencyMs");
    const raw = hdr ?? qp ?? null;
    if (!raw) return;
    const ms = Number(raw);
    if (!isNaN(ms) && ms > 0 && ms < 60000) {
      // clamp to reasonable range and await
      await sleep(ms);
    }
  } catch (e) {
    // ignore
  }
}

async function measure<T>(name: string, fn: () => T | Promise<T>) {
  const t0 = nowMs();
  const result = await Promise.resolve().then(fn);
  const dt = nowMs() - t0;
  if (dt >= LOG_THRESHOLD) {
    console.log(`[api/game] ${name} took ${dt}ms`);
  }
  return { result, ms: dt };
}

export async function POST(request: NextRequest) {
  try {
    await maybeSimulateLatency(request);
    const serverReceiveMs = Date.now();
    const body = await request.json();
    const { playerId, name, steer, throttle } = body;

    // Per-request caches to avoid redundant Redis lookups
    let ownerPromise: Promise<string | null> | null = null;
    const getOwnerCached = () =>
      ownerPromise ? ownerPromise : (ownerPromise = getCurrentMatchOwner());

    let sharedTokenPromise: Promise<string | null> | null = null;
    const getSharedTokenCached = () =>
      sharedTokenPromise
        ? sharedTokenPromise
        : (sharedTokenPromise = getCurrentMatchToken());

    if (!playerId || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // If client provided a signed match token, adopt it so this worker's
    // in-memory room uses the same race start/end times. Expose adoptOk
    // in the response for client-side diagnostics.
    let adoptOk: boolean | null = null;
    let adoptMs = 0;
    const canonicalToken = getMatchToken();
    try {
      if (body.matchToken) {
        // If the client token already matches our canonical token, skip
        // adoption to avoid redundant Redis reads/writes.
        if (body.matchToken === canonicalToken) {
          adoptOk = true;
          adoptMs = 0;
        } else {
          const tAdopt = nowMs();
          const ok = await adoptMatchFromToken(body.matchToken);
          adoptMs = nowMs() - tAdopt;
          adoptOk = !!ok;
          if (ok) {
            // include a quick log for diagnostics
            console.log(`[api/game] adopted match token from client`);
            try {
              // Ensure owner periodic tasks are running if we became the owner
              // (defensive: often adoptMatchFromToken starts timers, but this
              // guarantees ticks in case of a race).
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const gs = await Promise.resolve().then(() =>
                require("@/lib/gameState")
              );
              if (gs && typeof gs.ensureOwnerPeriodicTasks === "function") {
                try {
                  await gs.ensureOwnerPeriodicTasks();
                } catch (e) {}
              }
            } catch (e) {}
          } else {
            console.log(
              `[api/game] adoptMatchFromToken returned false for provided token`
            );
          }
        }
      }
    } catch (e) {
      console.warn("[api/game] adoptMatchFromToken threw:", e);
    }

    // If this worker is NOT the owner, try to fetch the latest authoritative
    // snapshot (served by the owner) so read-only workers serve up-to-date state.
    // Also check if owner has expired and we should take over.
    let ownerTakenOver = false;
    let ownerCheckMs = 0;
    let ownerCheckStart = 0;
    try {
      ownerCheckStart = nowMs();
      let owner = await getOwnerCached();
      const currentState = getGameState();

      // Ultra-fast path: if we are already the owner, skip TTL/snapshot work.
      // This keeps the hot path near 0ms while still allowing non-owners to
      // perform takeover/snapshot sync. Refresh a lightweight timestamp so we
      // can still rate-limit future expensive checks if needed.
      const isSelfOwner = owner === getInstanceId();

      // Fast-path cache for non-owners: if we just checked very recently and
      // periodic loops are running, skip redundant TTL/snapshot reads.
      const cacheAge = nowMs() - lastOwnerCheckAt;
      const cacheValid =
        isPeriodicPhysicsRunning() &&
        isPeriodicSnapshotRunning() &&
        cacheAge >= 0 &&
        cacheAge < OWNER_CHECK_CACHE_MS;

      if (isSelfOwner) {
        lastOwnerCheckAt = nowMs();
      }

      if (!isSelfOwner && !cacheValid) {
        lastOwnerCheckAt = nowMs();

        // Check for owner takeover opportunity during racing
        if (currentState === "racing" && body.matchToken) {
          const ownerTtl = await getMatchOwnerTtl();
          // ownerTtl: null = couldn't read, -2 = key missing, -1 = no TTL, >0 = ms remaining
          const ownerExpired = ownerTtl !== null && ownerTtl <= 0;
          const noOwner = !owner;

          if (ownerExpired || noOwner) {
            // Try to claim ownership by force-setting the owner key.
            // refreshMatchOwner doesn't use NX, so it will overwrite any stale owner.
            try {
              const claimed = await refreshMatchOwner(
                getInstanceId(),
                MATCH_DURATION_MS
              );
              if (claimed) {
                ownerTakenOver = true;
                ownerPromise = Promise.resolve(getInstanceId());
                owner = getInstanceId();
                console.log(
                  `[api/game] TAKEOVER: claimed ownership after owner expired/missing (instance=${getInstanceId()}, ownerTtl=${ownerTtl})`
                );

                // CRITICAL: Load the latest snapshot so we continue from where the old owner left off
                try {
                  const snap = await getMatchSnapshot();
                  if (snap) {
                    const r = getRoom();
                    if (Array.isArray(snap.destructibles)) {
                      r.destructibles = new Map(
                        snap.destructibles.map((d: any) => [d.id, d])
                      );
                    }
                    r.deliveries = Array.isArray(snap.deliveries)
                      ? snap.deliveries
                      : [];
                    r.powerUps = Array.isArray(snap.powerUps)
                      ? snap.powerUps
                      : [];
                    r.leaderboard = Array.isArray(snap.leaderboard)
                      ? snap.leaderboard
                      : [];
                    r.events = Array.isArray(snap.events) ? snap.events : [];
                    if (Array.isArray(snap.players)) {
                      r.players = new Map(
                        snap.players.map((p: any) => [p.id, p])
                      );
                    }
                    if (typeof snap.raceStartTime === "number")
                      r.raceStartTime = snap.raceStartTime;
                    if (typeof snap.raceEndTime === "number")
                      r.raceEndTime = snap.raceEndTime;
                    r.lastPhysicsUpdate = Date.now();
                    console.log(
                      `[api/game] TAKEOVER: loaded snapshot with ${
                        snap.players?.length || 0
                      } players`
                    );
                  }
                } catch (snapErr) {
                  console.warn(
                    "[api/game] takeover snapshot load failed:",
                    snapErr
                  );
                }

                // Start the physics and snapshot loops
                try {
                  await ensureOwnerPeriodicTasks();
                } catch (e) {
                  console.warn(
                    "[api/game] ensureOwnerPeriodicTasks failed after takeover:",
                    e
                  );
                }
              }
            } catch (e) {
              console.warn("[api/game] takeover claim failed:", e);
            }
          }
        }

        // If we're not the owner (and didn't just take over), apply snapshot
        if (owner && owner !== getInstanceId() && !ownerTakenOver) {
          const snap = await getMatchSnapshot();
          if (snap) {
            try {
              const r = getRoom();
              if (Array.isArray(snap.destructibles)) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                r.destructibles = new Map(
                  snap.destructibles.map((d: any) => [d.id, d])
                );
              }
              r.deliveries = Array.isArray(snap.deliveries)
                ? snap.deliveries
                : [];
              r.powerUps = Array.isArray(snap.powerUps) ? snap.powerUps : [];
              r.leaderboard = Array.isArray(snap.leaderboard)
                ? snap.leaderboard
                : [];
              r.events = Array.isArray(snap.events) ? snap.events : [];
              r.lastPhysicsUpdate = Date.now();
            } catch (err) {
              console.warn("[api/game] failed to apply snapshot:", err);
            }
          }
        }
      }
      if (cacheValid) {
        lastOwnerCheckAt = nowMs();
      }

      ownerCheckMs = nowMs() - ownerCheckStart;
    } catch (err) {
      ownerCheckMs = nowMs() - ownerCheckStart;
      console.warn("[api/game] owner check/snapshot failed:", err);
    }

    // Prevent new players joining a running match unless they present the
    // canonical matchToken. This avoids multiple overlapping matches and
    // ensures everyone joins the same active game.
    try {
      const players = getRoomState();
      const playerExists = players.some((p) => p.id === playerId);
      const currentState = getGameState();
      const canonicalToken = getMatchToken();
      if (!playerExists && currentState === "racing") {
        if (!body.matchToken || body.matchToken !== canonicalToken) {
          return NextResponse.json(
            { error: "match_in_progress" },
            { status: 403 }
          );
        }
      }
    } catch (e) {
      // If there's an error reading room state, fall back to conservative
      // behavior and allow the create/update to proceed.
    }

    // Determine if this worker is the canonical owner for physics simulation
    let isOwner = ownerTakenOver; // If we just took over, we're the owner
    let snapshotPlayers: any[] | null = null;
    try {
      if (!isOwner) {
        const owner = await getOwnerCached();
        isOwner = !owner || owner === getInstanceId();
      }

      // For non-owner workers during an active race, prefer returning snapshot
      // players to avoid divergent state from local physics simulation
      if (!isOwner && getGameState() === "racing") {
        const snap = await getMatchSnapshot();
        if (snap && Array.isArray(snap.players)) {
          snapshotPlayers = snap.players;
        }
      }
    } catch (e) {
      // If we can't determine ownership, assume we're the owner to avoid breaking
      isOwner = true;
    }

    // Update player input. If client provided an input sequence number (`seq`),
    // forward it so the server can acknowledge the last processed input.
    const clientSeq = typeof body.seq === "number" ? body.seq : null;

    // Always update player to keep them active (lastUpdate timestamp), but
    // non-owner workers won't have their physics changes be authoritative
    const createRes = await measure("createOrUpdatePlayer", () =>
      createOrUpdatePlayer(
        playerId,
        name,
        steer || 0,
        throttle || 0,
        {
          lastX: body.lastX,
          lastY: body.lastY,
          lastAngle: body.lastAngle,
        },
        clientSeq
      )
    );

    // Update physics - only owner's physics is authoritative
    const physicsRes = await measure("updatePhysics", () => updatePhysics());

    // For non-owner workers, merge the requesting player's local state with
    // snapshot players to reduce position divergence. The owner's snapshot
    // is the source of truth for all other players.
    let players: any[];
    if (!isOwner && snapshotPlayers && snapshotPlayers.length > 0) {
      // Use snapshot as base, but update the requesting player's input state
      const snapMap = new Map(snapshotPlayers.map((p: any) => [p.id, p]));
      const localPlayers = physicsRes.result as any[];

      // Find the requesting player in local state (has latest input applied)
      const localMe = localPlayers.find((p: any) => p.id === playerId);

      // Merge: use snapshot positions for all players, but preserve the
      // requesting player's input (steer/throttle) so prediction works
      players = snapshotPlayers.map((p: any) => {
        if (p.id === playerId && localMe) {
          // Keep snapshot position but use local input state
          return {
            ...p,
            steer: localMe.steer,
            throttle: localMe.throttle,
            lastUpdate: localMe.lastUpdate,
            lastProcessedInput: localMe.lastProcessedInput,
          };
        }
        return p;
      });

      // If requesting player isn't in snapshot yet (new joiner), add them
      if (!snapMap.has(playerId) && localMe) {
        players.push(localMe);
      }
    } else {
      players = physicsRes.result as any[];
    }
    const now = Date.now();

    // Serialize players for the requesting client. If a player has an active
    // invisibility powerup, hide them from other clients (but not themselves).
    let serializePlayersMs = 0;
    const tSerialize = nowMs();
    const serializedPlayers = players.map((p) => {
      const isInvisible =
        p.activePowerUps &&
        p.activePowerUps.some(
          (ap: any) => ap.type === "invisibility" && ap.expiresAt > now
        );
      if (isInvisible && p.id !== body.playerId) {
        return { ...p, hidden: true };
      }
      // Include a damage percent so clients can display health relative to
      // the server's destruction threshold (keeps UI consistent if threshold
      // differs from 100).
      const damage = p.damage || 0;
      const damagePercent = Math.min(
        100,
        Math.round((damage / (CAR_DESTROY_THRESHOLD || 100)) * 100)
      );
      return { ...p, damagePercent };
    });
    serializePlayersMs = nowMs() - tSerialize;

    // Parallelize read-only fetches to cut per-request latency
    const [
      gameStateRes,
      destructiblesRes,
      timerRes,
      leaderboardRes,
      deliveriesRes,
      eventsRes,
      powerUpsRes,
      serverFpsRes,
    ] = await Promise.all([
      measure("getGameState", () => getGameState()),
      measure("getDestructibleState", () => getDestructibleState()),
      measure("getTimerState", () => getTimerState()),
      measure("getLeaderboard", () => getLeaderboard()),
      measure("getDeliveries", () => getDeliveries()),
      measure("getMatchEvents", () => getMatchEvents()),
      measure("getPowerUps", () => getPowerUps()),
      measure("getServerFps", () => getServerFps()),
    ]);

    // If the timer shows expired but periodic physics didn't finalize
    // yet (rare), force finalize here to ensure clients transition.
    try {
      if (timerRes.result && (timerRes.result as any).timeRemainingMs === 0) {
        ensureFinalizeIfDue();
      }
    } catch (e) {}

    const serverSendMs = Date.now();
    const timing = {
      clientSendMs: body.clientSendTs || null,
      serverReceiveMs,
      serverSendMs,
      processingMs: serverSendMs - serverReceiveMs,
      redisConnectMs: getLastRedisConnectMs(),
      breakdown: {
        createOrUpdateMs: createRes.ms,
        updatePhysicsMs: physicsRes.ms,
        gameStateMs: gameStateRes.ms,
        destructiblesMs: destructiblesRes.ms,
        timerMs: timerRes.ms,
        leaderboardMs: leaderboardRes.ms,
        deliveriesMs: deliveriesRes.ms,
        eventsMs: eventsRes.ms,
        powerUpsMs: powerUpsRes.ms,
        serverFpsMs: serverFpsRes.ms,
        adoptMs,
        ownerCheckMs,
        serializePlayersMs,
      },
    };

    // Read the shared store token (if any) to help debug cross-instance races
    let sharedToken: string | null = null;
    try {
      if (typeof getSharedTokenCached === "function") {
        sharedToken = await getSharedTokenCached();
      }
    } catch (e) {
      console.warn("[api/game] getCurrentMatchToken failed:", e);
    }

    // Optionally include a debug snapshot of a single player when the
    // client passes `debugPlayerId` in the request body. This avoids
    // having to grep logs and makes it easy to correlate client/server
    // state for a particular player during repros.
    let debugPlayer: any = null;
    try {
      if (body.debugPlayerId) {
        debugPlayer =
          players.find((p: any) => p.id === body.debugPlayerId) || null;
        console.info("[api/game] debugPlayer ->", {
          debugPlayerId: body.debugPlayerId,
          snapshot: debugPlayer,
        });
      }

      try {
        const ownerId = await getOwnerCached();
        const isOwner = ownerId === getInstanceId();
        const periodicPhysics = isPeriodicPhysicsRunning();
        const periodicSnapshot = isPeriodicSnapshotRunning();
        console.info("[api/game] status ->", {
          instanceId: getInstanceId(),
          matchToken: getMatchToken(),
          sharedToken,
          adoptOk,
          timing,
          ownerId,
          isOwner,
          periodicPhysics,
          periodicSnapshot,
        });
      } catch (e) {
        console.info("[api/game] status ->", {
          instanceId: getInstanceId(),
          matchToken: getMatchToken(),
          sharedToken,
          adoptOk,
          timing,
        });
      }
    } catch (e) {}

    return NextResponse.json({
      players: serializedPlayers,
      gameState: gameStateRes.result,
      destructibles: destructiblesRes.result,
      timer: timerRes.result,
      leaderboard: leaderboardRes.result,
      deliveries: deliveriesRes.result,
      events: eventsRes.result,
      powerUps: powerUpsRes.result,
      serverFps: serverFpsRes.result,
      instanceId: getInstanceId(),
      matchToken: getMatchToken(),
      sharedToken,
      adoptOk,
      timing,
      ownerId: await (async () => {
        try {
          return await getOwnerCached();
        } catch (e) {
          return null;
        }
      })(),
      isOwner:
        (await (async () => {
          try {
            return await getOwnerCached();
          } catch (e) {
            return null;
          }
        })()) === getInstanceId(),
      periodicPhysicsRunning: isPeriodicPhysicsRunning(),
      periodicSnapshotRunning: isPeriodicSnapshotRunning(),
      debugPlayer,
    });
  } catch (error) {
    console.error("Error in game state update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // allow quick dev testing of higher RTT via query param or header
    // (e.g. `/api/game?simulateLatencyMs=120` or header `x-simulate-latency-ms: 120`)
    // note: only active when NODE_ENV !== 'production'
    await maybeSimulateLatency(request);

    return NextResponse.json({
      gameState: getGameState(),
      instanceId: getInstanceId(),
      matchToken: getMatchToken(),
      timer: getTimerState(),
    });
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
