"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Smoke } from "../../ParticleEffects";

export type SantaProps = {
  id?: string;
  position: [number, number, number];
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
  lastHitAt?: number;
  physics?: boolean;
  scale?: number;
};

export function Santa({
  id,
  position,
  destroyed = false,
  health,
  maxHealth,
  lastHitAt,
  physics = true,
  scale = 1,
}: SantaProps) {
  const groupRef = useRef<THREE.Group>(null);

  /** FRACTIONAL HEALTH (0 → 1) */
  const integrity = maxHealth
    ? Math.max(0, (health ?? maxHealth) / maxHealth)
    : 1;

  /** Tilt based on health */
  const tilt = destroyed ? -0.7 : THREE.MathUtils.degToRad((1 - integrity) * 7);

  /** Boss Santa head texture */
  const santaFaceTexture = useTexture("/santa-head.png");
  // Slightly rotate face texture so it reads better on the spherical head
  if (santaFaceTexture) {
    santaFaceTexture.center.set(0.5, 0.5);
    santaFaceTexture.rotation = THREE.MathUtils.degToRad(-8);
  }

  /** Idle animation + shake on hit */
  useFrame(() => {
    if (!groupRef.current) return;

    const t = Date.now() * 0.001;

    groupRef.current.rotation.x = Math.sin(t * 0.6) * 0.03 + tilt;
    groupRef.current.rotation.z = Math.sin(t * 0.45) * 0.02;

    if (lastHitAt && Date.now() - lastHitAt < 600) {
      const age = Date.now() - lastHitAt;
      const shake = (1 - age / 600) * 0.25;
      groupRef.current.rotation.z += Math.sin(age * 0.4) * shake;
    }
  });

  /** Deterministic facing angle based on unique ID */
  function idToAngle(id?: string) {
    if (!id) return 0;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h % 360) * (Math.PI / 180);
  }

  const baseRotationY = idToAngle(id);

  /* -------------------------------------------------------------
      Santa Model (intact)
  ------------------------------------------------------------- */
  const intact = (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      {/* ---------------- BELLY & TORSO ---------------- */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[1.1, 32, 32]} />
        <meshStandardMaterial color="#b91c1c" />
      </mesh>

      <mesh position={[0, 2, 0]} castShadow>
        <sphereGeometry args={[0.85, 32, 32]} />
        <meshStandardMaterial color="#b91c1c" />
      </mesh>

      {/* Coat trim (belt area) */}
      <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.95, 0.12, 16, 32]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Vertical white coat trim */}
      <mesh position={[0, 2, 0.54]}>
        <boxGeometry args={[0.25, 1.5, 0.12]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Coat Buttons */}
      {[1.7, 1.35, 1.0].map((y, i) => (
        <mesh key={i} position={[0, y, 0.6]}>
          <sphereGeometry args={[0.085, 16, 16]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}

      {/* ---------------- HEAD ---------------- */}
      <group position={[0, 3, 0]}>
        {/* Head sphere with boss face texture */}
        <mesh castShadow>
          <sphereGeometry args={[0.62, 32, 32]} />
          <meshStandardMaterial />
        </mesh>

        {/* Beard */}
        <mesh position={[0, -0.38, 0.38]} castShadow>
          <sphereGeometry args={[0.55, 24, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Moustache */}
        <mesh position={[0.22, -0.05, 0.62]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh position={[-0.22, -0.05, 0.62]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Nose */}
        <mesh position={[0, 0.1, 0.65]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color="#ffb4b4" />
        </mesh>

        {/* --- SANTA HAT --- */}
        {/* --- SANTA HAT --- */}
        <mesh position={[0, 1.12, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.75, 1.4, 32]} />
          <meshStandardMaterial color="#b91c1c" />
        </mesh>

        {/* Hat rim (tilted so brim sits naturally around the forehead) */}
        <mesh position={[0, 0.48, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.65, 0.15, 18, 32]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* Hat fluff ball (moved to sit at the tip) */}
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.23, 16, 16]} />
          <meshStandardMaterial color="white" />
        </mesh>
      </group>

      {/* ---------------- ARMS ---------------- */}
      {/* LEFT ARM (moved closer to torso) */}
      <group position={[-0.95, 2, 0]}>
        <mesh rotation={[0, 0, -0.6]}>
          <cylinderGeometry args={[0.22, 0.22, 1.0, 16]} />
          <meshStandardMaterial color="#b91c1c" />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.26, 16, 16]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      </group>

      {/* RIGHT ARM (moved closer to torso) */}
      <group position={[0.95, 2, 0]}>
        <mesh rotation={[0, 0, 0.6]}>
          <cylinderGeometry args={[0.22, 0.22, 1.0, 16]} />
          <meshStandardMaterial color="#b91c1c" />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.26, 16, 16]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      </group>

      {/* ---------------- LEGS + BOOTS ---------------- */}
      <mesh position={[0.45, 0.35, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1.4, 16]} />
        <meshStandardMaterial color="#b91c1c" />
      </mesh>

      <mesh position={[-0.45, 0.35, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1.4, 16]} />
        <meshStandardMaterial color="#b91c1c" />
      </mesh>

      {/* Boots */}
      <mesh position={[0.45, -0.55, 0.25]}>
        <boxGeometry args={[0.58, 0.38, 0.85]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      <mesh position={[-0.45, -0.55, 0.25]}>
        <boxGeometry args={[0.58, 0.38, 0.85]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  );

  /* -------------------------------------------------------------
      Destroyed Santa (simple collapse)
  ------------------------------------------------------------- */
  const toppled = (
    <group scale={[scale, scale, scale]}>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#ddd" />
      </mesh>

      <mesh position={[1, 0.4, 0]} rotation={[0.4, 0.7, 1.5]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color="#eee" />
      </mesh>
    </group>
  );

  /* -------------------------------------------------------------
      RETURN
  ------------------------------------------------------------- */

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
          <group position={[0, 1.7, 0]}>
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
        <group position={[0, 1.7, 0]}>
          <Smoke scale={0.45} count={18} color="#cfcfcf" />
        </group>
      )}
    </RigidBody>
  );
}
