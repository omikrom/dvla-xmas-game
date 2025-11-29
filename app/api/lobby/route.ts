import { NextRequest, NextResponse } from "next/server";
import {
  updatePlayerReady,
  checkAllReady,
  getGameState,
  getRoomState,
  // startRace is intentionally not imported directly to avoid circular
  // issues during cold-start; we'll require it dynamically when needed.
} from "@/lib/gameState";
import {
  claimMatchToken,
  getCurrentMatchToken,
  releaseMatchToken,
  saveMatchSnapshot,
  getLastRedisConnectMs,
} from "@/lib/matchStore";
import { getInstanceId } from "@/lib/gameState";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerId, name, ready, color } = body;

    if (!playerId || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Update player ready status
    updatePlayerReady(playerId, name, ready);

    // Update player color if provided (best-effort, avoid throwing)
    if (typeof color === "string" && color.trim()) {
      try {
        // lazily import to avoid circular dependency
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const gs = require("@/lib/gameState");
        if (gs && typeof gs.setPlayerColor === "function") {
          try {
            gs.setPlayerColor(playerId, color);
          } catch (e) {}
        }
      } catch (e) {}
    }

    // If all players are ready, ask the game logic to start the race.
    // We call `startRace()` dynamically (fire-and-forget) so the lobby
    // endpoint remains resilient and avoids circular import problems.
    try {
      if (checkAllReady()) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const gs = require("@/lib/gameState");
          if (gs && typeof gs.startRace === "function") {
            // fire-and-forget; startRace contains its own safety/claim logic
            gs.startRace().catch((err: any) =>
              console.warn("[lobby] startRace() failed:", err)
            );
          }
        } catch (e) {
          console.warn("[lobby] failed to call startRace():", e);
        }
      }
    } catch (e) {}

    // Return lobby state (simplified): we do not claim tokens here to keep
    // the endpoint robust. Token claiming is handled inside
    // `gameState.startRace()` which performs safe claim/adopt flows.
    const players = getRoomState();
    let currentCanonicalToken: string | null = null;
    try {
      currentCanonicalToken = (await getCurrentMatchToken()) || null;
    } catch (e) {
      currentCanonicalToken = null;
    }

    let storeBackend = "memory";
    try {
      if (process.env.REDIS_URL || process.env.REDIS_URI)
        storeBackend = "redis";
      else {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const kv = require("@vercel/kv");
          if (kv) storeBackend = "vercel-kv";
        } catch (e) {
          // leave as memory
        }
      }
    } catch (e) {}

    return NextResponse.json({
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        ready: p.ready || false,
        color: p.color,
      })),
      gameState: getGameState(),
      matchToken: currentCanonicalToken,
      claimOk: false,
      adoptOk: false,
      instanceId: getInstanceId(),
      lastRedisConnectMs:
        typeof getLastRedisConnectMs === "function"
          ? getLastRedisConnectMs()
          : null,
      currentCanonicalToken,
      storeBackend,
    });
  } catch (error) {
    console.error("Error in lobby:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
