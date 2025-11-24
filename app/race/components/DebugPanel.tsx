"use client";

import React from "react";

export default function DebugPanel({
  debugLogs,
  onClear,
  visible,
}: {
  debugLogs: Array<{ id: string; ts: number; level: string; msg: string }>;
  onClear: () => void;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="fixed left-4 bottom-4 z-50 w-96 max-h-64 overflow-auto pointer-events-auto">
      <div
        className="bg-black/60 text-white text-xs rounded-lg border border-white/10 p-2 backdrop-blur-sm"
        style={{ userSelect: "text", WebkitUserSelect: "text" }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Debug</div>
          <div className="flex items-center gap-2">
            <button
              className="text-xxs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
              onClick={onClear}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="space-y-1">
          {debugLogs.length === 0 && (
            <div className="text-slate-400">No debug messages</div>
          )}
          {debugLogs.slice(0, 50).map((d) => (
            <div key={d.id} className="flex items-start gap-2">
              <div
                className={`w-2 h-2 mt-1 rounded-full ${
                  d.level === "error"
                    ? "bg-red-400"
                    : d.level === "warn"
                    ? "bg-yellow-400"
                    : "bg-emerald-400"
                }`}
              />
              <div className="flex-1">
                <div className="text-[10px] text-slate-200">
                  {new Date(d.ts).toLocaleTimeString()}
                </div>
                <div className="text-sm break-words">{d.msg}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
