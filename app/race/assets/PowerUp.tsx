"use client";

import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import * as THREE from "three";
import { type PowerUpType, POWERUP_CONFIGS } from "../types/powerup";

export type PowerUpProps = {
  type: PowerUpType;
  position: [number, number, number];
  collected?: boolean;
};

function PowerUpModel({ type, position, collected = false }: PowerUpProps) {
  const groupRef = useRef<THREE.Group>(null);
  const config = POWERUP_CONFIGS[type];

  useFrame((state) => {
    if (!groupRef.current || collected) return;

    // Rotate the powerup
    groupRef.current.rotation.y = state.clock.elapsedTime * 1.5;

    // Bob up and down
    groupRef.current.position.y =
      position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.2;
  });

  if (collected) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Main powerup box */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial
          color={config.baseColor}
          roughness={0.3}
          metalness={0.6}
          emissive={config.baseColor}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Accent bands */}
      {[0, Math.PI / 2].map((rotation, idx) => (
        <mesh key={idx} rotation={[0, rotation, 0]}>
          <boxGeometry args={[0.85, 0.2, 0.85]} />
          <meshStandardMaterial
            color={config.accentColor}
            emissive={config.accentColor}
            emissiveIntensity={0.8}
            metalness={0.7}
          />
        </mesh>
      ))}

      {/* Glowing top sphere */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={config.accentColor}
          emissive={config.accentColor}
          emissiveIntensity={1.2}
        />
      </mesh>

      {/* Outer glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.03, 16, 32]} />
        <meshStandardMaterial
          color={config.accentColor}
          emissive={config.accentColor}
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Point light for glow effect */}
      {/* Emissive ground glow (cheaper than a real light) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshBasicMaterial
          color={config.accentColor}
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default memo(PowerUpModel);
