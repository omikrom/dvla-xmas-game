"use client";

import { useEffect, useRef } from "react";
import { POWERUP_CONFIGS, PowerUpType } from "../types";

export default function usePowerUps({
  playerId,
  cars,
  powerUps,
  setPowerUps,
  setActivePowerUps,
  setCars,
  pushDebug,
  setCollisionEffects,
}: any) {
  // The server is authoritative for pickups. We avoid mutating `powerUps` or
  // applying effects locally to prevent jitter between client optimism and
  // server state. Instead, watch server-sent `powerUps` and show a
  // local collected notification when the server confirms a pickup by this
  // player.
  const prevLocalPickupRef = useRef(new Map<string, boolean>());

  useEffect(() => {
    if (!powerUps || !powerUps.length) return;
    if (!playerId) return;
    for (const pu of powerUps) {
      const prev = prevLocalPickupRef.current.get(pu.id) || false;
      // When server reports a newly collected powerup, and it was collected by
      // this player, we emit debug events and visual effects elsewhere.
      // Previously we showed a small toast notification here; that is now
      // handled by the active power-up HUD to avoid duplicate/buggy toasts.
      prevLocalPickupRef.current.set(pu.id, !!pu.collected);
    }
  }, [powerUps, playerId]);
}
