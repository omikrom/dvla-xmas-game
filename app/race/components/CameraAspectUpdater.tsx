"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export default function CameraAspectUpdater({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const { camera, gl } = useThree();

  useEffect(() => {
    if (!camera) return;

    // Prefer the actual canvas client size when available. This is more
    // reliable when the canvas is rotated via CSS (100vh/100vw) or when the
    // visual viewport differs from the layout viewport.
    let actualW = width;
    let actualH = height;
    try {
      const canvas = (gl as any)?.domElement as HTMLCanvasElement | undefined;
      if (canvas && canvas.clientWidth && canvas.clientHeight) {
        actualW = canvas.clientWidth;
        actualH = canvas.clientHeight;
      }
    } catch (e) {
      // ignore and fallback to provided width/height
    }

    if (!actualW || !actualH) return;
    if ((camera as any).isPerspectiveCamera) {
      (camera as THREE.PerspectiveCamera).aspect = actualW / actualH;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [width, height, camera, gl]);

  return null;
}
