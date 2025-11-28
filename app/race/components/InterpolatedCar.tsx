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
  playerInputRef?: React.MutableRefObject<{
    steer: number;
    throttle: number;
  } | null>;
  trailColor?: string;
  interpolationDelayRef?: React.MutableRefObject<number>;
  isMobile?: boolean;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const LOCAL_DEBUG =
    typeof window !== "undefined" &&
    (!!(window as any).__GAME_DEBUG__ || process.env.NODE_ENV !== "production");
  const correctionRef = useRef<{
    active: boolean;
    start: number;
    duration: number;
    from: { x: number; y: number; z: number };
    to: { x: number; y: number; z: number };
  } | null>(null);
  // persistent snapless offset (visual-only reconciliation)
  const offsetRef = useRef({ x: 0, z: 0 });
  // smoothed authoritative target to avoid stepping when sampled target jumps
  const authTargetRef = useRef({ x: 0, z: 0 });
  // throttle debug-per-frame logging for a single car
  const lastDebugTsRef = useRef<number>(0);
  // NOTE: allow runtime toggle via `window.__GAME_TUNER.useSnapless`
  // default is true for now but reading per-frame lets us flip without a rebuild
  // (the actual read happens in the frame loop below)
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
    const tuner =
      typeof window !== "undefined" ? (window as any).__GAME_TUNER || {} : {};
    const defaultDelay = 220;
    const delayFromRef =
      interpolationDelayRef && typeof interpolationDelayRef.current === "number"
        ? interpolationDelayRef.current
        : defaultDelay;

    // grab snapshots early so we can estimate server tick interval
    const snaps = snapshotsRef?.current?.get(car.id) || [];

    // estimate server tick interval from recent snapshots (ms)
    let serverTickMs = 50;
    if (snaps.length >= 2) {
      const N = Math.min(6, snaps.length - 1);
      let sum = 0;
      for (let i = snaps.length - 1; i >= snaps.length - N; i--) {
        sum += snaps[i].ts - snaps[i - 1].ts;
      }
      serverTickMs = Math.max(10, Math.round(sum / N));
    }

    const approxOneWay =
      typeof tuner.approxOneWay === "number"
        ? tuner.approxOneWay
        : delayFromRef / 2;
    const processingMs =
      typeof tuner.processingMs === "number" ? tuner.processingMs : 0;

    // dynamic interpolation delay aims to cover one-way latency + processing + one server tick
    const dynamicDelay = Math.max(
      80,
      Math.round(
        approxOneWay +
          processingMs * 0.5 +
          serverTickMs +
          (tuner.delayBias || 0)
      )
    );

    const delay =
      typeof tuner.interpolationDelay === "number"
        ? tuner.interpolationDelay
        : typeof interpolationDelayRef?.current === "number"
        ? interpolationDelayRef.current
        : dynamicDelay;

    const now = Date.now();
    let targetTime = now - delay;

    // Avoid extrapolating beyond the last snapshot by clamping targetTime
    // to a small safety margin before the newest snapshot when possible.
    const SAFETY_MARGIN_MS =
      typeof tuner.safetyMarginMs === "number" ? tuner.safetyMarginMs : 30;
    const lastSnap = snaps.length > 0 ? snaps[snaps.length - 1] : null;
    if (lastSnap && targetTime > lastSnap.ts - SAFETY_MARGIN_MS) {
      // clamp targetTime so it sits slightly behind last snapshot
      targetTime = lastSnap.ts - SAFETY_MARGIN_MS;
      if (tuner.debugInterp) {
        try {
          console.debug("[interp] clamped targetTime", {
            id: car.id,
            targetTime,
            lastSnapTs: lastSnap.ts,
            safety: SAFETY_MARGIN_MS,
          });
        } catch (e) {}
      }
    }
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
      try {
        // Apply a short forward-prediction for the local player to make
        // controls feel snappy without changing authoritative state.
        const rawExtra = typeof tuner.extraPredict === "number" ? tuner.extraPredict : null;
        const extraSec = rawExtra != null ? (rawExtra > 2 ? rawExtra / 1000 : rawExtra) : Math.min(0.18, approxOneWay / 1000);
        const speed = typeof (car as any).speed === "number" ? (car as any).speed : 0;
        const predDx = -Math.sin(car.angle || 0) * speed * extraSec;
        const predDy = -Math.cos(car.angle || 0) * speed * extraSec;
        sampledX += predDx;
        sampledY += predDy;
      } catch (e) {}
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
        const tangentScale =
          typeof tuner.tangentScale === "number"
            ? tuner.tangentScale
            : defaultTangent;
        const m0x = (a.vx || 0) * totalSec * tangentScale;
        const m1x = (b.vx || 0) * totalSec * tangentScale;
        const m0y = (a.vy || 0) * totalSec * tangentScale;
        const m1y = (b.vy || 0) * totalSec * tangentScale;

        sampledX = h00 * a.x + h10 * m0x + h01 * b.x + h11 * m1x;
        sampledY = h00 * a.y + h10 * m0y + h01 * b.y + h11 * m1y;
        sampledZ =
          h00 * (a.z || 0.3) +
          h10 * ((a.z || 0.3) * totalSec) +
          h01 * (b.z || 0.3) +
          h11 * ((b.z || 0.3) * totalSec);

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
          // dt to avoid large runaway jumps when snapshots are delayed. Add a
          // small forward-prediction based on measured latency so visuals lead
          // slightly to cover server processing and network delay.
          const baseDt = Math.max(
            0,
            Math.min(0.5, (targetTime - last.ts) / 1000)
          );
          // Accept tuner.extraPredict in seconds or milliseconds (ms>2 treated as ms)
          const rawExtraPredict =
            typeof tuner.extraPredict === "number" ? tuner.extraPredict : null;
          const extraPredictSec =
            rawExtraPredict != null
              ? rawExtraPredict > 2
                ? rawExtraPredict / 1000
                : rawExtraPredict
              : Math.min(0.12, approxOneWay / 1000);
          const dt = Math.min(0.5, baseDt + extraPredictSec);
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
        const MAX_PRED_SPEED =
          typeof tuner.predSpeed === "number" ? tuner.predSpeed : 6; // units/sec
        const predDt =
          typeof tuner.predDt === "number"
            ? Math.max(0.01, tuner.predDt / 1000)
            : 0.125; // ms->s (default 125ms)
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
    const TELEPORT_THRESHOLD =
      typeof tuner.teleportThreshold === "number"
        ? tuner.teleportThreshold
        : 30;
    const CORRECT_THRESHOLD =
      typeof tuner.correctThreshold === "number" ? tuner.correctThreshold : 20;
    const CORRECTION_MS =
      typeof tuner.correctionMs === "number" ? tuner.correctionMs : 60;

    // update target rotation early
    targetRot.current = sampledAngle;

    if (dist > TELEPORT_THRESHOLD) {
      // Very large jump — teleport to authoritative position
      if (
        groupRef.current.position.x !== sampledX ||
        groupRef.current.position.z !== sampledY
      ) {
        if (LOCAL_DEBUG) {
          try {
            const lastSnaps = snaps
              .slice(Math.max(0, snaps.length - 4))
              .map((s) => ({ ts: s.ts, x: s.x, y: s.y, vx: s.vx, vy: s.vy }));
            console.info("[interp] teleport", {
              id: car.id,
              dist: Math.round(dist),
              from: {
                x: groupRef.current.position.x,
                z: groupRef.current.position.z,
              },
              to: { x: sampledX, z: sampledY },
              targetTime,
              bufferLen: snaps.length,
              lastSnaps,
            });
          } catch (e) {
            console.info("[interp] teleport", {
              id: car.id,
              dist: Math.round(dist),
            });
          }
        }
        groupRef.current.position.set(sampledX, sampledZ, sampledY);
        correctionRef.current = null;
        // reset snapless smoothing state on teleport so we don't carry stale offsets
        try {
          offsetRef.current.x = 0;
          offsetRef.current.z = 0;
          authTargetRef.current.x = sampledX;
          authTargetRef.current.z = sampledY;
        } catch (e) {}
        try {
          const gd = ((window as any).__GAME_DIAGS =
            (window as any).__GAME_DIAGS || {});
          gd.teleports = (gd.teleports || 0) + 1;
        } catch (e) {}
      }
    } else {
      const useSimpleInterp =
        typeof tuner.useSimpleInterp === "boolean" ? tuner.useSimpleInterp : false;
      if (useSimpleInterp) {
        // Simple interpolation fallback: lerp toward the sampled authoritative
        // position. This is less clever than the snapless offset approach but
        // often produces smoother, predictable motion and helps isolate
        // issues introduced by the more complex algorithm.
        const targetX = sampledX;
        const targetZ = sampledY;
        const curX = groupRef.current.position.x;
        const curZ = groupRef.current.position.z;
        // frame-independent lerp alpha
        const lerpAlpha = Math.min(1, 1 - Math.exp(-delta * 10));
        const stepX = (targetX - curX) * lerpAlpha;
        const stepZ = (targetZ - curZ) * lerpAlpha;
        const stepLen = Math.hypot(stepX, stepZ);
        const maxMoveSpeed = typeof tuner.maxMoveSpeed === "number" ? tuner.maxMoveSpeed : 40;
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
        groupRef.current.position.y = sampledZ;
        positionsRef.current.set(car.id, {
          x: groupRef.current.position.x,
          y: groupRef.current.position.z,
        });
      } else {
      const useSnapless =
        typeof tuner.useSnapless === "boolean" ? tuner.useSnapless : true;
      if (useSnapless) {
        // Determine authoritative speed (units/sec) from last snapshot when available
        const lastForSpeed =
          lastSnap || (snaps.length ? snaps[snaps.length - 1] : null);
        const authVx =
          lastForSpeed && typeof lastForSpeed.vx === "number"
            ? lastForSpeed.vx
            : 0;
        const authVy =
          lastForSpeed && typeof lastForSpeed.vy === "number"
            ? lastForSpeed.vy
            : 0;
        const authSpeed = Math.hypot(authVx, authVy);

        // normalize extraPredict to seconds (accept ms or seconds)
        const rawExtra =
          typeof tuner.extraPredict === "number" ? tuner.extraPredict : null;
        const extraSec =
          rawExtra != null
            ? rawExtra > 2
              ? rawExtra / 1000
              : rawExtra
            : Math.min(0.18, approxOneWay / 1000);
        const predictedLead = authSpeed * extraSec; // units

        // effective max offset should be at least tuned maxOffset but also cover predicted lead
        const offsetSafety =
          typeof tuner.offsetSafetyFactor === "number"
            ? tuner.offsetSafetyFactor
            : 1.5;
        const configuredMaxOffset =
          typeof tuner.maxOffset === "number" ? tuner.maxOffset : 35;
        const effectiveMaxOffset = Math.max(
          configuredMaxOffset,
          predictedLead * offsetSafety
        );
        // Snapless offset-based correction (continuous exponential decay)
        // Initialize offset to preserve visual continuity if it's currently zero
        const offset = offsetRef.current;
        if (Math.abs(offset.x) < 1e-6 && Math.abs(offset.z) < 1e-6) {
          offset.x = groupRef.current.position.x - sampledX;
          offset.z = groupRef.current.position.z - sampledY;
        }

        // Smooth the authoritative sampled target itself so large incoming
        // steps don't immediately translate to visual jumps. This helps when
        // snapshots arrive sparsely or with jitter.
        const auth = authTargetRef.current;
        if (auth.x === 0 && auth.z === 0) {
          auth.x = sampledX;
          auth.z = sampledY;
        }
        const authLambda =
          typeof tuner.authLambda === "number" ? tuner.authLambda : 18;
        const authSmoothing = 1 - Math.exp(-delta * authLambda);
        auth.x += (sampledX - auth.x) * authSmoothing;
        auth.z += (sampledY - auth.z) * authSmoothing;

        const lambda =
          typeof tuner.offsetLambda === "number" ? tuner.offsetLambda : 9;
        const smoothing = 1 - Math.exp(-delta * lambda);

        // Exponential decay of offset toward zero (frame-rate independent)
        offset.x *= 1 - smoothing;
        offset.z *= 1 - smoothing;

        // Optional: clamp offset so visuals can't drift too far
        const offLen = Math.hypot(offset.x, offset.z);
        if (offLen > effectiveMaxOffset) {
          const s = effectiveMaxOffset / offLen;
          offset.x *= s;
          offset.z *= s;
        }

        // For local player, reduce the applied offset so controls remain responsive
        const localBlend =
          typeof tuner.localBlend === "number" ? tuner.localBlend : 0.6;
        const appliedX = auth.x + (isLocal ? offset.x * localBlend : offset.x);
        const appliedZ = auth.z + (isLocal ? offset.z * localBlend : offset.z);

        // Move toward the applied visual target but clamp per-frame movement
        // to avoid teleport-like jumps when the applied target is far away.
        const curX = groupRef.current.position.x;
        const curZ = groupRef.current.position.z;
        const desiredMoveX = appliedX - curX;
        const desiredMoveZ = appliedZ - curZ;
        const desiredLen = Math.hypot(desiredMoveX, desiredMoveZ);

        // Base max move speed (units/sec), tunable
        const baseSpeed =
          typeof tuner.maxMoveSpeed === "number"
            ? tuner.maxMoveSpeed
            : isMobile
            ? 22
            : 40;
        // Scale move speed based on authoritative object speed so faster cars
        // can be reconciled without excessive clamping.
        const speedFactor =
          typeof tuner.moveSpeedFactor === "number"
            ? tuner.moveSpeedFactor
            : 2.0;
        const effectiveBaseSpeed = Math.max(baseSpeed, authSpeed * speedFactor);
        // Adaptive reach time (ms) - how quickly we want to reach a large gap
        const reachMs =
          typeof tuner.adaptiveReachMs === "number"
            ? tuner.adaptiveReachMs
            : 120;
        // desired speed to cover the gap in ~reachMs
        const desiredSpeed = desiredLen / Math.max(0.001, reachMs / 1000);
        const maxCap = Math.max(effectiveBaseSpeed * 6, effectiveBaseSpeed + 1);
        const appliedSpeed = Math.min(
          Math.max(effectiveBaseSpeed, desiredSpeed),
          maxCap
        );
        const maxMove = Math.max(0.001, appliedSpeed * delta);

        let moveX = desiredMoveX;
        let moveZ = desiredMoveZ;
        if (desiredLen > maxMove) {
          const s = maxMove / desiredLen;
          moveX *= s;
          moveZ *= s;
        }
        groupRef.current.position.x = curX + moveX;
        groupRef.current.position.z = curZ + moveZ;
        groupRef.current.position.y = sampledZ;

        // Optional debug spike capture: record frames where visual distance to
        // authoritative is large so we can inspect snapshots and decisions.
        if (
          tuner.debugInterp &&
          desiredLen >
            (typeof tuner.debugThreshold === "number"
              ? tuner.debugThreshold
              : 6)
        ) {
          try {
            const gd = ((window as any).__GAME_DIAGS =
              (window as any).__GAME_DIAGS || {});
            gd.interpSpikes = gd.interpSpikes || [];
            gd.interpSpikes.push({
              ts: Date.now(),
              id: car.id,
              desiredLen,
              appliedTarget: { x: appliedX, z: appliedZ },
              auth: { x: auth.x, z: auth.z },
              offset: { ...offset },
              cur: { x: curX, z: curZ },
              snaps: snaps
                .slice(Math.max(0, snaps.length - 6))
                .map((s) => ({ ts: s.ts, x: s.x, y: s.y, vx: s.vx, vy: s.vy })),
            });
            // keep size bounded
            if (gd.interpSpikes.length > 100) gd.interpSpikes.shift();
          } catch (e) {}
        }
      } // end useSnapless
      else {
        // fallback to original small-drift lerp if snapless disabled
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
        const maxMoveSpeed =
          typeof tuner.maxMoveSpeed === "number" ? tuner.maxMoveSpeed : 30; // units/sec
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
      }
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

    // Per-frame focused debug logging (throttled). Enable by setting
    // `window.__GAME_TUNER.debugCarId = '<playerId>'` and optionally
    // `window.__GAME_TUNER.debugFrameMs = 200` (ms between logs).
    try {
      const gT = (window as any).__GAME_TUNER || {};
      const debugCarId = gT.debugCarId;
      if (debugCarId && debugCarId === car.id) {
        const nowTs = Date.now();
        const frameMs =
          typeof gT.debugFrameMs === "number" ? gT.debugFrameMs : 200;
        if (nowTs - lastDebugTsRef.current >= frameMs) {
          lastDebugTsRef.current = nowTs;
          const curX = groupRef.current.position.x;
          const curZ = groupRef.current.position.z;
          const appliedTarget = {
            x: authTargetRef.current.x + (offsetRef.current.x || 0),
            z: authTargetRef.current.z + (offsetRef.current.z || 0),
          };
          const snapsLen = snaps.length;
          const desiredLen = Math.hypot(
            appliedTarget.x - curX,
            appliedTarget.z - curZ
          );
          // eslint-disable-next-line no-console
          console.debug("[interp-frame]", {
            id: car.id,
            snapsLen,
            appliedTarget,
            cur: { x: curX, z: curZ },
            desiredLen,
            sampleTime: targetTime,
            tuner: {
              authLambda: gT.authLambda,
              offsetLambda: gT.offsetLambda,
              maxMoveSpeed: gT.maxMoveSpeed,
              adaptiveReachMs: gT.adaptiveReachMs,
            },
          });
        }
      }
    } catch (e) {}

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
