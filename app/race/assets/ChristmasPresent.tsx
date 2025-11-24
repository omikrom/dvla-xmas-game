"use client";

import { memo } from "react";

export type ChristmasPresentProps = {
  size?: number;
  baseColor?: string;
  accentColor?: string;
  glow?: number;
};

function ChristmasPresentModel({
  size = 1,
  baseColor = "#dc2626",
  accentColor = "#fbbf24",
  glow = 0.4,
}: ChristmasPresentProps) {
  return (
    <group scale={size}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 0.6, 1]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.4}
          metalness={0.2}
          emissive={baseColor}
          emissiveIntensity={glow * 0.1}
        />
      </mesh>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[1.02, 0.08, 1.02]} />
        <meshStandardMaterial
          color={baseColor === "#dc2626" ? "#b91c1c" : baseColor}
        />
      </mesh>
      {[0, Math.PI / 2].map((rotation, idx) => (
        <mesh key={idx} rotation={[0, rotation, 0]}>
          <boxGeometry args={[1.02, 0.9, 0.07]} />
          <meshStandardMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={glow * 0.6}
          />
        </mesh>
      ))}
      {[0, Math.PI / 2].map((rotation, idx) => (
        <mesh
          key={`bow-${idx}`}
          position={[0, 0.48, 0]} // lifted slightly
          rotation={[Math.PI / 2, rotation, 0]} // FIX: proper orientation
          castShadow
        >
          <torusGeometry args={[0.26, 0.055, 14, 32]} /> // slightly larger,
          smoother
          <meshStandardMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={glow}
            metalness={0.35}
            roughness={0.3}
          />
        </mesh>
      ))}
      {/* <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={glow * 1.2}
        />
      </mesh> */}
    </group>
  );
}

export default memo(ChristmasPresentModel);
