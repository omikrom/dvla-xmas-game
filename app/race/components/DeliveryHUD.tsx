"use client";

import React from "react";

export default function DeliveryHUD({
  waitingCount,
  carrying,
  deliveries,
}: {
  waitingCount: number;
  carrying?: any;
  deliveries: any[];
}) {
  return (
    <div className="fixed left-1/2 transform -translate-x-1/2 bottom-6 z-40 bg-slate-900/75 px-4 py-2 rounded border border-white/10 text-sm flex items-center gap-4">
      <div className="font-semibold text-white">Deliveries</div>
      <div className="text-slate-300">
        Waiting: <span className="font-mono">{waitingCount}</span>
      </div>
      <div className="text-slate-300">
        Total: <span className="font-mono">{deliveries.length}</span>
      </div>
      {carrying ? (
        <div className="text-emerald-300">Carrying: {carrying.id}</div>
      ) : null}
    </div>
  );
}
