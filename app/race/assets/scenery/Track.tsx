"use client";

import { RigidBody } from "@react-three/rapier";

export function Track() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <group>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          position={[0, -0.1, 0]}
        >
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#0a4d0a" />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <ringGeometry args={[32, 35, 64]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          position={[0, 0, 0]}
        >
          <ringGeometry args={[22, 32, 64]} />
          <meshStandardMaterial color="#1f2933" />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <ringGeometry args={[18, 22, 64]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <circleGeometry args={[18, 64]} />
          <meshStandardMaterial color="#0a4d0a" />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -27]}>
          <planeGeometry args={[10, 1.5]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>

        {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle, i) => {
          const radius = 27;
          const x = Math.sin(angle) * radius;
          const z = -Math.cos(angle) * radius;
          return (
            <mesh
              key={i}
              rotation={[-Math.PI / 2, 0, angle]}
              position={[x, 0.02, z]}
            >
              <planeGeometry args={[10, 1]} />
              <meshStandardMaterial color={i === 0 ? "#ffffff" : "#3b82f6"} />
            </mesh>
          );
        })}
      </group>
    </RigidBody>
  );
}
