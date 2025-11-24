"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export default function MapPreview({ shapes }: { shapes: any[] }) {
  return (
    <div id="map" style={{ width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [0, 30, 40], fov: 60 }}>
        <color attach="background" args={["#071024"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#eef6fb" roughness={0.8} />
        </mesh>

        {shapes &&
          shapes.map((s, idx) => {
            const pos = s.position || [0, 0, 0];
            const rot = s.rotation || [0, 0, 0];
            const size = s.size || [1, 1, 1];
            const color = s.color || "#888888";
            const key = s.id || `shape-${idx}`;

            switch (s.shapeType) {
              case "sphere":
                return (
                  <mesh key={key} position={pos} rotation={rot}>
                    <sphereGeometry args={[size[0], 32, 32]} />
                    <meshStandardMaterial color={color} />
                  </mesh>
                );
              case "cylinder":
                return (
                  <mesh key={key} position={pos} rotation={rot}>
                    <cylinderGeometry args={[size[0], size[1], size[2], 32]} />
                    <meshStandardMaterial color={color} />
                  </mesh>
                );
              case "cone":
                return (
                  <mesh key={key} position={pos} rotation={rot}>
                    <coneGeometry args={[size[0], size[1], 32]} />
                    <meshStandardMaterial color={color} />
                  </mesh>
                );
              case "tube":
                return (
                  <mesh key={key} position={pos} rotation={rot}>
                    <torusGeometry args={[size[0], size[1], 16, 32]} />
                    <meshStandardMaterial color={color} />
                  </mesh>
                );
              case "wedge":
              case "box":
              default:
                return (
                  <mesh
                    key={key}
                    position={pos}
                    rotation={rot}
                    scale={[size[0], size[1], size[2]]}
                  >
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color={color} />
                  </mesh>
                );
            }
          })}

        <OrbitControls />
      </Canvas>
    </div>
  );
}
