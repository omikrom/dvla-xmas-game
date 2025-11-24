"use client";

import React from "react";
import { RigidBody } from "@react-three/rapier";

export default function MapLoader({ shapes }: { shapes?: any[] }) {
  if (!shapes || !Array.isArray(shapes) || shapes.length === 0) return null;

  return (
    <group>
      {shapes.map((s: any, idx: number) => {
        const pos: [number, number, number] = s.position || [0, 0, 0];
        const rot: [number, number, number] = s.rotation || [0, 0, 0];
        const size: [number, number, number] = s.size || [1, 1, 1];
        const color: string = s.color || "#888888";
        const key = s.id || `map-shape-${idx}`;

        // Use a fixed rigidbody to participate in collisions if desired
        return (
          <RigidBody
            key={key}
            type="fixed"
            colliders={"cuboid"}
            position={pos}
            rotation={rot}
          >
            <mesh
              position={[0, 0, 0]}
              rotation={[0, 0, 0]}
              castShadow
              receiveShadow
            >
              {/* Simplified: render boxes for most shapes; spheres & cylinders supported */}
              {s.shapeType === "sphere" ? (
                <sphereGeometry args={[size[0], 24, 24]} />
              ) : s.shapeType === "cylinder" ? (
                <cylinderGeometry args={[size[0], size[1], size[2], 24]} />
              ) : s.shapeType === "cone" ? (
                <coneGeometry args={[size[0], size[1], 24]} />
              ) : (
                <boxGeometry args={size} />
              )}
              <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>
          </RigidBody>
        );
      })}
    </group>
  );
}
