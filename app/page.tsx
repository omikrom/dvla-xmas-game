"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SnowOverlay from "./components/SnowOverlay";
import ChristmasLights from "./components/ChristmasLights";
import StarryBackground from "./components/StarryBackground";
import HeroCharacter from "./components/HeroCharacter";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isHovering, setIsHovering] = useState(false);

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      router.push(`/lobby?name=${encodeURIComponent(name)}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0c1445] via-[#1e3a5f] to-[#0f4035] overflow-hidden">
      {/* Animated gradient overlay */}
      <div
        className="fixed inset-0 z-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(22,163,74,0.2) 0%, transparent 40%)",
        }}
      />

      {/* Background layers */}
      <StarryBackground count={60} />
      <ChristmasLights count={25} position="top" />
      <SnowOverlay count={60} />

      {/* 3D Reindeer Hero - Large background element */}
      <div
        className="fixed inset-0 pointer-events-none flex items-center justify-center"
        style={{ zIndex: 2, opacity: 0.25 }}
      >
        <HeroCharacter style={{ width: "80vw", height: "90vh" }} />
      </div>

      <main className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 px-6 py-8">
        {/* Title Section */}
        <div className="text-center space-y-4">
          <style>{`
            @keyframes title_glow {
              0%, 100% { text-shadow: 0 0 20px rgba(220,38,38,0.5), 0 0 40px rgba(220,38,38,0.3); }
              50% { text-shadow: 0 0 30px rgba(220,38,38,0.8), 0 0 60px rgba(220,38,38,0.5); }
            }
            @keyframes title_shimmer {
              0% { background-position: -200% center; }
              100% { background-position: 200% center; }
            }
            @keyframes float_sleigh {
              0%, 100% { transform: translateY(0) rotate(-2deg); }
              50% { transform: translateY(-8px) rotate(2deg); }
            }
            @keyframes pulse_button {
              0%, 100% { box-shadow: 0 0 20px rgba(220,38,38,0.4), inset 0 0 20px rgba(255,255,255,0.1); }
              50% { box-shadow: 0 0 40px rgba(220,38,38,0.6), inset 0 0 30px rgba(255,255,255,0.2); }
            }
            @keyframes candy_stripe_move {
              0% { background-position: 0 0; }
              100% { background-position: 40px 0; }
            }
          `}</style>

          {/* Sleigh emoji decoration */}
          <div
            className="text-6xl mb-2"
            style={{ animation: "float_sleigh 3s ease-in-out infinite" }}
          >
            🛷
          </div>

          <h1
            className="text-5xl md:text-6xl font-black tracking-tight"
            style={{ animation: "title_glow 2s ease-in-out infinite" }}
          >
            <span className="text-red-600">Grand</span>{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: "linear-gradient(90deg, #fff, #fef3c7, #fff)",
                backgroundSize: "200% auto",
                animation: "title_shimmer 3s linear infinite",
              }}
            >
              Theft
            </span>{" "}
            <span className="text-green-500">Giftwrap</span>
          </h1>

          <p className="text-slate-300 text-lg md:text-xl italic font-light">
            &quot;One night. Zero brakes. All Christmas.&quot;
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <span className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-red-300 text-sm">
              🎮 Multiplayer
            </span>
            <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-300 text-sm">
              🎁 Deliver Gifts
            </span>
            <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-300 text-sm">
              💥 Chaos Mode
            </span>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleJoinGame} className="w-full space-y-4 mt-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-green-500 to-red-600 rounded-xl opacity-40 group-hover:opacity-60 blur transition-opacity" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What's your name, driver?"
              className="relative w-full px-6 py-4 rounded-xl bg-slate-900/80 backdrop-blur-sm border-2 border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-green-500/50 text-lg font-medium transition-all"
              required
              maxLength={20}
            />
          </div>

          <button
            type="submit"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="w-full relative overflow-hidden px-8 py-5 rounded-xl text-white font-black text-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background:
                "linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #16a34a 100%)",
              animation: isHovering
                ? "pulse_button 1s ease-in-out infinite"
                : "none",
              boxShadow:
                "0 0 30px rgba(220,38,38,0.3), 0 10px 40px rgba(0,0,0,0.3)",
            }}
          >
            {/* Candy cane stripe overlay */}
            <span
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.3) 10px, rgba(255,255,255,0.3) 20px)",
                backgroundSize: "40px 40px",
                animation: isHovering
                  ? "candy_stripe_move 1s linear infinite"
                  : "none",
              }}
            />
            {/* Shimmer effect */}
            <span
              className="absolute inset-0 opacity-30"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                backgroundSize: "200% 100%",
                animation: "title_shimmer 2s linear infinite",
              }}
            />
            <span className="relative z-10 flex items-center justify-center gap-3">
              <span className="text-2xl">🚗</span>
              <span>Let&apos;s Go!</span>
              <span className="text-2xl">🎄</span>
            </span>
          </button>
        </form>

        {/* Controls hint */}
        <div className="w-full mt-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <div className="flex items-center justify-center gap-6 text-slate-300">
            <div className="text-center">
              <div className="flex gap-1 justify-center mb-1">
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">
                  W
                </kbd>
              </div>
              <div className="flex gap-1 justify-center">
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">
                  A
                </kbd>
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">
                  S
                </kbd>
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">
                  D
                </kbd>
              </div>
              <p className="text-xs mt-1 text-slate-400">Drive</p>
            </div>
            <div className="text-slate-600">or</div>
            <div className="text-center">
              <div className="flex gap-1 justify-center mb-1">
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">
                  ↑
                </kbd>
              </div>
              <div className="flex gap-1 justify-center">
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">
                  ←
                </kbd>
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">
                  ↓
                </kbd>
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono">
                  →
                </kbd>
              </div>
              <p className="text-xs mt-1 text-slate-400">Arrows</p>
            </div>
            <div className="text-slate-600">|</div>
            <div className="text-center">
              <div className="text-2xl mb-1">📱</div>
              <p className="text-xs text-slate-400">Touch</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-slate-500 text-sm text-center">
          Race against friends • Deliver presents • Cause festive mayhem
        </p>

        {/* Leaderboard link */}
        <button
          onClick={() => router.push("/leaderboard")}
          className="mt-2 px-4 py-2 text-yellow-400 hover:text-yellow-300 text-sm font-medium transition-colors flex items-center gap-2 hover:underline"
        >
          <span>🏆</span>
          <span>View Leaderboard</span>
        </button>
      </main>
    </div>
  );
}
