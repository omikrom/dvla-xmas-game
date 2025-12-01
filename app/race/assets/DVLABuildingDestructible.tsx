"use client";

import { RigidBody } from "@react-three/rapier";
import type { ThreeElements } from "@react-three/fiber";
import { useRef, useLayoutEffect, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Smoke } from "./ParticleEffects";

// ALL window positions from the original DVLABuilding (147 windows)
const WINDOW_POSITIONS: [number, number, number][] = [
  [-0.82, 1.57, 18.68], [2.2, 1.57, 18.68], [5.14, 1.57, 18.68], [8.14, 1.57, 18.68],
  [-0.78, 4.28, 18.68], [2.25, 4.28, 18.68], [5.15, 4.28, 18.68], [8.12, 4.28, 18.68],
  [9.19, 4.28, 18.25], [9.31, 4.28, 15.86], [9.27, 1.57, 18.14], [9.35, 1.57, 15.71],
  [11.14, 1.57, 13.33], [11.13, 1.57, 10.59], [11.1, 1.53, 7.95], [11.07, 1.57, 5.2],
  [11.16, 1.57, 2.58], [11.15, 1.57, -0.15], [11.13, 1.57, -2.76], [11.07, 1.57, -5.47],
  [11.07, 1.57, -8.18], [11.01, 1.57, -10.91], [11.04, 1.57, -13.44],
  [11.16, 4.41, 13.33], [11.13, 4.41, 10.6], [11.16, 4.41, 7.96], [11.22, 4.41, 5.22],
  [11.22, 4.41, 2.51], [11.2, 4.41, -0.13], [11.11, 4.41, -2.76], [11.18, 4.41, -5.47],
  [11.21, 4.41, -8.19], [11.0, 4.41, -10.92], [11.01, 4.41, -13.48],
  [14.12, 4.41, -27.93], [14.19, 4.41, -30.73], [14.02, 4.41, -33.56], [14.01, 4.41, -36.34],
  [14.0, 4.41, -39.06], [13.93, 4.41, -41.59], [14.1, 4.41, -44.15],
  [13.99, 1.7, -27.93], [13.99, 1.7, -30.76], [13.99, 1.7, -33.57], [14.07, 1.7, -36.35],
  [13.99, 1.7, -39.12], [13.93, 1.7, -41.65], [13.92, 1.7, -44.18],
  [-4.29, 1.7, -44.18], [-4.32, 1.7, -41.25], [-4.38, 1.7, -38.37], [-4.57, 1.7, -35.56],
  [-4.54, 1.7, -32.81], [-4.45, 1.7, -30.07], [-4.4, 1.7, -27.43],
  [-4.32, 4.63, -44.18], [-4.43, 4.6, -41.25], [-4.39, 4.56, -38.37], [-4.31, 4.49, -35.56],
  [-4.34, 4.49, -32.8], [-4.52, 4.51, -30.07], [-4.54, 4.5, -27.43],
  [-25.82, 4.5, -20.31], [-25.72, 4.5, -17.51], [-25.7, 4.5, -14.67], [-25.83, 4.5, -11.73],
  [-25.74, 4.5, -8.85], [-25.74, 4.5, -5.83], [-25.65, 4.5, -3.02], [-25.68, 4.5, -0.08],
  [-25.68, 4.5, 2.94], [-25.61, 4.5, 5.9],
  [-25.62, 1.85, -20.31], [-25.57, 1.8, -17.51], [-25.45, 1.78, -14.67], [-25.45, 1.83, -11.73],
  [-25.67, 1.81, -8.85], [-25.68, 1.75, -5.83], [-25.59, 1.78, -3.02], [-25.58, 1.78, -0.08],
  [-25.54, 1.84, 2.94], [-25.58, 1.9, 5.9],
  [-23.03, 10.01, -1.88], [-23.06, 10.01, -5.69], [-23.16, 10.01, -8.28], [-23.15, 10.01, -12.33],
  [-23.03, 12.84, -1.94], [-23.16, 12.85, -5.69], [-23.26, 12.93, -8.28], [-23.12, 12.95, -12.33],
  [-22.98, 17.78, -12.33], [-23.3, 17.78, -8.12], [-23.03, 17.78, -5.51], [-23.15, 17.78, -1.92],
  [-23.06, 20.39, -12.33], [-23.18, 20.49, -8.12], [-23.11, 20.46, -5.51], [-23.17, 20.46, -1.92],
  [-22.03, 10.01, -0.51], [-22.03, 12.77, -0.51], [-21.97, 17.75, -0.51], [-21.95, 20.52, -0.51],
  [-17.63, 10.01, -0.51], [-14.84, 10.01, -0.51], [-11.11, 10.01, -0.51],
  [-17.67, 12.77, -0.51], [-14.8, 12.77, -0.51], [-11.1, 12.77, -0.51],
  [-17.58, 17.75, -0.51], [-14.83, 17.75, -0.51], [-11.1, 17.75, -0.51],
  [-17.49, 20.52, -0.51], [-14.67, 20.52, -0.51], [-11.14, 20.52, -0.51],
  [-9.71, 20.52, -1.95], [-9.65, 20.52, -5.87], [-9.58, 20.52, -8.48], [-9.52, 20.52, -12.34],
  [-9.54, 17.78, -1.95], [-9.61, 17.89, -5.87], [-9.52, 17.9, -8.48], [-9.54, 17.87, -12.34],
  [-9.67, 12.71, -1.95], [-9.52, 9.96, -1.95], [-9.55, 12.66, -5.87], [-9.62, 9.92, -5.87],
  [-9.44, 12.68, -8.48], [-9.44, 9.91, -8.48], [-9.43, 12.6, -12.34], [-9.51, 9.9, -12.34],
  [-21.51, 10.01, -14.08], [-17.74, 10.01, -14.02], [-15.1, 10.01, -14.21], [-11.38, 10.01, -14.0],
  [-21.57, 12.88, -14.23], [-21.53, 17.81, -13.99], [-17.7, 12.88, -14.23], [-21.61, 20.32, -13.99],
  [-14.99, 12.88, -14.23], [-11.44, 12.88, -14.1], [-17.69, 17.81, -13.99], [-15.05, 17.81, -13.99],
  [-11.43, 17.81, -13.99], [-17.77, 20.32, -13.99], [-15.11, 20.32, -13.99], [-11.32, 20.32, -13.99],
];

// Building section definitions for progressive destruction
type BuildingSection = {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  healthThreshold: number; // percentage below which this section collapses
};

const BUILDING_SECTIONS: BuildingSection[] = [
  // Main front section
  { id: "front-1", position: [6.95, 3.0, -90.0], size: [10, 10, 30], healthThreshold: 0.3 },
  // Tower section
  { id: "tower-1", position: [-16.35, 15.22, -97.32], size: [15, 15, 15], healthThreshold: 0.5 },
  // Base section
  { id: "base-1", position: [-16.34, 3.0, -97.16], size: [20, 10, 30], healthThreshold: 0.2 },
  // Back section  
  { id: "back-1", position: [4.8, 3.0, -125.75], size: [20, 10, 20], healthThreshold: 0.4 },
];

type DVLABuildingDestructibleProps = ThreeElements["group"] & {
  position?: [number, number, number]; // Position is ignored - building uses world coords
  lastHitAt?: number;
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
};

export default function DVLABuildingDestructible({
  position, // Ignored - building geometry is in world coordinates
  lastHitAt,
  destroyed = false,
  health = 800,
  maxHealth = 800,
  ...props
}: DVLABuildingDestructibleProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const visualGroupRef = useRef<THREE.Group | null>(null);
  const windowMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const windowMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Track damage state for visual effects
  const integrity = maxHealth ? Math.max(health ?? maxHealth, 0) / maxHealth : 1;
  const [shakeOffset, setShakeOffset] = useState({ x: 0, z: 0 });
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  // Determine which sections should be collapsed based on health
  useEffect(() => {
    const newCollapsed = new Set<string>();
    for (const section of BUILDING_SECTIONS) {
      if (integrity <= section.healthThreshold) {
        newCollapsed.add(section.id);
      }
    }
    setCollapsedSections(newCollapsed);
  }, [integrity]);

  // Shake effect when hit
  useEffect(() => {
    if (!lastHitAt) return;
    const elapsed = Date.now() - lastHitAt;
    if (elapsed > 800) return;
    
    // Shake animation
    const shakeIntensity = Math.max(0, 1 - elapsed / 800) * 0.3;
    const interval = setInterval(() => {
      setShakeOffset({
        x: (Math.random() - 0.5) * shakeIntensity,
        z: (Math.random() - 0.5) * shakeIntensity,
      });
    }, 50);
    
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setShakeOffset({ x: 0, z: 0 });
    }, 800);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [lastHitAt]);

  // Track if initial rotation has been applied to prevent double-application in Strict Mode
  const rotationApplied = useRef(false);

  useLayoutEffect(() => {
    const g = groupRef.current;
    if (g && !rotationApplied.current) {
      rotationApplied.current = true;
      // Rotate building 180° around world Y at pivot (0,0,-90)
      const pivot = new THREE.Vector3(0, 0, -90);
      const axis = new THREE.Vector3(0, 1, 0);
      const angle = Math.PI; // 180 degrees
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);

      const pos = g.position.clone().sub(pivot).applyQuaternion(q).add(pivot);
      g.position.copy(pos);
      g.quaternion.premultiply(q);
    }

    // Bake all window instance transforms once
    const instanced = windowMeshRef.current;
    if (instanced) {
      WINDOW_POSITIONS.forEach((pos, i) => {
        dummy.position.set(pos[0], pos[1], pos[2]);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      });
      instanced.instanceMatrix.needsUpdate = true;
    }
  }, [dummy]);

  useFrame((state) => {
    // Window glow pulse - dims as building takes damage
    const t = state.clock.getElapsedTime();
    const mat = windowMaterialRef.current;
    if (mat) {
      const baseIntensity = destroyed ? 0 : 2 * integrity;
      // Flicker effect when damaged
      const flicker = integrity < 0.5 ? Math.sin(t * 10) * 0.3 * (1 - integrity) : 0;
      mat.emissiveIntensity = Math.max(0, baseIntensity + flicker);
    }
  });

  // Calculate damage colors
  const bodyColor = destroyed
    ? "#4b5563"
    : integrity > 0.7
    ? "#e6e6e6"
    : integrity > 0.4
    ? "#d4d4d4"
    : "#a3a3a3";
    
  const crackColor = integrity < 0.6 ? "#3f3f46" : undefined;

  // Debris positions for destroyed state
  const debrisPositions = useMemo(() => {
    if (!destroyed) return [];
    const debris: { pos: [number, number, number]; size: [number, number, number]; rot: number }[] = [];
    // Generate random debris chunks
    for (let i = 0; i < 25; i++) {
      debris.push({
        pos: [
          (Math.random() - 0.5) * 40 - 5,
          Math.random() * 2 + 0.3,
          (Math.random() - 0.5) * 40 - 100
        ],
        size: [
          2 + Math.random() * 4,
          0.5 + Math.random() * 1.5,
          2 + Math.random() * 4
        ],
        rot: Math.random() * Math.PI
      });
    }
    return debris;
  }, [destroyed]);

  if (destroyed) {
    // Render rubble pile
    return (
      <group ref={groupRef} {...props}>
        {debrisPositions.map((d, i) => (
          <RigidBody
            key={`debris-${i}`}
            type="fixed"
            position={d.pos}
            rotation={[0, d.rot, 0]}
          >
            <mesh castShadow>
              <boxGeometry args={d.size} />
              <meshStandardMaterial
                color={i % 3 === 0 ? "#6b7280" : i % 3 === 1 ? "#9ca3af" : "#4b5563"}
                roughness={0.9}
              />
            </mesh>
          </RigidBody>
        ))}
        {/* Smoke rising from rubble */}
        <group position={[-5, 2, -95]}>
          <Smoke position={[0, 0, 0]} scale={2.5} count={80} color="#9ca3af" />
        </group>
        <group position={[5, 2, -110]}>
          <Smoke position={[0, 0, 0]} scale={2.0} count={60} color="#a1a1aa" />
        </group>
      </group>
    );
  }

  return (
    <group ref={groupRef} {...props}>
      {/* Collision bodies - separate from visual shake */}
      {/* Main front section collision */}
      {!collapsedSections.has("front-1") && (
        <RigidBody type="fixed" position={[6.95, 3.0, -90.0]} colliders="cuboid">
          <mesh castShadow receiveShadow>
            <boxGeometry args={[10.0, 10.0, 30.0]} />
            <meshStandardMaterial color={bodyColor} roughness={0.8} transparent opacity={0} />
          </mesh>
        </RigidBody>
      )}

      {/* Tower section collision */}
      {!collapsedSections.has("tower-1") && (
        <RigidBody type="fixed" position={[-16.35, 15.22, -97.32]} colliders="cuboid">
          <mesh>
            <boxGeometry args={[15.0, 15.0, 15.0]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
        </RigidBody>
      )}

      {/* Base section collision */}
      {!collapsedSections.has("base-1") && (
        <RigidBody type="fixed" position={[-16.34, 3.0, -97.16]} colliders="cuboid">
          <mesh>
            <boxGeometry args={[20.0, 10.0, 30.0]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
        </RigidBody>
      )}

      {/* Back section collision */}
      {!collapsedSections.has("back-1") && (
        <RigidBody type="fixed" position={[4.8, 3.0, -125.75]} colliders="cuboid">
          <mesh>
            <boxGeometry args={[20.0, 10.0, 20.0]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
        </RigidBody>
      )}

      {/* Front lobby collision */}
      <RigidBody type="fixed" position={[0.19, 2.22, -72.91]} colliders="cuboid">
        <mesh>
          <boxGeometry args={[20.0, 10.0, 5.0]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>

      {/* Golden entrance cylinder collision */}
      <RigidBody type="fixed" position={[-7.29, 1.28, -68.34]} colliders="hull">
        <mesh>
          <cylinderGeometry args={[5, 5, 10, 16]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>

      {/* Visual group with shake effect */}
      <group ref={visualGroupRef} position={[shakeOffset.x, 0, shakeOffset.z]}>
        {/* Main front section visual */}
        {!collapsedSections.has("front-1") && (
          <mesh position={[6.95, 3.0, -90.0]} castShadow receiveShadow>
            <boxGeometry args={[10.0, 10.0, 30.0]} />
            <meshStandardMaterial color={bodyColor} roughness={0.8} />
          </mesh>
        )}

        {/* Tower section visual */}
        {!collapsedSections.has("tower-1") ? (
          <mesh position={[-16.35, 15.22, -97.32]} castShadow receiveShadow>
            <boxGeometry args={[15.0, 15.0, 15.0]} />
            <meshStandardMaterial color={bodyColor} roughness={0.8} />
          </mesh>
        ) : (
          <group position={[-16.35, 2, -97.32]}>
            {[0, 1, 2, 3].map((i) => (
              <mesh
                key={`tower-rubble-${i}`}
                position={[(i - 1.5) * 3, i * 0.4, (i % 2 - 0.5) * 4]}
                rotation={[0.1 * i, i * 0.5, 0.05 * i]}
                castShadow
              >
                <boxGeometry args={[4 - i * 0.5, 1.5, 4 - i * 0.3]} />
                <meshStandardMaterial color="#6b7280" roughness={0.95} />
              </mesh>
            ))}
            <Smoke position={[0, 3, 0]} scale={1.5} count={40} color="#a3a3a3" />
          </group>
        )}

        {/* Base section visual */}
        {!collapsedSections.has("base-1") && (
          <mesh position={[-16.34, 3.0, -97.16]} castShadow receiveShadow>
            <boxGeometry args={[20.0, 10.0, 30.0]} />
            <meshStandardMaterial color={bodyColor} roughness={0.8} />
          </mesh>
        )}

        {/* Back section visual */}
        {!collapsedSections.has("back-1") ? (
          <mesh position={[4.8, 3.0, -125.75]} castShadow receiveShadow>
            <boxGeometry args={[20.0, 10.0, 20.0]} />
            <meshStandardMaterial color={bodyColor} roughness={0.8} />
          </mesh>
        ) : (
          <group position={[4.8, 1, -125.75]}>
            {[0, 1, 2].map((i) => (
              <mesh
                key={`back-rubble-${i}`}
                position={[(i - 1) * 5, i * 0.3, (i % 2 - 0.5) * 3]}
                rotation={[0, i * 0.7, 0]}
                castShadow
              >
                <boxGeometry args={[5 - i * 0.8, 1.2, 5 - i * 0.6]} />
                <meshStandardMaterial color="#71717a" roughness={0.92} />
              </mesh>
            ))}
          </group>
        )}

        {/* Windows and decorative elements - offset by -90 in Z */}
        <group position={[0, 0, -90]}>
          {/* Instanced windows - ALL 147 of them */}
          <instancedMesh
            ref={windowMeshRef}
            args={[undefined, undefined, WINDOW_POSITIONS.length]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[2.0, 2.0, 2.0]} />
            <meshStandardMaterial
              ref={windowMaterialRef}
              color={destroyed ? "#4b5563" : "#d6a757"}
              roughness={0.36}
              emissive={destroyed ? "#000000" : "#e5b01f"}
              emissiveIntensity={destroyed ? 0 : 1.2 * integrity}
            />
          </instancedMesh>

          {/* Front lobby section visual */}
          <mesh position={[0.19, 2.22, 17.09]} castShadow receiveShadow>
            <boxGeometry args={[20.0, 10.0, 5.0]} />
            <meshStandardMaterial color={bodyColor} roughness={0.8} />
          </mesh>

          {/* Golden entrance cylinder */}
          <mesh position={[-7.29, 1.28, 21.66]} castShadow receiveShadow>
            <cylinderGeometry args={[5, 5, 10, 32]} />
            <meshPhysicalMaterial
              color={destroyed ? "#6b7280" : "#d6a757"}
              roughness={destroyed ? 0.9 : 0}
              clearcoat={destroyed ? 0 : 1}
              emissive={destroyed ? "#000000" : "#ffcd1a"}
              emissiveIntensity={destroyed ? 0 : 1.2 * integrity}
            />
          </mesh>

          {/* Cylinder cap */}
          <mesh position={[-7.25, 6.22, 21.66]} castShadow receiveShadow>
            <cylinderGeometry args={[6, 6, 1, 32]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
        </group>

        {/* Damage crack overlays when health is low */}
        {integrity < 0.6 && !destroyed && (
          <group>
            {[0, 1, 2].map((i) => (
              <mesh
                key={`crack-${i}`}
                position={[-10 + i * 8, 2 + i * 1.5, -95 + i * 5]}
                rotation={[0, i * 0.5, 0.1 * (i - 1)]}
              >
                <planeGeometry args={[0.3, 4 + i]} />
                <meshBasicMaterial color="#1f2937" transparent opacity={0.7 * (1 - integrity)} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        )}
      </group>

      {/* Hit smoke effect */}
      {lastHitAt && Date.now() - lastHitAt < 1500 && (
        <group position={[-5, 8, -95]}>
          <Smoke position={[0, 0, 0]} scale={1.2} count={30} color="#d9d9d9" />
        </group>
      )}

      {/* Continuous smoke when heavily damaged */}
      {integrity < 0.4 && !destroyed && (
        <>
          <group position={[-16, 20, -97]}>
            <Smoke position={[0, 0, 0]} scale={1.0} count={25} color="#a3a3a3" />
          </group>
          <group position={[5, 6, -120]}>
            <Smoke position={[0, 0, 0]} scale={0.8} count={20} color="#bfbfbf" />
          </group>
        </>
      )}
    </group>
  );
}
