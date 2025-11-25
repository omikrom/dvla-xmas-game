"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Smoke } from "../../ParticleEffects";

export type ReindeerProps = {
  id?: string;
  position: [number, number, number];
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
  lastHitAt?: number;
  physics?: boolean;
};

export function Reindeer({
  id,
  position,
  destroyed = false,
  health,
  maxHealth,
  lastHitAt,
  physics = true,
}: ReindeerProps) {
  const integrity = maxHealth
    ? Math.max(health ?? maxHealth, 0) / maxHealth
    : 1;

  const tilt = destroyed ? -0.7 : THREE.MathUtils.degToRad((1 - integrity) * 6);

  const groupRef = useRef<THREE.Group | null>(null);

  // Boss face texture on the reindeer head
  // Put santa-head.png into /public/textures/boss-santa.png
  const bossFaceTexture = useTexture("/reindeer-head.png");

  useFrame(() => {
    if (!groupRef.current) return;
    const t = Date.now() / 1000;

    // gentle breathing / idle motion
    groupRef.current.position.y = 0.03 * Math.sin(t * 1.2);
    groupRef.current.rotation.x = tilt + Math.sin(t * 0.8) * 0.02;
    groupRef.current.rotation.z = Math.sin(t * 0.6) * 0.015;

    // wobble on hit
    if (lastHitAt && Date.now() - lastHitAt < 700) {
      const age = Date.now() - lastHitAt;
      const intensity = (1 - age / 700) * 0.3;
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
    <group ref={groupRef}>
      {/* BODY */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[1.6, 0.7, 0.6]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>

      {/* NECK */}
      <mesh position={[0.7, 1.45, 0]} rotation={[0, 0, -0.4]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.8, 10]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>

      {/* HEAD – boss Santa face */}
      <mesh position={[1.1, 1.9, 0]} castShadow>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial
          map={bossFaceTexture}
          transparent
          roughness={0.85}
        />
      </mesh>

      {/* SNOUT BASE (under/behind the 2D face for depth) */}
      <mesh position={[1.2, 1.8, 0]}>
        <boxGeometry args={[0.3, 0.2, 0.3]} />
        <meshStandardMaterial color="#9a6a3a" />
      </mesh>

      {/* RUDOLPH NOSE */}
      <mesh position={[1.35, 1.82, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial
          color="#dc2626"
          emissive="#ef4444"
          emissiveIntensity={1.2}
        />
      </mesh>

      {/* EARS */}
      <mesh position={[0.95, 2.1, 0.22]}>
        <boxGeometry args={[0.16, 0.26, 0.08]} />
        <meshStandardMaterial color="#9a6a3a" />
      </mesh>
      <mesh position={[0.95, 2.1, -0.22]}>
        <boxGeometry args={[0.16, 0.26, 0.08]} />
        <meshStandardMaterial color="#9a6a3a" />
      </mesh>

      {/* ANTLERS (simple low-poly branches) */}
      {/* Left antler root */}
      <mesh position={[0.9, 2.25, 0.18]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color="#5b3b1f" />
      </mesh>
      {/* Left antler branches */}
      <mesh position={[0.9, 2.45, 0.25]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color="#5b3b1f" />
      </mesh>
      <mesh position={[0.9, 2.45, 0.1]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color="#5b3b1f" />
      </mesh>

      {/* Right antler root */}
      <mesh position={[0.9, 2.25, -0.18]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color="#5b3b1f" />
      </mesh>
      {/* Right antler branches */}
      <mesh position={[0.9, 2.45, -0.25]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color="#5b3b1f" />
      </mesh>
      <mesh position={[0.9, 2.45, -0.1]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color="#5b3b1f" />
      </mesh>

      {/* LEGS */}
      {/* Front left */}
      <mesh position={[0.6, 0.45, 0.22]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.9, 10]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      {/* Front right */}
      <mesh position={[0.6, 0.45, -0.22]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.9, 10]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      {/* Back left */}
      <mesh position={[-0.6, 0.45, 0.22]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 1, 10]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      {/* Back right */}
      <mesh position={[-0.6, 0.45, -0.22]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 1, 10]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>

      {/* Hooves */}
      {[
        [0.6, 0, 0.22],
        [0.6, 0, -0.22],
        [-0.6, 0, 0.22],
        [-0.6, 0, -0.22],
      ].map((pos, i) => (
        <mesh key={`hoof-${i}`} position={pos as [number, number, number]}>
          <boxGeometry args={[0.18, 0.12, 0.22]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}

      {/* Tail */}
      <mesh position={[-0.9, 1.25, 0]} rotation={[Math.PI / 2.5, 0, 0]}>
        <coneGeometry args={[0.18, 0.32, 8]} />
        <meshStandardMaterial color="#9a6a3a" />
      </mesh>
    </group>
  );

  const toppled = (
    <group>
      {/* simple scattered pieces for destroyed state */}
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0.3, 0.2]}>
        <boxGeometry args={[1.2, 0.5, 0.5]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      <mesh position={[0.9, 0.5, 0.2]} rotation={[0.5, 0.7, 0.3]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial map={bossFaceTexture} />
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
          <group position={[0, 1.4, 0]}>
            <Smoke scale={0.45} count={18} color="#cfcfcf" />
          </group>
        )}
      </group>
    );
  }

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      <group rotation={[0, baseRotationY, 0]}>{intact}</group>
      {lastHitAt && Date.now() - lastHitAt < 700 && (
        <group position={[0, 1.4, 0]}>
          <Smoke scale={0.45} count={18} color="#cfcfcf" />
        </group>
      )}
    </RigidBody>
  );
}
