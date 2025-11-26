"use client";

import React, { useEffect, useState, useRef } from "react";

export default function AudioHeaderButton() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) window.addEventListener("pointerdown", onDoc);
    return () => window.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const toggle = () => {
    window.dispatchEvent(new Event("audio:toggle"));
  };
  const stop = () => {
    window.dispatchEvent(new Event("audio:stop"));
  };
  const next = () => {
    window.dispatchEvent(new Event("audio:next"));
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
      const ev: any = new Event("audio:setVolume");
      (ev as any).detail = { volume: v };
      window.dispatchEvent(ev);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup
        aria-expanded={open}
        title={playing ? "Audio: Playing" : "Audio: Paused"}
        className="w-8 h-8 rounded-full bg-white/6 hover:bg-white/12 text-white flex items-center justify-center"
      >
        {playing ? "🔊" : "🔈"}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-48 bg-black/70 p-3 rounded-md border border-white/10 backdrop-blur-sm z-50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-200">Audio</div>
            <div className="text-xs text-slate-400">{playing ? "On" : "Off"}</div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={toggle}
              className="px-2 py-1 rounded bg-white/6 hover:bg-white/12 text-white text-sm"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              onClick={stop}
              className="px-2 py-1 rounded bg-white/6 hover:bg-white/12 text-white text-sm"
            >
              Stop
            </button>
            <button
              onClick={next}
              className="px-2 py-1 rounded bg-white/6 hover:bg-white/12 text-white text-sm"
            >
              Next
            </button>
          </div>
          <div className="text-xs text-slate-300 mb-1">Volume</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVol(Number(e.target.value))}
            className="w-full"
            aria-label="volume"
          />
        </div>
      ) : null}
    </div>
  );
}
