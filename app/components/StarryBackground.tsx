"use client";
import React from "react";

export default function StarryBackground({ count = 50 }: { count?: number }) {
  const stars = React.useMemo(() => {
    const out: Array<{
      left: string;
      top: string;
      size: number;
      delay: string;
      duration: string;
    }> = [];
    for (let i = 0; i < count; i++) {
      out.push({
        left: Math.random() * 100 + "%",
        top: Math.random() * 60 + "%", // Keep stars in upper portion
        size: 1 + Math.random() * 2,
        delay: (Math.random() * 3).toFixed(2) + "s",
        duration: (1 + Math.random() * 2).toFixed(2) + "s",
      });
    }
    return out;
  }, [count]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <style>{`
        @keyframes star_twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
      {stars.map((star, i) => (
        <div
          key={`star-${i}`}
          style={{
            position: "absolute",
            left: star.left,
            top: star.top,
            width: star.size + "px",
            height: star.size + "px",
            background: "#fff",
            borderRadius: "50%",
            boxShadow: "0 0 4px 1px rgba(255,255,255,0.5)",
            animation: `star_twinkle ${star.duration} ease-in-out infinite`,
            animationDelay: star.delay,
          }}
        />
      ))}
    </div>
  );
}
