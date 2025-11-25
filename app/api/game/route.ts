import { NextRequest, NextResponse } from "next/server";
import {
  updatePhysics,
  createOrUpdatePlayer,
  getGameState,
  getDestructibleState,
  getTimerState,
  getLeaderboard,
  getDeliveries,
  getMatchEvents,
  getPowerUps,
  getServerFps,
  CAR_DESTROY_THRESHOLD,
} from "@/lib/gameState";

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
    const body = await request.json();
    const { playerId, name, steer, throttle } = body;

    if (!playerId || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Update player input
    const createRes = await measure("createOrUpdatePlayer", () =>
      createOrUpdatePlayer(playerId, name, steer || 0, throttle || 0)
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
    });
  } catch (error) {
    console.error("Error in game state update:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
