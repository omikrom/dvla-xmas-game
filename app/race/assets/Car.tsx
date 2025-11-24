"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type CarModelProps = {
  bodyColor?: string; // main paint
  trimColor?: string; // bumpers, skirts, roof accent
  position?: [number, number, number];
  rotation?: [number, number, number];
  isReversing?: boolean; // whether the car is in reverse
  alpha?: number; // overall opacity multiplier (0..1)
  shieldActive?: boolean;
};

export function CarModel({
  bodyColor: bodyColorProp,
  trimColor: trimColorProp,
  position = [0, 0.3, 0],
  rotation = [0, Math.PI, 0],
  isReversing = false,
  alpha = 1,
  shieldActive = false,
}: CarModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyColor = bodyColorProp ?? "#ef4444"; // Tailwind red-500-ish
  const trimColor = trimColorProp ?? "#111827"; // Tailwind slate-900-ish
  const glassColor = "#e5e7eb"; // Light frosted glass
  const wheelTireColor = "#020617";
  const wheelRimColor = "#e5e7eb";
  const headlightColor = "#f9fafb";
  const taillightColor = "#fee2e2";

  const CHASSIS_Y = 0.2;
  const CHASSIS_HEIGHT = 0.35;

  const CABIN_Y = 0.55;
  const CABIN_HEIGHT = 0.35;

  const ROOF_Y = CABIN_Y + CABIN_HEIGHT / 2 + 0.08 / 2;

  const wheelPositions: [number, number, number][] = [
    [-0.62, 0, 0.95],
    [0.62, 0, 0.95],
    [-0.62, 0, -0.95],
    [0.62, 0, -0.95],
  ];

  const leftSpotlightRef = useRef<THREE.SpotLight>(null);
  const rightSpotlightRef = useRef<THREE.SpotLight>(null);
  const headlightGroupRef = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const { scene } = useThree();

  useEffect(() => {
    // Add spotlight targets to the scene when component mounts
    if (leftSpotlightRef.current && rightSpotlightRef.current) {
      scene.add(leftSpotlightRef.current.target);
      scene.add(rightSpotlightRef.current.target);
    }

    return () => {
      // Clean up targets on unmount
      if (leftSpotlightRef.current && rightSpotlightRef.current) {
        scene.remove(leftSpotlightRef.current.target);
        scene.remove(rightSpotlightRef.current.target);
      }
    };
  }, [scene]);

  // Apply alpha (opacity) to all mesh materials in the group when it changes
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        for (const m of mats) {
          if (!m) continue;
          // Only adjust if material supports opacity
          if (typeof m.opacity === "number") {
            if (typeof m.__originalOpacity !== "number") {
              m.__originalOpacity = m.opacity ?? 1;
            }
            m.transparent = alpha < 1 || m.transparent;
            // Multiply original opacity by alpha
            m.opacity = (m.__originalOpacity ?? 1) * alpha;
            m.needsUpdate = true;
          }
        }
      }
    });
  }, [alpha]);

  useFrame(() => {
    if (
      leftSpotlightRef.current &&
      rightSpotlightRef.current &&
      headlightGroupRef.current
    ) {
      // Get world position and rotation of the headlight group
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      headlightGroupRef.current.getWorldPosition(worldPos);
      headlightGroupRef.current.getWorldQuaternion(worldQuat);

      // Calculate forward direction in world space (headlights point in positive Z direction)
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat);

      // Update left spotlight target
      const leftPos = new THREE.Vector3(-0.25, 0, 0.1)
        .applyQuaternion(worldQuat)
        .add(worldPos);
      leftSpotlightRef.current.target.position.copy(
        leftPos.add(forward.clone().multiplyScalar(10))
      );
      leftSpotlightRef.current.target.updateMatrixWorld();

      // Update right spotlight target
      const rightPos = new THREE.Vector3(0.25, 0, 0.1)
        .applyQuaternion(worldQuat)
        .add(worldPos);
      rightSpotlightRef.current.target.position.copy(
        rightPos.add(forward.multiplyScalar(10))
      );
      rightSpotlightRef.current.target.updateMatrixWorld();
    }
  });

  // simple pulsate for the shield bubble
  useFrame((state) => {
    if (shieldRef.current && shieldActive) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.04;
      shieldRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* MAIN CHASSIS */}
      <mesh position={[0, CHASSIS_Y, 0]} castShadow>
        <boxGeometry args={[1.45, CHASSIS_HEIGHT, 2.3]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.4}
          metalness={0.65}
        />
      </mesh>

      {/* LOWER TRIM / SKIRTS */}
      <mesh position={[0, CHASSIS_Y + 0.02, 0]} castShadow>
        <boxGeometry args={[1.46, 0.1, 2.32]} />
        <meshStandardMaterial
          color={trimColor}
          roughness={0.8}
          metalness={0.3}
        />
      </mesh>

      {/* MID BODY BLOCK */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.25, 0.3, 1.4]} />
        <meshStandardMaterial color={bodyColor} roughness={0.55} />
      </mesh>

      {/* FRONT BLOCK / ENGINE BAY */}
      <mesh position={[0, 0.33, 0.7]}>
        <boxGeometry args={[1.15, 0.2, 0.9]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.4}
          metalness={0.75}
        />
      </mesh>

      {/* WHEELS */}
      {wheelPositions.map((pos, idx) => (
        <group key={`wheel-${idx}`} position={pos}>
          {/* Tire */}
          <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
            <torusGeometry args={[0.3, 0.08, 16, 28]} />
            <meshStandardMaterial
              color={wheelTireColor}
              roughness={0.7}
              metalness={0.25}
            />
          </mesh>
          {/* Rim */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.15, 0.15, 0.25, 16]} />
            <meshStandardMaterial
              color={wheelRimColor}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}

      {/* CABIN */}
      {/* Glass block */}
      <mesh position={[0, CABIN_Y, -0.1]}>
        <boxGeometry args={[0.95, CABIN_HEIGHT, 1.1]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={0.15}
          metalness={0.2}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Roof accent */}
      <mesh position={[0, ROOF_Y, -0.1]}>
        <boxGeometry args={[1.02, 0.08, 1.2]} />
        <meshStandardMaterial
          color={trimColor}
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>

      {/* HOOD */}
      <mesh position={[0, 0.55, 0.85]} rotation={[Math.PI * 0.01, 0, 0]}>
        <boxGeometry args={[0.95, 0.15, 0.8]} />
        <meshStandardMaterial
          color={bodyColor}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>

      {/* TRUNK */}
      <mesh position={[0, 0.5, -0.95]} rotation={[-Math.PI * 0.01, 0, 0]}>
        <boxGeometry args={[0.9, 0.16, 0.65]} />
        <meshStandardMaterial color={bodyColor} roughness={0.45} />
      </mesh>

      {/* DOORS */}
      {/* Left */}
      <mesh position={[-0.7, 0.25, -0.05]}>
        <boxGeometry args={[0.08, 0.65, 1.4]} />
        <meshStandardMaterial
          color={bodyColor}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>
      {/* Right */}
      <mesh position={[0.7, 0.25, -0.05]}>
        <boxGeometry args={[0.08, 0.65, 1.4]} />
        <meshStandardMaterial
          color={bodyColor}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      {/* BUMPERS */}
      {/* Front */}
      <mesh position={[0, 0.12, 1.15]} castShadow>
        <boxGeometry args={[1.05, 0.22, 0.35]} />
        <meshStandardMaterial color={trimColor} roughness={0.6} />
      </mesh>
      {/* Rear */}
      <mesh position={[0, 0.12, -1.15]} castShadow>
        <boxGeometry args={[1.05, 0.22, 0.35]} />
        <meshStandardMaterial color={trimColor} roughness={0.6} />
      </mesh>

      {/* LIGHTS */}
      {/* Headlights - positioned on front of car */}
      <group ref={headlightGroupRef} position={[0, 0.35, 1.3]}>
        {/* Left headlight */}
        <mesh position={[-0.25, 0, 0]}>
          <boxGeometry args={[0.25, 0.15, 0.08]} />
          <meshStandardMaterial
            color={headlightColor}
            emissive="#fef9c3"
            emissiveIntensity={0.8}
          />
        </mesh>
        {/* Right headlight */}
        <mesh position={[0.25, 0, 0]}>
          <boxGeometry args={[0.25, 0.15, 0.08]} />
          <meshStandardMaterial
            color={headlightColor}
            emissive="#fef9c3"
            emissiveIntensity={0.8}
          />
        </mesh>
        {/* Left spotlight */}
        <spotLight
          ref={leftSpotlightRef}
          position={[-0.25, 0, 0.1]}
          angle={Math.PI / 3}
          penumbra={0.5}
          intensity={5}
          distance={30}
          color="#fef9c3"
          castShadow={false}
          decay={2}
        />
        {/* Right spotlight */}
        <spotLight
          ref={rightSpotlightRef}
          position={[0.25, 0, 0.1]}
          angle={Math.PI / 3}
          penumbra={0.5}
          intensity={5}
          distance={30}
          color="#fef9c3"
          castShadow={false}
          decay={2}
        />
      </group>

      {/* Tail lights */}
      <group position={[0, 0.35, -1.3]}>
        {/* Left tail light */}
        <mesh position={[-0.2, 0, 0]}>
          <boxGeometry args={[0.15, 0.15, 0.08]} />
          <meshStandardMaterial
            color={taillightColor}
            emissive="#dc2626"
            emissiveIntensity={isReversing ? 1.2 : 0.5}
          />
        </mesh>
        {/* Right tail light */}
        <mesh position={[0.2, 0, 0]}>
          <boxGeometry args={[0.15, 0.15, 0.08]} />
          <meshStandardMaterial
            color={taillightColor}
            emissive="#dc2626"
            emissiveIntensity={isReversing ? 1.2 : 0.5}
          />
        </mesh>
        {/* Reverse lights - only active when reversing */}
        {isReversing && (
          <>
            <pointLight
              position={[-0.2, 0, -0.1]}
              intensity={3}
              distance={8}
              color="#ffffff"
              decay={2}
            />
            <pointLight
              position={[0.2, 0, -0.1]}
              intensity={3}
              distance={8}
              color="#ffffff"
              decay={2}
            />
          </>
        )}
      </group>

      {/* SIMPLE UNDERBODY SHADOW PLATE (optional visual touch) */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.6, 32]} />
        <meshStandardMaterial
          color="#020617"
          transparent
          opacity={0.15}
          roughness={1}
        />
      </mesh>

      {/* Shield bubble - translucent, emissive, cheap geometry */}
      {/* Shield bubble: always rendered but invisible when inactive to avoid mount/unmount flicker.
          Use a basic material and disable depth write/test so it remains visible above geometry. */}
      <mesh
        ref={shieldRef}
        position={[0, 0.55, 0]}
        castShadow={false}
        receiveShadow={false}
        renderOrder={999}
      >
        <sphereGeometry args={[1.6, 16, 12]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={shieldActive ? 0.16 : 0}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}
