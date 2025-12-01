"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerCar } from "../types";

export default function FollowCamera({
  playerId,
  cars,
  isMobile = false,
  mobileHeight = 6,
}: {
  playerId: string;
  cars: PlayerCar[];
  isMobile?: boolean;
  mobileHeight?: number;
}) {
  const { camera } = useThree();
  const targetPositionRef = useRef(new THREE.Vector3());
  const targetLookAtRef = useRef(new THREE.Vector3());
  
  // Pre-smoothed player position to handle server jumps
  const smoothedPlayerPos = useRef(new THREE.Vector3());
  const smoothedPlayerAngle = useRef(0);
  const initialized = useRef(false);

  // Reusable temporaries to avoid allocations per-frame
  const tmpDir = useRef(new THREE.Vector3());
  const tmpQuat = useRef(new THREE.Quaternion());
  const desiredQuat = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    const playerCar = cars.find((car) => car.id === playerId);
    if (!playerCar) return;

    const rawX = playerCar.x;
    const rawY = playerCar.y;
    const rawZ = playerCar.z || 0.8;
    const rawAngle = playerCar.angle;

    // Initialize on first frame
    if (!initialized.current) {
      smoothedPlayerPos.current.set(rawX, rawZ, rawY);
      smoothedPlayerAngle.current = rawAngle;
      initialized.current = true;
    }

    // Pre-smooth the player position to handle server position jumps
    // This creates a buffer between raw server data and camera tracking
    const preSmoothSpeed = isMobile ? 5 : 6;
    const preSmoothing = 1 - Math.exp(-preSmoothSpeed * Math.max(0, delta));
    
    smoothedPlayerPos.current.x += (rawX - smoothedPlayerPos.current.x) * preSmoothing;
    smoothedPlayerPos.current.y += (rawZ - smoothedPlayerPos.current.y) * preSmoothing;
    smoothedPlayerPos.current.z += (rawY - smoothedPlayerPos.current.z) * preSmoothing;
    
    // Smooth angle with shortest-path interpolation
    let angleDiff = rawAngle - smoothedPlayerAngle.current;
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    smoothedPlayerAngle.current += angleDiff * preSmoothing;

    // Use smoothed values for camera calculations
    const playerX = smoothedPlayerPos.current.x;
    const playerY = smoothedPlayerPos.current.z; // game Y -> three Z
    const playerZ = smoothedPlayerPos.current.y; // game Z -> three Y
    const playerAngle = smoothedPlayerAngle.current;

    // Follow tuning: bring the camera closer and lower so the car stays in view.
    const distance = isMobile ? 12 : 13;
    const height = isMobile ? mobileHeight : 6;
    const carAngle = playerAngle + Math.PI;
    const targetX = playerX - Math.sin(carAngle) * distance;
    const targetZ = playerY - Math.cos(carAngle) * distance;
    const targetY = playerZ + height;

    // Clamp camera within map bounds so it doesn't pass through perimeter walls.
    const BOUNDS = { minX: -90, maxX: 90, minZ: -90, maxZ: 90 };
    const clampedX = Math.min(Math.max(targetX, BOUNDS.minX), BOUNDS.maxX);
    const clampedZ = Math.min(Math.max(targetZ, BOUNDS.minZ), BOUNDS.maxZ);
    targetPositionRef.current.set(clampedX, targetY, clampedZ);

    // Use exponential smoothing based on frame delta to make movement
    // framerate-independent and reduce perceived jitter on mobile.
    const posSmoothSpeed = isMobile ? 4.5 : 7.0; // reduced for smoother motion
    const rotSmoothSpeed = isMobile ? 4.5 : 8.0; // reduced for smoother motion
    const tPos = 1 - Math.exp(-posSmoothSpeed * Math.max(0, delta));

    camera.position.lerp(targetPositionRef.current, tPos);

    // Compute desired look-at target and slerp camera orientation toward it
    const lookAtYOffset = 0.6;
    const lookAtForward = 0.8;
    const lookAtX = playerX + Math.sin(playerAngle) * lookAtForward;
    const lookAtZ = playerY + Math.cos(playerAngle) * lookAtForward;
    targetLookAtRef.current.set(
      lookAtX,
      playerZ + lookAtYOffset,
      lookAtZ
    );

    // Build desired quaternion for camera to look at the target point
    const camPos = camera.position;
    const m = new THREE.Matrix4();
    m.lookAt(camPos, targetLookAtRef.current, camera.up);
    desiredQuat.current.setFromRotationMatrix(m);

    // Slerp toward desired orientation using delta-based smoothing
    const tRot = 1 - Math.exp(-rotSmoothSpeed * Math.max(0, delta));
    camera.quaternion.slerp(desiredQuat.current, tRot);
  });

  return null;
}
