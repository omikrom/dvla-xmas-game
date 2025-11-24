"use client";
import React, { useEffect, useState } from "react";

export default function AudioControls() {
  const [playing, setPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.7);

  useEffect(() => {
    const onStatus = (ev: any) => {
      try {
        const detail = ev.detail || {};
        setPlaying(!!detail.playing);
      } catch (e) {
        setPlaying(false);
      }
    };
    const onVolume = (ev: any) => {
      try {
        const detail = ev.detail || {};
        if (typeof detail.volume === "number") setVolume(detail.volume);
      } catch (e) {}
    };
    window.addEventListener("audio:status", onStatus as any);
    window.addEventListener("audio:volume", onVolume as any);
    return () => {
      window.removeEventListener("audio:status", onStatus as any);
      window.removeEventListener("audio:volume", onVolume as any);
    };
  }, []);

  const toggle = () => {
    window.dispatchEvent(new Event("audio:toggle"));
  };
  const stop = () => {
    window.dispatchEvent(new Event("audio:stop"));
  };
  const setVol = (v: number) => {
    setVolume(v);
    try {
      window.dispatchEvent(
        new CustomEvent("audio:setVolume", {
          detail: { volume: v, fadeMs: 200 },
        })
      );
    } catch (e) {
      // fallback
      const ev: any = new Event("audio:setVolume");
      (ev as any).detail = { volume: v };
      window.dispatchEvent(ev);
    }
  };

  return (
    <div style={{ position: "fixed", right: 16, top: 55, zIndex: 9999 }}>
      <div className="flex items-center gap-2 bg-black/40 p-2 rounded-md border border-white/10 backdrop-blur-sm">
        <button
          onClick={toggle}
          className="px-2 py-1 rounded bg-white/6 hover:bg-white/12 text-white text-sm"
          aria-pressed={playing}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button
          onClick={stop}
          className="px-2 py-1 rounded bg-white/6 hover:bg-white/12 text-white text-sm"
          title="Stop"
        >
          ⏹
        </button>
        <div className="flex items-center gap-2 text-white text-sm">
          <span className="sr-only">Volume</span>
          <input
            aria-label="volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVol(Number(e.target.value))}
            style={{ width: 120 }}
          />
        </div>
      </div>
    </div>
  );
}
