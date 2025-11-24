"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import PowerUp from "../assets/PowerUp";
import type { PowerUpItem } from "../types";

export default function LocalPowerUp({
  pu,
  onRemoved,
}: {
  pu: PowerUpItem;
  onRemoved: (id: string) => void;
}) {
  const gRef = useRef<any>(null);
  const removingRef = useRef(false);
  const startRef = useRef<number | null>(null);

  useFrame((state) => {
    if (!gRef.current) return;
    if (pu.collected && !removingRef.current) {
      removingRef.current = true;
      startRef.current = state.clock.elapsedTime;
    }
    if (removingRef.current && startRef.current != null) {
      const elapsed = state.clock.elapsedTime - startRef.current;
      const t = Math.min(1, elapsed / 0.45);
      const s = 1 - t;
      gRef.current.scale.setScalar(s);
      gRef.current.rotation.y = state.clock.elapsedTime * 3;
      if (t >= 1) {
        onRemoved(pu.id);
      }
    }
  });

  return (
    <group ref={gRef} position={[pu.x, pu.z || 0.8, pu.y]}>
      <PowerUp type={pu.type as any} position={[0, 0, 0]} collected={false} />
    </group>
  );
}
