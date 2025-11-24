"use client";

import React from "react";

export default function MobileControls({
  isMobile,
  joystickBaseRef,
  joystick,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  acceleratorHeld,
  brakeHeld,
  setAcceleratorHeld,
  setBrakeHeld,
}: {
  isMobile: boolean;
  joystickBaseRef: React.RefObject<HTMLDivElement | null>;
  joystick: { active: boolean; x: number; y: number };
  onPointerDown: any;
  onPointerMove: any;
  onPointerEnd: any;
  acceleratorHeld: boolean;
  brakeHeld: boolean;
  setAcceleratorHeld: (v: boolean) => void;
  setBrakeHeld: (v: boolean) => void;
}) {
  if (!isMobile) return null;
  return (
    <div
      className={`absolute inset-x-0 bottom-4 px-4 flex items-end justify-between pointer-events-none`}
    >
      <div className="pointer-events-auto flex items-end gap-4 w-full h-full justify-around">
        <div
          ref={joystickBaseRef}
          className="relative w-28 h-28 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerLeave={onPointerEnd}
        >
          <div
            className="absolute w-14 h-14 rounded-full bg-white/40 border border-white/60 shadow-inner"
            style={{
              left: `calc(50% + ${joystick.x * 36}px)`,
              top: `calc(50% + ${joystick.y * 36}px)`,
              transform: "translate(-50%, -50%)",
            }}
          />
          <div className="absolute inset-4 rounded-full border border-white/10" />
        </div>
        <div className="flex gap-3 items-center">
          <button
            type="button"
            className={`px-3 py-2 rounded-2xl min-w-[96px] font-semibold text-white bg-gradient-to-b from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/40 border border-white/10 ${
              acceleratorHeld ? "scale-95" : ""
            }`}
            onPointerDown={(e) => {
              e.preventDefault();
              setAcceleratorHeld(true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              setAcceleratorHeld(false);
            }}
            onPointerLeave={() => setAcceleratorHeld(false)}
          >
            Accelerator
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-2xl min-w-[96px] font-semibold text-white bg-gradient-to-b from-red-400 to-rose-500 shadow-lg shadow-rose-500/40 border border-white/10 ${
              brakeHeld ? "scale-95" : ""
            }`}
            onPointerDown={(e) => {
              e.preventDefault();
              setBrakeHeld(true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              setBrakeHeld(false);
            }}
            onPointerLeave={() => setBrakeHeld(false)}
          >
            Brake
          </button>
        </div>
      </div>
    </div>
  );
}
