"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef, useMemo, useState, useEffect } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Smoke, Sparks } from "../../ParticleEffects";

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
  const wavingArmRef = useRef<THREE.Group>(null);
  const [shakeIntensity, setShakeIntensity] = useState(0);

  /** FRACTIONAL HEALTH (0 → 1) */
  const integrity = maxHealth
    ? Math.max(0, (health ?? maxHealth) / maxHealth)
    : 1;

  /** Tilt based on health - more dramatic as health drops */
  const tilt = destroyed
    ? -0.7
    : THREE.MathUtils.degToRad((1 - integrity) * 15);

  /** Color changes based on damage */
  const coatColor = destroyed
    ? "#6b7280"
    : integrity > 0.6
    ? "#b91c1c"
    : integrity > 0.3
    ? "#991b1b"
    : "#7f1d1d";

  const skinColor = destroyed ? "#9ca3af" : "#ffb4b4";
  const beardColor = destroyed ? "#d1d5db" : "white";

  /** Shake effect when hit */
  useEffect(() => {
    if (!lastHitAt) return;
    const elapsed = Date.now() - lastHitAt;
    if (elapsed > 800) return;

    setShakeIntensity(Math.max(0, 1 - elapsed / 800) * 0.4);
    const interval = setInterval(() => {
      const now = Date.now() - lastHitAt;
      if (now > 800) {
        setShakeIntensity(0);
        clearInterval(interval);
      } else {
        setShakeIntensity(Math.max(0, 1 - now / 800) * 0.4);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [lastHitAt]);

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

    // More lively idle animation
    groupRef.current.rotation.x = Math.sin(t * 0.6) * 0.04 + tilt;
    groupRef.current.rotation.z = Math.sin(t * 0.45) * 0.03;

    // Breathing effect - belly slightly expands/contracts
    const breathScale = 1 + Math.sin(t * 0.8) * 0.015;
    groupRef.current.scale.set(scale * breathScale, scale, scale * breathScale);

    // Animate waving arm
    if (wavingArmRef.current) {
      // Wave back and forth
      wavingArmRef.current.rotation.z = -1.2 + Math.sin(t * 4) * 0.3;
      wavingArmRef.current.rotation.x = -0.3 + Math.sin(t * 4 + 0.5) * 0.15;
    }

    // Shake when hit
    if (shakeIntensity > 0) {
      groupRef.current.rotation.z += (Math.random() - 0.5) * shakeIntensity;
      groupRef.current.rotation.x +=
        (Math.random() - 0.5) * shakeIntensity * 0.5;
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

  // Generate debris positions for destroyed state
  const debrisPositions = useMemo(() => {
    if (!destroyed) return [];
    return [
      // Scattered coat pieces
      {
        pos: [-0.3, 0.2, 0.2] as [number, number, number],
        size: [0.5, 0.3, 0.4] as [number, number, number],
        color: "#991b1b",
        rot: 0.3,
      },
      {
        pos: [0.4, 0.15, -0.1] as [number, number, number],
        size: [0.4, 0.25, 0.35] as [number, number, number],
        color: "#7f1d1d",
        rot: -0.5,
      },
      {
        pos: [0.1, 0.1, 0.5] as [number, number, number],
        size: [0.35, 0.2, 0.3] as [number, number, number],
        color: "#b91c1c",
        rot: 0.8,
      },
      // Belt buckle
      {
        pos: [0, 0.08, 0.3] as [number, number, number],
        size: [0.2, 0.15, 0.1] as [number, number, number],
        color: "#fbbf24",
        rot: 0.1,
      },
      // Boot
      {
        pos: [-0.5, 0.12, 0.4] as [number, number, number],
        size: [0.4, 0.25, 0.5] as [number, number, number],
        color: "#111827",
        rot: 1.2,
      },
      {
        pos: [0.6, 0.1, -0.3] as [number, number, number],
        size: [0.35, 0.2, 0.45] as [number, number, number],
        color: "#1f2937",
        rot: -0.7,
      },
    ];
  }, [destroyed]);

  /* -------------------------------------------------------------
      Santa Model (intact) - Clean redesign
  ------------------------------------------------------------- */
  const intact = (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      {/* ---------------- BODY / TORSO ---------------- */}
      {/* Main body - tapered cylinder shape */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.8, 1.8, 24]} />
        <meshStandardMaterial color={coatColor} roughness={0.7} />
      </mesh>

      {/* Belly bulge - front facing */}
      <mesh position={[0, 1.0, 0.35]} castShadow>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial color={coatColor} roughness={0.7} />
      </mesh>

      {/* White fur trim - bottom of coat */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.2, 24]} />
        <meshStandardMaterial color={beardColor} roughness={0.9} />
      </mesh>

      {/* White fur trim - down the front */}
      <mesh position={[0, 1.2, 0.7]}>
        <boxGeometry args={[0.2, 1.4, 0.1]} />
        <meshStandardMaterial color={beardColor} roughness={0.9} />
      </mesh>

      {/* Belt */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.78, 0.78, 0.18, 24]} />
        <meshStandardMaterial color="#1f2937" roughness={0.5} />
      </mesh>

      {/* Belt buckle */}
      <mesh position={[0, 0.9, 0.78]}>
        <boxGeometry args={[0.22, 0.16, 0.06]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Buckle inner */}
      <mesh position={[0, 0.9, 0.82]}>
        <boxGeometry args={[0.12, 0.08, 0.02]} />
        <meshStandardMaterial color="#92400e" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Buttons */}
      {[1.35, 1.6, 1.85].map((y, i) => (
        <mesh key={`btn-${i}`} position={[0, y, 0.62]} castShadow>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#1f2937" roughness={0.4} />
        </mesh>
      ))}

      {/* ---------------- HEAD ---------------- */}
      <group position={[0, 2.55, 0]}>
        {/* Head */}
        <mesh castShadow>
          <sphereGeometry args={[0.45, 24, 24]} />
          <meshStandardMaterial color={skinColor} roughness={0.8} />
        </mesh>

        {/* Ears */}
        <mesh position={[0.42, 0, 0]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.8} />
        </mesh>
        <mesh position={[-0.42, 0, 0]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.8} />
        </mesh>

        {/* Rosy cheeks */}
        <mesh position={[0.25, -0.08, 0.35]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#ff8888" transparent opacity={0.5} />
        </mesh>
        <mesh position={[-0.25, -0.08, 0.35]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#ff8888" transparent opacity={0.5} />
        </mesh>

        {/* Eyes - white */}
        <mesh position={[0.15, 0.08, 0.38]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh position={[-0.15, 0.08, 0.38]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* Pupils */}
        <mesh position={[0.15, 0.08, 0.45]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#1e3a5f" />
        </mesh>
        <mesh position={[-0.15, 0.08, 0.45]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#1e3a5f" />
        </mesh>

        {/* Eyebrows */}
        <mesh position={[0.15, 0.2, 0.4]} rotation={[0.3, 0, 0.15]}>
          <boxGeometry args={[0.14, 0.04, 0.06]} />
          <meshStandardMaterial color={beardColor} />
        </mesh>
        <mesh position={[-0.15, 0.2, 0.4]} rotation={[0.3, 0, -0.15]}>
          <boxGeometry args={[0.14, 0.04, 0.06]} />
          <meshStandardMaterial color={beardColor} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.02, 0.48]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#ffaaaa" roughness={0.7} />
        </mesh>

        {/* Moustache */}
        <mesh position={[0.15, -0.15, 0.42]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color={beardColor} roughness={0.95} />
        </mesh>
        <mesh position={[-0.15, -0.15, 0.42]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color={beardColor} roughness={0.95} />
        </mesh>

        {/* Beard - main */}
        <mesh position={[0, -0.4, 0.2]} castShadow>
          <sphereGeometry args={[0.4, 20, 16]} />
          <meshStandardMaterial color={beardColor} roughness={0.95} />
        </mesh>
        {/* Beard - chin extension */}
        <mesh position={[0, -0.65, 0.1]} castShadow>
          <sphereGeometry args={[0.25, 16, 12]} />
          <meshStandardMaterial color={beardColor} roughness={0.95} />
        </mesh>
        {/* Beard - sides */}
        <mesh position={[0.3, -0.25, 0.15]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color={beardColor} roughness={0.95} />
        </mesh>
        <mesh position={[-0.3, -0.25, 0.15]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color={beardColor} roughness={0.95} />
        </mesh>

        {/* --- HAT --- */}
        {/* Hat brim - white fur */}
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.52, 0.52, 0.15, 24]} />
          <meshStandardMaterial color={beardColor} roughness={0.9} />
        </mesh>

        {/* Hat main cone */}
        <mesh position={[0, 0.75, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.45, 0.9, 24]} />
          <meshStandardMaterial color={coatColor} roughness={0.7} />
        </mesh>

        {/* Hat tip - drooping */}
        <mesh position={[0.25, 1.0, 0.15]} rotation={[0.5, 0.2, 0.4]}>
          <coneGeometry args={[0.18, 0.4, 16]} />
          <meshStandardMaterial color={coatColor} roughness={0.7} />
        </mesh>

        {/* Pompom */}
        <mesh position={[0.35, 1.05, 0.25]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color={beardColor} roughness={0.95} />
        </mesh>
      </group>

      {/* ---------------- ARMS ---------------- */}
      {/* Left arm - down */}
      <group position={[-0.75, 1.7, 0]} rotation={[0.1, 0, 0.3]}>
        {/* Shoulder */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color={coatColor} roughness={0.7} />
        </mesh>
        {/* Upper arm */}
        <mesh position={[-0.15, -0.35, 0]} rotation={[0, 0, 0.3]}>
          <capsuleGeometry args={[0.15, 0.4, 8, 16]} />
          <meshStandardMaterial color={coatColor} roughness={0.7} />
        </mesh>
        {/* Cuff */}
        <mesh position={[-0.3, -0.65, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.12, 16]} />
          <meshStandardMaterial color={beardColor} roughness={0.9} />
        </mesh>
        {/* Mitten */}
        <mesh position={[-0.3, -0.85, 0]}>
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial color="#1f2937" roughness={0.6} />
        </mesh>
      </group>

      {/* Right arm - raised waving */}
      <group
        ref={wavingArmRef}
        position={[0.75, 1.7, 0]}
        rotation={[-0.3, 0, -1.2]}
      >
        {/* Shoulder */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color={coatColor} roughness={0.7} />
        </mesh>
        {/* Upper arm */}
        <mesh position={[0.15, 0.35, 0]} rotation={[0, 0, -0.3]}>
          <capsuleGeometry args={[0.15, 0.4, 8, 16]} />
          <meshStandardMaterial color={coatColor} roughness={0.7} />
        </mesh>
        {/* Cuff */}
        <mesh position={[0.3, 0.65, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.12, 16]} />
          <meshStandardMaterial color={beardColor} roughness={0.9} />
        </mesh>
        {/* Mitten */}
        <mesh position={[0.3, 0.85, 0]}>
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial color="#1f2937" roughness={0.6} />
        </mesh>
      </group>

      {/* ---------------- LEGS & BOOTS ---------------- */}
      {/* Left leg */}
      <mesh position={[-0.3, 0.0, 0]}>
        <capsuleGeometry args={[0.18, 0.35, 8, 16]} />
        <meshStandardMaterial color={coatColor} roughness={0.7} />
      </mesh>
      {/* Right leg */}
      <mesh position={[0.3, 0.0, 0]}>
        <capsuleGeometry args={[0.18, 0.35, 8, 16]} />
        <meshStandardMaterial color={coatColor} roughness={0.7} />
      </mesh>

      {/* Left boot */}
      <group position={[-0.3, -0.35, 0.1]}>
        {/* Boot top cuff */}
        <mesh position={[0, 0.15, -0.05]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
          <meshStandardMaterial color={beardColor} roughness={0.9} />
        </mesh>
        {/* Boot main */}
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.35, 0.3, 0.5]} />
          <meshStandardMaterial color="#1f2937" roughness={0.6} />
        </mesh>
        {/* Boot toe */}
        <mesh position={[0, -0.1, 0.22]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#1f2937" roughness={0.6} />
        </mesh>
      </group>

      {/* Right boot */}
      <group position={[0.3, -0.35, 0.1]}>
        {/* Boot top cuff */}
        <mesh position={[0, 0.15, -0.05]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
          <meshStandardMaterial color={beardColor} roughness={0.9} />
        </mesh>
        {/* Boot main */}
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.35, 0.3, 0.5]} />
          <meshStandardMaterial color="#1f2937" roughness={0.6} />
        </mesh>
        {/* Boot toe */}
        <mesh position={[0, -0.1, 0.22]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#1f2937" roughness={0.6} />
        </mesh>
      </group>

      {/* Damage cracks when health is low */}
      {integrity < 0.5 && !destroyed && (
        <group>
          {[0, 1, 2].map((i) => (
            <mesh
              key={`crack-${i}`}
              position={[Math.sin(i * 2.5) * 0.5, 1.0 + i * 0.4, 0.75]}
              rotation={[0, 0, i * 0.4 - 0.6]}
            >
              <planeGeometry args={[0.04, 0.3 + i * 0.1]} />
              <meshBasicMaterial
                color="#1f2937"
                transparent
                opacity={0.8 * (1 - integrity)}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Magical Christmas sparkles around Santa */}
      <Sparks position={[0, 1.5, 0]} scale={2.5} count={25} color="#ffd700" />
    </group>
  );

  /* -------------------------------------------------------------
      Destroyed Santa - scattered debris
  ------------------------------------------------------------- */
  const toppled = (
    <group scale={[scale, scale, scale]}>
      {/* Hat on ground */}
      <mesh position={[-0.6, 0.25, 0.3]} rotation={[1.2, 0.3, 0.5]}>
        <coneGeometry args={[0.5, 1.0, 16]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
      <mesh position={[-0.55, 0.15, 0.35]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#d1d5db" />
      </mesh>

      {/* Scattered debris */}
      {debrisPositions.map((d, i) => (
        <mesh
          key={`debris-${i}`}
          position={d.pos}
          rotation={[0, d.rot, Math.random() * 0.3]}
          castShadow
        >
          <boxGeometry args={d.size} />
          <meshStandardMaterial color={d.color} roughness={0.9} />
        </mesh>
      ))}

      {/* Fallen belly */}
      <mesh position={[0.2, 0.4, -0.1]} rotation={[0.3, 0.5, 1.0]}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>

      {/* Smoke rising from destruction */}
      <group position={[0, 0.5, 0]}>
        <Smoke position={[0, 0, 0]} scale={0.8} count={35} color="#a3a3a3" />
      </group>
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
        {/* Hit smoke effect */}
        {lastHitAt && Date.now() - lastHitAt < 800 && (
          <group position={[0, 2.0, 0]}>
            <Smoke scale={0.5} count={22} color="#cfcfcf" />
          </group>
        )}
        {/* Continuous smoke when heavily damaged */}
        {integrity < 0.35 && (
          <group position={[0, 2.5, 0]}>
            <Smoke scale={0.35} count={15} color="#bfbfbf" />
          </group>
        )}
      </group>
    );
  }

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      <group rotation={[0, baseRotationY, 0]}>{intact}</group>

      {/* Hit smoke effect */}
      {lastHitAt && Date.now() - lastHitAt < 800 && (
        <group position={[0, 2.0, 0]}>
          <Smoke scale={0.5} count={22} color="#cfcfcf" />
        </group>
      )}
      {/* Continuous smoke when heavily damaged */}
      {integrity < 0.35 && (
        <group position={[0, 2.5, 0]}>
          <Smoke scale={0.35} count={15} color="#bfbfbf" />
        </group>
      )}
    </RigidBody>
  );
}
