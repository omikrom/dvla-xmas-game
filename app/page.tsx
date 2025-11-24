"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SnowOverlay from "./components/SnowOverlay";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      router.push(`/lobby?name=${encodeURIComponent(name)}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-900 via-sky-700 to-slate-800">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 px-6 py-12">
        <SnowOverlay count={48} />
        <div className="text-center">
          <div
            style={{ flexDirection: "column" }}
            className="flex items-center justify-center gap-4"
          >
            <img
              src="/logo.png"
              alt="DVLA Grand Theft Giftwrap"
              onError={(e) =>
                ((e.currentTarget as HTMLImageElement).style.display = "none")
              }
              className="w-20 h-20 object-contain"
            />
            <h1 className="text-5xl font-extrabold text-white tracking-tight">
              The DVLA's
            </h1>
            <h1 className="text-5xl font-extrabold text-white tracking-tight">
              <span className="text-[#c60f0f]"> Grand</span>{" "}
              <span className="text-[#fff]"> Theft</span>
              <span className="text-[#c60f0f]"> Giftwrap</span>
            </h1>
          </div>
          <p className="mt-3 text-slate-200 text-lg italic">
            “One night. Zero brakes. All Christmas.”
          </p>
        </div>

        <form onSubmit={handleJoinGame} className="w-full space-y-4">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-6 py-4 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              required
              maxLength={20}
            />
          </div>

          <button
            type="submit"
            className="w-full relative overflow-hidden px-6 py-3 rounded-lg text-white font-extrabold text-lg transition-all transform hover:scale-105 shadow-2xl flex items-center justify-center"
          >
            {/* Candy-cane tiled background */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage: "url('/candy-cane.png')",
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: 0.95,
              }}
            />
            {/* Semi-transparent festive overlay for legibility */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(185,28,28,0.45), rgba(22,163,74,0.45))",
                mixBlendMode: "multiply",
              }}
            />
            <span className="relative z-10 flex items-center gap-3">
              <span>Let's go!</span>
            </span>
          </button>
        </form>

        <div className="w-full flex items-center justify-between gap-4 mt-4">
          <div className="text-slate-300 text-sm">
            <p>Use WASD or Arrow Keys to drive</p>
            <p className="mt-1">One night. Zero brakes. All Christmas.</p>
          </div>
          <div className="flex items-center gap-3" />
        </div>
      </main>
    </div>
  );
}
