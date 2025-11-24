"use client";

import { useEffect, useRef, useState } from "react";

export default function useJoystick() {
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const [joystick, setJoystick] = useState({ active: false, x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [acceleratorHeld, setAcceleratorHeld] = useState(false);
  const [brakeHeld, setBrakeHeld] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    setIsMobile(m);
  }, []);

  const handleJoystickPointerDown = (e: any) => {
    e.preventDefault();
    setJoystick((j) => ({ ...j, active: true }));
    // capture pointer for multi-touch safety
    try {
      (e.currentTarget as Element)?.setPointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  const handleJoystickPointerMove = (e: any) => {
    if (!joystick.active) return;
    const rect = joystickBaseRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const nx = Math.max(-1, Math.min(1, dx));
    const ny = Math.max(-1, Math.min(1, dy));
    setJoystick({ active: true, x: nx, y: ny });
  };

  const handleJoystickPointerEnd = (e: any) => {
    setJoystick({ active: false, x: 0, y: 0 });
    try {
      (e.currentTarget as Element)?.releasePointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  return {
    joystickBaseRef,
    joystick,
    isMobile,
    acceleratorHeld,
    brakeHeld,
    setAcceleratorHeld,
    setBrakeHeld,
    handleJoystickPointerDown,
    handleJoystickPointerMove,
    handleJoystickPointerEnd,
  } as const;
}
