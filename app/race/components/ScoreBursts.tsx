"use client";

import React from "react";

type ScoreBurst = {
  id: string;
  amount: number;
  message: string;
  createdAt: number;
};

export default function ScoreBursts({ bursts }: { bursts: ScoreBurst[] }) {
  if (!bursts || bursts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-24 left-0 right-0 z-30 flex flex-col items-center gap-3">
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className="px-6 py-3 rounded-3xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-500 shadow-2xl shadow-emerald-500/40 text-center"
        >
          <p className="text-3xl font-black tracking-wide drop-shadow-lg">
            +{burst.amount} pts
          </p>
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-100">
            {burst.message}
          </p>
        </div>
      ))}
    </div>
  );
}
