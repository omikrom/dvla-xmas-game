"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Smoke } from "../../ParticleEffects";

export type SnowmanProps = {
  id?: string;
  position: [number, number, number];
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
  lastHitAt?: number;
  physics?: boolean;
};

export function Snowman({
  id,
  position,
  destroyed = false,
  health,
  maxHealth,
  lastHitAt,
  physics = true,
}: SnowmanProps) {
  const integrity = maxHealth
    ? Math.max(health ?? maxHealth, 0) / maxHealth
    : 1;
  const tilt = destroyed ? -0.6 : THREE.MathUtils.degToRad((1 - integrity) * 6);

  const groupRef = useRef<THREE.Group | null>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    // slight idle bob
    const t = Date.now() / 1000;
    groupRef.current.rotation.x = Math.sin(t * 0.4) * 0.02 + tilt;
    groupRef.current.rotation.z = Math.sin(t * 0.6) * 0.01;
    // quick wobble if recently hit
    if (lastHitAt && Date.now() - lastHitAt < 700) {
      const age = Date.now() - lastHitAt;
      const intensity = (1 - age / 700) * 0.25;
      groupRef.current.rotation.z += Math.sin(age / 40) * intensity;
    }
  });

  function idToAngle(id?: string) {
    if (!id) return 0;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h % 360) * (Math.PI / 180);
  }

  const baseRotationY = idToAngle(id);

  const intact = (
    <group ref={groupRef} rotation={[tilt, 0, 0]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <sphereGeometry args={[0.9, 16, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.6, 12, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 2.2, 0]} castShadow>
        <sphereGeometry args={[0.38, 12, 12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Coal eyes */}
      <mesh position={[0.12, 2.3, 0.34]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[-0.12, 2.3, 0.34]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      {/* Carrot nose */}
      <mesh position={[0, 2.2, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.5, 8]} />
        <meshStandardMaterial color="#ff8c42" />
      </mesh>

      {/* Buttons */}
      <mesh position={[0, 1.45, 0.6]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 1.2, 0.62]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Simple hat */}
      <mesh position={[0, 2.46, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.28, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.48, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );

  const toppled = (
    <group>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <sphereGeometry args={[0.3, 6, 12]} />
        <meshStandardMaterial color="#ddd" />
      </mesh>
      <mesh position={[1, 0.4, 0]} rotation={[0.2, 0.4, 1.2]} castShadow>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshStandardMaterial color="#eee" />
      </mesh>
    </group>
  );

  if (destroyed) {
    return (
      <group position={position} rotation={[0, baseRotationY, 0]}>
        {toppled}
      </group>
    );
  }

  if (!physics) {
    return (
      <group position={position} rotation={[0, baseRotationY, 0]}>
        {intact}
        {lastHitAt && Date.now() - lastHitAt < 700 && (
          <group position={[0, 1.6, 0]}>
            <Smoke
              position={[0, 0, 0]}
              scale={0.45}
              count={18}
              color="#cfcfcf"
            />
          </group>
        )}
      </group>
    );
  }

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      <group rotation={[0, baseRotationY, 0]}>{intact}</group>
      {lastHitAt && Date.now() - lastHitAt < 700 && (
        <group position={[0, 1.6, 0]}>
          <Smoke position={[0, 0, 0]} scale={0.45} count={18} color="#cfcfcf" />
        </group>
      )}
    </RigidBody>
  );
}
