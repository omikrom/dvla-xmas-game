"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerCar } from "../types";
import SpeedTrail from "./SpeedTrail";

export default function InterpolatedCar({
  car,
  children,
  positionsRef,
  trailColor,
}: {
  car: PlayerCar;
  children: React.ReactNode;
  positionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  trailColor?: string;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const targetPos = useRef(new THREE.Vector3(car.x, car.z || 0.3, car.y));
  const targetRot = useRef(car.angle);

  useEffect(() => {
    targetPos.current.set(car.x, car.z || 0.3, car.y);
    targetRot.current = car.angle;
  }, [car.x, car.y, car.z, car.angle]);

  // On mount, immediately snap the visual group to the server position so
  // the car isn't rendered at the origin for a frame before lerping.
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(
      targetPos.current.x,
      targetPos.current.y,
      targetPos.current.z
    );
    g.rotation.y = targetRot.current;
    // ensure positionsRef reflects initial placement
    positionsRef.current.set(car.id, { x: g.position.x, y: g.position.z });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(targetPos.current, 0.2);
    positionsRef.current.set(car.id, {
      x: groupRef.current.position.x,
      y: groupRef.current.position.z,
    });

    // Clamp visual position to inside the playable area to avoid passing through perimeter walls visually
    const CLAMP_BOUND = 98; // just inside the wall at 100
    if (groupRef.current.position.x > CLAMP_BOUND)
      groupRef.current.position.x = CLAMP_BOUND;
    if (groupRef.current.position.x < -CLAMP_BOUND)
      groupRef.current.position.x = -CLAMP_BOUND;
    if (groupRef.current.position.z > CLAMP_BOUND)
      groupRef.current.position.z = CLAMP_BOUND;
    if (groupRef.current.position.z < -CLAMP_BOUND)
      groupRef.current.position.z = -CLAMP_BOUND;

    const currentRotY = groupRef.current.rotation.y;
    let angleDiff = targetRot.current - currentRotY;
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    groupRef.current.rotation.y += angleDiff * 0.1;
  });

  const isSpeedActive = !!car.activePowerUps?.some(
    (p) => p.type === "speed" && p.expiresAt > Date.now()
  );

  return (
    <group ref={groupRef}>
      <SpeedTrail
        groupRef={groupRef}
        active={isSpeedActive}
        color={trailColor}
      />
      {children}
    </group>
  );
}
