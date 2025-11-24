"use client";

import { useEffect } from "react";
import type { PowerUpItem, PowerUpType } from "../types/powerup";
import { POWERUP_CONFIGS } from "../types/powerup";

export default function useInitializePowerUps({
  gameState,
  deliveries,
  powerUps,
  setPowerUps,
}: {
  gameState: "lobby" | "racing" | "finished";
  deliveries: any[];
  powerUps: PowerUpItem[];
  setPowerUps: (p: PowerUpItem[]) => void;
}) {
  useEffect(() => {
    if (gameState !== "racing" || powerUps.length > 0) return;

    const powerUpTypes: PowerUpType[] = Object.keys(
      POWERUP_CONFIGS
    ) as PowerUpType[];
    const candidatePositions: Array<[number, number, number]> = [
      [30, 0.8, 30],
      [-30, 0.8, 30],
      [30, 0.8, -30],
      [-30, 0.8, -30],
      [0, 0.8, 40],
      [0, 0.8, -40],
      [40, 0.8, 0],
      [-40, 0.8, 0],
      // More candidate spots to increase coverage
      [20, 0.8, 20],
      [-20, 0.8, 20],
      [20, 0.8, -20],
      [-20, 0.8, -20],
      [10, 0.8, 35],
      [-10, 0.8, 35],
      [10, 0.8, -35],
      [-10, 0.8, -35],
      [35, 0.8, 10],
      [35, 0.8, -10],
      [-35, 0.8, 10],
      [-35, 0.8, -10],
    ];

    // Gather delivery positions (use x/y)
    const deliveryPositions = deliveries.map(
      (d) => [d.x, 0.8, d.y] as [number, number, number]
    );

    // Gather present spawn positions (assuming static at origin for now)
    const presentPositions: Array<[number, number, number]> = [[0, 0.8, 0]];

    // Minimum allowed distance between spawns
    const minDistance = 8;

    // Helper to check overlap
    function isOverlapping(
      pos: [number, number, number],
      others: Array<[number, number, number]>
    ) {
      return others.some((other) => {
        const dx = pos[0] - other[0];
        const dz = pos[2] - other[2];
        return Math.sqrt(dx * dx + dz * dz) < minDistance;
      });
    }

    // Rank candidate positions by distance to nearest delivery/present (prefer far away)
    const scored = candidatePositions.map((pos) => {
      const dists = [...deliveryPositions, ...presentPositions].map((other) => {
        const dx = pos[0] - other[0];
        const dz = pos[2] - other[2];
        return Math.sqrt(dx * dx + dz * dz);
      });
      const minDist = dists.length ? Math.min(...dists) : Infinity;
      return { pos, minDist };
    });

    // Sort descending by minDist so we pick positions furthest from deliveries/presents first
    scored.sort((a, b) => b.minDist - a.minDist);

    const maxPowerUps = 12; // allow more simultaneous powerups
    const selected: Array<[number, number, number]> = [];

    for (const s of scored) {
      if (selected.length >= maxPowerUps) break;
      // Skip if this candidate overlaps an already-selected spawn
      if (isOverlapping(s.pos, selected)) continue;

      // soft check: accept if sufficiently far from deliveries/presents,
      // otherwise only accept if we still need slots
      if (
        s.minDist >= minDistance * 0.6 ||
        selected.length + 1 > Math.floor(maxPowerUps * 0.6)
      ) {
        selected.push(s.pos);
      }
    }
    // Build initial powerUps state from selected positions
    const initialPowerUps: PowerUpItem[] = selected.map((pos, idx) => {
      const type = powerUpTypes[idx % powerUpTypes.length];
      return {
        id: `pu-${idx}-${Date.now()}`,
        type,
        // candidate `pos` is [x, height, y] so map to { x, y, z }
        x: pos[0],
        y: pos[2],
        z: pos[1],
        collected: false,
      };
    });

    setPowerUps(initialPowerUps);
  }, [gameState, deliveries, powerUps.length, setPowerUps]);
}
