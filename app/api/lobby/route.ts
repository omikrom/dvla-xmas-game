import { NextRequest, NextResponse } from "next/server";
import {
  updatePlayerReady,
  checkAllReady,
  getGameState,
  getRoomState,
  startRace,
} from "@/lib/gameState";

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
    // Update player color if provided
    if (typeof color === "string" && color.trim()) {
      try {
        // lazily import/set to avoid circular issues
        // setPlayerColor is exported from lib/gameState
        // update authoritative state so clients see the change immediately
        // (no-op if player doesn't yet exist)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const gs = await Promise.resolve().then(() => require("@/lib/gameState"));
        if (gs && typeof gs.setPlayerColor === "function") {
          try {
            gs.setPlayerColor(playerId, color);
          } catch (e) {}
        }
      } catch (e) {}
    }

    // Check if all players are ready and start game
    const currentState = getGameState();
    if (
      (currentState === "lobby" || currentState === "finished") &&
      checkAllReady()
    ) {
      // Wait a moment then start
      setTimeout(() => {
        const latestState = getGameState();
        if (latestState === "lobby" || latestState === "finished") {
          startRace();
        }
      }, 2000);
    }

    // Return lobby state
    const players = getRoomState();
    return NextResponse.json({
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        ready: p.ready || false,
        color: p.color,
      })),
      gameState: getGameState(),
    });
  } catch (error) {
    console.error("Error in lobby:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
