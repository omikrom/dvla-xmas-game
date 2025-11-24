"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Smoke } from "../../ParticleEffects";

export type ChristmasTreeProps = {
  id: string;
  position: [number, number, number];
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
  lastHitAt?: number;
  physics?: boolean;
};

export function ChristmasTree({
  position,
  destroyed = false,
  health,
  maxHealth,
  lastHitAt,
  physics = true,
}: ChristmasTreeProps) {
  const integrity = maxHealth
    ? Math.max(health ?? maxHealth, 0) / maxHealth
    : 1;
  const tone = destroyed
    ? "#4b5563"
    : integrity > 0.6
    ? "#166534"
    : integrity > 0.3
    ? "#b45309"
    : "#7c2d12";
  const tilt = destroyed ? -0.6 : THREE.MathUtils.degToRad((1 - integrity) * 6);

  const groupRef = useRef<THREE.Group | null>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    if (!lastHitAt) {
      groupRef.current.rotation.z = 0;
      groupRef.current.rotation.x = tilt;
      return;
    }
    const age = Date.now() - lastHitAt;
    const DURATION = 800; // ms
    if (age > DURATION) {
      groupRef.current.rotation.z = 0;
      groupRef.current.rotation.x = tilt;
      return;
    }
    const t = (age / DURATION) * Math.PI * 2;
    const intensity = (1 - age / DURATION) * 0.12; // radians
    groupRef.current.rotation.z = Math.sin(t * 6) * intensity;
    groupRef.current.rotation.x = tilt + Math.sin(t * 4) * intensity * 0.35;
  });

  const intact = (
    <group ref={groupRef} rotation={[tilt, 0, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 1, 8]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <coneGeometry args={[1.5, 2, 8]} />
        <meshStandardMaterial color={tone} />
      </mesh>
      <mesh position={[0, 2.8, 0]} castShadow>
        <coneGeometry args={[1.2, 1.8, 8]} />
        <meshStandardMaterial color={tone} />
      </mesh>
      <mesh position={[0, 4, 0]} castShadow>
        <coneGeometry args={[0.9, 1.5, 8]} />
        <meshStandardMaterial color={tone} />
      </mesh>
      <mesh position={[0, 5.2, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffd700"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );

  const toppled = (
    <group>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 3, 6]} />
        <meshStandardMaterial color="#3f3f46" />
      </mesh>
      <mesh position={[1, 0.4, 0]} rotation={[0.2, 0.4, 1.2]} castShadow>
        <coneGeometry args={[1.5, 3.2, 8]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
    </group>
  );

  if (destroyed) {
    return <group position={position}>{toppled}</group>;
  }

  if (!physics) {
    return (
      <group position={position}>
        {intact}
        {lastHitAt && Date.now() - lastHitAt < 700 && (
          <group position={[0, 1.2, 0]}>
            <Smoke
              position={[0, 0, 0]}
              scale={0.45}
              count={22}
              color="#cfcfcf"
            />
          </group>
        )}
      </group>
    );
  }

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      {intact}
      {/* Emit a quick puff of smoke when recently hit */}
      {lastHitAt && Date.now() - lastHitAt < 700 && (
        <group position={[0, 1.2, 0]}>
          <Smoke position={[0, 0, 0]} scale={0.45} count={22} color="#cfcfcf" />
        </group>
      )}
    </RigidBody>
  );
}
