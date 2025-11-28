"use client";

import React, { useEffect, useRef, useState } from "react";

type Resp = any;

export default function GameDebugPanel({
  initialPlayerId,
  initialMatchToken,
}: {
  initialPlayerId?: string;
  initialMatchToken?: string;
}) {
  const [playerId, setPlayerId] = useState(initialPlayerId || "");
  const [name, setName] = useState("Player");
  const [steer, setSteer] = useState<number>(0);
  const [throttle, setThrottle] = useState<number>(0);
  const [matchToken, setMatchToken] = useState(initialMatchToken || "");
  const [debugPlayerId, setDebugPlayerId] = useState("");
  const [simulateLatencyMs, setSimulateLatencyMs] = useState("");
  const [lastResponse, setLastResponse] = useState<Resp | null>(null);
  const [playersList, setPlayersList] = useState<any[] | null>(null);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(500);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  // Fetch initial status on mount so the panel shows players/matchToken
  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildBody = () => ({
    playerId,
    name,
    steer,
    throttle,
    matchToken,
    clientSendTs: Date.now(),
    debugPlayerId: debugPlayerId || undefined,
  });

  async function fetchStatus() {
    try {
      const q = simulateLatencyMs
        ? `?simulateLatencyMs=${encodeURIComponent(simulateLatencyMs)}`
        : "";
      const res = await fetch(`/api/game${q}`, { method: "GET" });
      const json = await res.json();
      setLastResponse(json);
      if (Array.isArray(json.players)) {
        setPlayersList(json.players);
        if (!playerId && json.players.length > 0) {
          setPlayerId(json.players[0].id);
        }
        if (!matchToken && json.matchToken) setMatchToken(json.matchToken);
      }
    } catch (e) {
      console.warn("[debug panel] status fetch failed", e);
    }
  }

  async function sendOnce() {
    try {
      const body = buildBody();
      console.log("[debug panel] send ->", body);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (simulateLatencyMs)
        headers["x-simulate-latency-ms"] = String(simulateLatencyMs);
      const res = await fetch("/api/game", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch (e) {
        json = { status: res.status, text: await res.text() };
      }
      console.log("[debug panel] resp ->", json);
      setLastResponse(json);
      // refresh players list after POST
      fetchStatus();
    } catch (e) {
      console.error("[debug panel] error ->", e);
      setLastResponse({ error: String(e) });
    }
  }

  async function createAndRegisterLocalPlayer() {
    try {
      // generate a stable-but-random id
      const id = `dbg-${Math.random().toString(36).slice(2, 10)}`;
      const body = {
        playerId: id,
        name: name || "Player",
        steer: 0,
        throttle: 0,
        matchToken: matchToken || undefined,
        clientSendTs: Date.now(),
      };
      console.log("[debug panel] creating local player ->", body);
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch (e) {
        json = { status: res.status, text: await res.text() };
      }
      console.log("[debug panel] create resp ->", json);
      setLastResponse(json);
      if (json && Array.isArray(json.players)) {
        setPlayersList(json.players);
      }
      // set local inputs so subsequent Send Once uses this id
      setPlayerId(id);
      setDebugPlayerId(id);
      try {
        sessionStorage.setItem("playerId", id);
      } catch (e) {}
    } catch (e) {
      console.error("[debug panel] create player failed", e);
    }
  }

  function startPolling() {
    if (polling) return;
    setPolling(true);
    // fetch status immediately and then start poll
    fetchStatus();
    pollRef.current = window.setInterval(() => {
      sendOnce();
    }, pollIntervalMs);
  }

  function stopPolling() {
    setPolling(false);
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Helpers to render a compact status header
  const maskToken = (t?: string | null) => {
    if (!t) return null;
    try {
      // show only prefix and suffix short parts
      return `${t.slice(0, 8)}...${t.slice(-8)}`;
    } catch (e) {
      return t;
    }
  };

  const formatMs = (ms?: number | null) => {
    if (ms == null) return "-";
    if (ms <= 0) return "0s";
    const s = Math.round(ms / 1000);
    return `${s}s`;
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 9999,
        width: 420,
        maxWidth: "calc(100% - 24px)",
        background: "rgba(0,0,0,0.8)",
        color: "#fff",
        padding: 12,
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Game Debug Panel</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ fontSize: 11, opacity: 0.9 }}>playerId</label>
          <input
            placeholder="playerId"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, opacity: 0.9 }}>matchToken</label>
          <input
            placeholder="matchToken"
            value={matchToken}
            onChange={(e) => setMatchToken(e.target.value)}
          />
        </div>
        <input
          placeholder="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="debugPlayerId"
          value={debugPlayerId}
          onChange={(e) => setDebugPlayerId(e.target.value)}
        />
        <input
          type="number"
          step="0.01"
          placeholder="steer (-1..1)"
          value={String(steer)}
          onChange={(e) => setSteer(Number(e.target.value))}
        />
        <input
          type="number"
          step="0.01"
          placeholder="throttle (0..1)"
          value={String(throttle)}
          onChange={(e) => setThrottle(Number(e.target.value))}
        />
        <input
          placeholder="simulate latency ms"
          value={simulateLatencyMs}
          onChange={(e) => setSimulateLatencyMs(e.target.value)}
        />
        <input
          type="number"
          placeholder="poll ms"
          value={String(pollIntervalMs)}
          onChange={(e) => setPollIntervalMs(Number(e.target.value))}
        />
      </div>

      {/* Players list */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, marginBottom: 6 }}>Players</div>
        <div
          style={{
            maxHeight: 120,
            overflow: "auto",
            background: "rgba(255,255,255,0.02)",
            padding: 6,
            borderRadius: 6,
          }}
        >
          {playersList && playersList.length > 0 ? (
            playersList.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                }}
              >
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 700 }}>{p.name || "(unnamed)"}</div>
                  <div style={{ fontSize: 11, color: "#ddd" }}>
                    {p.id}
                    {p.hidden ? " (hidden)" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => {
                      setPlayerId(p.id);
                      setDebugPlayerId(p.id);
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Select
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: "#999" }}>
              No players in room
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={sendOnce} style={{ flex: 1 }}>
          Send Once
        </button>
        <button onClick={createAndRegisterLocalPlayer} style={{ flex: 1 }}>
          Create Local Player
        </button>
        <button
          onClick={polling ? stopPolling : startPolling}
          style={{ flex: 1 }}
        >
          {polling ? "Stop Poll" : "Start Poll"}
        </button>
        <button
          onClick={() => {
            setLastResponse(null);
          }}
          style={{ flex: 1 }}
        >
          Clear
        </button>
      </div>

      {/* Status header */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {(() => {
            const gs = lastResponse?.gameState as string | undefined | null;
            const color =
              gs === "racing"
                ? "#22c55e"
                : gs === "finished"
                ? "#ef4444"
                : "#f59e0b";
            return (
              <div
                style={{
                  background: color,
                  color: "#000",
                  padding: "4px 8px",
                  borderRadius: 6,
                  fontWeight: 700,
                }}
              >
                {gs || "-"}
              </div>
            );
          })()}

          <div style={{ fontSize: 12, color: "#ddd" }}>
            FPS:{" "}
            <span style={{ fontFamily: "monospace" }}>
              {lastResponse?.serverFps ?? "-"}
            </span>
          </div>

          <div style={{ fontSize: 12, color: "#ddd" }}>
            Timer:{" "}
            <span style={{ fontFamily: "monospace" }}>
              {formatMs(lastResponse?.timer?.timeRemainingMs)}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right", fontSize: 12, color: "#bbb" }}>
          <div>
            instance:{" "}
            <span style={{ fontFamily: "monospace" }}>
              {lastResponse?.instanceId ?? "-"}
            </span>
          </div>
          <div>
            token:{" "}
            <span style={{ fontFamily: "monospace" }}>
              {maskToken(
                lastResponse?.matchToken ??
                  lastResponse?.sharedToken ??
                  matchToken
              ) ?? "-"}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          maxHeight: 320,
          overflow: "auto",
          background: "rgba(255,255,255,0.03)",
          padding: 8,
          borderRadius: 6,
        }}
      >
        <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.9 }}>
          Last response
        </div>
        <pre
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}
        >
          {lastResponse
            ? JSON.stringify(lastResponse, null, 2)
            : "(no response yet)"}
        </pre>
      </div>
    </div>
  );
}
