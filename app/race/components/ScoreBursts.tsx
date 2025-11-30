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
    <div className="pointer-events-none fixed top-16 left-0 right-0 z-30 flex flex-col items-center gap-2">
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className="md:px-6 md:py-3 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-500 shadow-lg shadow-emerald-400/30 text-center max-w-[92vw] md:max-w-[720px]"
        >
          <p className="md:text-2xl text-xl font-black tracking-wide drop-shadow">
            +{burst.amount} pts
          </p>
          <p className="text-xs uppercase tracking-wide text-emerald-100">
            {burst.message}
          </p>
        </div>
      ))}
    </div>
  );
}
