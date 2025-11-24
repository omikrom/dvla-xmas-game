"use client";

import { RigidBody } from "@react-three/rapier";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Smoke } from "../../ParticleEffects";
import * as THREE from "three";

export type BuildingProps = {
  position: [number, number, number];
  width?: number;
  depth?: number;
  height?: number;
  lastHitAt?: number;
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
};

export function Building({
  position,
  width = 6,
  depth = 6,
  height = 8,
  lastHitAt,
  destroyed,
  health = 0,
  maxHealth = 1,
}: BuildingProps) {
  const groupRef = useRef<any>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    if (!lastHitAt) {
      groupRef.current.rotation.y = 0;
      return;
    }
    const age = Date.now() - lastHitAt;
    const DURATION = 900;
    if (age > DURATION) {
      groupRef.current.rotation.y = 0;
      return;
    }
    const t = (age / DURATION) * Math.PI * 2;
    const intensity = (1 - age / DURATION) * 0.06;
    groupRef.current.rotation.y = Math.sin(t * 5) * intensity;
  });

  return (
    <RigidBody type="fixed" position={position} colliders="cuboid">
      <group ref={groupRef}>
        {/* If destroyed, show collapsed rubble and smoke */}
        {destroyed ? (
          <group>
            {/* collapsed rubble pieces */}
            {[0, 1, 2, 3, 4].map((i) => {
              const rx = (i - 2) * (width * 0.35);
              const rz = (i % 2 === 0 ? -1 : 1) * (depth * 0.2 + i * 0.2);
              const ry = 0.3 + (i % 3) * 0.15;
              return (
                <mesh
                  key={`rubble-${i}`}
                  position={[rx, ry, rz]}
                  rotation={[
                    Math.random() * 0.6,
                    Math.random() * 1.2,
                    Math.random() * 0.6,
                  ]}
                  castShadow
                >
                  <boxGeometry
                    args={[
                      width * 0.5 - i * 0.4,
                      0.4 + i * 0.05,
                      depth * 0.5 - i * 0.3,
                    ]}
                  />
                  <meshStandardMaterial color="#8b6b5a" roughness={0.95} />
                </mesh>
              );
            })}
            {/* larger smoke when fully destroyed */}
            <group position={[0, 1.2, 0]}>
              <Smoke
                position={[0, 0, 0]}
                scale={1.2}
                count={60}
                color="#bfbfbf"
              />
            </group>
          </group>
        ) : (
          // intact / damaged building
          <group>
            {/* Main building body with subtle paneling */}
            <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial
                color={
                  health && maxHealth
                    ? health / maxHealth < 0.4
                      ? "#eab308"
                      : "#cbd5e1"
                    : "#cbd5e1"
                }
                roughness={0.58}
                metalness={0.02}
              />
            </mesh>

            {/* facade trim */}
            <mesh position={[0, height * 0.55, depth / 2 + 0.02]}>
              <boxGeometry args={[width * 0.92, height * 0.7, 0.08]} />
              <meshStandardMaterial color="#ffffff" roughness={0.8} />
            </mesh>

            {/* Roof with a small overhang */}
            <mesh position={[0, height + 0.9, 0]} castShadow>
              <boxGeometry args={[width * 1.05, 0.6, depth * 1.05]} />
              <meshStandardMaterial color="#b91c1c" roughness={0.7} />
            </mesh>

            {/* Door */}
            <mesh position={[0, 1.1, depth / 2 + 0.03]} castShadow>
              <boxGeometry args={[1.2, 2.2, 0.06]} />
              <meshStandardMaterial color="#4b5563" roughness={0.9} />
            </mesh>

            {/* Windows with frames; degrade emissive when damaged */}
            {[-1, 1].map((x) =>
              [2.6, 4.2, 5.8].map((y, idx) => {
                // slight variation per window
                const broken =
                  health && maxHealth
                    ? health / maxHealth < 0.45 && Math.random() > 0.6
                    : false;
                return (
                  <group
                    key={`win-${x}-${y}`}
                    position={[x * (width / 3), y, depth / 2 + 0.015]}
                  >
                    {/* glass pane */}
                    <mesh position={[0, 0, 0]}>
                      <planeGeometry args={[0.9, 0.9]} />
                      <meshPhysicalMaterial
                        color={broken ? "#3b3b3b" : "#eaf6ff"}
                        metalness={0.05}
                        roughness={broken ? 0.8 : 0.12}
                        clearcoat={0.2}
                        transmission={broken ? 0 : 0.75}
                        opacity={broken ? 0.9 : 0.95}
                        transparent
                      />
                    </mesh>

                    {/* thin mullion frame */}
                    <mesh position={[0, 0, 0.02]}>
                      <boxGeometry args={[0.95, 0.95, 0.02]} />
                      <meshStandardMaterial
                        color="#2f3640"
                        roughness={0.95}
                        metalness={0.0}
                      />
                    </mesh>

                    {/* simple broken shards overlay when broken */}
                    {broken && (
                      <group>
                        <mesh
                          rotation={[0, 0, 0.2]}
                          position={[
                            Math.random() * 0.12,
                            Math.random() * 0.08,
                            0.03,
                          ]}
                        >
                          <planeGeometry args={[0.45, 0.45]} />
                          <meshStandardMaterial color="#1f2937" />
                        </mesh>
                        <mesh
                          rotation={[0, 0, -0.3]}
                          position={[
                            Math.random() * -0.08,
                            Math.random() * 0.06,
                            0.031,
                          ]}
                        >
                          <planeGeometry args={[0.22, 0.22]} />
                          <meshStandardMaterial color="#111827" />
                        </mesh>
                      </group>
                    )}
                  </group>
                );
              })
            )}

            {/* hit smoke when recently hit */}
            {lastHitAt && Date.now() - lastHitAt < 1200 && (
              <group position={[0, height * 0.6, 0]}>
                <Smoke
                  position={[0, 0, 0]}
                  scale={0.7}
                  count={28}
                  color="#d9d9d9"
                />
              </group>
            )}
          </group>
        )}
      </group>
    </RigidBody>
  );
}
