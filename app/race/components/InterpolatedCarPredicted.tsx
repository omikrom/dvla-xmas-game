"use client";

import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import SpeedTrail from "./SpeedTrail";

type InputFrame = {
  seq: number;
  steer: number;
  throttle: number;
  dt: number;
};

// Replicate server-side tuning constants (keep in sync with lib/gameState.ts)
const CAR_DESTROY_THRESHOLD = 150;
const BASE_MAX_SPEED = 25;
const BASE_ACCELERATION = 20;
const BASE_DECELERATION = 15;
const BASE_TURN_SPEED = 3.0;
// Client-side mirror of server periodic physics tick (ms) to align replay steps
const SERVER_TICK_MS = 50;

function getPerformanceScale(damage?: number) {
  const clamped = Math.min(Math.max(damage ?? 0, 0), CAR_DESTROY_THRESHOLD);
  const ratio = clamped / CAR_DESTROY_THRESHOLD;
  return Math.max(0.25, 1 - ratio * 0.7);
}

export default function InterpolatedCarPredicted({
  car,
  snapshotsRef,
  positionsRef,
  playerInputRef,
  localPlayerId,
  children,
  trailColor,
}: any) {
  const groupRef = useRef<THREE.Group | null>(null);

  // local predicted state
  const predicted = useRef({
    x: car.x,
    y: car.y,
    z: car.z ?? 0.3,
    angle: car.angle,
    speed: car.speed ?? 0,
    damage: car.damage ?? 0,
  });

  // authoritative state from server
  const authoritative = useRef({ ...predicted.current });

  // input seq + pending queue
  const seqRef = useRef(0);
  const pendingInputs = useRef<InputFrame[]>([]);

  // reconcile when server sends authoritative update
  useEffect(() => {
    if (!car) return;
    if (car.lastProcessedInput == null) return;

    const newAuthoritative = {
      x: car.x,
      y: car.y,
      z: car.z ?? 0.3,
      angle: car.angle,
      speed: car.speed ?? 0,
      damage: car.damage ?? 0,
    };

    // remove acknowledged inputs
    const beforeLen = pendingInputs.current.length;
    pendingInputs.current = pendingInputs.current.filter(
      (i) => i.seq > (car.lastProcessedInput as number)
    );
    const afterLen = pendingInputs.current.length;

    // replay remaining on top of authoritative snapshot using server-sized steps
    let reconciled = { ...newAuthoritative };
    for (const input of pendingInputs.current) {
      // pending input dt was recorded per-frame (seconds). Replay it in
      // server-sized substeps to better match server integration.
      let remaining = input.dt || 0;
      const stepSec = SERVER_TICK_MS / 1000;
      while (remaining > 1e-6) {
        const step = Math.min(remaining, stepSec);
        reconciled = simulate(reconciled, { steer: input.steer, throttle: input.throttle, dt: step });
        remaining -= step;
      }
    }

    // compute correction (don't snap immediately to avoid visible jitter)
    const dx = reconciled.x - predicted.current.x;
    const dy = reconciled.y - predicted.current.y;
    const dAng = ((reconciled.angle - predicted.current.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const dist = Math.hypot(dx, dy);

    // store authoritative for reference
    authoritative.current = newAuthoritative;

    // if correction is small, apply immediately; otherwise smooth it
    const CORRECTION_THRESHOLD = 0.02; // meters
    const CORRECTION_DURATION = 0.12; // seconds
    if (dist <= CORRECTION_THRESHOLD) {
      predicted.current = reconciled;
    } else {
      // schedule a smooth correction over CORRECTION_DURATION
      correctionRef.current = {
        startTs: performance.now(),
        duration: CORRECTION_DURATION * 1000,
        from: { ...predicted.current },
        to: { ...reconciled },
      };
    }

    // debug: log authoritative vs predicted vs reconciled and pending seqs
    try {
      const pendingSeqs = pendingInputs.current.map((p) => p.seq);
      console.info("[recon] ack=", car.lastProcessedInput, "pending(before->after)=", beforeLen, "->", afterLen, {
        authoritative: { x: newAuthoritative.x.toFixed(3), y: newAuthoritative.y.toFixed(3), angle: newAuthoritative.angle.toFixed(3) },
        predicted: { x: predicted.current.x.toFixed(3), y: predicted.current.y.toFixed(3), angle: predicted.current.angle.toFixed(3) },
        reconciled: { x: reconciled.x.toFixed(3), y: reconciled.y.toFixed(3), angle: reconciled.angle.toFixed(3) },
        pendingSeqs,
        dist: dist.toFixed(3),
      });
    } catch (e) {}
  }, [car?.x, car?.y, car?.z, car?.angle, car?.speed, car?.damage, car?.lastProcessedInput]);

  // initial snap
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(predicted.current.x, predicted.current.z, predicted.current.y);
    g.rotation.y = predicted.current.angle;
  }, []);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;

    const isLocal = car?.id === localPlayerId;

    if (isLocal && playerInputRef?.current) {
      // prefer seq supplied by the page (shared ref) so server and client
      // use the same input sequence numbers; fall back to local seqRef
      const suppliedSeq = (playerInputRef.current as any).seq as number | undefined;
      const seq = typeof suppliedSeq === "number" ? suppliedSeq : ++seqRef.current;

      // build input
      const input: InputFrame = {
        seq,
        steer: playerInputRef.current.steer,
        throttle: playerInputRef.current.throttle,
        dt,
      };

      // apply local prediction
      predicted.current = simulate(predicted.current, input);

      // store pending (will be reconciled when server acknowledges)
      pendingInputs.current.push(input);
      try {
        console.debug(
          "[pred] enqueue ->",
          input.seq,
          { steer: input.steer, throttle: input.throttle, dt: input.dt },
          { px: predicted.current.x.toFixed(3), py: predicted.current.y.toFixed(3), angle: predicted.current.angle.toFixed(3) }
        );
      } catch (e) {}

      // move visuals
      g.position.x = predicted.current.x;
      g.position.z = predicted.current.y;
      g.position.y = predicted.current.z;
      g.rotation.y = predicted.current.angle;

      positionsRef.current.set(car.id, { x: predicted.current.x, y: predicted.current.y });
    } else {
      // fallback to snapshots interpolation for non-local
      const snaps: any[] = snapshotsRef.current.get(car?.id) || [];
      if (snaps.length >= 2) {
        const now = Date.now();
        const targetTime = now - 120;
        let idx = snaps.findIndex((s, i) => s.ts <= targetTime && snaps[i + 1]?.ts >= targetTime);
        if (idx !== -1) {
          const a = snaps[idx];
          const b = snaps[idx + 1];
          const t = (targetTime - a.ts) / Math.max(1, b.ts - a.ts);
          g.position.x = a.x + (b.x - a.x) * t;
          g.position.z = a.y + (b.y - a.y) * t;
          g.position.y = (a.z || 0.3) * (1 - t) + (b.z || 0.3) * t;
          const diff = ((b.angle - a.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          g.rotation.y = a.angle + diff * t;
        } else {
          const last = snaps[snaps.length - 1];
          g.position.x = last.x; g.position.z = last.y; g.position.y = last.z ?? 0.3; g.rotation.y = last.angle;
        }
      } else if (snaps.length === 1) {
        const s = snaps[0];
        g.position.x = s.x; g.position.z = s.y; g.position.y = s.z ?? 0.3; g.rotation.y = s.angle;
      } else {
        // no snapshots: snap to server props
        g.position.x = car.x; g.position.z = car.y; g.position.y = car.z ?? 0.3; g.rotation.y = car.angle;
      }
      positionsRef.current.set(car.id, { x: g.position.x, y: g.position.z });
    }

    // apply any in-flight correction (smoothed reconciliation)
    if (correctionRef.current) {
      const now = performance.now();
      const c = correctionRef.current;
      const t = Math.min(1, (now - c.startTs) / Math.max(1, c.duration));
      // simple lerp
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      predicted.current.x = lerp(c.from.x, c.to.x, t);
      predicted.current.y = lerp(c.from.y, c.to.y, t);
      predicted.current.angle = lerp(c.from.angle, c.to.angle, t);
      predicted.current.speed = lerp(c.from.speed ?? 0, c.to.speed ?? 0, t);
      if (t >= 1) correctionRef.current = null;
      // update visuals to show smoothed correction (local prediction will also update it)
      g.position.x = predicted.current.x;
      g.position.z = predicted.current.y;
      g.position.y = predicted.current.z;
      g.rotation.y = predicted.current.angle;
    }
  });

  // small helper ref for smoothing corrections
  const correctionRef = useRef<{
    startTs: number;
    duration: number;
    from: any;
    to: any;
  } | null>(null);

  const speedActive = !!car?.activePowerUps?.some((p: any) => p.type === "speed" && (p.expiresAt ?? 0) > Date.now());

  return (
    <group ref={groupRef}>
      <SpeedTrail groupRef={groupRef} active={speedActive} color={trailColor} />
      {children}
    </group>
  );
}

// simulate one input frame — client-side prediction using same tuning as server
function simulate(state: any, input: InputFrame | { steer: number; throttle: number; dt?: number }) {
  const dt = (input as any).dt ?? 1 / 60;
  const steer = (input as any).steer ?? 0;
  const throttle = (input as any).throttle ?? 0;

  const damage = state.damage ?? 0;
  const perf = getPerformanceScale(damage);

  // active speed multiplier from powerups (if present on state)
  let speedMultiplier = 1;
  if (state.activePowerUps && Array.isArray(state.activePowerUps)) {
    for (const ap of state.activePowerUps) {
      if (ap.type === "speed" && ap.value) speedMultiplier *= ap.value;
    }
  }

  const maxSpeed = BASE_MAX_SPEED * perf * speedMultiplier;
  const accel = BASE_ACCELERATION * perf * speedMultiplier;
  const decel = BASE_DECELERATION * (0.6 + 0.4 * perf);
  const turnRate = BASE_TURN_SPEED * (0.5 + 0.5 * perf);

  let speed = state.speed ?? 0;
  // throttle handling
  if (throttle > 0) {
    speed += accel * throttle * dt;
    if (speed > maxSpeed) speed = maxSpeed;
  } else if (throttle < 0) {
    speed += accel * throttle * dt;
    if (speed < -maxSpeed * 0.5) speed = -maxSpeed * 0.5;
  } else {
    if (speed > 0) {
      speed -= decel * dt;
      if (speed < 0) speed = 0;
    } else if (speed < 0) {
      speed += decel * dt;
      if (speed > 0) speed = 0;
    }
  }

  // turning (only when moving)
  let angle = state.angle ?? 0;
  if (Math.abs(speed) > 0.5) {
    const turnFactor = Math.min(Math.abs(speed) / maxSpeed, 1);
    angle -= steer * turnRate * dt * turnFactor * Math.sign(speed);
  }

  const nx = -Math.sin(angle) * speed * dt;
  const ny = -Math.cos(angle) * speed * dt;

  return {
    ...state,
    x: (state.x ?? 0) + nx,
    y: (state.y ?? 0) + ny,
    z: state.z ?? 0.3,
    angle,
    speed,
  };
}
