"use client";

import { RigidBody } from "@react-three/rapier";
import type { ThreeElements } from "@react-three/fiber";
import { Smoke } from "./ParticleEffects";
import { useRef, useMemo, useEffect } from "react";
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
  const groupRef = useRef<any>(null);

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

  return (
    <group ref={groupRef} {...props}>
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
            color={"#8c5740"}
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
          <meshStandardMaterial color={"#8c5740"} roughness={0.78} />
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
          <meshStandardMaterial color={"#8c5740"} roughness={0.72} />
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
          <meshStandardMaterial color={"#ffffff"} roughness={0.6} />
        </mesh>

        <mesh
          position={[1.45, 5.64, 0.0]}
          rotation={[0.0, 0.0, -0.66]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[3.7, 0.3, 5.11]} />
          <meshStandardMaterial color={"#ffffff"} roughness={0.6} />
        </mesh>

        <mesh
          position={[4.41, 2.4, 0.0]}
          rotation={[0.0, 0.0, 0.0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[6.14, 0.5, 4.9]} />
          <meshStandardMaterial color={"#ffffff"} roughness={0.6} />
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
              scale={0.6}
              count={24}
              color="#d9d9d9"
            />
          </group>
        )}

        {/* If destroyed, collapse into rubble + smoke (simple fallback) */}
        {destroyed && (
          <group>
            {[0, 1, 2].map((i) => (
              <mesh
                key={`r-${i}`}
                position={[
                  (i - 1) * 0.6,
                  0.2 + i * 0.08,
                  (i % 2 === 0 ? -1 : 1) * (i * 0.8),
                ]}
                castShadow
              >
                <boxGeometry
                  args={[1.2 - i * 0.2, 0.3 + i * 0.06, 1.0 - i * 0.25]}
                />
                <meshStandardMaterial color="#8b6b5a" roughness={0.95} />
              </mesh>
            ))}
            <group position={[0, 1.0, 0]}>
              <Smoke
                position={[0, 0, 0]}
                scale={1.0}
                count={48}
                color="#bfbfbf"
              />
            </group>
          </group>
        )}
      </RigidBody>
    </group>
  );
}
