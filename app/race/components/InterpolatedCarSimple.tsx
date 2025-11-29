"use client";

import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import SpeedTrail from "./SpeedTrail";
import {
  SERVER_PERIODIC_PHYSICS_MS,
  BASE_ACCELERATION,
  BASE_DECELERATION,
  BASE_MAX_SPEED,
  BASE_TURN_SPEED,
  GROUND_HEIGHT,
  CLIENT_CORRECTION_DURATION_MS,
  CLIENT_MAX_EXTRAPOLATION_MS,
  CLIENT_REPLAY_SUBSTEPS,
  CLIENT_BIG_CORRECTION_DIST,
  CLIENT_BIG_CORRECTION_MAX_MS,
  CLIENT_POS_SMOOTH_TAU_MS,
} from "@/lib/physicsConstants";

// helper: simulate a single step of our simple client-side physics
function getTurnFactor(speed: number, max: number) {
  const ratio = Math.min(1, Math.abs(speed) / Math.max(1, max));
  return Math.max(0.25, ratio);
}
function simulateStep(state: any, input: any, dt: number) {
  const ACC = BASE_ACCELERATION;
  const DEC = BASE_DECELERATION;
  const MAX_SPEED = BASE_MAX_SPEED;
  const TURN = BASE_TURN_SPEED;
  const s = { x: state.x, y: state.y, angle: state.angle, speed: state.speed };
  if ((input.throttle || 0) > 0) {
    s.speed += (input.throttle || 0) * ACC * dt;
  } else if ((input.throttle || 0) < 0) {
    s.speed += (input.throttle || 0) * DEC * dt;
  } else {
    if (s.speed > 0) s.speed = Math.max(0, s.speed - DEC * dt);
    else s.speed = Math.min(0, s.speed + DEC * dt);
  }
  s.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, s.speed));
  s.angle += (input.steer || 0) * TURN * dt * getTurnFactor(s.speed, MAX_SPEED);
  s.x += -Math.sin(s.angle) * s.speed * dt;
  s.y += -Math.cos(s.angle) * s.speed * dt;
  return s;
}

export default function InterpolatedCarSimple({
  car,
  children,
  positionsRef,
  snapshotsRef,
  playerInputRef,
  localPlayerId,
  interpolationDelayRef,
  trailColor,
}: any) {
  const groupRef = useRef<THREE.Group | null>(null);

  // lightweight predicted position for the local player
  const localPred = useRef({ x: car.x, y: car.y, angle: car.angle, z: car.z ?? 0.3, speed: car.speed ?? 0 });
  // pending local inputs not yet acknowledged by server
  const pendingInputs = useRef<Array<any>>([]);
  const lastEnqueuedSeq = useRef<number | null>(null);
  const lastAckSeq = useRef<number | null>(null);
  const correction = useRef<any>(null);
  const renderRef = useRef<{ x: number; y: number; z: number; angle: number } | null>(null);

  // On mount snap to server position
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(car.x, car.z ?? 0.3, car.y);
    g.rotation.y = car.angle;
    positionsRef.current.set(car.id, { x: car.x, y: car.y });
    // initialize local predict state
    localPred.current.x = car.x;
    localPred.current.y = car.y;
    localPred.current.z = car.z ?? 0.3;
    localPred.current.angle = car.angle;
    localPred.current.speed = car.speed ?? 0;
  }, []);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const isLocal = car?.id === localPlayerId;

    // Local player: client-side prediction + reconciliation
    if (isLocal) {
      const inp = playerInputRef?.current;
      if (inp && typeof inp.seq === "number") {
        if (lastEnqueuedSeq.current !== inp.seq) {
          pendingInputs.current.push({ seq: inp.seq, steer: inp.steer || 0, throttle: inp.throttle || 0 });
          lastEnqueuedSeq.current = inp.seq;
        }
      }

      // pick the most recent input to visualize immediately
      const current = pendingInputs.current.length ? pendingInputs.current[pendingInputs.current.length - 1] : (playerInputRef?.current || { steer: 0, throttle: 0 });
      const frameDt = Math.min(0.1, dt);

      // integrate locally (use shared constants for closer match)
      if ((current.throttle || 0) > 0) localPred.current.speed += (current.throttle || 0) * BASE_ACCELERATION * frameDt;
      else if ((current.throttle || 0) < 0) localPred.current.speed += (current.throttle || 0) * BASE_DECELERATION * frameDt;
      else {
        if (localPred.current.speed > 0) localPred.current.speed = Math.max(0, localPred.current.speed - BASE_DECELERATION * frameDt);
        else localPred.current.speed = Math.min(0, localPred.current.speed + BASE_DECELERATION * frameDt);
      }
      localPred.current.speed = Math.max(-BASE_MAX_SPEED, Math.min(BASE_MAX_SPEED, localPred.current.speed));
      localPred.current.angle += (current.steer || 0) * BASE_TURN_SPEED * frameDt * getTurnFactor(localPred.current.speed, BASE_MAX_SPEED);
      localPred.current.x += -Math.sin(localPred.current.angle) * localPred.current.speed * frameDt;
      localPred.current.y += -Math.cos(localPred.current.angle) * localPred.current.speed * frameDt;

      // apply correction smoothing (ease-out)
      if (correction.current) {
        const nowMs = Date.now();
        const elapsed = nowMs - correction.current.start;
        const rawT = Math.min(1, elapsed / correction.current.duration);
        const easeT = 1 - Math.pow(1 - rawT, 2);
        localPred.current.x = correction.current.from.x + (correction.current.to.x - correction.current.from.x) * easeT;
        localPred.current.y = correction.current.from.y + (correction.current.to.y - correction.current.from.y) * easeT;
        localPred.current.angle = correction.current.from.angle + (correction.current.to.angle - correction.current.from.angle) * easeT;
        localPred.current.speed = correction.current.to.speed;
        if (rawT >= 1) correction.current = null;
      }

      // apply to scene
      g.position.x = localPred.current.x;
      g.position.z = localPred.current.y;
      g.position.y = localPred.current.z;
      g.rotation.y = localPred.current.angle;
      positionsRef.current.set(car.id, { x: g.position.x, y: g.position.z });

      // reconciliation when server ack arrives
      const serverAck = typeof car?.lastProcessedInput === "number" ? car.lastProcessedInput : null;
      if (serverAck !== null && serverAck !== lastAckSeq.current) {
        pendingInputs.current = pendingInputs.current.filter((p) => p.seq > serverAck);
        lastAckSeq.current = serverAck;

        let reconciled = { x: car.x, y: car.y, angle: car.angle, speed: car.speed ?? 0 };
        const TICK = SERVER_PERIODIC_PHYSICS_MS / 1000;
        const SUBSTEPS = CLIENT_REPLAY_SUBSTEPS || 4;
        for (const p of pendingInputs.current) {
          let s = reconciled;
          const subDt = TICK / SUBSTEPS;
          for (let k = 0; k < SUBSTEPS; k++) s = simulateStep(s, p, subDt);
          reconciled = s;
        }

        const dx = reconciled.x - localPred.current.x;
        const dy = reconciled.y - localPred.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const bigDist = CLIENT_BIG_CORRECTION_DIST || 1.5;
        if (dist > bigDist) {
          const dur = Math.min(CLIENT_BIG_CORRECTION_MAX_MS || 300, Math.max(80, Math.round(dist * 120)));
          correction.current = {
            from: { x: localPred.current.x, y: localPred.current.y, angle: localPred.current.angle },
            to: { x: reconciled.x, y: reconciled.y, angle: reconciled.angle, speed: reconciled.speed },
            start: Date.now(),
            duration: dur,
          };
        } else {
          correction.current = {
            from: { x: localPred.current.x, y: localPred.current.y, angle: localPred.current.angle },
            to: { x: reconciled.x, y: reconciled.y, angle: reconciled.angle, speed: reconciled.speed },
            start: Date.now(),
            duration: CLIENT_CORRECTION_DURATION_MS,
          };
        }
      }

      return;
    }

    // Remote players: Hermite interpolation with short extrapolation
    const snaps: any[] = snapshotsRef?.current?.get(car?.id) || [];
    if (snaps.length >= 2) {
      const nowTs = Date.now();
      const delay = (interpolationDelayRef && interpolationDelayRef.current) || 120;
      const targetTime = nowTs - delay;
      let i = 0;
      while (i < snaps.length - 1 && snaps[i + 1].ts < targetTime) i++;
      const a = snaps[i];
      const b = snaps[Math.min(i + 1, snaps.length - 1)];
      const span = Math.max(1, b.ts - a.ts);
      const t = Math.min(1, Math.max(0, (targetTime - a.ts) / span));

      const lastSnap = snaps[snaps.length - 1];
      let targetPos: { x: number; y: number; z: number; angle: number } | null = null;
      if (targetTime > lastSnap.ts) {
        const dtMs = Math.min(CLIENT_MAX_EXTRAPOLATION_MS, targetTime - lastSnap.ts);
        const dtSec = dtMs / 1000;
        const speed = lastSnap.speed ?? 0;
        const angle = lastSnap.angle ?? 0;
        targetPos = {
          x: lastSnap.x + -Math.sin(angle) * speed * dtSec,
          y: lastSnap.y + -Math.cos(angle) * speed * dtSec,
          z: lastSnap.z ?? GROUND_HEIGHT,
          angle,
        };
      } else {
        // Hermite interpolation
        const spanSec = Math.max(0.001, (b.ts - a.ts) / 1000);
        const va = { x: (b.x - a.x) / spanSec, y: (b.y - a.y) / spanSec };
        let vb = { x: va.x, y: va.y };
        const idxBplus = Math.min(i + 2, snaps.length - 1);
        if (idxBplus > i + 1) {
          const c = snaps[idxBplus];
          const span2 = Math.max(0.001, (c.ts - b.ts) / 1000);
          vb = { x: (c.x - b.x) / span2, y: (c.y - b.y) / span2 };
        }
        const tt = t;
        const tt2 = tt * tt;
        const tt3 = tt2 * tt;
        const h00 = 2 * tt3 - 3 * tt2 + 1;
        const h10 = tt3 - 2 * tt2 + tt;
        const h01 = -2 * tt3 + 3 * tt2;
        const h11 = tt3 - tt2;
        const mScale = spanSec;
        const ma = { x: va.x * mScale, y: va.y * mScale };
        const mb = { x: vb.x * mScale, y: vb.y * mScale };
        
        const px = h00 * a.x + h10 * ma.x + h01 * b.x + h11 * mb.x;
        const pz = h00 * a.y + h10 * ma.y + h01 * b.y + h11 * mb.y;
        const py = (a.z ?? GROUND_HEIGHT) + ((b.z ?? GROUND_HEIGHT) - (a.z ?? GROUND_HEIGHT)) * tt;
        const pang = typeof a.angle === "number" && typeof b.angle === "number" ? (() => {
          let d = b.angle - a.angle;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          const eased = 1 - Math.pow(1 - tt, 2);
          return a.angle + d * eased;
        })() : car.angle;
        targetPos = { x: px, y: pz, z: py, angle: pang };
      }

      // apply exponential low-pass to reduce jitter
      const tau = (CLIENT_POS_SMOOTH_TAU_MS || 80) / 1000;
      const alpha = 1 - Math.exp(-dt / Math.max(1e-6, tau));
      if (targetPos) {
        if (!renderRef.current) renderRef.current = { x: targetPos.x, y: targetPos.y, z: targetPos.z, angle: targetPos.angle };
        else {
          renderRef.current.x += (targetPos.x - renderRef.current.x) * alpha;
          renderRef.current.y += (targetPos.y - renderRef.current.y) * alpha;
          renderRef.current.z += (targetPos.z - renderRef.current.z) * alpha;
          let da = targetPos.angle - renderRef.current.angle;
          if (da > Math.PI) da -= Math.PI * 2;
          if (da < -Math.PI) da += Math.PI * 2;
          renderRef.current.angle += da * alpha;
        }
        g.position.x = renderRef.current.x;
        g.position.z = renderRef.current.y;
        g.position.y = renderRef.current.z;
        g.rotation.y = renderRef.current.angle;
      }
    } else {
      g.position.x = car.x;
      g.position.z = car.y;
      g.position.y = car.z ?? 0.3;
      g.rotation.y = car.angle;
    }

    positionsRef.current.set(car.id, { x: g.position.x, y: g.position.z });
  });

  const speedActive = !!car?.activePowerUps?.some((p: any) => p.type === "speed" && (p.expiresAt ?? 0) > Date.now());

  return (
    <group ref={groupRef}>
      <SpeedTrail groupRef={groupRef} active={speedActive} color={trailColor} />
      {children}
    </group>
  );
}
