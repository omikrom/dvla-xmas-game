"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Smoke,
  ChristmasLightsTwinkle,
  TreeStringLights,
} from "../../ParticleEffects";

export type ChristmasTreeProps = {
  id: string;
  position: [number, number, number];
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
  lastHitAt?: number;
  physics?: boolean;
};

export function ChristmasTree({
  id,
  position,
  destroyed = false,
  health,
  maxHealth,
  lastHitAt,
  physics = true,
}: ChristmasTreeProps) {
  const integrity = maxHealth
    ? Math.max(health ?? maxHealth, 0) / maxHealth
    : 1;

  // Color changes based on damage - tree gets darker/more brown
  const tone = destroyed
    ? "#4b5563"
    : integrity > 0.7
    ? "#166534" // Healthy green
    : integrity > 0.5
    ? "#15803d" // Slightly damaged
    : integrity > 0.3
    ? "#a16207" // Moderate damage - yellowing
    : "#78350f"; // Heavy damage - brown/dying

  const tilt = destroyed
    ? -0.6
    : THREE.MathUtils.degToRad((1 - integrity) * 15);
  const [shakeIntensity, setShakeIntensity] = useState(0);

  const groupRef = useRef<THREE.Group | null>(null);

  // Shake effect when hit
  useEffect(() => {
    if (!lastHitAt) return;
    const elapsed = Date.now() - lastHitAt;
    if (elapsed > 800) return;

    setShakeIntensity(Math.max(0, 1 - elapsed / 800) * 0.3);
    const interval = setInterval(() => {
      const now = Date.now() - lastHitAt;
      if (now > 800) {
        setShakeIntensity(0);
        clearInterval(interval);
      } else {
        setShakeIntensity(Math.max(0, 1 - now / 800) * 0.3);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [lastHitAt]);

  useFrame(() => {
    if (!groupRef.current) return;

    // Gentle sway animation
    const t = Date.now() / 1000;
    groupRef.current.rotation.z = Math.sin(t * 0.3) * 0.02;
    groupRef.current.rotation.x = tilt + Math.sin(t * 0.25) * 0.015;

    // Shake when hit
    if (shakeIntensity > 0) {
      groupRef.current.rotation.z += (Math.random() - 0.5) * shakeIntensity;
      groupRef.current.rotation.x +=
        (Math.random() - 0.5) * shakeIntensity * 0.5;
    }
  });

  // Generate debris for destroyed state
  const debrisPositions = useMemo(() => {
    if (!destroyed) return [];
    return [
      // Scattered pine branches
      {
        pos: [-0.5, 0.15, 0.3] as [number, number, number],
        size: [0.8, 0.15, 0.5] as [number, number, number],
        color: "#374151",
        rot: 0.8,
      },
      {
        pos: [0.6, 0.12, -0.2] as [number, number, number],
        size: [0.6, 0.12, 0.4] as [number, number, number],
        color: "#4b5563",
        rot: -0.5,
      },
      {
        pos: [0.1, 0.1, 0.6] as [number, number, number],
        size: [0.5, 0.1, 0.35] as [number, number, number],
        color: "#374151",
        rot: 1.2,
      },
      {
        pos: [-0.4, 0.08, -0.5] as [number, number, number],
        size: [0.7, 0.12, 0.4] as [number, number, number],
        color: "#4b5563",
        rot: -0.3,
      },
      // Trunk pieces
      {
        pos: [0.3, 0.2, 0.1] as [number, number, number],
        size: [0.25, 0.4, 0.2] as [number, number, number],
        color: "#5c4033",
        rot: 0.4,
      },
      {
        pos: [-0.2, 0.15, -0.3] as [number, number, number],
        size: [0.2, 0.35, 0.18] as [number, number, number],
        color: "#6b4423",
        rot: -0.7,
      },
    ];
  }, [destroyed]);

  // Ornament positions - hide some when damaged
  const ornamentCount = Math.floor(integrity * 8);

  const intact = (
    <group ref={groupRef} rotation={[tilt, 0, 0]}>
      {/* Tree trunk - more detailed */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.4, 1.2, 12]} />
        <meshStandardMaterial color="#8b4513" roughness={0.9} />
      </mesh>

      {/* Trunk base/roots */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={`root-${i}`}
          position={[
            Math.cos((i * Math.PI) / 2) * 0.35,
            0.1,
            Math.sin((i * Math.PI) / 2) * 0.35,
          ]}
          rotation={[0.3, (i * Math.PI) / 2, 0]}
        >
          <cylinderGeometry args={[0.08, 0.12, 0.3, 6]} />
          <meshStandardMaterial color="#6b4423" roughness={0.95} />
        </mesh>
      ))}

      {/* Bottom tier - largest */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <coneGeometry args={[1.6, 2.2, 12]} />
        <meshStandardMaterial color={tone} roughness={0.85} />
      </mesh>

      {/* Middle tier */}
      <mesh position={[0, 2.8, 0]} castShadow>
        <coneGeometry args={[1.25, 1.9, 12]} />
        <meshStandardMaterial color={tone} roughness={0.85} />
      </mesh>

      {/* Top tier */}
      <mesh position={[0, 4.0, 0]} castShadow>
        <coneGeometry args={[0.95, 1.6, 12]} />
        <meshStandardMaterial color={tone} roughness={0.85} />
      </mesh>

      {/* Star on top */}
      <mesh position={[0, 5.2, 0]}>
        <octahedronGeometry args={[0.25, 0]} />
        <meshStandardMaterial
          color={destroyed ? "#6b7280" : "#ffd700"}
          emissive={destroyed ? "#000000" : "#ffd700"}
          emissiveIntensity={destroyed ? 0 : 0.6 * integrity}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Ornaments - colored balls scattered on tree */}
      {!destroyed &&
        ornamentCount > 0 &&
        [
          { pos: [0.8, 1.8, 0.4], color: "#dc2626" },
          { pos: [-0.6, 2.0, 0.5], color: "#2563eb" },
          { pos: [0.5, 2.6, -0.4], color: "#fbbf24" },
          { pos: [-0.4, 3.0, 0.3], color: "#dc2626" },
          { pos: [0.3, 3.4, 0.35], color: "#16a34a" },
          { pos: [-0.3, 3.8, -0.2], color: "#9333ea" },
          { pos: [0.2, 4.2, 0.2], color: "#dc2626" },
          { pos: [-0.15, 4.5, 0.15], color: "#fbbf24" },
        ]
          .slice(0, ornamentCount)
          .map((orn, i) => (
            <mesh
              key={`orn-${i}`}
              position={orn.pos as [number, number, number]}
            >
              <sphereGeometry args={[0.12, 12, 12]} />
              <meshStandardMaterial
                color={orn.color}
                metalness={0.6}
                roughness={0.3}
                emissive={orn.color}
                emissiveIntensity={0.2}
              />
            </mesh>
          ))}

      {/* Twinkling lights around the tree */}
      {!destroyed && integrity > 0.3 && (
        <group position={[0, 2.2, 0]}>
          <TreeStringLights
            position={[0, -0.65, 0]}
            scale={0.6}
            tiers={[0.1, 2.4, 3.6, 5]}
            counts={[6, 8, 8, 6]}
          />
        </group>
      )}

      {/* Damage cracks when health is low */}
      {integrity < 0.5 && !destroyed && (
        <group>
          {[0, 1, 2].map((i) => (
            <mesh
              key={`crack-${i}`}
              position={[
                Math.sin(i * 2) * 0.6,
                1.5 + i * 0.8,
                Math.cos(i * 2) * 0.6,
              ]}
              rotation={[0.2, i * 0.8, 0.1 * i]}
            >
              <planeGeometry args={[0.04, 0.5 + i * 0.15]} />
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

  const toppled = (
    <group>
      {/* Fallen trunk */}
      <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0.3]} castShadow>
        <cylinderGeometry args={[0.35, 0.4, 2.5, 8]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} />
      </mesh>

      {/* Fallen top portion */}
      <mesh position={[1.2, 0.5, 0.2]} rotation={[0.3, 0.5, 1.3]} castShadow>
        <coneGeometry args={[1.3, 3.0, 10]} />
        <meshStandardMaterial color="#374151" roughness={0.9} />
      </mesh>

      {/* Scattered debris */}
      {debrisPositions.map((d, i) => (
        <mesh
          key={`debris-${i}`}
          position={d.pos}
          rotation={[0, d.rot, Math.random() * 0.2]}
          castShadow
        >
          <boxGeometry args={d.size} />
          <meshStandardMaterial color={d.color} roughness={0.9} />
        </mesh>
      ))}

      {/* Fallen star */}
      <mesh position={[1.5, 0.12, 0.4]} rotation={[0.5, 0.8, 1.2]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.7} />
      </mesh>

      {/* Scattered ornaments */}
      {[
        { pos: [-0.3, 0.08, 0.5], color: "#991b1b" },
        { pos: [0.5, 0.06, -0.2], color: "#1e40af" },
        { pos: [-0.5, 0.07, -0.4], color: "#b45309" },
      ].map((orn, i) => (
        <mesh
          key={`fallen-orn-${i}`}
          position={orn.pos as [number, number, number]}
        >
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={orn.color} roughness={0.8} />
        </mesh>
      ))}

      {/* Smoke rising from destruction */}
      <group position={[0.5, 0.5, 0]}>
        <Smoke position={[0, 0, 0]} scale={0.8} count={30} color="#6b7280" />
      </group>
    </group>
  );

  if (destroyed) {
    return <group position={position}>{toppled}</group>;
  }

  if (!physics) {
    return (
      <group position={position}>
        {intact}
        {/* Hit smoke effect */}
        {lastHitAt && Date.now() - lastHitAt < 800 && (
          <group position={[0, 2.0, 0]}>
            <Smoke
              position={[0, 0, 0]}
              scale={0.55}
              count={25}
              color="#9ca3af"
            />
          </group>
        )}
        {/* Continuous smoke when heavily damaged */}
        {integrity < 0.35 && (
          <group position={[0, 3.0, 0]}>
            <Smoke scale={0.4} count={15} color="#a3a3a3" />
          </group>
        )}
      </group>
    );
  }

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      {intact}
      {/* Hit smoke effect */}
      {lastHitAt && Date.now() - lastHitAt < 800 && (
        <group position={[0, 2.0, 0]}>
          <Smoke position={[0, 0, 0]} scale={0.55} count={25} color="#9ca3af" />
        </group>
      )}
      {/* Continuous smoke when heavily damaged */}
      {integrity < 0.35 && (
        <group position={[0, 3.0, 0]}>
          <Smoke scale={0.4} count={15} color="#a3a3a3" />
        </group>
      )}
    </RigidBody>
  );
}
