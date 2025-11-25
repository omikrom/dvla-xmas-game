import { NextRequest, NextResponse } from "next/server";
import {
  updatePlayerReady,
  checkAllReady,
  getGameState,
  getRoomState,
  createMatchToken,
  adoptMatchFromToken,
  MATCH_DURATION_MS,
  verifyMatchToken,
} from "@/lib/gameState";
import {
  claimMatchToken,
  getCurrentMatchToken,
  releaseMatchToken,
} from "@/lib/matchStore";

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
      const token = createMatchToken(startedAt, MATCH_DURATION_MS);
      // Attempt to claim the canonical token in the shared store (Vercel KV)
      // If claim succeeds, adopt it locally and return it. Otherwise read the
      // existing canonical token and return that instead.
      try {
        const claimed = await claimMatchToken(token, MATCH_DURATION_MS);
        // Diagnostic log: show which worker claimed/failed to claim
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const iid = require("@/lib/gameState").getInstanceId();
          console.log(`[lobby][${iid}] claimMatchToken -> ${claimed}`);
        } catch (e) {
          console.log(`[lobby] claimMatchToken -> ${claimed}`);
        }

        if (claimed) {
          matchToken = token;
          try {
            adoptMatchFromToken(matchToken);
            try {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              const iid = require("@/lib/gameState").getInstanceId();
              console.log(`[lobby][${iid}] adopted token locally`);
            } catch (e) {}
          } catch (e) {
            console.warn("Failed to adopt match token on lobby worker:", e);
          }
        } else {
          // Another worker already claimed a token — return that one instead
          matchToken = (await getCurrentMatchToken()) || null;
          // Defensive: if the returned token is expired, release it and clear
          // the value so we don't hand out finished matches to late joiners.
          try {
            if (matchToken) {
              const payload = verifyMatchToken(matchToken as string);
              if (
                !payload ||
                payload.startedAt + payload.durationMs <= Date.now()
              ) {
                try {
                  await releaseMatchToken();
                } catch (e) {}
                matchToken = null;
                try {
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  const iid = require("@/lib/gameState").getInstanceId();
                  console.log(
                    `[lobby][${iid}] discovered expired canonical token, released`
                  );
                } catch (e) {}
              }
            }
          } catch (e) {}
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const iid = require("@/lib/gameState").getInstanceId();
            console.log(
              `[lobby][${iid}] did not claim token, returning existing=${!!matchToken}`
            );
          } catch (e) {}
        }
      } catch (e) {
        console.warn("Error claiming match token, falling back:", e);
        matchToken = token;
        try {
          adoptMatchFromToken(matchToken);
        } catch (err) {}
      }
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
