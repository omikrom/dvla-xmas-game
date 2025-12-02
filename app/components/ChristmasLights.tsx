"use client";
import React from "react";

export default function ChristmasLights({
  count = 20,
  position = "top",
}: {
  count?: number;
  position?: "top" | "bottom";
}) {
  const lights = React.useMemo(() => {
    const colors = ["#ef4444", "#22c55e", "#fbbf24", "#3b82f6", "#ec4899"];
    const out: Array<{
      left: string;
      color: string;
      delay: string;
    }> = [];
    for (let i = 0; i < count; i++) {
      const left = (i / (count - 1)) * 100 + "%";
      const color = colors[i % colors.length];
      const delay = (Math.random() * 2).toFixed(2) + "s";
      out.push({ left, color, delay });
    }
    return out;
  }, [count]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed left-0 right-0 z-30 h-12 ${
        position === "top" ? "top-0" : "bottom-0"
      }`}
    >
      <style>{`
        @keyframes xmas_twinkle {
          0%, 100% { opacity: 1; filter: brightness(1.2) drop-shadow(0 0 8px currentColor); }
          50% { opacity: 0.4; filter: brightness(0.8) drop-shadow(0 0 2px currentColor); }
        }
        @keyframes xmas_sway {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
      `}</style>
      {/* Wire/string */}
      <svg
        className="absolute w-full h-6"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        style={{
          top: position === "top" ? 0 : "auto",
          bottom: position === "bottom" ? 0 : "auto",
        }}
      >
        <path
          d="M0,2 Q25,8 50,2 T100,2"
          fill="none"
          stroke="#1f2937"
          strokeWidth="0.3"
        />
      </svg>
      {lights.map((light, i) => (
        <div
          key={`light-${i}`}
          className="absolute"
          style={{
            left: light.left,
            top: position === "top" ? "8px" : "auto",
            bottom: position === "bottom" ? "8px" : "auto",
            transform: "translateX(-50%)",
            animation: `xmas_sway 2s ease-in-out infinite`,
            animationDelay: light.delay,
          }}
        >
          {/* Bulb */}
          <div
            style={{
              width: "12px",
              height: "16px",
              background: light.color,
              borderRadius: "50% 50% 50% 50% / 40% 40% 60% 60%",
              animation: `xmas_twinkle ${
                1.5 + Math.random()
              }s ease-in-out infinite`,
              animationDelay: light.delay,
              color: light.color,
            }}
          />
          {/* Cap */}
          <div
            style={{
              position: "absolute",
              top: "-4px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "8px",
              height: "6px",
              background: "#374151",
              borderRadius: "2px 2px 0 0",
            }}
          />
        </div>
      ))}
    </div>
  );
}
