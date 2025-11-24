import { NextRequest, NextResponse } from "next/server";
import { recordMatchEvent, getRoomState } from "@/lib/gameState";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerId, description, points, timestamp } = body;
    if (!playerId || !description || typeof points !== "number") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    // Find player
    const players = getRoomState();
    const player = players.find((p) => p.id === playerId);
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    recordMatchEvent(player, points, description);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording match event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
