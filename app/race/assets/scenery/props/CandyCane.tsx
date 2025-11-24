"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Smoke } from "../../ParticleEffects";
import { useTexture } from "@react-three/drei";

export type CandyCaneProps = {
  id?: string;
  position: [number, number, number];
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
  lastHitAt?: number;
  physics?: boolean;
};

export function CandyCane({
  id,
  position,
  destroyed = false,
  health,
  maxHealth,
  lastHitAt,
  physics = true,
}: CandyCaneProps) {
  // -----------------------
  // Load stripe texture
  // -----------------------
  const stripeTex = useTexture("/candy-cane.png");
  stripeTex.wrapS = THREE.RepeatWrapping;
  stripeTex.wrapT = THREE.RepeatWrapping;
  stripeTex.repeat.set(4, 1);

  // -----------------------
  // Clone + rotate texture only for the SHAFT
  // -----------------------
  const shaftTex = stripeTex.clone();
  shaftTex.wrapS = THREE.RepeatWrapping;
  shaftTex.wrapT = THREE.RepeatWrapping;
  shaftTex.repeat.set(4, 1);

  // rotate UVs for cylinder
  shaftTex.center.set(0.5, 0.5);
  shaftTex.rotation = Math.PI / 2;

  // -----------------------
  // Health + wobble animation
  // -----------------------
  const integrity = maxHealth
    ? Math.max(health ?? maxHealth, 0) / maxHealth
    : 1;
  const tilt = destroyed ? -0.6 : THREE.MathUtils.degToRad((1 - integrity) * 3);

  const groupRef = useRef<THREE.Group | null>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = Date.now() / 1000;
    groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.02 + tilt;

    if (lastHitAt && Date.now() - lastHitAt < 700) {
      const age = Date.now() - lastHitAt;
      const intensity = (1 - age / 700) * 0.12;
      groupRef.current.rotation.z += Math.sin(age / 40) * intensity;
    }
  });

  // -----------------------
  // Build cane
  // -----------------------
  const shaftHeight = 1.6;
  const shaftRadius = 0.08;

  function idToAngle(id?: string) {
    if (!id) return 0;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h % 360) * (Math.PI / 180);
  }

  const intact = (
    <group ref={groupRef}>
      {/* Shaft uses ROTATED texture */}
      <mesh position={[0, shaftHeight / 2 - 0.6, 0]} castShadow>
        <cylinderGeometry args={[shaftRadius, shaftRadius, shaftHeight, 12]} />
        <meshStandardMaterial map={shaftTex} />
      </mesh>

      {/* Hook uses NORMAL texture */}
      <mesh position={[-0.32, 1, 0]} rotation={[0, 0, 0]} castShadow>
        <torusGeometry args={[0.32, 0.08, 8, 24, Math.PI]} />
        <meshStandardMaterial map={stripeTex} />
      </mesh>
    </group>
  );

  // -----------------------
  // Toppled version: also gets rotated texture
  // -----------------------
  const toppled = (
    <group>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 1.8, 12]} />
        <meshStandardMaterial map={shaftTex} />
      </mesh>
    </group>
  );

  // deterministic rotation per ID
  const baseRotationY = idToAngle(id);

  if (destroyed)
    return (
      <group position={position} rotation={[0, baseRotationY, 0]}>
        {toppled}
      </group>
    );

  if (!physics)
    return (
      <group position={position} rotation={[0, baseRotationY, 0]}>
        {intact}
        {lastHitAt && Date.now() - lastHitAt < 700 && (
          <group position={[0, shaftHeight - 0.2, 0]}>
            <Smoke
              position={[0, 0, 0]}
              scale={0.45}
              count={14}
              color="#f3f3f3"
            />
          </group>
        )}
      </group>
    );

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      <group rotation={[0, baseRotationY, 0]}>{intact}</group>
      {lastHitAt && Date.now() - lastHitAt < 700 && (
        <group position={[0, shaftHeight - 0.2, 0]}>
          <Smoke position={[0, 0, 0]} scale={0.45} count={14} color="#f3f3f3" />
        </group>
      )}
    </RigidBody>
  );
}
