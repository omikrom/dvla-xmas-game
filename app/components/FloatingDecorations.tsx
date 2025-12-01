"use client";
import React from "react";

const DECORATIONS = [
  { emoji: "🎁", size: 28 },
  { emoji: "🎄", size: 32 },
  { emoji: "⭐", size: 24 },
  { emoji: "🔔", size: 26 },
  { emoji: "❄️", size: 22 },
  { emoji: "🎅", size: 30 },
  { emoji: "🦌", size: 28 },
  { emoji: "🍬", size: 24 },
];

export default function FloatingDecorations({ count = 12 }: { count?: number }) {
  const items = React.useMemo(() => {
    const out: Array<{
      left: string;
      top: string;
      emoji: string;
      size: number;
      delay: string;
      duration: string;
    }> = [];
    for (let i = 0; i < count; i++) {
      const dec = DECORATIONS[Math.floor(Math.random() * DECORATIONS.length)];
      out.push({
        left: Math.random() * 90 + 5 + "%",
        top: Math.random() * 80 + 10 + "%",
        emoji: dec.emoji,
        size: dec.size + Math.random() * 10,
        delay: (Math.random() * 5).toFixed(2) + "s",
        duration: (4 + Math.random() * 4).toFixed(2) + "s",
      });
    }
    return out;
  }, [count]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
    >
      <style>{`
        @keyframes float_bob {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-15px) rotate(5deg); }
        }
        @keyframes float_spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {items.map((item, i) => (
        <div
          key={`dec-${i}`}
          style={{
            position: "absolute",
            left: item.left,
            top: item.top,
            fontSize: item.size + "px",
            opacity: 0.6,
            animation: item.emoji === "⭐" 
              ? `float_spin ${item.duration} linear infinite`
              : `float_bob ${item.duration} ease-in-out infinite`,
            animationDelay: item.delay,
          }}
        >
          {item.emoji}
        </div>
      ))}
    </div>
  );
}
