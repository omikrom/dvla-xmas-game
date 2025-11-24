"use client";

import React from "react";

export default function CountdownOverlay({
  showCountdown,
  showGoSignal,
  countdownNumber,
  trafficActiveIndex,
}: {
  showCountdown: boolean;
  showGoSignal: boolean;
  countdownNumber: number | null;
  trafficActiveIndex: number;
}) {
  if (!showCountdown && !showGoSignal) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur">
      <div className="flex gap-4 mb-8">
        {["#ef4444", "#f97316", "#22c55e"].map((color, index) => (
          <span
            key={color}
            className={`w-12 h-12 rounded-full border-4 border-white/40 transition-all ${
              index === trafficActiveIndex
                ? "scale-110 shadow-lg shadow-black/50"
                : "opacity-40"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <p className="text-7xl font-black tracking-widest text-white drop-shadow-2xl">
        {showCountdown ? countdownNumber : "GO!"}
      </p>
    </div>
  );
}
