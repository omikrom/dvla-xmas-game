"use client";

import { useEffect, useRef } from "react";
import { POWERUP_CONFIGS, PowerUpType } from "../types";

export default function usePowerupVisuals({
  powerUps,
  setCollisionEffects,
  pushDebug,
}: any) {
  const prevPowerUpsRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!powerUps || !powerUps.length) return;
    for (const pu of powerUps) {
      const prev = prevPowerUpsRef.current.get(pu.id) || false;
      if (!prev && pu.collected) {
        const cfg = POWERUP_CONFIGS[pu.type as PowerUpType];
        setCollisionEffects((prevArr: any) => {
          // Keep a cap on simultaneous transient effects to avoid UI spikes
          const next = [
            ...prevArr,
            {
              id: `pu-${pu.id}-${Date.now()}`,
              // Project uses [x, z, y] ordering for three.js positions (x, vertical, forward)
              position: [pu.x, pu.z || 0.8, pu.y],
              timestamp: Date.now(),
              color: cfg.accentColor || cfg.baseColor,
              kind: "powerup",
              variant: pu.type,
            },
          ];
          // Cap to last 8 visual effects
          if (next.length > 8) {
            return next.slice(next.length - 8);
          }
          return next;
        });
        if (pushDebug)
          pushDebug(
            `PowerUp visual effect: ${pu.type} collected at ${Math.round(
              pu.x
            )},${Math.round(pu.y)}`
          );
      }
      prevPowerUpsRef.current.set(pu.id, !!pu.collected);
    }
  }, [powerUps, setCollisionEffects, pushDebug]);
}
