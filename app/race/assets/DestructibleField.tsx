"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import type { DebrisState, DestructibleState } from "../types";
import MyBuilding from "./MyBuilding";

type ChristmasTreeProps = {
  position: [number, number, number];
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
};

type BuildingProps = {
  position: [number, number, number];
  width?: number;
  depth?: number;
  height?: number;
  destroyed?: boolean;
  health?: number;
  maxHealth?: number;
};

function DebrisField({ chunks }: { chunks?: DebrisState[] }) {
  if (!chunks || chunks.length === 0) return null;
  return (
    <>
      {chunks.map((chunk) => (
        <RigidBody
          key={chunk.id}
          position={[chunk.x, chunk.z, chunk.y]}
          linearVelocity={[chunk.vx ?? 0, chunk.vz ?? 0, chunk.vy ?? 0]}
          gravityScale={1}
          colliders="cuboid"
          type="dynamic"
          friction={0.7}
          restitution={0.3}
        >
          <mesh castShadow>
            <boxGeometry
              args={[chunk.size, Math.max(0.2, chunk.size * 0.4), chunk.size]}
            />
            <meshStandardMaterial color={chunk.color} roughness={0.9} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

function ChristmasTree({
  position,
  destroyed = false,
  health,
  maxHealth,
}: ChristmasTreeProps) {
  const integrity = maxHealth
    ? Math.max(health ?? maxHealth, 0) / maxHealth
    : 1;
  const tone = destroyed
    ? "#4b5563"
    : integrity > 0.6
    ? "#166534"
    : integrity > 0.3
    ? "#b45309"
    : "#7c2d12";
  const tilt = destroyed ? -0.6 : THREE.MathUtils.degToRad((1 - integrity) * 6);

  const content = destroyed ? (
    <group>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 3, 6]} />
        <meshStandardMaterial color="#3f3f46" />
      </mesh>
      <mesh position={[1, 0.4, 0]} rotation={[0.2, 0.4, 1.2]} castShadow>
        <coneGeometry args={[1.5, 3.2, 8]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
    </group>
  ) : (
    <group rotation={[tilt, 0, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 1, 8]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <coneGeometry args={[1.5, 2, 8]} />
        <meshStandardMaterial color={tone} />
      </mesh>
      <mesh position={[0, 2.8, 0]} castShadow>
        <coneGeometry args={[1.2, 1.8, 8]} />
        <meshStandardMaterial color={tone} />
      </mesh>
      <mesh position={[0, 4, 0]} castShadow>
        <coneGeometry args={[0.9, 1.5, 8]} />
        <meshStandardMaterial color={tone} />
      </mesh>
      <mesh position={[0, 5.2, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffd700"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );

  if (destroyed) {
    return <group position={position}>{content}</group>;
  }

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      {content}
    </RigidBody>
  );
}

function Building({
  position,
  width = 6,
  depth = 6,
  height = 8,
  destroyed = false,
  health,
  maxHealth,
}: BuildingProps) {
  const integrity = maxHealth
    ? Math.max(health ?? maxHealth, 0) / maxHealth
    : 1;
  const bodyColor = destroyed
    ? "#4b5563"
    : integrity > 0.6
    ? "#cbd5e1"
    : integrity > 0.3
    ? "#fcd34d"
    : "#f97316";
  const roofColor = destroyed ? "#1f2937" : "#dc2626";
  const windowsColor = destroyed ? "#6b7280" : "#fef3c7";

  const intact = (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.8 - integrity * 0.4}
        />
      </mesh>
      <mesh
        position={[0, height + 1, 0]}
        rotation={[THREE.MathUtils.degToRad((1 - integrity) * 2), 0, 0]}
        castShadow
      >
        <coneGeometry args={[width * 0.8, 2, 4]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {[-1, 1].map((x) =>
        [2, 4, 6].map((y) => (
          <mesh
            key={`${x}-${y}`}
            position={[x * (width / 3), y, depth / 2 + 0.01]}
          >
            <planeGeometry args={[0.8, 0.8]} />
            <meshStandardMaterial
              color={windowsColor}
              emissive={destroyed ? "#0f172a" : "#fbbf24"}
              emissiveIntensity={destroyed ? 0.05 : 0.3}
            />
          </mesh>
        ))
      )}
    </group>
  );

  const rubbleOffsets: [number, number, number, number][] = [
    [-1, 0.4, 0, 0],
    [1, 0.45, 0.5, Math.PI / 4],
    [0, 0.3, -0.8, Math.PI / 2],
    [-0.5, 0.35, 0.8, Math.PI / 3],
    [0.8, 0.38, -0.3, Math.PI / 6],
    [0, 0.5, 0, Math.PI / 1.5],
  ];

  const rubble = (
    <group>
      {rubbleOffsets.map(([ox, oy, oz, rot], idx) => (
        <mesh
          key={idx}
          position={[ox * (width / 4), oy, oz * (depth / 4)]}
          rotation={[0, rot, 0]}
          castShadow
        >
          <boxGeometry
            args={[
              1.2 - (idx % 3) * 0.2,
              0.4 + (idx % 2) * 0.2,
              1 + (idx % 4) * 0.15,
            ]}
          />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
      ))}
    </group>
  );

  if (destroyed) {
    return <group position={position}>{rubble}</group>;
  }

  return (
    <RigidBody type="fixed" position={position} colliders="cuboid">
      {intact}
    </RigidBody>
  );
}

export function DestructibleField({
  destructibles,
}: {
  destructibles: DestructibleState[];
}) {
  if (!destructibles.length) return null;

  // Debug helper: log destructible ids/positions so we can confirm server
  // is sending expected coordinates (helps diagnose central clustering).
  try {
    const clientDebug = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (typeof window !== "undefined" && (window as any).__GAME_DEBUG)
          return true;
        if (typeof window !== "undefined") {
          const v = sessionStorage.getItem("GAME_DEBUG");
          if (v === "1" || v === "true") return true;
        }
      } catch (e) {}
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (process.env.NEXT_PUBLIC_GAME_LOG_LEVEL === "debug") return true;
      } catch (e) {}
      return false;
    })();
    // eslint-disable-next-line no-console
    if (clientDebug)
      console.debug(
        "DestructibleField (main):",
        destructibles.map((d) => ({ id: d.id, x: d.x, y: d.y }))
      );
  } catch (e) {
    /* ignore */
  }

  return (
    <>
      {destructibles.map((item) => {
        const position: [number, number, number] = [item.x, 0, item.y];

        // Resolve a registry key in this order:
        // 1. explicit `model` on the destructible (if provided by server)
        // 2. `type` field
        // 3. id prefix (e.g. `mybuilding-1` -> `mybuilding`)
        const explicitModel = (item as any).model;
        const idPrefix = item.id?.split("-")[0];
        const modelKey = explicitModel || item.type || idPrefix;

        // Lazy import registry to avoid changing the existing local Building/Tree
        // implementations used as fallbacks.
        // The registry allows you to register many custom building components
        // (like `MyBuilding`) without modifying this file again.
        let Custom: any = undefined;
        try {
          // dynamic require/import is not used to keep SSR/client semantics stable;
          // we import the resolver at top of file when possible. Use a runtime
          // lookup so existing behavior remains the default.
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const {
            resolveDestructibleComponent,
          } = require("./destructibleRegistry");
          Custom = resolveDestructibleComponent(modelKey);
        } catch (e) {
          // If registry isn't present or fails, fall back to the builtin behaviour.
          Custom = undefined;
        }

        // Skip server-side DVLA landmark to avoid duplicating the
        // `DVLABuilding` visual and colliders that are placed in the scene.
        if (item.id === "dvlab-main") return null;

        return (
          <group key={item.id}>
            {Custom ? (
              // Render the custom registered component. It should accept the
              // destructible-style props (position, destroyed, health, maxHealth, lastHitAt).
              <Custom
                position={position}
                destroyed={item.destroyed}
                health={item.health}
                maxHealth={item.maxHealth}
                lastHitAt={(item as any).lastHitAt}
              />
            ) : item.type === "tree" ? (
              <ChristmasTree
                position={position}
                destroyed={item.destroyed}
                health={item.health}
                maxHealth={item.maxHealth}
              />
            ) : (
              <MyBuilding
                position={position}
                destroyed={item.destroyed}
                health={item.health}
                maxHealth={item.maxHealth}
                // pass lastHitAt if present so MyBuilding can show hit effects
                lastHitAt={(item as any).lastHitAt}
              />
            )}
            <DebrisField chunks={item.debris} />
          </group>
        );
      })}
    </>
  );
}
