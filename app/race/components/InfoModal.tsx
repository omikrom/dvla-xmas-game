"use client";

import React from "react";

export default function InfoModal({
  open,
  onClose,
  name,
  powerupConfigs,
  formattedTimer,
  timerProgress,
  waitingDeliveries,
  deliveries,
  destroyedObjects,
  totalDestructibles,
  myCar,
  activePowerUps,
  leaderboard,
  recentEvents,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  powerupConfigs: Record<string, any>;
  formattedTimer: string;
  timerProgress: number;
  waitingDeliveries: number;
  deliveries: any[];
  destroyedObjects: number;
  totalDestructibles: number;
  myCar: any;
  activePowerUps?: Array<any>;
  leaderboard?: Array<{
    id: string;
    name: string;
    score: number;
    color?: string;
  }>;
  recentEvents?: Array<{ id: string; ts: number; msg: string }>;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-50 w-[min(640px,95%)] max-h-[90vh] overflow-auto bg-slate-900/95 p-6 rounded-lg border border-white/10">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">Game Info</h2>
          <button onClick={onClose} className="px-3 py-1 bg-white/10 rounded">
            Close
          </button>
        </div>
        <div className="text-sm text-slate-300 space-y-3">
          <p>Controls: WASD / Arrow Keys</p>
          <p className="text-blue-400">SPACE - Throw Present 🎁</p>
          <p className="text-purple-400">Collect PowerUps ⚡🔧🛡️🧲</p>
          <div className="pt-2">
            <p className="font-semibold text-slate-200">⭐ PowerUps Guide</p>
            <div className="mt-2 space-y-1 text-sm text-slate-300">
              {Object.keys(powerupConfigs).map((type) => {
                const cfg = powerupConfigs[type];
                return (
                  <div key={type} className="flex items-start gap-3">
                    <div className="text-lg">{cfg.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold">
                        {cfg.name}{" "}
                        {cfg.duration > 0 ? (
                          <span className="text-xs text-slate-400">
                            ({cfg.duration / 1000}s)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            (Instant)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {cfg.description || cfg.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="font-mono text-base text-yellow-300">
              ⏱️ {formattedTimer}
            </p>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-1">
              <span
                className="block h-full bg-yellow-400"
                style={{ width: `${timerProgress * 100}%` }}
              />
            </div>
          </div>
          <p className="text-pink-300 font-semibold">
            Score: {Math.round(myCar?.score || 0)} pts
          </p>
          <p className="text-amber-200">
            Deliveries ready: {waitingDeliveries}/{deliveries.length || "?"}
          </p>
          <div className="mt-3 p-3 bg-slate-800/60 rounded">
            <p className="font-semibold">🎁 Holiday Deliveries</p>
            <p className="text-sm text-slate-300">
              Rush to the centre, grab a licence, and smash your way to the drop
              zone.
            </p>
            <div className="flex gap-4 mt-2 text-sm text-slate-300">
              <span>Waiting: {waitingDeliveries}</span>
              <span>Total: {deliveries.length}</span>
            </div>
          </div>
          <p className="text-emerald-300">
            Environment: {destroyedObjects}/{totalDestructibles || "?"}
          </p>

          {activePowerUps && activePowerUps.length > 0 && (
            <div className="mt-3 p-3 bg-slate-800/60 rounded">
              <p className="font-semibold">Active PowerUps</p>
              <div className="mt-2 space-y-1 text-sm text-slate-300">
                {activePowerUps.map((ap: any) => (
                  <div
                    key={ap.type}
                    className="flex items-center justify-between"
                  >
                    <div>{ap.type}</div>
                    <div className="text-xs text-slate-400">
                      {Math.max(
                        0,
                        Math.round((ap.expiresAt - Date.now()) / 1000)
                      )}
                      s
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {leaderboard && leaderboard.length > 0 && (
            <div className="mt-3 p-3 bg-slate-800/60 rounded">
              <p className="font-semibold">Leaderboard</p>
              <div className="mt-2 text-sm text-slate-300">
                {leaderboard.slice(0, 6).map((l) => (
                  <div key={l.id} className="flex justify-between">
                    <div>{l.name}</div>
                    <div className="font-mono">{l.score}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentEvents && recentEvents.length > 0 && (
            <div className="mt-3 p-3 bg-slate-800/60 rounded">
              <p className="font-semibold">Recent Events</p>
              <div className="mt-2 text-sm text-slate-300 space-y-1">
                {recentEvents.slice(0, 8).map((ev) => (
                  <div key={ev.id}>
                    {new Date(ev.ts).toLocaleTimeString()}: {ev.msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
