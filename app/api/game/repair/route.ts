import { NextRequest, NextResponse } from "next/server";
import { repairPlayer } from "@/lib/gameState";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerId, amount } = body || {};
    if (!playerId || typeof amount !== "number") {
      return NextResponse.json({ error: "Missing playerId or amount" }, { status: 400 });
    }

    const player = repairPlayer(playerId, amount);
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    return NextResponse.json({ player });
  } catch (err) {
    console.error("/api/game/repair error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
