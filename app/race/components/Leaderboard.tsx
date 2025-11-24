"use client";

import React from "react";

export default function Leaderboard({
  entries,
}: {
  entries: Array<{ id: string; name: string; score: number; color?: string }>;
}) {
  const top = entries.slice(0, 6);
  return (
    <div className="fixed right-4 top-4 z-40 w-44 bg-slate-900/80 p-2 rounded border border-white/10 text-sm">
      <div className="font-semibold text-white">Leaderboard</div>
      <div className="mt-2 space-y-1">
        {top.map((e, i) => (
          <div key={e.id} className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 10,
                  height: 10,
                  background: e.color || "#fff",
                  borderRadius: 4,
                }}
              />
              <div className="truncate" title={e.name}>
                {i + 1}. {e.name}
              </div>
            </div>
            <div className="font-mono">{e.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
