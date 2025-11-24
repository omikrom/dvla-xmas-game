"use client";
import React from "react";

export default function SnowOverlay({
  count = 48,
  maxSize = 18,
  minSize = 8,
}: {
  count?: number;
  maxSize?: number;
  minSize?: number;
}) {
  const flakes = React.useMemo(() => {
    const out: Array<{
      left: string;
      delay: string;
      dur: string;
      size: string;
      opacity: number;
    }> = [];
    for (let i = 0; i < count; i++) {
      const left = Math.round(Math.random() * 100) + "%";
      const delay = (Math.random() * -20).toFixed(2) + "s"; // negative so some are mid-fall
      const dur = (6 + Math.random() * 8).toFixed(2) + "s";
      const size =
        Math.round(minSize + Math.random() * (maxSize - minSize)) + "px";
      const opacity = 0.4 + Math.random() * 0.6;
      out.push({ left, delay, dur, size, opacity });
    }
    return out;
  }, [count, maxSize, minSize]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      <style>{`
        @keyframes dvgf_snow_fall{0%{transform:translateY(-10vh) translateX(0) rotate(0deg)}100%{transform:translateY(110vh) translateX(20px) rotate(360deg)}}
      `}</style>
      {flakes.map((f, i) => (
        <div
          key={`snow-${i}`}
          style={{
            position: "absolute",
            left: f.left,
            top: "-10vh",
            fontSize: f.size,
            opacity: f.opacity,
            color: "#fff",
            transform: `translate3d(0,0,0)`,
            animationName: "dvgf_snow_fall",
            animationDuration: f.dur,
            animationTimingFunction: "linear",
            animationDelay: f.delay,
            animationIterationCount: "infinite",
          }}
        >
          ❆
        </div>
      ))}
    </div>
  );
}
