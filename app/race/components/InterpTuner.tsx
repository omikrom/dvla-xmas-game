"use client";

import React, { useEffect, useState } from "react";

function readStored(name: string, fallback: number) {
  try {
    const s = sessionStorage.getItem("interp_tuner:" + name);
    if (s != null) return Number(s);
  } catch (e) {}
  return fallback;
}

function writeStored(name: string, v: number) {
  try {
    sessionStorage.setItem("interp_tuner:" + name, String(v));
  } catch (e) {}
}

export default function InterpTuner({ visible }: { visible: boolean }) {
  const [interpolationDelay, setInterpolationDelay] = useState<number>(
    readStored("delay", 285)
  );
  const [correctionMs, setCorrectionMs] = useState<number>(
    readStored("correctionMs", 83)
  );
  const [correctThreshold, setCorrectThreshold] = useState<number>(
    readStored("correctThreshold", 15)
  );
  const [teleportThreshold, setTeleportThreshold] = useState<number>(
    readStored("teleportThreshold", 25)
  );
  const [predSpeed, setPredSpeed] = useState<number>(readStored("predSpeed", 6));
  const [predDt, setPredDt] = useState<number>(readStored("predDt", 125));
  const [presentTau, setPresentTau] = useState<number>(readStored("presentTau", 387));

  // Ensure sessionStorage holds sensible defaults for these tuner keys so the
  // runtime reads the user's preferred values even before manual adjustment.
  useEffect(() => {
    try {
      const defaults: { key: string; val: number }[] = [
        { key: "delay", val: 285 },
        { key: "correctionMs", val: 83 },
        { key: "correctThreshold", val: 15 },
        { key: "teleportThreshold", val: 25 },
        { key: "predSpeed", val: 6 },
        { key: "predDt", val: 125 },
        { key: "presentTau", val: 387 },
      ];
      defaults.forEach(({ key, val }) => {
        const existing = sessionStorage.getItem("interp_tuner:" + key);
        if (existing == null) writeStored(key, val);
      });
    } catch (e) {}
  }, []);

  useEffect(() => {
    // write to window global so runtime components can read
    (window as any).__GAME_TUNER = (window as any).__GAME_TUNER || {};
    (window as any).__GAME_TUNER.interpolationDelay = interpolationDelay;
    (window as any).__GAME_TUNER.correctionMs = correctionMs;
    (window as any).__GAME_TUNER.correctThreshold = correctThreshold;
    (window as any).__GAME_TUNER.teleportThreshold = teleportThreshold;
    (window as any).__GAME_TUNER.predSpeed = predSpeed;
    // predDt in ms
    (window as any).__GAME_TUNER.predDt = predDt;
    // presentTau in ms
    (window as any).__GAME_TUNER.presentTau = presentTau;
  }, [interpolationDelay, correctionMs, correctThreshold, teleportThreshold, predSpeed, predDt, presentTau]);

  useEffect(() => {
    writeStored("delay", interpolationDelay);
    writeStored("correctionMs", correctionMs);
    writeStored("correctThreshold", correctThreshold);
    writeStored("teleportThreshold", teleportThreshold);
    writeStored("predSpeed", predSpeed);
    writeStored("predDt", predDt);
    writeStored("presentTau", presentTau);
  }, [interpolationDelay, correctionMs, correctThreshold, teleportThreshold, predSpeed, predDt, presentTau]);

  if (!visible) return null;

  return (
    <div className="fixed right-4 top-4 z-60 w-80 bg-black/60 text-white p-3 rounded border border-white/5 text-sm">
      <div className="font-semibold mb-2">Interpolation Tuner</div>
      <div className="space-y-2">
        <label className="flex items-center justify-between">
          <span>Interpolation Delay (ms)</span>
          <input
            type="range"
            min={50}
            max={600}
            value={interpolationDelay}
            onChange={(e) => setInterpolationDelay(Number(e.target.value))}
          />
          <span className="ml-2 w-12 text-right">{interpolationDelay}</span>
        </label>

        <label className="flex items-center justify-between">
          <span>Correction ms</span>
          <input
            type="range"
            min={50}
            max={1000}
            value={correctionMs}
            onChange={(e) => setCorrectionMs(Number(e.target.value))}
          />
          <span className="ml-2 w-12 text-right">{correctionMs}</span>
        </label>

        <label className="flex items-center justify-between">
          <span>Correction Threshold</span>
          <input
            type="range"
            min={0}
            max={40}
            value={correctThreshold}
            onChange={(e) => setCorrectThreshold(Number(e.target.value))}
          />
          <span className="ml-2 w-12 text-right">{correctThreshold}</span>
        </label>

        <label className="flex items-center justify-between">
          <span>Teleport Threshold</span>
          <input
            type="range"
            min={10}
            max={200}
            value={teleportThreshold}
            onChange={(e) => setTeleportThreshold(Number(e.target.value))}
          />
          <span className="ml-2 w-12 text-right">{teleportThreshold}</span>
        </label>

        <label className="flex items-center justify-between">
          <span>Local Predict Speed</span>
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={predSpeed}
            onChange={(e) => setPredSpeed(Number(e.target.value))}
          />
          <span className="ml-2 w-12 text-right">{predSpeed}</span>
        </label>

        <label className="flex items-center justify-between">
          <span>Local Predict Dt (ms)</span>
          <input
            type="range"
            min={10}
            max={200}
            value={predDt}
            onChange={(e) => setPredDt(Number(e.target.value))}
          />
          <span className="ml-2 w-12 text-right">{predDt}</span>
        </label>

        <label className="flex items-center justify-between">
          <span>Present Smooth Tau (ms)</span>
          <input
            type="range"
            min={20}
            max={500}
            value={presentTau}
            onChange={(e) => setPresentTau(Number(e.target.value))}
          />
          <span className="ml-2 w-12 text-right">{presentTau}</span>
        </label>
      </div>
    </div>
  );
}
