import { NextRequest, NextResponse } from "next/server";
import {
  updatePlayerReady,
  checkAllReady,
  getGameState,
  getRoomState,
  // startRace is intentionally not imported directly to avoid circular
  // issues during cold-start; we'll require it dynamically when needed.
  cleanupInactiveLobbyPlayers,
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

    // If the match already finished some time ago, allow a quick reset
    // to lobby when players interact (avoid waiting the full scheduled
    // reset). Use a 5s threshold so players can quickly start a new game.
    // Also force reset if still in "finished" state after interaction.
    // NOTE: This must happen BEFORE updatePlayerReady to avoid the race reset
    // clearing the ready flag.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const gs = require("@/lib/gameState");
      const currentState = gs.getGameState ? gs.getGameState() : null;

      if (currentState === "finished") {
        console.log("[lobby] game state is 'finished', attempting reset...");
        if (gs && typeof gs.resetIfFinishedOlderThan === "function") {
          // Try with 0ms threshold first to reset immediately
          const didReset = gs.resetIfFinishedOlderThan(0);
          console.log("[lobby] resetIfFinishedOlderThan(0) ->", didReset);

          // If that didn't work, try force resetting
          if (!didReset && typeof gs.forceResetToLobby === "function") {
            gs.forceResetToLobby();
            console.log("[lobby] forceResetToLobby called");
          }
        }
      }
    } catch (e) {
      console.warn("[lobby] reset check failed:", e);
    }

    // Update player ready status AFTER any reset (reset clears ready flags)
    updatePlayerReady(playerId, name, ready);
    console.log("[lobby] player updated:", { playerId, name, ready });

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
      // Only start when all players are ready. Allow single-player starts
      // so a user can play alone if they choose — the server-side logic
      // contains safety checks to avoid duplicate matches across instances.
      const allReady = checkAllReady();
      const playersNow = getRoomState();
      const currentGameState = getGameState();

      console.log("[lobby] readiness check:", {
        allReady,
        playerCount: playersNow.length,
        gameState: currentGameState,
        players: playersNow.map((p) => ({
          id: p.id,
          name: p.name,
          ready: p.ready,
        })),
      });

      if (allReady && currentGameState === "lobby") {
        if (playersNow.length >= 1) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const gs = require("@/lib/gameState");
            if (gs && typeof gs.startRace === "function") {
              console.log("[lobby] attempting to start race...");
              // fire-and-forget; startRace contains its own safety/claim logic
              gs.startRace().catch((err: any) =>
                console.warn("[lobby] startRace() failed:", err)
              );
            }
          } catch (e) {
            console.warn("[lobby] failed to call startRace():", e);
          }
        } else {
          console.log("[lobby] not enough players to start");
        }
      }
    } catch (e) {
      console.warn("[lobby] readiness check failed:", e);
    }

    // Clean up any inactive players who may have disconnected while in the lobby.
    try {
      cleanupInactiveLobbyPlayers();
    } catch (e) {
      console.warn("[lobby] cleanupInactiveLobbyPlayers failed:", e);
    }

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
