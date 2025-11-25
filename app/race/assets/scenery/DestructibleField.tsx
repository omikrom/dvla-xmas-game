"use client";

import type { DebrisState, DestructibleState } from "../../types";
import MyBuilding from "../MyBuilding";
import { ChristmasTree } from "./props/ChristmasTree";
import { Snowman } from "./props/Snowman";
import { CandyCane } from "./props/CandyCane";
import { Santa } from "./props/Santa";
import { Reindeer } from "./props/Reindeer";
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ========================================
// Debris Component (animated)
// - Keeps an internal active list so debris can animate and expire
// - Applies simple integrate-and-dampen physics for a believable effect
// ========================================

function DebrisField({ chunks }: { chunks?: DebrisState[] }) {
  const [active, setActive] = useState<DebrisState[]>([]);
  const [staticChunks, setStaticChunks] = useState<DebrisState[]>([]);
  // Remember debris IDs we've already shown-and-removed so we don't re-add
  // transient pieces while the server still holds them in TTL.
  const seenRef = useRef<Set<string>>(new Set());
  const velRef = useRef<Map<string, { vx: number; vy: number; vz: number }>>(
    new Map()
  );
  const startRef = useRef<Map<string, number>>(new Map());
  const meshRefs = useRef<Map<string, any>>(new Map());
  const staticMeshRefs = useRef<Map<string, any>>(new Map());
  const FADE_SECONDS = 2.6; // shorter fade so debris doesn't linger

  // sync incoming chunks: append any new chunks to active
  useEffect(() => {
    if (!chunks || chunks.length === 0) return;
    // Separate persistent (static) chunks from transient animated chunks.
    const persistent = chunks.filter((c) => !!c.persistent);
    const transient = chunks.filter((c) => !c.persistent);

    // Update static (persistent) list to match server-provided persistent debris.
    setStaticChunks((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      for (const c of persistent) map.set(c.id, c);
      // Also remove any static ids that no longer exist on the server
      for (const existing of Array.from(map.keys())) {
        if (!persistent.find((p) => p.id === existing)) map.delete(existing);
      }
      return Array.from(map.values());
    });

    // Merge transient chunks into the animated active list (dedupe by id).
    // Also avoid re-adding any transient chunk we've already shown-and-removed
    // earlier this match (seenRef) to prevent server TTL causing respawns.
    setActive((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]));
      for (const c of transient) {
        if (seenRef.current.has(c.id)) continue; // skip already-seen transient
        if (!byId.has(c.id)) {
          byId.set(c.id, c);
          // Prefer server-provided velocity when available; fall back to random
          velRef.current.set(c.id, {
            vx: typeof c.vx === "number" ? c.vx : Math.random() * 6 - 3,
            vy: typeof c.vy === "number" ? c.vy : Math.random() * 4 + 2,
            vz: typeof c.vz === "number" ? c.vz : Math.random() * 6 - 3,
          });
          startRef.current.set(c.id, performance.now());
        }
      }
      return Array.from(byId.values());
    });
  }, [chunks]);

  useFrame((state, delta) => {
    const toRemove: string[] = [];
    const gravity = 9.81 * 1.2;
    const now = performance.now();
    active.forEach((c) => {
      const mesh = meshRefs.current.get(c.id);
      const vel = velRef.current.get(c.id);
      const started = startRef.current.get(c.id) || now;
      const age = (now - started) / 1000;
      if (!mesh || !vel) return;
      // Integrate
      vel.vy -= gravity * delta;
      const nx = mesh.position.x + vel.vx * delta;
      const ny = mesh.position.y + vel.vy * delta;
      const nz = mesh.position.z + vel.vz * delta;
      // keep pieces above a reasonable ground floor and allow a soft bounce
      const floorY = 0.12;
      let finalY = ny;
      if (ny < floorY) {
        // simple bounce: invert and damp vertical velocity
        if (vel.vy < 0) vel.vy = -vel.vy * 0.18;
        finalY = floorY + vel.vy * delta;
      }
      mesh.position.set(nx, Math.max(finalY, -4), nz);
      mesh.rotation.x += vel.vx * 0.1 * delta;
      mesh.rotation.z += vel.vz * 0.1 * delta;
      // update fade based on age
      const mat: any = mesh.material;
      if (mat) {
        mat.transparent = true;
        mat.opacity = Math.max(0, 1 - age / FADE_SECONDS);
      }
      // damping
      vel.vx *= 0.92;
      vel.vy *= 0.985;
      vel.vz *= 0.92;
      // remove after fade completes or below ground threshold
      if (age > FADE_SECONDS + 0.6 || mesh.position.y < -1.5)
        toRemove.push(c.id);
    });
    if (toRemove.length) {
      setActive((prev) => prev.filter((p) => !toRemove.includes(p.id)));
      for (const id of toRemove) {
        velRef.current.delete(id);
        startRef.current.delete(id);
        meshRefs.current.delete(id);
        // mark transient chunk as seen so it won't be re-added from server
        seenRef.current.add(id);
      }
    }
  });
  // Render both static (persistent) debris and animated active debris.
  if (!staticChunks.length && !active.length) return null;

  return (
    <>
      {staticChunks.map((chunk) => (
        <mesh
          key={chunk.id}
          ref={(r) => staticMeshRefs.current.set(chunk.id, r)}
          position={[chunk.x, chunk.z, chunk.y]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[chunk.size, Math.max(0.2, chunk.size * 0.4), chunk.size]}
          />
          <meshStandardMaterial color={chunk.color} roughness={0.9} />
        </mesh>
      ))}

      {active.map((chunk) => (
        <mesh
          key={chunk.id}
          ref={(r) => meshRefs.current.set(chunk.id, r)}
          position={[chunk.x, chunk.z, chunk.y]}
          castShadow={chunk.size > 0.6}
        >
          <boxGeometry
            args={[chunk.size, Math.max(0.2, chunk.size * 0.4), chunk.size]}
          />
          <meshStandardMaterial color={chunk.color} roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

// ========================================
// Main DestructibleField Component
// ========================================

export function DestructibleField({
  destructibles,
}: {
  destructibles: DestructibleState[];
}) {
  if (!destructibles.length) return null;

  // Debug: print destructible ids/positions to help diagnose unexpected placement
  // (remove or comment out this log once you've validated server data).
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
    if (clientDebug)
      console.debug(
        "DestructibleField:",
        destructibles.map((d) => ({ id: d.id, x: d.x, y: d.y }))
      );
  } catch (e) {
    /* ignore in non-browser environments */
  }

  return (
    <>
      {destructibles.map((item) => {
        // Skip server-only landmark destructible which is rendered as
        // the dedicated `DVLABuilding` component in the scene to avoid
        // duplicate visuals and nested colliders.
        if (item.id === "dvlab-main") return null;
        const position: [number, number, number] = [item.x, 0, item.y];

        const angle = idToAngle(item.id);

        return (
          <group key={item.id}>
            {(() => {
              switch (item.type) {
                case "tree":
                  return (
                    <ChristmasTree
                      id={item.id}
                      position={position}
                      destroyed={item.destroyed}
                      health={item.health}
                      maxHealth={item.maxHealth}
                      lastHitAt={item.lastHitAt}
                    />
                  );
                case "snowman":
                  return (
                    <Snowman
                      id={item.id}
                      position={position}
                      destroyed={item.destroyed}
                      health={item.health}
                      maxHealth={item.maxHealth}
                      lastHitAt={item.lastHitAt}
                    />
                  );
                case "candy":
                  return (
                    <CandyCane
                      id={item.id}
                      position={position}
                      destroyed={item.destroyed}
                      health={item.health}
                      maxHealth={item.maxHealth}
                      lastHitAt={item.lastHitAt}
                    />
                  );
                case "santa":
                  return (
                    <Santa
                      id={item.id}
                      position={position}
                      physics={true}
                      destroyed={item.destroyed}
                      health={item.health}
                      maxHealth={item.maxHealth}
                      lastHitAt={item.lastHitAt}
                    />
                  );
                case "reindeer":
                  return (
                    <Reindeer
                      id={item.id}
                      position={position}
                      physics={true}
                      destroyed={item.destroyed}
                      health={item.health}
                      maxHealth={item.maxHealth}
                      lastHitAt={item.lastHitAt}
                    />
                  );
                default:
                  return (
                    <MyBuilding
                      position={position}
                      rotation={[0, angle, 0]}
                      destroyed={item.destroyed}
                      health={item.health}
                      maxHealth={item.maxHealth}
                      lastHitAt={item.lastHitAt}
                    />
                  );
              }
            })()}
            <DebrisField chunks={item.debris} />
          </group>
        );
      })}
    </>
  );
}

function idToAngle(id?: string) {
  if (!id) return 0;
  // FNV-1a hash for deterministic randomness
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const deg = h % 360;
  return deg * THREE.MathUtils.DEG2RAD;
}
