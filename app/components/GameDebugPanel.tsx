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
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(500);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
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

  async function sendOnce() {
    try {
      const body = buildBody();
      console.log("[debug panel] send ->", body);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (simulateLatencyMs) headers["x-simulate-latency-ms"] = String(simulateLatencyMs);
      const res = await fetch("/api/game", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json();
      console.log("[debug panel] resp ->", json);
      setLastResponse(json);
    } catch (e) {
      console.error("[debug panel] error ->", e);
      setLastResponse({ error: String(e) });
    }
  }

  function startPolling() {
    if (polling) return;
    setPolling(true);
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
    <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 9999, width: 420, maxWidth: "calc(100% - 24px)", background: "rgba(0,0,0,0.8)", color: "#fff", padding: 12, borderRadius: 8, fontSize: 13 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Game Debug Panel</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input placeholder="playerId" value={playerId} onChange={(e) => setPlayerId(e.target.value)} />
        <input placeholder="matchToken" value={matchToken} onChange={(e) => setMatchToken(e.target.value)} />
        <input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="debugPlayerId" value={debugPlayerId} onChange={(e) => setDebugPlayerId(e.target.value)} />
        <input type="number" step="0.01" placeholder="steer (-1..1)" value={String(steer)} onChange={(e) => setSteer(Number(e.target.value))} />
        <input type="number" step="0.01" placeholder="throttle (0..1)" value={String(throttle)} onChange={(e) => setThrottle(Number(e.target.value))} />
        <input placeholder="simulate latency ms" value={simulateLatencyMs} onChange={(e) => setSimulateLatencyMs(e.target.value)} />
        <input type="number" placeholder="poll ms" value={String(pollIntervalMs)} onChange={(e) => setPollIntervalMs(Number(e.target.value))} />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={sendOnce} style={{ flex: 1 }}>Send Once</button>
        <button onClick={polling ? stopPolling : startPolling} style={{ flex: 1 }}>{polling ? "Stop Poll" : "Start Poll"}</button>
        <button onClick={() => { setLastResponse(null); }} style={{ flex: 1 }}>Clear</button>
      </div>

      {/* Status header */}
      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {(() => {
            const gs = lastResponse?.gameState as string | undefined | null;
            const color = gs === "racing" ? "#22c55e" : gs === "finished" ? "#ef4444" : "#f59e0b";
            return (
              <div style={{ background: color, color: "#000", padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>{gs || "-"}</div>
            );
          })()}

          <div style={{ fontSize: 12, color: "#ddd" }}>
            FPS: <span style={{ fontFamily: "monospace" }}>{lastResponse?.serverFps ?? "-"}</span>
          </div>

          <div style={{ fontSize: 12, color: "#ddd" }}>
            Timer: <span style={{ fontFamily: "monospace" }}>{formatMs(lastResponse?.timer?.timeRemainingMs)}</span>
          </div>
        </div>

        <div style={{ textAlign: "right", fontSize: 12, color: "#bbb" }}>
          <div>instance: <span style={{ fontFamily: "monospace" }}>{lastResponse?.instanceId ?? "-"}</span></div>
          <div>token: <span style={{ fontFamily: "monospace" }}>{maskToken(lastResponse?.matchToken ?? lastResponse?.sharedToken ?? matchToken) ?? "-"}</span></div>
        </div>
      </div>

      <div style={{ marginTop: 10, maxHeight: 320, overflow: "auto", background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 6 }}>
        <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.9 }}>Last response</div>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{lastResponse ? JSON.stringify(lastResponse, null, 2) : "(no response yet)"}</pre>
      </div>
    </div>
  );
}
