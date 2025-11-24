import React, { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { DeliveryItem } from "../types";

type Pointer = {
  id: string;
  x: number;
  y: number;
  onScreen: boolean;
  angle: number;
  distance: number;
};

export function DeliveryPointersHelper({
  deliveries,
  onUpdate,
}: {
  deliveries: DeliveryItem[];
  onUpdate: (p: Pointer[]) => void;
}) {
  const { size, camera } = useThree();
  const tmp = useRef(new THREE.Vector3());

  useFrame(() => {
    const pointers: Pointer[] = [];
    const w = size.width;
    const h = size.height;
    const padding = 36; // keep arrows away from screen edge

    for (const d of deliveries) {
      tmp.current.set(d.x || 0, (d.z ?? 0.6) as number, d.y || 0);
      const world = tmp.current.clone();
      const ndc = world.project(camera);

      const onScreen =
        ndc.x >= -1 &&
        ndc.x <= 1 &&
        ndc.y >= -1 &&
        ndc.y <= 1 &&
        ndc.z >= -1 &&
        ndc.z <= 1;

      let sx = (ndc.x * 0.5 + 0.5) * w;
      let sy = (-ndc.y * 0.5 + 0.5) * h;

      let angle = 0;
      if (!onScreen) {
        // compute an angle and clamp to edge
        angle = Math.atan2(ndc.y, ndc.x); // rad
        // clamp to box edge
        const cx = w / 2;
        const cy = h / 2;
        const rx = cx - padding;
        const ry = cy - padding;
        sx = cx + Math.cos(angle) * rx;
        sy = cy - Math.sin(angle) * ry;
      }

      const distance = camera.position.distanceTo(world);

      pointers.push({ id: d.id, x: sx, y: sy, onScreen, angle, distance });
    }

    onUpdate(pointers);
  });

  return null;
}

export function DeliveryPointersOverlay({
  pointers,
}: {
  pointers: Array<{
    id: string;
    x: number;
    y: number;
    onScreen: boolean;
    angle: number;
    distance: number;
  }>;
}) {
  return (
    <div className="pointer-overlay absolute inset-0 pointer-events-none z-40">
      {pointers.map((p) => (
        <div
          key={p.id}
          style={{
            left: p.x,
            top: p.y,
            transform: `translate(-50%,-50%) rotate(${p.angle}rad)`,
          }}
          className="absolute flex items-center justify-center"
        >
          <svg
            width={36}
            height={36}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2 L19 21 L12 17 L5 21 Z"
              fill={p.onScreen ? "#10b981" : "#f97316"}
              opacity={0.95}
            />
          </svg>
        </div>
      ))}
    </div>
  );
}

export default {
  DeliveryPointersHelper,
  DeliveryPointersOverlay,
};
