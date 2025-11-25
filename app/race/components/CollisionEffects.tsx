"use client";

import React, { useEffect } from "react";

export default function CollisionEffects({
  effects,
  setEffects,
}: {
  effects: any[];
  setEffects: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  useEffect(() => {
    const iv = setInterval(() => {
      setEffects((prev) =>
        prev.filter((fx) => Date.now() - (fx.timestamp || 0) < 1600)
      );
    }, 600);
    return () => clearInterval(iv);
  }, [setEffects]);

  return (
    <>
      {effects.map((fx) => (
        <mesh key={fx.id} position={fx.position}>
          <sphereGeometry args={[0.35, 12, 12]} />
          <meshStandardMaterial
            color={fx.color || "#fff"}
            emissive={fx.color || "#fff"}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </>
  );
}
