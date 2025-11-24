"use client";

import { RigidBody } from "@react-three/rapier";

type RampProps = {
  position: [number, number, number];
  rotation?: [number, number, number];
};

export function Ramp({ position, rotation = [0, 0, 0] }: RampProps) {
  return (
    <RigidBody
      type="fixed"
      position={position}
      rotation={rotation}
      colliders="cuboid"
    >
      <group>
        <mesh
          rotation={[0.4, 0, 0]}
          position={[0, 1.5, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[14, 0.8, 8]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>

        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[14, 1, 8]} />
          <meshStandardMaterial color="#52525b" />
        </mesh>

        {[0, 1, 2].map((i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, -5 - i * 1.2]}
          >
            <planeGeometry args={[12, 0.6]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#fef3c7" : "#dc2626"} />
          </mesh>
        ))}
      </group>
    </RigidBody>
  );
}
