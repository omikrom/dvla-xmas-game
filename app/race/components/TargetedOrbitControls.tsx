"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

type Props = {
  playerId?: string | null;
  cars: any[];
  lerp?: number;
  enableDamping?: boolean;
  dampingFactor?: number;
  minDistance?: number;
  maxDistance?: number;
  maxPolarAngle?: number;
};

export default function TargetedOrbitControls({
  playerId,
  cars,
  lerp = 0.12,
  enableDamping = true,
  dampingFactor = 0.05,
  minDistance = 30,
  maxDistance = 100,
  maxPolarAngle = Math.PI / 2.5,
}: Props) {
  const ref = useRef<any>(null);

  useFrame(() => {
    const ctrl = ref.current;
    if (!ctrl) return;

    // Find the player's car in the provided list
    const playerCar = playerId
      ? cars?.find((c: any) => c.id === playerId)
      : null;

    // Convert game coordinates (x, y) -> three (x, z, y) where z is vertical
    const desired = new THREE.Vector3();
    if (playerCar) {
      const x = typeof playerCar.x === "number" ? playerCar.x : 0;
      const z =
        typeof playerCar.z === "number"
          ? playerCar.z
          : (playerCar.y && playerCar.y.z) || 0.8;
      const y = typeof playerCar.y === "number" ? playerCar.y : 0;
      desired.set(x, z, y);
    } else {
      // fall back to current target
      desired.copy(ctrl.target || new THREE.Vector3());
    }

    // Smoothly lerp the controls target towards the desired position
    ctrl.target.lerp(desired, lerp);
    if (ctrl.update) ctrl.update();
  });

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping={enableDamping}
      dampingFactor={dampingFactor}
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={maxPolarAngle}
    />
  );
}
