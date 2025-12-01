"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Smoke } from "../../ParticleEffects";

export type SnowmanProps = {
  id?: string;
  position: [number, number, number];
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
  lastHitAt?: number;
  physics?: boolean;
};

export function Snowman({
  id,
  position,
  destroyed = false,
  health,
  maxHealth,
  lastHitAt,
  physics = true,
}: SnowmanProps) {
  const integrity = maxHealth
    ? Math.max(health ?? maxHealth, 0) / maxHealth
    : 1;
  const tilt = destroyed ? -0.6 : THREE.MathUtils.degToRad((1 - integrity) * 12);
  const [shakeIntensity, setShakeIntensity] = useState(0);

  const groupRef = useRef<THREE.Group | null>(null);

  // Color changes based on damage
  const snowColor = destroyed 
    ? "#d1d5db" 
    : integrity > 0.6 
      ? "#ffffff" 
      : integrity > 0.3 
        ? "#f3f4f6" 
        : "#e5e7eb";

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
    // slight idle bob
    const t = Date.now() / 1000;
    groupRef.current.rotation.x = Math.sin(t * 0.4) * 0.03 + tilt;
    groupRef.current.rotation.z = Math.sin(t * 0.6) * 0.02;
    
    // Shake when hit
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

  // Generate debris for destroyed state
  const debrisPositions = useMemo(() => {
    if (!destroyed) return [];
    return [
      // Snow chunks
      { pos: [-0.4, 0.2, 0.3] as [number, number, number], size: 0.35, color: "#e5e7eb" },
      { pos: [0.5, 0.15, -0.2] as [number, number, number], size: 0.4, color: "#f3f4f6" },
      { pos: [0.1, 0.1, 0.5] as [number, number, number], size: 0.25, color: "#ffffff" },
      { pos: [-0.3, 0.12, -0.4] as [number, number, number], size: 0.3, color: "#e5e7eb" },
      // Carrot nose
      { pos: [0.6, 0.08, 0.2] as [number, number, number], size: 0.12, color: "#ff8c42", isCarrot: true },
      // Coal buttons
      { pos: [-0.2, 0.05, 0.1] as [number, number, number], size: 0.08, color: "#222" },
      { pos: [0.3, 0.06, -0.15] as [number, number, number], size: 0.07, color: "#111" },
    ];
  }, [destroyed]);

  const intact = (
    <group ref={groupRef} rotation={[tilt, 0, 0]}>
      {/* Bottom snowball - larger */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <sphereGeometry args={[0.95, 24, 18]} />
        <meshStandardMaterial color={snowColor} roughness={0.9} />
      </mesh>
      
      {/* Middle snowball */}
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.65, 20, 16]} />
        <meshStandardMaterial color={snowColor} roughness={0.9} />
      </mesh>
      
      {/* Head */}
      <mesh position={[0, 2.35, 0]} castShadow>
        <sphereGeometry args={[0.42, 18, 14]} />
        <meshStandardMaterial color={snowColor} roughness={0.9} />
      </mesh>

      {/* Coal eyes - more expressive */}
      <mesh position={[0.14, 2.45, 0.36]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[-0.14, 2.45, 0.36]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      
      {/* Eyebrows (small snow ridges) */}
      <mesh position={[0.14, 2.52, 0.34]} rotation={[0.3, 0, 0.15]}>
        <boxGeometry args={[0.1, 0.03, 0.04]} />
        <meshStandardMaterial color={snowColor} />
      </mesh>
      <mesh position={[-0.14, 2.52, 0.34]} rotation={[0.3, 0, -0.15]}>
        <boxGeometry args={[0.1, 0.03, 0.04]} />
        <meshStandardMaterial color={snowColor} />
      </mesh>

      {/* Carrot nose - more detailed */}
      <mesh position={[0, 2.35, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.07, 0.55, 10]} />
        <meshStandardMaterial color="#ff8c42" roughness={0.6} />
      </mesh>

      {/* Smile (coal pieces) */}
      {[-0.12, -0.06, 0, 0.06, 0.12].map((x, i) => (
        <mesh key={`smile-${i}`} position={[x, 2.22 - Math.abs(x) * 0.8, 0.38 + Math.abs(x) * 0.1]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}

      {/* Buttons - three coal pieces */}
      <mesh position={[0, 1.85, 0.62]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 1.55, 0.64]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 1.25, 0.62]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Stick arms */}
      <group position={[-0.7, 1.6, 0]} rotation={[0, 0, -0.5]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.025, 0.8, 8]} />
          <meshStandardMaterial color="#5c4033" roughness={0.9} />
        </mesh>
        {/* Twig fingers */}
        <mesh position={[0, 0.35, 0]} rotation={[0, 0, 0.6]}>
          <cylinderGeometry args={[0.015, 0.01, 0.2, 6]} />
          <meshStandardMaterial color="#5c4033" />
        </mesh>
        <mesh position={[0, 0.35, 0]} rotation={[0, 0, -0.4]}>
          <cylinderGeometry args={[0.015, 0.01, 0.18, 6]} />
          <meshStandardMaterial color="#5c4033" />
        </mesh>
      </group>
      <group position={[0.7, 1.6, 0]} rotation={[0, 0, 0.5]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.025, 0.8, 8]} />
          <meshStandardMaterial color="#5c4033" roughness={0.9} />
        </mesh>
        {/* Twig fingers */}
        <mesh position={[0, 0.35, 0]} rotation={[0, 0, 0.5]}>
          <cylinderGeometry args={[0.015, 0.01, 0.2, 6]} />
          <meshStandardMaterial color="#5c4033" />
        </mesh>
        <mesh position={[0, 0.35, 0]} rotation={[0, 0, -0.5]}>
          <cylinderGeometry args={[0.015, 0.01, 0.18, 6]} />
          <meshStandardMaterial color="#5c4033" />
        </mesh>
      </group>

      {/* Top hat - more detailed */}
      <mesh position={[0, 2.65, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.08, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 2.9, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.5, 16]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* Hat band */}
      <mesh position={[0, 2.72, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.08, 16]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>

      {/* Scarf */}
      <mesh position={[0, 2.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.08, 12, 24]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
      {/* Scarf tail */}
      <mesh position={[0.3, 1.85, 0.25]} rotation={[0.3, 0.2, 0.5]}>
        <boxGeometry args={[0.12, 0.4, 0.06]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>

      {/* Damage cracks when health is low */}
      {integrity < 0.5 && !destroyed && (
        <group>
          {[0, 1].map((i) => (
            <mesh
              key={`crack-${i}`}
              position={[
                (i === 0 ? 0.3 : -0.25),
                1.0 + i * 0.5,
                0.7
              ]}
              rotation={[0, 0, i * 0.5 - 0.25]}
            >
              <planeGeometry args={[0.03, 0.3 + i * 0.1]} />
              <meshBasicMaterial color="#9ca3af" transparent opacity={0.7 * (1 - integrity)} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );

  const toppled = (
    <group>
      {/* Collapsed snow pile */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <sphereGeometry args={[0.5, 12, 8]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.95} />
      </mesh>
      <mesh position={[0.4, 0.2, 0.2]} rotation={[0.3, 0.5, 0.2]} castShadow>
        <sphereGeometry args={[0.35, 10, 8]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.95} />
      </mesh>
      <mesh position={[-0.3, 0.18, -0.1]} rotation={[0.2, -0.3, 0.1]} castShadow>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color="#f3f4f6" roughness={0.95} />
      </mesh>

      {/* Fallen hat */}
      <mesh position={[-0.5, 0.12, 0.4]} rotation={[0.8, 0.3, 1.2]}>
        <cylinderGeometry args={[0.2, 0.2, 0.35, 12]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Scattered debris */}
      {debrisPositions.map((d, i) => (
        <mesh
          key={`debris-${i}`}
          position={d.pos}
          castShadow
        >
          {(d as any).isCarrot ? (
            <coneGeometry args={[0.05, 0.3, 8]} />
          ) : (
            <sphereGeometry args={[d.size, 8, 8]} />
          )}
          <meshStandardMaterial color={d.color} roughness={0.9} />
        </mesh>
      ))}

      {/* Broken stick arm */}
      <mesh position={[0.6, 0.1, -0.3]} rotation={[1.2, 0.5, 0.3]}>
        <cylinderGeometry args={[0.025, 0.02, 0.5, 6]} />
        <meshStandardMaterial color="#5c4033" />
      </mesh>

      {/* Smoke/steam rising */}
      <group position={[0, 0.4, 0]}>
        <Smoke position={[0, 0, 0]} scale={0.6} count={25} color="#e5e7eb" />
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
        {/* Hit smoke effect */}
        {lastHitAt && Date.now() - lastHitAt < 700 && (
          <group position={[0, 1.6, 0]}>
            <Smoke position={[0, 0, 0]} scale={0.5} count={20} color="#e5e7eb" />
          </group>
        )}
        {/* Continuous smoke when heavily damaged */}
        {integrity < 0.35 && (
          <group position={[0, 2.0, 0]}>
            <Smoke scale={0.3} count={12} color="#d1d5db" />
          </group>
        )}
      </group>
    );
  }

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      <group rotation={[0, baseRotationY, 0]}>{intact}</group>
      {/* Hit smoke effect */}
      {lastHitAt && Date.now() - lastHitAt < 700 && (
        <group position={[0, 1.6, 0]}>
          <Smoke position={[0, 0, 0]} scale={0.5} count={20} color="#e5e7eb" />
        </group>
      )}
      {/* Continuous smoke when heavily damaged */}
      {integrity < 0.35 && (
        <group position={[0, 2.0, 0]}>
          <Smoke scale={0.3} count={12} color="#d1d5db" />
        </group>
      )}
    </RigidBody>
  );
}
