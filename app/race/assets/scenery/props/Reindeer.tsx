"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef, useState, useEffect, useMemo } from "react";
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

  const tilt = destroyed ? -0.7 : THREE.MathUtils.degToRad((1 - integrity) * 10);
  const [shakeIntensity, setShakeIntensity] = useState(0);

  const groupRef = useRef<THREE.Group | null>(null);

  // Boss face texture on the reindeer head
  const bossFaceTexture = useTexture("/reindeer-head.png");

  // Progressive damage colors - fur gets darker and dustier
  const furColor = useMemo(() => {
    if (destroyed) return "#4a3020";
    if (integrity > 0.7) return "#8b5a2b";
    if (integrity > 0.4) return "#7a4a25";
    if (integrity > 0.2) return "#5a3a1a";
    return "#4a3018";
  }, [integrity, destroyed]);
  
  const lightFurColor = useMemo(() => {
    if (destroyed) return "#5a4030";
    if (integrity > 0.7) return "#9a6a3a";
    if (integrity > 0.4) return "#8a5a30";
    return "#6a4a28";
  }, [integrity, destroyed]);

  const antlerColor = useMemo(() => {
    if (destroyed) return "#3a2a15";
    if (integrity > 0.5) return "#5b3b1f";
    return "#4a3018";
  }, [integrity, destroyed]);

  // Shake effect when hit
  useEffect(() => {
    if (!lastHitAt) return;
    const elapsed = Date.now() - lastHitAt;
    if (elapsed > 700) return;
    
    setShakeIntensity(Math.max(0, 1 - elapsed / 700) * 0.35);
    const interval = setInterval(() => {
      const now = Date.now() - lastHitAt;
      if (now > 700) {
        setShakeIntensity(0);
        clearInterval(interval);
      } else {
        setShakeIntensity(Math.max(0, 1 - now / 700) * 0.35);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [lastHitAt]);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = Date.now() / 1000;

    // gentle breathing / idle motion
    groupRef.current.position.y = 0.03 * Math.sin(t * 1.2);
    groupRef.current.rotation.x = tilt + Math.sin(t * 0.8) * 0.02;
    groupRef.current.rotation.z = Math.sin(t * 0.6) * 0.015;

    // wobble on hit with enhanced shake
    if (shakeIntensity > 0) {
      groupRef.current.rotation.z += (Math.random() - 0.5) * shakeIntensity;
      groupRef.current.rotation.x += (Math.random() - 0.5) * shakeIntensity * 0.5;
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
  
  // Nose glow intensity based on health
  const noseGlow = useMemo(() => {
    if (destroyed) return 0;
    if (integrity > 0.5) return 1.2;
    if (integrity > 0.2) return 0.6;
    return 0.3;
  }, [integrity, destroyed]);

  const intact = (
    <group ref={groupRef}>
      {/* BODY */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[1.6, 0.7, 0.6]} />
        <meshStandardMaterial color={furColor} />
      </mesh>
      
      {/* Harness / Christmas bells */}
      {integrity > 0.4 && (
        <group position={[0, 1.0, 0]}>
          {/* Harness strap - rotated to wrap around body horizontally */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.38, 0.04, 8, 24]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
          {/* Jingle bells hanging from harness */}
          {[0, 1, 2].map((i) => (
            <mesh key={`bell-${i}`} position={[(i - 1) * 0.25, -0.08, 0.35]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
        </group>
      )}

      {/* NECK */}
      <mesh position={[0.7, 1.45, 0]} rotation={[0, 0, -0.4]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.8, 10]} />
        <meshStandardMaterial color={furColor} />
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
        <meshStandardMaterial color={lightFurColor} />
      </mesh>

      {/* RUDOLPH NOSE */}
      <mesh position={[1.35, 1.82, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial
          color="#dc2626"
          emissive="#ef4444"
          emissiveIntensity={noseGlow}
        />
      </mesh>

      {/* EARS */}
      <mesh position={[0.95, 2.1, 0.22]}>
        <boxGeometry args={[0.16, 0.26, 0.08]} />
        <meshStandardMaterial color={lightFurColor} />
      </mesh>
      <mesh position={[0.95, 2.1, -0.22]}>
        <boxGeometry args={[0.16, 0.26, 0.08]} />
        <meshStandardMaterial color={lightFurColor} />
      </mesh>

      {/* ANTLERS (simple low-poly branches) */}
      {/* Left antler root */}
      <mesh position={[0.9, 2.25, 0.18]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color={antlerColor} />
      </mesh>
      {/* Left antler branches */}
      <mesh position={[0.9, 2.45, 0.25]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color={antlerColor} />
      </mesh>
      <mesh position={[0.9, 2.45, 0.1]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color={antlerColor} />
      </mesh>

      {/* Right antler root */}
      <mesh position={[0.9, 2.25, -0.18]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color={antlerColor} />
      </mesh>
      {/* Right antler branches */}
      <mesh position={[0.9, 2.45, -0.25]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color={antlerColor} />
      </mesh>
      <mesh position={[0.9, 2.45, -0.1]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color={antlerColor} />
      </mesh>

      {/* LEGS */}
      {/* Front left */}
      <mesh position={[0.6, 0.45, 0.22]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.9, 10]} />
        <meshStandardMaterial color={furColor} />
      </mesh>
      {/* Front right */}
      <mesh position={[0.6, 0.45, -0.22]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.9, 10]} />
        <meshStandardMaterial color={furColor} />
      </mesh>
      {/* Back left */}
      <mesh position={[-0.6, 0.45, 0.22]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 1, 10]} />
        <meshStandardMaterial color={furColor} />
      </mesh>
      {/* Back right */}
      <mesh position={[-0.6, 0.45, -0.22]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 1, 10]} />
        <meshStandardMaterial color={furColor} />
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
        <meshStandardMaterial color={lightFurColor} />
      </mesh>
      
      {/* Damage cracks when health is low */}
      {integrity < 0.4 && (
        <group>
          <mesh position={[0.2, 1.1, 0.31]}>
            <planeGeometry args={[0.03, 0.4]} />
            <meshBasicMaterial color="#1a1a1a" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );

  const toppled = (
    <group>
      {/* Body lying on side */}
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0.3, 0.2]}>
        <boxGeometry args={[1.2, 0.5, 0.5]} />
        <meshStandardMaterial color="#6b4a25" />
      </mesh>
      
      {/* Head separated */}
      <mesh position={[0.9, 0.4, 0.2]} rotation={[0.5, 0.7, 0.3]}>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshStandardMaterial map={bossFaceTexture} />
      </mesh>
      
      {/* Broken antler pieces */}
      <mesh position={[1.2, 0.1, 0.3]} rotation={[0.2, 0.5, 1.2]}>
        <boxGeometry args={[0.06, 0.35, 0.06]} />
        <meshStandardMaterial color="#3a2a15" />
      </mesh>
      <mesh position={[0.7, 0.08, -0.2]} rotation={[0.8, -0.3, 0.5]}>
        <boxGeometry args={[0.06, 0.25, 0.06]} />
        <meshStandardMaterial color="#3a2a15" />
      </mesh>
      
      {/* Broken legs */}
      <mesh position={[-0.4, 0.12, 0.35]} rotation={[Math.PI / 2, 0, 0.6]}>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 8]} />
        <meshStandardMaterial color="#5a3a20" />
      </mesh>
      <mesh position={[0.3, 0.1, -0.3]} rotation={[Math.PI / 2, 0, -0.4]}>
        <cylinderGeometry args={[0.08, 0.08, 0.45, 8]} />
        <meshStandardMaterial color="#5a3a20" />
      </mesh>
      
      {/* Scattered hooves */}
      <mesh position={[-0.6, 0.06, 0.5]}>
        <boxGeometry args={[0.15, 0.1, 0.18]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      
      {/* Fallen harness/bells */}
      <mesh position={[0.2, 0.08, 0.4]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Dust cloud */}
      <group position={[0, 0.3, 0]}>
        <Smoke scale={0.6} count={30} color="#b0a090" />
      </group>
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
        {/* Hit smoke */}
        {lastHitAt && Date.now() - lastHitAt < 700 && (
          <group position={[0, 1.4, 0]}>
            <Smoke scale={0.5} count={22} color="#c0b0a0" />
          </group>
        )}
        {/* Continuous smoke when heavily damaged */}
        {integrity < 0.35 && (
          <group position={[0, 1.2, 0]}>
            <Smoke scale={0.35} count={12} color="#a09080" />
          </group>
        )}
      </group>
    );
  }

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      <group rotation={[0, baseRotationY, 0]}>{intact}</group>
      {/* Hit smoke */}
      {lastHitAt && Date.now() - lastHitAt < 700 && (
        <group position={[0, 1.4, 0]}>
          <Smoke scale={0.5} count={22} color="#c0b0a0" />
        </group>
      )}
      {/* Continuous smoke when heavily damaged */}
      {integrity < 0.35 && (
        <group position={[0, 1.2, 0]}>
          <Smoke scale={0.35} count={12} color="#a09080" />
        </group>
      )}
    </RigidBody>
  );
}
