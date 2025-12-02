"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef, useMemo, useState, useEffect } from "react";
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
  const tilt = destroyed ? -0.6 : THREE.MathUtils.degToRad((1 - integrity) * 8);
  const [shakeIntensity, setShakeIntensity] = useState(0);

  const groupRef = useRef<THREE.Group | null>(null);

  // Shake effect when hit
  useEffect(() => {
    if (!lastHitAt) return;
    const elapsed = Date.now() - lastHitAt;
    if (elapsed > 700) return;

    setShakeIntensity(Math.max(0, 1 - elapsed / 700) * 0.25);
    const interval = setInterval(() => {
      const now = Date.now() - lastHitAt;
      if (now > 700) {
        setShakeIntensity(0);
        clearInterval(interval);
      } else {
        setShakeIntensity(Math.max(0, 1 - now / 700) * 0.25);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [lastHitAt]);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = Date.now() / 1000;
    groupRef.current.rotation.x = Math.sin(t * 0.35) * 0.025 + tilt;
    groupRef.current.rotation.z = Math.sin(t * 0.25) * 0.015;

    // Shake when hit
    if (shakeIntensity > 0) {
      groupRef.current.rotation.z += (Math.random() - 0.5) * shakeIntensity;
      groupRef.current.rotation.x +=
        (Math.random() - 0.5) * shakeIntensity * 0.5;
    }
  });

  // -----------------------
  // Build cane
  // -----------------------
  const shaftHeight = 1.8;
  const shaftRadius = 0.1;

  function idToAngle(id?: string) {
    if (!id) return 0;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h % 360) * (Math.PI / 180);
  }

  // Generate debris for destroyed state
  const debrisPositions = useMemo(() => {
    if (!destroyed) return [];
    return [
      // Candy cane fragments
      {
        pos: [-0.2, 0.08, 0.15] as [number, number, number],
        length: 0.4,
        rot: 0.8,
      },
      {
        pos: [0.25, 0.06, -0.1] as [number, number, number],
        length: 0.35,
        rot: -0.5,
      },
      {
        pos: [0.05, 0.05, 0.3] as [number, number, number],
        length: 0.25,
        rot: 1.2,
      },
      {
        pos: [-0.15, 0.07, -0.2] as [number, number, number],
        length: 0.3,
        rot: -0.3,
      },
    ];
  }, [destroyed]);

  const intact = (
    <group ref={groupRef}>
      {/* Shaft uses ROTATED texture - taller and thicker */}
      <mesh position={[0, shaftHeight / 2 - 0.5, 0]} castShadow>
        <cylinderGeometry
          args={[shaftRadius, shaftRadius * 1.1, shaftHeight, 16]}
        />
        <meshStandardMaterial map={shaftTex} roughness={0.3} />
      </mesh>

      {/* Hook uses NORMAL texture - larger curve */}
      <mesh position={[-0.35, 1.2, 0]} rotation={[0, 0, 0]} castShadow>
        <torusGeometry args={[0.35, shaftRadius, 12, 32, Math.PI]} />
        <meshStandardMaterial map={stripeTex} roughness={0.3} />
      </mesh>

      {/* Decorative bow/ribbon at base (optional detail) */}
      {integrity > 0.5 && (
        <group position={[0, 0.3, 0]}>
          <mesh rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.15, 0.08, 0.12]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
          <mesh rotation={[0, 0, -0.3]}>
            <boxGeometry args={[0.15, 0.08, 0.12]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
        </group>
      )}

      {/* Damage cracks when health is low */}
      {integrity < 0.5 && !destroyed && (
        <group>
          {[0, 1].map((i) => (
            <mesh
              key={`crack-${i}`}
              position={[0.08, 0.4 + i * 0.5, 0.08]}
              rotation={[0, 0.3, i * 0.4 - 0.2]}
            >
              <planeGeometry args={[0.02, 0.25 + i * 0.1]} />
              <meshBasicMaterial
                color="#1f2937"
                transparent
                opacity={0.6 * (1 - integrity)}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );

  // -----------------------
  // Toppled version: broken candy cane pieces
  // -----------------------
  const toppled = (
    <group>
      {/* Main broken shaft lying on ground */}
      <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0.5]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1.2, 12]} />
        <meshStandardMaterial map={shaftTex} roughness={0.4} />
      </mesh>

      {/* Broken hook piece */}
      <mesh position={[-0.4, 0.1, 0.2]} rotation={[0.8, 0.3, 1.0]} castShadow>
        <torusGeometry args={[0.2, 0.06, 8, 16, Math.PI * 0.7]} />
        <meshStandardMaterial map={stripeTex} roughness={0.4} />
      </mesh>

      {/* Scattered fragments */}
      {debrisPositions.map((d, i) => (
        <mesh
          key={`debris-${i}`}
          position={d.pos}
          rotation={[Math.PI / 2, d.rot, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.04, 0.035, d.length, 8]} />
          <meshStandardMaterial map={shaftTex} roughness={0.5} />
        </mesh>
      ))}

      {/* Sugar dust / smoke */}
      <group position={[0, 0.15, 0]}>
        <Smoke position={[0, 0, 0]} scale={0.4} count={18} color="#fecaca" />
      </group>
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
        {/* Hit smoke effect */}
        {lastHitAt && Date.now() - lastHitAt < 700 && (
          <group position={[0, shaftHeight - 0.2, 0]}>
            <Smoke
              position={[0, 0, 0]}
              scale={0.5}
              count={18}
              color="#fecaca"
            />
          </group>
        )}
        {/* Continuous smoke when heavily damaged */}
        {integrity < 0.35 && (
          <group position={[0, shaftHeight * 0.6, 0]}>
            <Smoke scale={0.3} count={10} color="#fca5a5" />
          </group>
        )}
      </group>
    );

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      <group rotation={[0, baseRotationY, 0]}>{intact}</group>
      {/* Hit smoke effect */}
      {lastHitAt && Date.now() - lastHitAt < 700 && (
        <group position={[0, shaftHeight - 0.2, 0]}>
          <Smoke position={[0, 0, 0]} scale={0.5} count={18} color="#fecaca" />
        </group>
      )}
      {/* Continuous smoke when heavily damaged */}
      {integrity < 0.35 && (
        <group position={[0, shaftHeight * 0.6, 0]}>
          <Smoke scale={0.3} count={10} color="#fca5a5" />
        </group>
      )}
    </RigidBody>
  );
}
