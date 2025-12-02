"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import SnowOverlay from "../components/SnowOverlay";
import ChristmasLights from "../components/ChristmasLights";
import StarryBackground from "../components/StarryBackground";

type LobbyPlayer = {
  id: string;
  name: string;
  ready: boolean;
  color: string;
};

type LobbyState = {
  players: LobbyPlayer[];
  gameState: "lobby" | "racing" | "finished";
};

export default function LobbyPage() {
  const router = useRouter();
  const name =
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("name")
      : null) || "Player";
  const [playerId, setPlayerId] = useState<string>("");
  const [playerColor, setPlayerColor] = useState<string>(() => {
    try {
      if (typeof window !== "undefined") {
        return window.sessionStorage.getItem("playerColor") || "#16a34a";
      }
    } catch (e) {}
    return "#16a34a";
  });
  const [lobbyState, setLobbyState] = useState<LobbyState>({
    players: [],
    gameState: "lobby",
  });
  const [isReady, setIsReady] = useState(false);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const playerColorRef = useRef<string>(playerColor);

  useEffect(() => {
    if (typeof window === "undefined" || playerId) return;
    let id = window.sessionStorage.getItem("playerId");
    if (!id) {
      id = `player-${Math.random().toString(36).substring(2, 11)}`;
      window.sessionStorage.setItem("playerId", id);
    }
    try {
      let col = window.sessionStorage.getItem("playerColor");
      if (!col) {
        const palette = [
          "#ef4444",
          "#f97316",
          "#f59e0b",
          "#84cc16",
          "#06b6d4",
          "#6366f1",
          "#ec4899",
          "#10b981",
        ];
        col = palette[Math.floor(Math.random() * palette.length)];
        window.sessionStorage.setItem("playerColor", col);
      }
      setPlayerColor(col);
    } catch (e) {}
    setPlayerId(id);
  }, [playerId]);

  useEffect(() => {
    if (!playerId) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/lobby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            name,
            ready: isReady,
            color: playerColorRef.current,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          try {
            console.info("[lobby] server ->", {
              matchToken: data.matchToken,
              claimOk: data.claimOk,
              adoptOk: data.adoptOk,
              instanceId: data.instanceId,
              lastRedisConnectMs: data.lastRedisConnectMs,
              gameState: data.gameState,
            });
          } catch (e) {}
          try {
            if (data.matchToken) {
              window.sessionStorage.setItem("matchToken", data.matchToken);
            }
          } catch (e) {}
          setLobbyState({
            players: data.players || [],
            gameState: data.gameState,
          });

          if (data.matchToken) {
            try {
              router.push(`/race?name=${encodeURIComponent(name)}`);
            } catch (e) {}
          } else if (data.gameState === "racing") {
            router.push(`/race?name=${encodeURIComponent(name)}`);
          }
        }
      } catch (error) {
        console.error("Error polling lobby:", error);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [playerId, name, isReady, router]);

  useEffect(() => {
    if (!playerId) return;
    playerColorRef.current = playerColor;
    (async () => {
      try {
        await fetch("/api/lobby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            name,
            ready: isReady,
            color: playerColor,
          }),
        });
      } catch (e) {}
    })();
  }, [playerColor, playerId, name, isReady]);

  const toggleReady = () => {
    setIsReady(!isReady);
  };

  const myPlayer = lobbyState.players.find((p) => p.id === playerId);
  const allReady =
    lobbyState.players.length > 0 && lobbyState.players.every((p) => p.ready);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c1445] via-[#1e3a5f] to-[#0f4035] text-white flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden">
      {/* Background layers */}
      <StarryBackground count={40} />
      <ChristmasLights count={20} position="top" />
      <SnowOverlay count={40} />

      <style>{`
        @keyframes lobby_pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes waiting_dots {
          0%, 20% { opacity: 0; }
          40% { opacity: 1; }
          60%, 100% { opacity: 0; }
        }
        @keyframes ready_bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes card_glow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.5); }
        }
        @keyframes countdown_pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>

      <div className="max-w-2xl w-full space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-4xl">🎄</span>
            <h1 className="text-3xl md:text-4xl font-black">
              <span className="text-red-500">Grand</span>{" "}
              <span className="text-white">Theft</span>{" "}
              <span className="text-green-500">Giftwrap</span>
            </h1>
            <span className="text-4xl">🎄</span>
          </div>
          <p className="text-slate-400 text-sm">Waiting in the workshop...</p>
        </div>

        {/* Player List Card */}
        <div
          className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-white/10"
          style={{
            boxShadow:
              "0 0 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">🎅</span>
              Drivers
            </h2>
            <span className="px-3 py-1 bg-white/10 rounded-full text-sm font-medium">
              {lobbyState.players.length}{" "}
              {lobbyState.players.length === 1 ? "player" : "players"}
            </span>
          </div>

          <div className="space-y-3">
            {lobbyState.players.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🦌</div>
                <p className="text-slate-400">
                  Waiting for drivers
                  <span
                    style={{
                      animation: "waiting_dots 1.4s infinite",
                      animationDelay: "0s",
                    }}
                  >
                    .
                  </span>
                  <span
                    style={{
                      animation: "waiting_dots 1.4s infinite",
                      animationDelay: "0.2s",
                    }}
                  >
                    .
                  </span>
                  <span
                    style={{
                      animation: "waiting_dots 1.4s infinite",
                      animationDelay: "0.4s",
                    }}
                  >
                    .
                  </span>
                </p>
              </div>
            ) : (
              lobbyState.players.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    player.id === playerId
                      ? "bg-blue-500/20 border-2 border-blue-500/50"
                      : "bg-white/5 border border-white/5 hover:bg-white/10"
                  }`}
                  style={
                    player.id === playerId
                      ? { animation: "card_glow 2s ease-in-out infinite" }
                      : {}
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-sm font-mono w-6">
                      #{index + 1}
                    </span>
                    {player.id === playerId ? (
                      <>
                        <button
                          onClick={() => colorInputRef.current?.click()}
                          aria-label="Choose your colour"
                          className="w-10 h-10 rounded-full ring-2 ring-white/30 hover:ring-white/50 focus:outline-none hover:scale-110 transition-all shadow-lg"
                          style={{
                            backgroundColor: player.color,
                            boxShadow: `0 0 15px ${player.color}50`,
                          }}
                        />
                        <input
                          ref={colorInputRef}
                          type="color"
                          value={playerColor}
                          onChange={(e) => {
                            const c = e.target.value;
                            try {
                              window.sessionStorage.setItem("playerColor", c);
                            } catch (err) {}
                            setPlayerColor(c);
                            setLobbyState((prev) => ({
                              ...prev,
                              players: prev.players.map((pp) =>
                                pp.id === playerId ? { ...pp, color: c } : pp
                              ),
                            }));
                          }}
                          className="sr-only"
                          aria-hidden="true"
                        />
                      </>
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full shadow-lg"
                        style={{
                          backgroundColor: player.color,
                          boxShadow: `0 0 10px ${player.color}30`,
                        }}
                      />
                    )}
                    <div>
                      <span className="font-semibold text-lg">
                        {player.name}
                      </span>
                      {player.id === playerId && (
                        <span className="ml-2 text-xs text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    {player.ready ? (
                      <span
                        className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full text-sm font-bold text-green-400 flex items-center gap-2"
                        style={{
                          animation: "ready_bounce 1s ease-in-out infinite",
                        }}
                      >
                        <span>✓</span> Ready!
                      </span>
                    ) : (
                      <span className="px-4 py-2 bg-slate-700/50 rounded-full text-sm text-slate-400">
                        Waiting...
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ready Button */}
        {myPlayer && (
          <div className="text-center space-y-4">
            <button
              onClick={toggleReady}
              className={`w-full md:w-auto px-12 py-5 rounded-xl font-black text-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl ${
                isReady
                  ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                  : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              }`}
              style={{
                boxShadow: isReady
                  ? "0 0 30px rgba(220,38,38,0.4)"
                  : "0 0 30px rgba(34,197,94,0.4)",
              }}
            >
              {isReady ? (
                <span className="flex items-center justify-center gap-3">
                  <span>🛑</span> Cancel Ready
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  <span>🏁</span> Ready Up!
                </span>
              )}
            </button>

            {allReady && (
              <div
                className="inline-flex items-center gap-3 px-6 py-3 bg-green-500/20 border border-green-500/30 rounded-xl"
                style={{ animation: "countdown_pulse 1s ease-in-out infinite" }}
              >
                <span className="text-2xl">🚀</span>
                <span className="text-green-400 font-bold text-lg">
                  All ready! Starting race...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Info Footer */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-4 text-slate-400 text-sm">
            <span className="flex items-center gap-1">
              <span>👥</span> Play with friends
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1">
              <span>🎮</span> Solo play allowed
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            Share this page link to invite others!
          </p>
        </div>

        {/* Decorative bottom */}
        <div className="flex justify-center gap-2 pt-4">
          {["🎁", "⭐", "🔔", "❄️", "🎄"].map((emoji, i) => (
            <span
              key={i}
              className="text-2xl opacity-50"
              style={{
                animation: `ready_bounce ${1 + i * 0.1}s ease-in-out infinite`,
                animationDelay: `${i * 0.15}s`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
