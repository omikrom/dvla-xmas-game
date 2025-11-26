"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerCar } from "../types";
import SpeedTrail from "./SpeedTrail";

type Snapshot = {
  ts: number;
  x: number;
  y: number;
  z?: number;
  angle?: number;
  vx?: number;
  vy?: number;
};

export default function InterpolatedCar({
  car,
  children,
  positionsRef,
  snapshotsRef,
  localPlayerId,
  playerInputRef,
  trailColor,
  interpolationDelayRef,
  isMobile,
}: {
  car: PlayerCar;
  children: React.ReactNode;
  positionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  snapshotsRef: React.MutableRefObject<Map<string, Snapshot[]>>;
  localPlayerId?: string | null;
  playerInputRef?: React.MutableRefObject<{ steer: number; throttle: number } | null>;
  trailColor?: string;
  interpolationDelayRef?: React.MutableRefObject<number>;
  isMobile?: boolean;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const LOCAL_DEBUG =
    typeof window !== "undefined" && (!!(window as any).__GAME_DEBUG__ || process.env.NODE_ENV !== "production");
  const correctionRef = useRef<{
    active: boolean;
    start: number;
    duration: number;
    from: { x: number; y: number; z: number };
    to: { x: number; y: number; z: number };
  } | null>(null);
  const targetPos = useRef(new THREE.Vector3(car.x, car.z || 0.3, car.y));
  const targetRot = useRef(car.angle);

  useEffect(() => {
    targetPos.current.set(car.x, car.z || 0.3, car.y);
    targetRot.current = car.angle;
  }, [car.x, car.y, car.z, car.angle]);

  // On mount, immediately snap the visual group to the server position so
  // the car isn't rendered at the origin for a frame before lerping.
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(
      targetPos.current.x,
      targetPos.current.y,
      targetPos.current.z
    );
    g.rotation.y = targetRot.current;
    // ensure positionsRef reflects initial placement
    positionsRef.current.set(car.id, { x: g.position.x, y: g.position.z });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Interpolation buffering: render a slightly older authoritative state
    // to smooth jitter. The client keeps a short buffer of snapshots and
    // renders the state at `now - INTERPOLATION_DELAY_MS`.
    // allow runtime overrides from the InterpTuner (window.__GAME_TUNER)
    const tuner = typeof window !== "undefined" ? (window as any).__GAME_TUNER || {} : {};
    const defaultDelay = 285;
    const delayFromRef = interpolationDelayRef && typeof interpolationDelayRef.current === "number" ? interpolationDelayRef.current : defaultDelay;
    const delay = typeof tuner.interpolationDelay === "number" ? tuner.interpolationDelay : delayFromRef;
    const now = Date.now();
    const targetTime = now - delay;

    const snaps = snapshotsRef?.current?.get(car.id) || [];
    let sampledX = targetPos.current.x;
    let sampledY = targetPos.current.z;
    let sampledZ = targetPos.current.y;
    let sampledAngle = targetRot.current;

    const isLocal = !!localPlayerId && car.id === localPlayerId;

    if (isLocal) {
      // Local player: prefer immediate server-reported props (car.x/y)
      // plus a light prediction offset so controls feel responsive. Avoid
      // buffering the local player's visual to keep reaction time low.
      sampledX = car.x;
      sampledY = car.y;
      sampledZ = car.z ?? 0.3;
      sampledAngle = car.angle;
    } else if (snaps.length === 0) {
      // no snapshots yet — fall back to last-known server position (car prop)
      sampledX = car.x;
      sampledY = car.y;
      sampledZ = car.z || 0.3;
      sampledAngle = car.angle;
    } else {
      // find surrounding snapshots
      let aIndex = -1;
      for (let i = 0; i < snaps.length - 1; i++) {
        if (snaps[i].ts <= targetTime && snaps[i + 1].ts >= targetTime) {
          aIndex = i;
          break;
        }
      }

      if (aIndex >= 0) {
        // Use cubic Hermite interpolation (position + velocity) between
        // surrounding snapshots for smoother motion at higher latencies.
        const a = snaps[aIndex];
        const b = snaps[aIndex + 1];
        const totalMs = Math.max(1, b.ts - a.ts);
        const s = Math.min(1, Math.max(0, (targetTime - a.ts) / totalMs));
        const totalSec = totalMs / 1000;

        // Hermite basis
        const s2 = s * s;
        const s3 = s2 * s;
        const h00 = 2 * s3 - 3 * s2 + 1;
        const h10 = s3 - 2 * s2 + s;
        const h01 = -2 * s3 + 3 * s2;
        const h11 = s3 - s2;

        const defaultTangent = isMobile ? 0.45 : 0.6;
        const tangentScale = typeof tuner.tangentScale === "number" ? tuner.tangentScale : defaultTangent;
        const m0x = (a.vx || 0) * totalSec * tangentScale;
        const m1x = (b.vx || 0) * totalSec * tangentScale;
        const m0y = (a.vy || 0) * totalSec * tangentScale;
        const m1y = (b.vy || 0) * totalSec * tangentScale;

        sampledX = h00 * a.x + h10 * m0x + h01 * b.x + h11 * m1x;
        sampledY = h00 * a.y + h10 * m0y + h01 * b.y + h11 * m1y;
        sampledZ = h00 * (a.z || 0.3) + h10 * ((a.z || 0.3) * totalSec) + h01 * (b.z || 0.3) + h11 * ((b.z || 0.3) * totalSec);

        if (typeof a.angle === "number" && typeof b.angle === "number") {
          // shortest-angle lerp for rotation (keep simple linear blend)
          let d = b.angle - a.angle;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          sampledAngle = a.angle + d * s;
        }
      } else {
        // before first snapshot or after last
        const first = snaps[0];
        const last = snaps[snaps.length - 1];
        if (targetTime < first.ts) {
          sampledX = first.x;
          sampledY = first.y;
          sampledZ = first.z || 0.3;
          sampledAngle = first.angle ?? sampledAngle;
        } else {
          // extrapolate from last using velocity if available. Cap extrapolation
          // dt to avoid large runaway jumps when snapshots are delayed.
          const dt = Math.max(0, Math.min(0.5, (targetTime - last.ts) / 1000));
          sampledX = last.x + (last.vx || 0) * dt;
          sampledY = last.y + (last.vy || 0) * dt;
          sampledZ = last.z ?? 0.3;
          sampledAngle = last.angle ?? sampledAngle;
        }
      }
    }

    // Apply a lightweight local prediction for the local player to make
    // controls feel immediate. Only apply when rendering the local player.
    if (isLocal && playerInputRef && playerInputRef.current) {
      try {
        const inp = playerInputRef.current;
        // prediction parameters may be overridden by tuner
        const MAX_PRED_SPEED = typeof tuner.predSpeed === "number" ? tuner.predSpeed : 6; // units/sec
        const predDt = typeof tuner.predDt === "number" ? Math.max(0.01, tuner.predDt / 1000) : 0.125; // ms->s (default 125ms)
        const forward = (inp.throttle || 0) * MAX_PRED_SPEED * predDt;
        const steerEffect = (inp.steer || 0) * 0.25 * predDt; // smaller angular effect
        sampledX += Math.sin(sampledAngle) * forward;
        sampledY += Math.cos(sampledAngle) * forward;
        sampledAngle += steerEffect;
      } catch (e) {}
    }

    // Compute a smoothing alpha based on frame delta so interpolation is
    // framerate-independent. Use a slightly snappier factor but allow the
    // buffered interpolation to do the heavy lifting for smoothness.
    const alpha = Math.min(1, 1 - Math.exp(-delta * 12));

    // Teleport or smoothly correct visual drift depending on magnitude.
    const dx = sampledX - groupRef.current.position.x;
    const dz = sampledY - groupRef.current.position.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);
    const TELEPORT_THRESHOLD = typeof tuner.teleportThreshold === "number" ? tuner.teleportThreshold : 25;
    const CORRECT_THRESHOLD = typeof tuner.correctThreshold === "number" ? tuner.correctThreshold : 15;
    const CORRECTION_MS = typeof tuner.correctionMs === "number" ? tuner.correctionMs : 83;

    // update target rotation early
    targetRot.current = sampledAngle;

    if (dist > TELEPORT_THRESHOLD) {
      // Very large jump — teleport to authoritative position
      if (groupRef.current.position.x !== sampledX || groupRef.current.position.z !== sampledY) {
        if (LOCAL_DEBUG) {
          try {
            const lastSnaps = snaps.slice(Math.max(0, snaps.length - 4)).map(s => ({ ts: s.ts, x: s.x, y: s.y, vx: s.vx, vy: s.vy }));
            console.info("[interp] teleport", {
              id: car.id,
              dist: Math.round(dist),
              from: { x: groupRef.current.position.x, z: groupRef.current.position.z },
              to: { x: sampledX, z: sampledY },
              targetTime,
              bufferLen: snaps.length,
              lastSnaps,
            });
          } catch (e) {
            console.info("[interp] teleport", { id: car.id, dist: Math.round(dist) });
          }
        }
        groupRef.current.position.set(sampledX, sampledZ, sampledY);
        correctionRef.current = null;
        try {
          const gd = (window as any).__GAME_DIAGS = (window as any).__GAME_DIAGS || {};
          gd.teleports = (gd.teleports || 0) + 1;
        } catch (e) {}
      }
    } else if (dist > CORRECT_THRESHOLD) {
      // Moderate drift — start or continue a smooth correction towards
      // the authoritative sampled position instead of snapping instantly.
      const nowMs = Date.now();
      const existing = correctionRef.current;
      // If no active correction or the target changed significantly, start a new one
      if (!existing || Math.hypot(existing.to.x - sampledX, existing.to.z - sampledY) > 0.5) {
        // For the local player, perform a softer reconciliation so input
        // responsiveness remains high. Blend towards the authoritative
        // position instead of fully jumping to it.
        const localBlend = typeof tuner.localBlend === "number" ? tuner.localBlend : 0.5;
        const localCorrectionMs = typeof tuner.localCorrectionMs === "number" ? tuner.localCorrectionMs : Math.min(CORRECTION_MS, 200);

        const toX = isLocal ? (groupRef.current.position.x + (sampledX - groupRef.current.position.x) * localBlend) : sampledX;
        const toZ = isLocal ? (groupRef.current.position.z + (sampledY - groupRef.current.position.z) * localBlend) : sampledY;

        correctionRef.current = {
          active: true,
          start: nowMs,
          duration: isLocal ? localCorrectionMs : CORRECTION_MS,
          from: {
            x: groupRef.current.position.x,
            y: groupRef.current.position.y,
            z: groupRef.current.position.z,
          },
          to: { x: toX, y: sampledZ, z: toZ },
        };
        if (LOCAL_DEBUG) {
          try {
            const lastSnaps = snaps.slice(Math.max(0, snaps.length - 4)).map(s => ({ ts: s.ts, x: s.x, y: s.y, vx: s.vx, vy: s.vy }));
            console.info("[interp] start-correction", {
              id: car.id,
              dist: Math.round(dist),
              from: correctionRef.current.from,
              to: correctionRef.current.to,
              now: nowMs,
              duration: correctionRef.current.duration,
              bufferLen: snaps.length,
              lastSnaps,
            });
          } catch (e) {
            console.info("[interp] start-correction", { id: car.id, dist: Math.round(dist) });
          }
        }
        try {
          const gd = (window as any).__GAME_DIAGS = (window as any).__GAME_DIAGS || {};
          gd.corrections = (gd.corrections || 0) + 1;
        } catch (e) {}
      }

      // apply correction if active
      if (correctionRef.current && correctionRef.current.active) {
        const c = correctionRef.current;
        const elapsed = Math.min(c.duration, Date.now() - c.start);
        const t = Math.max(0, Math.min(1, elapsed / c.duration));
        // smoothstep ease
        const eased = t * t * (3 - 2 * t);
        const nx = c.from.x + (c.to.x - c.from.x) * eased;
        const ny = c.from.y + (c.to.y - c.from.y) * eased;
        const nz = c.from.z + (c.to.z - c.from.z) * eased;
        // Clamp per-frame movement to avoid visual teleporting/jumps. Use
        // a configured max move speed (units/sec) multiplied by `delta`.
        const defaultMaxMove = isMobile ? 18 : 30;
        const maxMoveSpeed = typeof tuner.maxMoveSpeed === "number" ? tuner.maxMoveSpeed : defaultMaxMove; // units/sec
        const maxMove = Math.max(0.001, maxMoveSpeed * delta);
        const curX = groupRef.current.position.x;
        const curZ = groupRef.current.position.z;
        let moveX = nx - curX;
        let moveZ = nz - curZ;
        const moveLen = Math.hypot(moveX, moveZ);
        if (moveLen > maxMove) {
          const scale = maxMove / moveLen;
          moveX *= scale;
          moveZ *= scale;
        }
        groupRef.current.position.set(curX + moveX, ny, curZ + moveZ);
        if (t >= 1) {
          if (LOCAL_DEBUG) {
            console.info("[interp] finish-correction", {
              id: car.id,
              to: c.to,
              elapsed,
            });
          }
          try {
            const gd = (window as any).__GAME_DIAGS = (window as any).__GAME_DIAGS || {};
            gd.correctionsFinished = (gd.correctionsFinished || 0) + 1;
          } catch (e) {}
          correctionRef.current = null;
        }
      }
    } else {
      // Small drift — regular lerp smoothing, but clamp per-frame movement to
      // avoid large jumps when sampled target is far ahead due to out-of-order
      // or late snapshots.
      const target = new THREE.Vector3(sampledX, sampledZ, sampledY);
      const curX = groupRef.current.position.x;
      const curZ = groupRef.current.position.z;
      const desiredMoveX = target.x - curX;
      const desiredMoveZ = target.z - curZ;
      const desiredLen = Math.hypot(desiredMoveX, desiredMoveZ);
      // compute intended lerp step
      const stepX = desiredMoveX * alpha;
      const stepZ = desiredMoveZ * alpha;
      const stepLen = Math.hypot(stepX, stepZ);
      const maxMoveSpeed = typeof tuner.maxMoveSpeed === "number" ? tuner.maxMoveSpeed : 30; // units/sec
      const maxMove = Math.max(0.001, maxMoveSpeed * delta);
      let finalStepX = stepX;
      let finalStepZ = stepZ;
      if (stepLen > maxMove) {
        const s = maxMove / stepLen;
        finalStepX = stepX * s;
        finalStepZ = stepZ * s;
      }
      groupRef.current.position.x = curX + finalStepX;
      groupRef.current.position.z = curZ + finalStepZ;
      groupRef.current.position.y = target.y;
    }

    positionsRef.current.set(car.id, {
      x: groupRef.current.position.x,
      y: groupRef.current.position.z,
    });

    // Clamp visual position to inside the playable area to avoid passing through perimeter walls visually
    const CLAMP_BOUND = 98; // just inside the wall at 100
    if (groupRef.current.position.x > CLAMP_BOUND)
      groupRef.current.position.x = CLAMP_BOUND;
    if (groupRef.current.position.x < -CLAMP_BOUND)
      groupRef.current.position.x = -CLAMP_BOUND;
    if (groupRef.current.position.z > CLAMP_BOUND)
      groupRef.current.position.z = CLAMP_BOUND;
    if (groupRef.current.position.z < -CLAMP_BOUND)
      groupRef.current.position.z = -CLAMP_BOUND;

    const currentRotY = groupRef.current.rotation.y;
    let angleDiff = targetRot.current - currentRotY;
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    groupRef.current.rotation.y += angleDiff * 0.1;
  });

  const isSpeedActive = !!car.activePowerUps?.some(
    (p) => p.type === "speed" && p.expiresAt > Date.now()
  );

  return (
    <group ref={groupRef}>
      <SpeedTrail
        groupRef={groupRef}
        active={isSpeedActive}
        color={trailColor}
      />
      {children}
    </group>
  );
}
