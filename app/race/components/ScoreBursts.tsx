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
          className="md:px-6 md:py-3 px-3 py-2 rounded-xl shadow-lg text-center max-w-[92vw] md:max-w-[720px] border border-yellow-400/30"
          style={{
            background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 25%, #166534 50%, #15803d 75%, #dc2626 100%)",
            boxShadow: "0 0 20px rgba(220,38,38,0.4), 0 0 40px rgba(22,163,74,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        >
          <p className="md:text-2xl text-xl font-black tracking-wide drop-shadow-lg" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
            <span className="text-yellow-300">+{burst.amount}</span> <span className="text-white">pts</span>
          </p>
          <p className="text-xs uppercase tracking-wide text-yellow-100/90">
            {burst.message}
          </p>
        </div>
      ))}
    </div>
  );
}
