"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import SnowOverlay from "../components/SnowOverlay";

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

type ColorPickerProps = {
  value: string;
  onChange: (c: string) => void;
};

// Color picker inline is rendered inside the player list for the current user

// (player header avatar removed; color input is inline in the player list)

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
    // Ensure we have a stored color for this player
    try {
      let col = window.sessionStorage.getItem("playerColor");
      if (!col) {
        // pick a default color (green) or random nicer palette
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
    // Poll lobby state (use ref for playerColor so interval remains stable)
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
          const data: LobbyState = await response.json();
          setLobbyState(data);

          // Redirect to race if game started
          if (data.gameState === "racing") {
            router.push(`/race?name=${encodeURIComponent(name)}`);
          }
        }
      } catch (error) {
        console.error("Error polling lobby:", error);
      }
    }, 500); // Poll every 500ms

    return () => clearInterval(interval);
    // Keep interval stable; playerColor is read from ref instead of dependencies
  }, [playerId, name, isReady, router]);

  // Allow sending color updates when playerColor changes
  useEffect(() => {
    if (!playerId) return;
    // keep ref current for polling callback
    playerColorRef.current = playerColor;
    // trigger an immediate update with new color
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#064e3b] to-slate-900 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        <SnowOverlay count={36} />
        <div className="text-center relative">
          <div className="flex items-center justify-center gap-4 mb-2">
            <h1 className="text-4xl font-extrabold">
              <span className="text-[#c60f0f]">Grand </span>
              <span className="text-[#fff]"> Theft</span>{" "}
              <span className="text-[#c60f0f]"> Giftwrap</span>
            </h1>
          </div>
          <p className="text-slate-300 text-lg italic">
            “One night. Zero brakes. All Christmas.”
          </p>

          {/* header is unchanged; color avatar moved into player list */}
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
          <h2 className="text-2xl font-semibold mb-4">
            Players ({lobbyState.players.length})
          </h2>
          <div className="space-y-3">
            {lobbyState.players.length === 0 ? (
              <p className="text-slate-400 text-center py-4">
                Waiting for players...
              </p>
            ) : (
              lobbyState.players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    player.id === playerId
                      ? "bg-blue-500/20 border-2 border-blue-500"
                      : "bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {player.id === playerId ? (
                      <>
                        <button
                          onClick={() => colorInputRef.current?.click()}
                          aria-label="Choose your colour"
                          className="w-8 h-8 rounded-full ring-2 ring-white/20 focus:outline-none hover:scale-105 transition-transform"
                          style={{ backgroundColor: player.color }}
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
                            // optimistic local update so the avatar changes immediately
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
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: player.color }}
                      />
                    )}
                    <span className="font-medium">
                      {player.name}
                      {player.id === playerId && " (You)"}
                    </span>
                  </div>
                  <div>
                    {player.ready ? (
                      <span className="px-4 py-2 bg-green-500 rounded-full text-sm font-semibold">
                        ✓ Ready
                      </span>
                    ) : (
                      <span className="px-4 py-2 bg-slate-600 rounded-full text-sm">
                        Not Ready
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {myPlayer && (
          <div className="text-center space-y-4">
            <button
              onClick={toggleReady}
              className={`px-8 py-4 rounded-lg font-bold text-xl transition-all transform hover:scale-105 shadow-lg ${
                isReady
                  ? "bg-[#b91c1c] hover:bg-[#a01616]"
                  : "bg-[#16a34a] hover:bg-[#128836]"
              }`}
            >
              {isReady ? "Cancel Ready" : "Ready Up!"}
            </button>

            {allReady && (
              <p className="text-green-400 font-semibold animate-pulse text-lg">
                All players ready! Starting race...
              </p>
            )}
          </div>
        )}

        <div className="text-center text-slate-400 text-sm">
          <p>Share this page with friends to play together!</p>
          <p className="mt-2">
            Race starts when everyone is ready — or after the lobby triggers the
            next round.
          </p>
        </div>
      </div>
    </div>
  );
}
