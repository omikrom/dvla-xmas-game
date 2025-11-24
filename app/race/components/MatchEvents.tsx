"use client";

import React from "react";

export default function MatchEvents({
  events,
}: {
  events: Array<{ id: string; ts: number; msg: string }>;
}) {
  if (!events || events.length === 0) return null;
  return (
    <div className="fixed left-4 top-4 z-40 w-64 bg-slate-900/80 p-2 rounded border border-white/10 text-sm">
      <div className="font-semibold text-white">Events</div>
      <div className="mt-2 space-y-1 max-h-40 overflow-auto">
        {events.map((ev) => (
          <div key={ev.id} className="text-slate-300 text-xs">
            {new Date(ev.ts).toLocaleTimeString()}: {ev.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
