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
  // Smoothed target position to avoid jumps from raw server data
  const smoothedTarget = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  useFrame((_, delta) => {
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

    // Initialize smoothed target on first frame
    if (!initialized.current && playerCar) {
      smoothedTarget.current.copy(desired);
      ctrl.target.copy(desired);
      initialized.current = true;
    }

    // First, smooth the desired position to handle server position jumps
    // This creates a double-smoothing effect: raw -> smoothed -> camera target
    const preSmoothFactor = 6; // How fast to track raw server position
    const preSmoothing = 1 - Math.exp(-preSmoothFactor * delta);
    smoothedTarget.current.lerp(desired, preSmoothing);

    // Then smoothly lerp the controls target towards the pre-smoothed position
    // Use frame-rate independent exponential smoothing
    const cameraTrackFactor = 8; // How fast camera tracks the smoothed position
    const cameraSmoothing = 1 - Math.exp(-cameraTrackFactor * delta);
    ctrl.target.lerp(smoothedTarget.current, cameraSmoothing);
    
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
