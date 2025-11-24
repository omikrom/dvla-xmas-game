"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function SpeedTrail({
  groupRef,
  active,
  color = "#f59e0b",
  debug = false,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  active: boolean;
  color?: string;
  debug?: boolean;
}) {
  const maxPoints = 24;
  const positions = useRef(new Float32Array(maxPoints * 3));
  const ages = useRef(new Float32Array(maxPoints));
  const geomRef = useRef<THREE.BufferGeometry | null>(null);
  const posAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const wp = useRef(new THREE.Vector3());
  const debugGroupRef = useRef<THREE.Group | null>(null);

  // initialize positions to zero/aged
  React.useEffect(() => {
    for (let i = 0; i < maxPoints * 3; i++) positions.current[i] = 0;
    for (let i = 0; i < maxPoints; i++) ages.current[i] = 1;
  }, []);

  useFrame((state, delta) => {
    if (!geomRef.current || !groupRef.current) return;
    // reuse vector to avoid allocations
    groupRef.current.getWorldPosition(wp.current);

    // shift arrays efficiently using copyWithin
    // move [0..(n-2)] -> [1..(n-1)]
    positions.current.copyWithin(3, 0, (maxPoints - 1) * 3);
    ages.current.copyWithin(1, 0, maxPoints - 1);

    if (active) {
      positions.current[0] = wp.current.x;
      positions.current[1] = wp.current.y + 0.15;
      positions.current[2] = wp.current.z;
      ages.current[0] = 0;
      if (debug) {
        // quick min/max log for visual debugging of coverage
        let minX = Infinity,
          maxX = -Infinity,
          minZ = Infinity,
          maxZ = -Infinity;
        for (let i = 0; i < maxPoints; i++) {
          const x = positions.current[i * 3];
          const z = positions.current[i * 3 + 2];
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }
        // log once per head update so we can see extents in console
        // throttle to avoid noisy logs
        if (Math.random() < 0.08) {
          // small sample of logs
          // eslint-disable-next-line no-console
          console.log(
            `[SpeedTrail debug] head at ${wp.current.x.toFixed(
              1
            )},${wp.current.z.toFixed(1)} extents x=[${minX.toFixed(
              1
            )},${maxX.toFixed(1)}] z=[${minZ.toFixed(1)},${maxZ.toFixed(1)}]`
          );
        }
      }
    } else {
      // age head
      ages.current[0] = Math.min(1, ages.current[0] + delta * 0.5);
    }

    // update buffer attribute (created once)
    if (posAttrRef.current) {
      posAttrRef.current.array = positions.current;
      posAttrRef.current.needsUpdate = true;
    }

    // set material opacity based on oldest age (last element)
    if (materialRef.current) {
      const oldest = ages.current[maxPoints - 1] || 1;
      materialRef.current.opacity = Math.max(0, 1 - oldest * 0.95);
    }

    // update debug spheres positions (imperative, no React rerender)
    if (debug && debugGroupRef.current) {
      const g = debugGroupRef.current;
      for (let i = 0; i < Math.min(g.children.length, maxPoints); i++) {
        const child = g.children[i] as THREE.Mesh;
        const xi = positions.current[i * 3];
        const yi = positions.current[i * 3 + 1];
        const zi = positions.current[i * 3 + 2];
        child.position.set(xi, yi, zi);
        // visible if the point is recent
        child.visible =
          ages.current[i] < 0.99 && !(xi === 0 && yi === 0 && zi === 0);
      }
    }
  });

  return (
    <>
      <points frustumCulled={false}>
        <bufferGeometry
          ref={(g) => {
            if (!g || geomRef.current) return;
            geomRef.current = g as unknown as THREE.BufferGeometry;
            const attr = new THREE.BufferAttribute(positions.current, 3);
            posAttrRef.current = attr;
            g.setAttribute("position", attr);
          }}
        />
        <pointsMaterial
          ref={(m) =>
            (materialRef.current = m as unknown as THREE.PointsMaterial)
          }
          size={0.18}
          vertexColors={false}
          color={color}
          transparent={true}
          depthTest={true}
          depthWrite={false}
          opacity={0.95}
          sizeAttenuation={true}
        />
      </points>

      {/* Debug: render small spheres at buffer positions so we can visually inspect coverage */}
      {debug && (
        <group
          ref={(r) => (debugGroupRef.current = r as unknown as THREE.Group)}
        >
          {Array.from({ length: maxPoints }).map((_, i) => (
            <mesh key={i} visible={false}>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshStandardMaterial color="#ff4d4f" emissive="#ff7a7a" />
            </mesh>
          ))}
        </group>
      )}
    </>
  );
}
