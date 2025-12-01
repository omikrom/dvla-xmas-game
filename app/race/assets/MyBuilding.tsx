"use client";

import { RigidBody } from "@react-three/rapier";
import type { ThreeElements } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { Smoke } from "./ParticleEffects";
import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";

type MyBuildingProps = ThreeElements["group"] & {
  lastHitAt?: number;
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
};

export default function MyBuilding({
  lastHitAt,
  destroyed,
  health,
  maxHealth,
  ...props
}: MyBuildingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const [flickeringWindows, setFlickeringWindows] = useState<Set<number>>(new Set());
  
  // Calculate integrity for progressive damage
  const integrity = maxHealth ? Math.max(health ?? maxHealth, 0) / maxHealth : 1;
  
  // Progressive damage colors - walls get darker and more damaged-looking
  const wallColor = useMemo(() => {
    if (destroyed) return "#4a3a30";
    if (integrity > 0.7) return "#8c5740";
    if (integrity > 0.4) return "#7a4d38";
    if (integrity > 0.2) return "#5c3a2a";
    return "#4a3020";
  }, [integrity, destroyed]);
  
  const roofColor = useMemo(() => {
    if (destroyed) return "#3a3a3a";
    if (integrity > 0.7) return "#ffffff";
    if (integrity > 0.4) return "#d0d0d0";
    return "#a0a0a0";
  }, [integrity, destroyed]);

  // Shake effect when hit
  useEffect(() => {
    if (!lastHitAt) return;
    const elapsed = Date.now() - lastHitAt;
    if (elapsed > 800) return;
    
    setShakeIntensity(Math.max(0, 1 - elapsed / 800) * 0.08);
    
    // Flicker some random windows when hit
    const windowsToFlicker = new Set<number>();
    const numFlickers = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < numFlickers; i++) {
      windowsToFlicker.add(Math.floor(Math.random() * 20));
    }
    setFlickeringWindows(windowsToFlicker);
    
    const interval = setInterval(() => {
      const now = Date.now() - lastHitAt;
      if (now > 800) {
        setShakeIntensity(0);
        setFlickeringWindows(new Set());
        clearInterval(interval);
      } else {
        setShakeIntensity(Math.max(0, 1 - now / 800) * 0.08);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [lastHitAt]);
  
  // Animate shake
  useFrame(() => {
    if (!groupRef.current) return;
    if (shakeIntensity > 0) {
      groupRef.current.rotation.x = (Math.random() - 0.5) * shakeIntensity;
      groupRef.current.rotation.z = (Math.random() - 0.5) * shakeIntensity;
    } else {
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.z = 0;
    }
  });

  // Build a reliable BufferGeometry for the wedge (from the ModelBuilder export)
  const wedgeGeometry = useMemo(() => {
    const positions = new Float32Array([
      -2.5, 0, 2.5, 2.5, 0, 2.5, 0, 2, 2.5, -2.5, 0, -2.5, 2.5, 0, -2.5, 0, 2,
      -2.5,
    ]);

    const indices = new Uint16Array([
      0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 0, 2, 5, 0, 5, 3,
    ]);

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    return g;
  }, []);

  useEffect(() => {
    return () => {
      try {
        wedgeGeometry?.dispose();
      } catch (e) {
        // ignore
      }
    };
  }, [wedgeGeometry]);
  
  // Helper to determine window emissive based on damage and flickering
  const getWindowEmissive = (baseColor: string, index: number) => {
    if (destroyed) return "#000000";
    if (flickeringWindows.has(index)) return "#1a1a00";
    if (integrity < 0.3) return Math.random() > 0.7 ? baseColor : "#0f0f00";
    if (integrity < 0.5) return Math.random() > 0.85 ? "#0f0f00" : baseColor;
    return baseColor;
  };
  
  const getWindowIntensity = (baseIntensity: number, index: number) => {
    if (destroyed) return 0;
    if (flickeringWindows.has(index)) return baseIntensity * 0.1;
    if (integrity < 0.3) return Math.random() > 0.7 ? baseIntensity * 0.5 : 0;
    if (integrity < 0.5) return baseIntensity * 0.7;
    return baseIntensity;
  };
  
  // Debris positions for destroyed state
  const debrisPositions = useMemo(() => {
    if (!destroyed) return [];
    return [
      { pos: [1.2, 0.3, 0.8] as [number, number, number], size: [1.5, 0.4, 1.2] as [number, number, number], rot: 0.2 },
      { pos: [-1.0, 0.25, -0.5] as [number, number, number], size: [1.8, 0.35, 1.0] as [number, number, number], rot: -0.3 },
      { pos: [0.3, 0.4, 1.5] as [number, number, number], size: [1.2, 0.5, 0.8] as [number, number, number], rot: 0.5 },
      { pos: [-0.8, 0.2, 1.0] as [number, number, number], size: [0.8, 0.3, 1.4] as [number, number, number], rot: -0.1 },
      { pos: [2.0, 0.35, -1.0] as [number, number, number], size: [1.0, 0.45, 1.1] as [number, number, number], rot: 0.4 },
      { pos: [0, 0.5, 0] as [number, number, number], size: [2.0, 0.6, 2.0] as [number, number, number], rot: 0 },
      // Roof debris
      { pos: [-0.5, 0.15, -1.2] as [number, number, number], size: [1.5, 0.2, 0.6] as [number, number, number], rot: 0.8, isRoof: true },
      { pos: [1.0, 0.18, 0.5] as [number, number, number], size: [1.2, 0.15, 0.8] as [number, number, number], rot: -0.6, isRoof: true },
    ];
  }, [destroyed]);

  // If destroyed, show rubble
  if (destroyed) {
    return (
      <group ref={groupRef} {...props}>
        <RigidBody type="fixed" colliders="cuboid">
          {/* Main rubble pile */}
          {debrisPositions.map((d, i) => (
            <mesh
              key={`debris-${i}`}
              position={d.pos}
              rotation={[0.1 * i, d.rot, 0.05 * i]}
              castShadow
            >
              <boxGeometry args={d.size} />
              <meshStandardMaterial 
                color={(d as any).isRoof ? "#909090" : "#6b5040"} 
                roughness={0.95} 
              />
            </mesh>
          ))}
          
          {/* Broken window glass scattered */}
          {[0, 1, 2, 3].map((i) => (
            <mesh
              key={`glass-${i}`}
              position={[
                (i - 1.5) * 1.2,
                0.05,
                (i % 2 === 0 ? 1 : -1) * 1.5
              ]}
              rotation={[Math.PI / 2, 0, i * 0.3]}
            >
              <planeGeometry args={[0.5 + i * 0.1, 0.4]} />
              <meshStandardMaterial 
                color="#ffd700" 
                transparent 
                opacity={0.4}
                emissive="#ffa500"
                emissiveIntensity={0.3}
              />
            </mesh>
          ))}
          
          {/* Heavy smoke from destruction */}
          <group position={[0, 1.0, 0]}>
            <Smoke position={[0, 0, 0]} scale={1.2} count={60} color="#8a8a8a" />
          </group>
          <group position={[1.5, 0.5, 0.5]}>
            <Smoke position={[0, 0, 0]} scale={0.8} count={30} color="#a0a0a0" />
          </group>
          <group position={[-1.0, 0.6, -0.5]}>
            <Smoke position={[0, 0, 0]} scale={0.7} count={25} color="#909090" />
          </group>
        </RigidBody>
      </group>
    );
  }

  return (
    <group ref={groupRef} {...props}>
      {/* Damage cracks overlay when health is low */}
      {integrity < 0.5 && (
        <group>
          {[0, 1, 2].map((i) => (
            <mesh
              key={`crack-${i}`}
              position={[
                -0.04 + (i - 1) * 1.5,
                2.34 + i * 0.5,
                2.52
              ]}
              rotation={[0, 0, i * 0.2 - 0.2]}
            >
              <planeGeometry args={[0.08, 1.5 + i * 0.3]} />
              <meshBasicMaterial color="#1a1a1a" transparent opacity={0.5 * (1 - integrity)} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      )}
      
      {/* main group */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh
          position={[-0.04, 2.34, 0.0]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[5.0, 5.0, 5.0]} />
          <meshStandardMaterial
            color={wallColor}
            side={THREE.DoubleSide}
            roughness={0.72}
          />
        </mesh>
        {/* ModelBuilder wedge roof restored using a computed BufferGeometry */}
        <mesh
          position={[0.0, 4.83, 0.0]}
          rotation={[0, 0, 0]}
          castShadow
          receiveShadow
          geometry={wedgeGeometry}
        >
          <meshStandardMaterial color={wallColor} roughness={0.78} />
        </mesh>

        <mesh
          position={[0.0, 1.0, 1.69]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2.0, 2.0, 2.0]} />
          <meshStandardMaterial color={"#d6a757"} />
        </mesh>

        <mesh
          position={[0.0, 0.9, 1.82]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.8, 1.9, 1.8]} />
          <meshStandardMaterial color={"#ffffff"} />
        </mesh>

        <mesh
          position={[0.59, 1.0, 2.69]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color={"#000000"} />
        </mesh>

        <mesh
          position={[-1.1, 3.53, 2.13]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            roughness={0.36}
            emissive={"#e5b01f"}
            emissiveIntensity={0.9}
          />
        </mesh>

        <mesh
          position={[1.12, 3.53, 2.13]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            roughness={0.36}
            emissive={"#e5b01f"}
            emissiveIntensity={0.9}
          />
        </mesh>

        <mesh
          position={[2.09, 3.53, 1.32]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#fdac3a"}
            emissiveIntensity={0.8}
            roughness={0.4}
          />
        </mesh>

        <mesh
          position={[2.07, 3.53, -1.19]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#f79322"}
            emissiveIntensity={0.9}
            roughness={0.38}
          />
        </mesh>

        <mesh
          position={[4.94, 1.05, 0.0]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[5.0, 2.5, 5.0]} />
          <meshStandardMaterial color={wallColor} roughness={0.72} />
        </mesh>

        <mesh
          position={[3.09, 1.13, 2.14]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#f4af1a"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>

        <mesh
          position={[4.8, 1.16, 2.12]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ffcd1a"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>

        <mesh
          position={[6.48, 1.16, 2.12]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ffb81f"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>

        <mesh
          position={[3.42, 1.2, -2.04]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ff8e24"}
            emissiveIntensity={2}
          />
        </mesh>

        <mesh
          position={[4.97, 1.23, -2.04]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ffa50a"}
            emissiveIntensity={2}
          />
        </mesh>

        <mesh
          position={[6.55, 1.26, -2.12]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ffc21a"}
            emissiveIntensity={2}
          />
        </mesh>

        <mesh
          position={[-1.32, 5.64, 0.0]}
          rotation={[0.0, 0.0, 0.66]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[3.7, 0.3, 5.1]} />
          <meshStandardMaterial color={roofColor} roughness={0.6} />
        </mesh>

        <mesh
          position={[1.45, 5.64, 0.0]}
          rotation={[0.0, 0.0, -0.66]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[3.7, 0.3, 5.11]} />
          <meshStandardMaterial color={roofColor} roughness={0.6} />
        </mesh>

        <mesh
          position={[4.41, 2.4, 0.0]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[6.14, 0.5, 4.9]} />
          <meshStandardMaterial color={roofColor} roughness={0.6} />
        </mesh>

        <mesh
          position={[-2.14, 3.53, -1.05]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ff9f1a"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>

        <mesh
          position={[-2.12, 3.53, 1.08]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ff8b1f"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>

        <mesh
          position={[-2.2, 1.3, -1.05]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ff961f"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>

        <mesh
          position={[-2.1, 1.3, 1.06]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ff8e24"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>

        <mesh
          position={[-1.1, 1.3, -2.08]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ffc629"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>

        <mesh
          position={[1.04, 1.3, -2.04]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ffa424"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>

        <mesh
          position={[1.03, 3.47, -2.1]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ffaf24"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>

        <mesh
          position={[-1.07, 3.47, -2.08]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial
            color={"#d6a757"}
            emissive={"#ffb638"}
            emissiveIntensity={0.9}
            roughness={0.36}
          />
        </mesh>
        {/* Show hit smoke when recently hit */}
        {lastHitAt && Date.now() - lastHitAt < 1200 && (
          <group position={[0, 3.0, 0]}>
            <Smoke
              position={[0, 0, 0]}
              scale={0.8}
              count={30}
              color="#b0b0b0"
            />
          </group>
        )}
        
        {/* Continuous smoke when heavily damaged */}
        {integrity < 0.35 && (
          <group position={[0, 4.0, 0]}>
            <Smoke position={[0, 0, 0]} scale={0.6} count={20} color="#909090" />
          </group>
        )}
      </RigidBody>
    </group>
  );
}
