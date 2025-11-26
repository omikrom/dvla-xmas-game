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
  getServerFps,
  CAR_DESTROY_THRESHOLD,
} from "@/lib/gameState";
import {
  getLastRedisConnectMs,
  getMatchSnapshot,
  getCurrentMatchOwner,
} from "@/lib/matchStore";
import { getRoom } from "@/lib/gameState";

const nowMs = () => Number(process.hrtime.bigint() / BigInt(1e6));
const LOG_THRESHOLD = 1;

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
    const serverReceiveMs = Date.now();
    const body = await request.json();
    const { playerId, name, steer, throttle } = body;

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
    try {
      if (body.matchToken) {
        const ok = await adoptMatchFromToken(body.matchToken);
        adoptOk = !!ok;
        if (ok) {
          // include a quick log for diagnostics
          console.log(`[api/game] adopted match token from client`);
        } else {
          console.log(`[api/game] adoptMatchFromToken returned false for provided token`);
        }
      }
    } catch (e) {
      console.warn("[api/game] adoptMatchFromToken threw:", e);
    }

    // If this worker is NOT the owner, try to fetch the latest authoritative
    // snapshot (served by the owner) so read-only workers serve up-to-date state.
    try {
      const owner = await getCurrentMatchOwner();
      if (owner && owner !== getInstanceId()) {
        const snap = await getMatchSnapshot();
        if (snap) {
          try {
            const r = getRoom();
            if (Array.isArray(snap.destructibles)) {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              r.destructibles = new Map(snap.destructibles.map((d: any) => [d.id, d]));
            }
            r.deliveries = Array.isArray(snap.deliveries) ? snap.deliveries : [];
            r.powerUps = Array.isArray(snap.powerUps) ? snap.powerUps : [];
            r.leaderboard = Array.isArray(snap.leaderboard) ? snap.leaderboard : [];
            r.events = Array.isArray(snap.events) ? snap.events : [];
            r.lastPhysicsUpdate = Date.now();
          } catch (err) {
            console.warn("[api/game] failed to apply snapshot:", err);
          }
        }
      }
    } catch (err) {}

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

    // Update player input
    const createRes = await measure("createOrUpdatePlayer", () =>
      createOrUpdatePlayer(playerId, name, steer || 0, throttle || 0, {
        lastX: body.lastX,
        lastY: body.lastY,
        lastAngle: body.lastAngle,
      })
    );

    // Update physics
    const physicsRes = await measure("updatePhysics", () => updatePhysics());
    const players = physicsRes.result as any[];
    const now = Date.now();

    // Serialize players for the requesting client. If a player has an active
    // invisibility powerup, hide them from other clients (but not themselves).
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

    const gameStateRes = await measure("getGameState", () => getGameState());
    const destructiblesRes = await measure("getDestructibleState", () =>
      getDestructibleState()
    );
    const timerRes = await measure("getTimerState", () => getTimerState());
    const leaderboardRes = await measure("getLeaderboard", () =>
      getLeaderboard()
    );
    const deliveriesRes = await measure("getDeliveries", () => getDeliveries());
    const eventsRes = await measure("getMatchEvents", () => getMatchEvents());
    const powerUpsRes = await measure("getPowerUps", () => getPowerUps());
    const serverFpsRes = await measure("getServerFps", () => getServerFps());

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
    };

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
      adoptOk,
      timing,
    });
  } catch (error) {
    console.error("Error in game state update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
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
