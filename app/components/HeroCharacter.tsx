"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Group } from "three";
import { Reindeer } from "../race/assets/scenery/props/Reindeer";

function ReindeerWrapper() {
  const grp = useRef<Group | null>(null);
  useFrame((_, delta) => {
    if (grp.current) grp.current.rotation.y += delta * 0.25;
  });
  return (
    <group ref={grp} position={[-1.7, -5, -10]} rotation={[0, -Math.PI / 2, 0]}>
      {/* Render the existing Reindeer model with physics disabled for the hero */}
      <Reindeer position={[0, 0, 0]} physics={false} />
    </group>
  );
}

export default function HeroCharacter({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const defaultStyle: React.CSSProperties = {
    width: "50%",
    minWidth: 240,
    height: 320,
    pointerEvents: "none",
    position: "relative",
  };

  const mergedStyle = {
    ...(defaultStyle as any),
    ...(style || {}),
  } as React.CSSProperties;

  return (
    <div className={className} style={mergedStyle}>
      <Canvas
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
        camera={{ position: [0, 1.2, 3.6], fov: 40 }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 5, 2]} intensity={0.9} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        {/* bright point light near the reindeer's head to make face texture visible */}
        <pointLight position={[1.2, 1.9, 0.8]} intensity={1.2} distance={8} />
        <ReindeerWrapper />
      </Canvas>
    </div>
  );
}
