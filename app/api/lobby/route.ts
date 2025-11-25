import { NextRequest, NextResponse } from "next/server";
import {
  updatePlayerReady,
  checkAllReady,
  getGameState,
  getRoomState,
  createMatchToken,
  MATCH_DURATION_MS,
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
        const gs = await Promise.resolve().then(() =>
          require("@/lib/gameState")
        );
        if (gs && typeof gs.setPlayerColor === "function") {
          try {
            gs.setPlayerColor(playerId, color);
          } catch (e) {}
        }
      } catch (e) {}
    }

    // Check if all players are ready and prepare a signed match token for
    // clients to adopt. We do not start the race directly on the lobby
    // worker to avoid multiple workers initiating overlapping matches in
    // multi-instance deployments. The client will include the returned
    // `matchToken` in subsequent `/api/game` requests so whichever worker
    // first receives it can adopt and initialize the canonical match.
    const currentState = getGameState();
    let matchToken: string | null = null;
    if (
      (currentState === "lobby" || currentState === "finished") &&
      checkAllReady()
    ) {
      const startedAt = Math.floor((Date.now() + 2000) / 1000) * 1000; // small delay
      matchToken = createMatchToken(startedAt, MATCH_DURATION_MS);
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
      matchToken,
    });
  } catch (error) {
    console.error("Error in lobby:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
