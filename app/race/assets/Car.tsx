"use client";

import { useRef, useEffect, useMemo } from "react";
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
  speed?: number; // current speed for wheel spin animation
};

export function CarModel({
  bodyColor: bodyColorProp,
  trimColor: trimColorProp,
  position = [0, 0.3, 0],
  rotation = [0, Math.PI, 0],
  isReversing = false,
  alpha = 1,
  shieldActive = false,
  speed = 0,
}: CarModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<THREE.Group[]>([]);
  
  const bodyColor = bodyColorProp ?? "#ef4444"; // Tailwind red-500-ish
  const trimColor = trimColorProp ?? "#1e293b"; // Tailwind slate-800
  const accentColor = "#fbbf24"; // Gold accent for Christmas feel
  const glassColor = "#94a3b8"; // Slightly blue tinted glass
  const wheelTireColor = "#0f172a";
  const wheelRimColor = "#e2e8f0";
  const headlightColor = "#fefce8";
  const taillightColor = "#fca5a5";
  const chromeColor = "#f1f5f9";

  // Dimensions
  const CHASSIS_Y = 0.18;
  const CHASSIS_HEIGHT = 0.32;
  const CABIN_Y = 0.52;
  const CABIN_HEIGHT = 0.38;
  const ROOF_Y = CABIN_Y + CABIN_HEIGHT / 2 + 0.04;

  const wheelPositions: [number, number, number][] = [
    [-0.58, 0.15, 0.88],  // front left
    [0.58, 0.15, 0.88],   // front right
    [-0.58, 0.15, -0.85], // rear left
    [0.58, 0.15, -0.85],  // rear right
  ];

  const leftSpotlightRef = useRef<THREE.SpotLight>(null);
  const rightSpotlightRef = useRef<THREE.SpotLight>(null);
  const headlightGroupRef = useRef<THREE.Group>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const { scene } = useThree();

  useEffect(() => {
    if (leftSpotlightRef.current && rightSpotlightRef.current) {
      scene.add(leftSpotlightRef.current.target);
      scene.add(rightSpotlightRef.current.target);
    }
    return () => {
      if (leftSpotlightRef.current && rightSpotlightRef.current) {
        scene.remove(leftSpotlightRef.current.target);
        scene.remove(rightSpotlightRef.current.target);
      }
    };
  }, [scene]);

  // Apply alpha (opacity) to all mesh materials
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (!m) continue;
          if (typeof m.opacity === "number") {
            if (typeof m.__originalOpacity !== "number") {
              m.__originalOpacity = m.opacity ?? 1;
            }
            m.transparent = alpha < 1 || m.transparent;
            m.opacity = (m.__originalOpacity ?? 1) * alpha;
            m.needsUpdate = true;
          }
        }
      }
    });
  }, [alpha]);

  useFrame((state, delta) => {
    // Update spotlight targets
    if (leftSpotlightRef.current && rightSpotlightRef.current && headlightGroupRef.current) {
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      headlightGroupRef.current.getWorldPosition(worldPos);
      headlightGroupRef.current.getWorldQuaternion(worldQuat);
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat);

      const leftPos = new THREE.Vector3(-0.28, 0, 0.1).applyQuaternion(worldQuat).add(worldPos);
      leftSpotlightRef.current.target.position.copy(leftPos.add(forward.clone().multiplyScalar(12)));
      leftSpotlightRef.current.target.updateMatrixWorld();

      const rightPos = new THREE.Vector3(0.28, 0, 0.1).applyQuaternion(worldQuat).add(worldPos);
      rightSpotlightRef.current.target.position.copy(rightPos.add(forward.multiplyScalar(12)));
      rightSpotlightRef.current.target.updateMatrixWorld();
    }

    // Wheel spin based on speed
    const wheelSpeed = speed * delta * 3;
    wheelRefs.current.forEach((wheel) => {
      if (wheel) {
        // Wheels spin around X axis (forward/backward rolling)
        wheel.rotation.x += wheelSpeed;
      }
    });

    // Shield pulsate
    if (shieldRef.current && shieldActive) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.04;
      shieldRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* === MAIN BODY === */}
      
      {/* Lower chassis / floor pan */}
      <mesh position={[0, CHASSIS_Y - 0.08, 0]} castShadow>
        <boxGeometry args={[1.35, 0.08, 2.4]} />
        <meshStandardMaterial color={trimColor} roughness={0.9} metalness={0.2} />
      </mesh>

      {/* Main body shell */}
      <mesh position={[0, CHASSIS_Y, 0]} castShadow>
        <boxGeometry args={[1.38, CHASSIS_HEIGHT, 2.35]} />
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.7} />
      </mesh>

      {/* Body contour lines (raised detail) */}
      <mesh position={[0.68, CHASSIS_Y + 0.08, 0]}>
        <boxGeometry args={[0.03, 0.08, 2.0]} />
        <meshStandardMaterial color={bodyColor} roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[-0.68, CHASSIS_Y + 0.08, 0]}>
        <boxGeometry args={[0.03, 0.08, 2.0]} />
        <meshStandardMaterial color={bodyColor} roughness={0.3} metalness={0.8} />
      </mesh>

      {/* === WHEEL ARCHES === */}
      {wheelPositions.map((pos, idx) => (
        <mesh key={`arch-${idx}`} position={[pos[0] * 1.15, pos[1] + 0.12, pos[2]]} castShadow>
          <boxGeometry args={[0.18, 0.35, 0.55]} />
          <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
        </mesh>
      ))}

      {/* === HOOD === */}
      <mesh position={[0, 0.42, 0.75]} rotation={[-0.08, 0, 0]} castShadow>
        <boxGeometry args={[1.2, 0.08, 1.0]} />
        <meshStandardMaterial color={bodyColor} metalness={0.75} roughness={0.25} />
      </mesh>
      
      {/* Hood vents / air intake */}
      <mesh position={[0.25, 0.46, 0.65]}>
        <boxGeometry args={[0.15, 0.03, 0.35]} />
        <meshStandardMaterial color={trimColor} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[-0.25, 0.46, 0.65]}>
        <boxGeometry args={[0.15, 0.03, 0.35]} />
        <meshStandardMaterial color={trimColor} roughness={0.5} metalness={0.4} />
      </mesh>

      {/* === FRONT GRILLE === */}
      <mesh position={[0, 0.25, 1.18]} castShadow>
        <boxGeometry args={[0.85, 0.22, 0.06]} />
        <meshStandardMaterial color={trimColor} roughness={0.6} metalness={0.5} />
      </mesh>
      {/* Grille chrome strips */}
      {[-0.25, 0, 0.25].map((x, i) => (
        <mesh key={`grille-${i}`} position={[x, 0.25, 1.2]}>
          <boxGeometry args={[0.08, 0.18, 0.02]} />
          <meshStandardMaterial color={chromeColor} roughness={0.1} metalness={0.95} />
        </mesh>
      ))}

      {/* === CABIN === */}
      {/* Windshield */}
      <mesh position={[0, CABIN_Y - 0.05, 0.45]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[1.0, 0.45, 0.06]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={0.08}
          metalness={0.1}
          transparent
          opacity={0.75}
        />
      </mesh>
      
      {/* Rear windshield */}
      <mesh position={[0, CABIN_Y - 0.05, -0.55]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.9, 0.4, 0.06]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={0.08}
          metalness={0.1}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Side windows - left */}
      <mesh position={[-0.62, CABIN_Y, -0.05]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.7, 0.32, 0.05]} />
        <meshStandardMaterial color={glassColor} roughness={0.1} transparent opacity={0.7} />
      </mesh>
      
      {/* Side windows - right */}
      <mesh position={[0.62, CABIN_Y, -0.05]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.7, 0.32, 0.05]} />
        <meshStandardMaterial color={glassColor} roughness={0.1} transparent opacity={0.7} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, ROOF_Y, -0.1]} castShadow>
        <boxGeometry args={[1.15, 0.06, 1.0]} />
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.6} />
      </mesh>

      {/* A-pillars */}
      <mesh position={[-0.55, CABIN_Y, 0.25]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.08, 0.42, 0.08]} />
        <meshStandardMaterial color={trimColor} roughness={0.5} />
      </mesh>
      <mesh position={[0.55, CABIN_Y, 0.25]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.08, 0.42, 0.08]} />
        <meshStandardMaterial color={trimColor} roughness={0.5} />
      </mesh>

      {/* C-pillars */}
      <mesh position={[-0.52, CABIN_Y, -0.45]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.1, 0.38, 0.12]} />
        <meshStandardMaterial color={trimColor} roughness={0.5} />
      </mesh>
      <mesh position={[0.52, CABIN_Y, -0.45]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.1, 0.38, 0.12]} />
        <meshStandardMaterial color={trimColor} roughness={0.5} />
      </mesh>

      {/* === SIDE MIRRORS === */}
      <group position={[-0.72, 0.48, 0.35]}>
        <mesh>
          <boxGeometry args={[0.12, 0.08, 0.15]} />
          <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[-0.02, 0, 0]} rotation={[0, 0.2, 0]}>
          <boxGeometry args={[0.02, 0.06, 0.1]} />
          <meshStandardMaterial color={glassColor} roughness={0.05} metalness={0.9} />
        </mesh>
      </group>
      <group position={[0.72, 0.48, 0.35]}>
        <mesh>
          <boxGeometry args={[0.12, 0.08, 0.15]} />
          <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0.02, 0, 0]} rotation={[0, -0.2, 0]}>
          <boxGeometry args={[0.02, 0.06, 0.1]} />
          <meshStandardMaterial color={glassColor} roughness={0.05} metalness={0.9} />
        </mesh>
      </group>

      {/* === TRUNK / REAR === */}
      <mesh position={[0, 0.42, -0.9]} rotation={[0.05, 0, 0]} castShadow>
        <boxGeometry args={[1.1, 0.12, 0.6]} />
        <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.65} />
      </mesh>

      {/* Rear spoiler */}
      <group position={[0, 0.52, -1.05]}>
        {/* Spoiler wing */}
        <mesh rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[1.0, 0.04, 0.18]} />
          <meshStandardMaterial color={trimColor} roughness={0.4} metalness={0.7} />
        </mesh>
        {/* Spoiler supports */}
        <mesh position={[-0.35, -0.06, 0.05]}>
          <boxGeometry args={[0.06, 0.12, 0.06]} />
          <meshStandardMaterial color={trimColor} roughness={0.5} />
        </mesh>
        <mesh position={[0.35, -0.06, 0.05]}>
          <boxGeometry args={[0.06, 0.12, 0.06]} />
          <meshStandardMaterial color={trimColor} roughness={0.5} />
        </mesh>
      </group>

      {/* === BUMPERS === */}
      {/* Front bumper */}
      <mesh position={[0, 0.14, 1.18]} castShadow>
        <boxGeometry args={[1.32, 0.18, 0.12]} />
        <meshStandardMaterial color={trimColor} roughness={0.7} metalness={0.3} />
      </mesh>
      {/* Front lip */}
      <mesh position={[0, 0.06, 1.22]}>
        <boxGeometry args={[1.1, 0.04, 0.08]} />
        <meshStandardMaterial color={accentColor} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Rear bumper */}
      <mesh position={[0, 0.14, -1.18]} castShadow>
        <boxGeometry args={[1.25, 0.2, 0.12]} />
        <meshStandardMaterial color={trimColor} roughness={0.7} metalness={0.3} />
      </mesh>

      {/* === WHEELS === */}
      {wheelPositions.map((pos, idx) => {
        const isLeftSide = idx % 2 === 0;
        return (
          <group 
            key={`wheel-${idx}`} 
            position={pos}
            ref={(el) => { if (el) wheelRefs.current[idx] = el; }}
          >
            {/* Tire - rotated so cylinder axis points left-right (X axis) */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.28, 0.28, 0.18, 24]} />
              <meshStandardMaterial color={wheelTireColor} roughness={0.85} metalness={0.1} />
            </mesh>
            {/* Tire tread (outer ring) - vertical ring facing sideways */}
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.28, 0.045, 8, 24]} />
              <meshStandardMaterial color={wheelTireColor} roughness={0.9} />
            </mesh>
            {/* Rim */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.18, 0.18, 0.2, 16]} />
              <meshStandardMaterial color={wheelRimColor} metalness={0.92} roughness={0.15} />
            </mesh>
            {/* Rim center cap - offset outward on X based on left/right side */}
            <mesh position={[isLeftSide ? -0.11 : 0.11, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.06, 0.06, 0.02, 12]} />
              <meshStandardMaterial color={chromeColor} metalness={0.95} roughness={0.1} />
            </mesh>
            {/* Rim spokes - rotate around the wheel's axis (X after 90deg Z rotation) */}
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh 
                key={`spoke-${idx}-${i}`} 
                position={[0, 0, 0]} 
                rotation={[0, 0, Math.PI / 2 + (i * Math.PI * 2) / 5]}
              >
                <boxGeometry args={[0.03, 0.28, 0.03]} />
                <meshStandardMaterial color={wheelRimColor} metalness={0.9} roughness={0.2} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* === HEADLIGHTS === */}
      <group ref={headlightGroupRef} position={[0, 0.32, 1.2]}>
        {/* Left headlight housing */}
        <mesh position={[-0.42, 0, 0]}>
          <boxGeometry args={[0.3, 0.14, 0.1]} />
          <meshStandardMaterial color={trimColor} roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Left headlight lens */}
        <mesh position={[-0.42, 0, 0.04]}>
          <boxGeometry args={[0.26, 0.1, 0.03]} />
          <meshStandardMaterial
            color={headlightColor}
            emissive="#fef3c7"
            emissiveIntensity={1.0}
            transparent
            opacity={0.95}
          />
        </mesh>
        
        {/* Right headlight housing */}
        <mesh position={[0.42, 0, 0]}>
          <boxGeometry args={[0.3, 0.14, 0.1]} />
          <meshStandardMaterial color={trimColor} roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Right headlight lens */}
        <mesh position={[0.42, 0, 0.04]}>
          <boxGeometry args={[0.26, 0.1, 0.03]} />
          <meshStandardMaterial
            color={headlightColor}
            emissive="#fef3c7"
            emissiveIntensity={1.0}
            transparent
            opacity={0.95}
          />
        </mesh>

        {/* DRL strips */}
        <mesh position={[-0.42, -0.1, 0.03]}>
          <boxGeometry args={[0.22, 0.02, 0.02]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0.42, -0.1, 0.03]}>
          <boxGeometry args={[0.22, 0.02, 0.02]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.8} />
        </mesh>

        {/* Spotlights */}
        <spotLight
          ref={leftSpotlightRef}
          position={[-0.42, 0, 0.12]}
          angle={Math.PI / 4}
          penumbra={0.6}
          intensity={6}
          distance={35}
          color="#fef3c7"
          castShadow={false}
          decay={2}
        />
        <spotLight
          ref={rightSpotlightRef}
          position={[0.42, 0, 0.12]}
          angle={Math.PI / 4}
          penumbra={0.6}
          intensity={6}
          distance={35}
          color="#fef3c7"
          castShadow={false}
          decay={2}
        />
      </group>

      {/* === TAIL LIGHTS === */}
      <group position={[0, 0.32, -1.2]}>
        {/* Left tail light */}
        <mesh position={[-0.4, 0, 0]}>
          <boxGeometry args={[0.28, 0.12, 0.06]} />
          <meshStandardMaterial
            color={taillightColor}
            emissive="#dc2626"
            emissiveIntensity={isReversing ? 1.5 : 0.6}
          />
        </mesh>
        {/* Right tail light */}
        <mesh position={[0.4, 0, 0]}>
          <boxGeometry args={[0.28, 0.12, 0.06]} />
          <meshStandardMaterial
            color={taillightColor}
            emissive="#dc2626"
            emissiveIntensity={isReversing ? 1.5 : 0.6}
          />
        </mesh>
        {/* Center brake light */}
        <mesh position={[0, 0.18, 0.02]}>
          <boxGeometry args={[0.4, 0.03, 0.02]} />
          <meshStandardMaterial
            color="#fca5a5"
            emissive="#dc2626"
            emissiveIntensity={isReversing ? 1.2 : 0.4}
          />
        </mesh>
        {/* Reverse lights */}
        <mesh position={[-0.2, -0.08, 0]}>
          <boxGeometry args={[0.1, 0.06, 0.04]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={isReversing ? 1.5 : 0}
          />
        </mesh>
        <mesh position={[0.2, -0.08, 0]}>
          <boxGeometry args={[0.1, 0.06, 0.04]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={isReversing ? 1.5 : 0}
          />
        </mesh>
        {/* Reverse point lights when active */}
        {isReversing && (
          <>
            <pointLight position={[-0.2, -0.08, -0.1]} intensity={4} distance={10} color="#ffffff" decay={2} />
            <pointLight position={[0.2, -0.08, -0.1]} intensity={4} distance={10} color="#ffffff" decay={2} />
          </>
        )}
      </group>

      {/* === CHRISTMAS DECORATIONS === */}
      {/* Roof-mounted Christmas lights string */}
      <group position={[0, ROOF_Y + 0.04, -0.1]}>
        {[-0.4, -0.2, 0, 0.2, 0.4].map((x, i) => (
          <mesh key={`xmas-light-${i}`} position={[x, 0.02, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial
              color={["#ef4444", "#22c55e", "#3b82f6", "#eab308", "#ef4444"][i]}
              emissive={["#ef4444", "#22c55e", "#3b82f6", "#eab308", "#ef4444"][i]}
              emissiveIntensity={0.8}
            />
          </mesh>
        ))}
      </group>

      {/* Small wreath on grille */}
      <group position={[0, 0.25, 1.22]}>
        <mesh>
          <torusGeometry args={[0.08, 0.025, 8, 16]} />
          <meshStandardMaterial color="#166534" roughness={0.8} />
        </mesh>
        {/* Wreath bow */}
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.06, 0.04, 0.02]} />
          <meshStandardMaterial color="#dc2626" roughness={0.6} />
        </mesh>
      </group>

      {/* === UNDERBODY SHADOW === */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.5, 32]} />
        <meshStandardMaterial color="#020617" transparent opacity={0.2} roughness={1} />
      </mesh>

      {/* === SHIELD BUBBLE === */}
      <mesh
        ref={shieldRef}
        position={[0, 0.45, 0]}
        castShadow={false}
        receiveShadow={false}
        renderOrder={999}
      >
        <sphereGeometry args={[1.7, 20, 14]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={shieldActive ? 0.18 : 0}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      {/* Shield inner glow */}
      {shieldActive && (
        <mesh position={[0, 0.45, 0]} renderOrder={998}>
          <sphereGeometry args={[1.65, 16, 12]} />
          <meshBasicMaterial
            color="#93c5fd"
            transparent
            opacity={0.08}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  );
}
