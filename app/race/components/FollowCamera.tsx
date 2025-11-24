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

  // Reusable temporaries to avoid allocations per-frame
  const tmpDir = useRef(new THREE.Vector3());
  const tmpQuat = useRef(new THREE.Quaternion());
  const desiredQuat = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    const playerCar = cars.find((car) => car.id === playerId);
    if (!playerCar) return;

    // Follow tuning: bring the camera closer and lower so the car stays in view.
    // Use stronger lerp smoothing so the camera tilts down more responsively.
    const distance = isMobile ? 12 : 13;
    const height = isMobile ? mobileHeight : 6;
    const carAngle = playerCar.angle + Math.PI;
    const targetX = playerCar.x - Math.sin(carAngle) * distance;
    const targetZ = playerCar.y - Math.cos(carAngle) * distance;
    const targetY = (playerCar.z || 0.8) + height;

    targetPositionRef.current.set(targetX, targetY, targetZ);

    // Use exponential smoothing based on frame delta to make movement
    // framerate-independent and reduce perceived jitter on mobile.
    // Lower speed = smoother (but more lag). Tune these values as needed.
    const posSmoothSpeed = isMobile ? 5.5 : 9.0; // higher = snappier
    const rotSmoothSpeed = isMobile ? 5.5 : 10.0;
    const tPos = 1 - Math.exp(-posSmoothSpeed * Math.max(0, delta));

    camera.position.lerp(targetPositionRef.current, tPos);

    // Compute desired look-at target and slerp camera orientation toward it
    const lookAtYOffset = 0.6;
    const lookAtForward = 0.8;
    const lookAtX = playerCar.x + Math.sin(playerCar.angle) * lookAtForward;
    const lookAtZ = playerCar.y + Math.cos(playerCar.angle) * lookAtForward;
    targetLookAtRef.current.set(
      lookAtX,
      (playerCar.z || 0.8) + lookAtYOffset,
      lookAtZ
    );

    // Build desired quaternion for camera to look at the target point
    // without allocating new matrices/quaternions each frame.
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
