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
        <div className="flex gap-3 items-end">
          {/* Accelerator pedal (right) */}
          <div
            role="button"
            aria-label="Accelerator"
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault();
              setAcceleratorHeld(true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              setAcceleratorHeld(false);
            }}
            onPointerLeave={() => setAcceleratorHeld(false)}
            className="relative w-24 h-36 touch-none select-none"
          >
            <div
              className="absolute inset-0 rounded-lg overflow-hidden"
              style={{
                background: "linear-gradient(180deg,#111827,#0b1220)",
                boxShadow:
                  "inset 0 6px 14px rgba(0,0,0,0.6), 0 6px 18px rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* decorative slats */}
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  right: 6,
                  top: 8,
                  bottom: 8,
                  borderRadius: 8,
                  background:
                    "repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 6px, rgba(0,0,0,0.06) 6px 12px)",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingBottom: 8,
                }}
              >
                <div
                  className={`w-full rounded-md bg-gradient-to-b from-green-400 to-emerald-500 shadow-md`}
                  style={{
                    height: acceleratorHeld ? 8 : 18,
                    transition: "height 120ms ease",
                    boxShadow: acceleratorHeld
                      ? "inset 0 2px 6px rgba(0,0,0,0.5)"
                      : "inset 0 6px 10px rgba(0,0,0,0.6)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Brake pedal (left) */}
          <div
            role="button"
            aria-label="Brake"
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault();
              setBrakeHeld(true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              setBrakeHeld(false);
            }}
            onPointerLeave={() => setBrakeHeld(false)}
            className="relative w-24 h-36 touch-none select-none"
          >
            <div
              className="absolute inset-0 rounded-lg overflow-hidden"
              style={{
                background: "linear-gradient(180deg,#111827,#0b1220)",
                boxShadow:
                  "inset 0 6px 14px rgba(0,0,0,0.6), 0 6px 18px rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  right: 6,
                  top: 8,
                  bottom: 8,
                  borderRadius: 8,
                  background:
                    "repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 6px, rgba(0,0,0,0.06) 6px 12px)",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingBottom: 8,
                }}
              >
                <div
                  className={`w-full rounded-md bg-gradient-to-b from-rose-500 to-red-600 shadow-md`}
                  style={{
                    height: brakeHeld ? 8 : 18,
                    transition: "height 120ms ease",
                    boxShadow: brakeHeld
                      ? "inset 0 2px 6px rgba(0,0,0,0.5)"
                      : "inset 0 6px 10px rgba(0,0,0,0.6)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
