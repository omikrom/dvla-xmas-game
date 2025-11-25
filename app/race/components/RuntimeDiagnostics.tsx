"use client";

import React, { useEffect, useState } from "react";

export default function RuntimeDiagnostics({
  powerUps,
  destructibles,
  collisionEffects,
}: {
  powerUps?: any[];
  destructibles?: any[];
  collisionEffects?: any[];
}) {
  const [stats, setStats] = useState({
    particleSystems: 0,
    totalParticles: 0,
    powerUps: 0,
    debris: 0,
    collisionEffects: 0,
  });

  useEffect(() => {
    const update = () => {
      const d = (typeof window !== "undefined" && (window as any).__GAME_DIAGS) || {};
      const debris = (destructibles || []).reduce(
        (acc, d) => acc + (d?.debris?.length || 0),
        0
      );
      // expose quick globals for console-driven diagnostics
      try {
        if (typeof window !== "undefined") {
          (window as any).__GAME_POWERUPS_COUNT = (powerUps || []).length;
          (window as any).__GAME_DEBRIS_COUNT = debris;
        }
      } catch (e) {}
      setStats({
        particleSystems: d.particleSystems || 0,
        totalParticles: d.totalParticles || 0,
        powerUps: (powerUps || []).length,
        debris,
        collisionEffects: (collisionEffects || []).length,
      });
    };

    update();
    const id = window.setInterval(update, 500);
    return () => window.clearInterval(id);
  }, [powerUps, destructibles, collisionEffects]);

  return (
    <div className="absolute right-6 top-16 z-50 pointer-events-none">
      <div className="bg-black/60 text-xs text-white rounded-md p-2 w-56 pointer-events-auto">
        <div className="font-semibold text-sm mb-1">Runtime Diagnostics</div>
        <div className="flex justify-between"><span>Particle systems</span><span className="font-mono">{stats.particleSystems}</span></div>
        <div className="flex justify-between"><span>Total particles</span><span className="font-mono">{stats.totalParticles}</span></div>
        <div className="flex justify-between"><span>Active power-ups</span><span className="font-mono">{stats.powerUps}</span></div>
        <div className="flex justify-between"><span>Debris pieces</span><span className="font-mono">{stats.debris}</span></div>
        <div className="flex justify-between"><span>Collision effects</span><span className="font-mono">{stats.collisionEffects}</span></div>
      </div>
    </div>
  );
}
