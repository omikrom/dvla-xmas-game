"use client";

import PowerUp from "../assets/PowerUp";
import type { PowerUpItem } from "../types/powerup";

export default function PowerUpLayer({
  powerUps,
}: {
  powerUps: PowerUpItem[];
}) {
  return (
    <>
      {powerUps.map((powerUp) => (
        <PowerUp
          key={powerUp.id}
          type={powerUp.type}
          position={[powerUp.x, powerUp.z || 0.8, powerUp.y]}
          collected={powerUp.collected}
        />
      ))}
    </>
  );
}
