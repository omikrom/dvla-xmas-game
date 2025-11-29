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
    // diagnostic flags to surface claim/adopt status to callers
    let claimOk = false;
    let adoptOk = false;
    const instanceId = getInstanceId();
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
        const iid = getInstanceId();
        const claimed = await claimMatchToken(token, MATCH_DURATION_MS, iid);
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
          claimOk = true;
          try {
            const adopted = await adoptMatchFromToken(matchToken);
            adoptOk = !!adopted;
            try {
              console.log(
                `[lobby][${instanceId}] adopted token locally -> ${adoptOk}`
              );
            } catch (e) {}
            // Save the initial authoritative snapshot so other workers can load it
            try {
              const r = getRoomState();
              const snapshot = {
                destructibles: r
                  ? require("@/lib/gameState").getDestructibleState() || []
                  : [],
                deliveries: r
                  ? require("@/lib/gameState").getDeliveries() || []
                  : [],
                powerUps: r
                  ? require("@/lib/gameState").getPowerUps() || []
                  : [],
                leaderboard: r
                  ? require("@/lib/gameState").getLeaderboard() || []
                  : [],
                events: r
                  ? require("@/lib/gameState").getMatchEvents() || []
                  : [],
              };
              try {
                await saveMatchSnapshot(
                  matchToken,
                  snapshot,
                  MATCH_DURATION_MS
                );
              } catch (e) {
                console.warn("Failed to save match snapshot:", e);
              }
            } catch (e) {}
          } catch (e) {
            console.warn("Failed to adopt match token on lobby worker:", e);
          }
        } else {
          // Another worker already claimed a token — try to read the canonical
          // token from the shared store. Sometimes Redis/KV connections may be
          // cold on a new instance or briefly delayed; retry briefly before
          // returning null so clients do not immediately bounce back to lobby.
          const READ_RETRY_MS = 300;
          const READ_STEP_MS = 60;
          let tried = 0;
          matchToken = (await getCurrentMatchToken()) || null;
          while (!matchToken && tried < READ_RETRY_MS) {
            try {
              // wait a short bit and retry
              await new Promise((res) => setTimeout(res, READ_STEP_MS));
            } catch (e) {}
            tried += READ_STEP_MS;
            try {
              matchToken = (await getCurrentMatchToken()) || null;
            } catch (e) {
              matchToken = null;
            }
          }
          try {
            console.log(
              `[lobby][${instanceId}] did not claim token, returning existing=${!!matchToken} (readRetryMs=${tried})`
            );
          } catch (e) {}
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
          const adopted = await adoptMatchFromToken(matchToken);
          adoptOk = !!adopted;
        } catch (err) {}
        try {
          console.log(`[lobby][${instanceId}] fallback adopted -> ${adoptOk}`);
        } catch (e) {}
      }
    }

    // Return lobby state
    const players = getRoomState();
    // Also include the current canonical token (if any) and a best-effort
    // hint about which backend is configured so operators can triage.
    let currentCanonicalToken: string | null = null;
    try {
      currentCanonicalToken = (await getCurrentMatchToken()) || null;
    } catch (e) {
      currentCanonicalToken = null;
    }

    // If this worker did not themselves claim the token, but a canonical
    // token exists in the shared store, prefer returning that so clients
    // receive a usable token regardless of which worker they polled.
    const returnedMatchToken = matchToken || currentCanonicalToken;

    // Best-effort store backend hint
    let storeBackend = "memory";
    try {
      if (process.env.REDIS_URL || process.env.REDIS_URI)
        storeBackend = "redis";
      else {
        // try to detect Vercel KV availability
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
      matchToken: returnedMatchToken,
      // diagnostic helpers for debugging prod issues
      claimOk,
      adoptOk,
      instanceId,
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
