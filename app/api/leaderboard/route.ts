import { NextResponse } from "next/server";

// In-memory leaderboard for this running instance.
// Stored in module/global scope so it's kept while the server process is running.
// This is intentionally simple — restart of the process will reset the list.

type Entry = {
  id: string;
  name: string;
  score: number;
  color?: string;
};

let inMemoryLeaderboard: Entry[] = [];
const MAX_ENTRIES = 200;

function normalizeEntries(arr: any): Entry[] {
  if (!Array.isArray(arr)) return [];
  const normalized: Entry[] = [];
  for (const it of arr) {
    if (!it) continue;
    const id = String(it.id || it.playerId || "").trim();
    const name = String(it.name || it.playerName || "").trim() || "Player";
    const score = Number(it.score || 0) || 0;
    const color = it.color ? String(it.color) : undefined;
    if (!id) continue;
    normalized.push({ id, name, score, color });
  }
  return normalized;
}

export async function GET() {
  // return the top entries sorted by score desc
  const sorted = [...inMemoryLeaderboard].sort((a, b) => b.score - a.score);
  return NextResponse.json({ leaderboard: sorted.slice(0, MAX_ENTRIES) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const incoming = normalizeEntries(
      body && body.leaderboard ? body.leaderboard : body.entries || body
    );
    if (incoming.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No entries provided" },
        { status: 400 }
      );
    }

    // Merge incoming scores into inMemoryLeaderboard, keeping highest score per player
    const map = new Map<string, Entry>();
    for (const e of inMemoryLeaderboard) {
      map.set(e.id, e);
    }
    for (const e of incoming) {
      const existing = map.get(e.id);
      if (!existing || e.score > existing.score) {
        map.set(e.id, e);
      }
    }

    // Build sorted array
    inMemoryLeaderboard = Array.from(map.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);

    return NextResponse.json({ ok: true, leaderboard: inMemoryLeaderboard });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }
}
