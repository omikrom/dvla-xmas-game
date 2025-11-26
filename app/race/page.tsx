"use client";

export const dynamic = "force-dynamic";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  ContactShadows,
  Stars,
} from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  ChromaticAberration,
  Vignette,
  Noise,
  SMAA,
} from "@react-three/postprocessing";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  PlayerCar,
  DestructibleState,
  TimerState,
  LeaderboardEntry,
  DeliveryItem,
  MatchEvent,
  PowerUpItem,
  ActivePowerUp,
  PowerUpType,
} from "./types";
import { POWERUP_CONFIGS } from "./types";
import {
  clamp,
  describeScoreBurst,
  COUNTDOWN_DURATION_MS,
  GO_FLASH_MS,
  formatMatchTime,
} from "./utils";
import useKeyboardControls, { keys } from "./hooks/useKeyboardControls";
import ScoreBursts from "./components/ScoreBursts";
import CountdownOverlay from "./components/CountdownOverlay";
import InfoModal from "./components/InfoModal";
import { DeliveryDropZones, DeliveryTokens } from "./assets/DeliveryMarkers";
import DVLABuilding from "./assets/DVLABuilding";
import MyBuilding from "./assets/MyBuilding";
import { DestructibleField } from "./assets/scenery/DestructibleField";
import { ChristmasTree } from "./assets/scenery/props/ChristmasTree";
import { Santa } from "./assets/scenery/props/Santa";
import { Reindeer } from "./assets/scenery/props/Reindeer";
import { CarModel } from "./assets/Car";
import { Fire, Smoke, Sparks, Snow } from "./assets/ParticleEffects";
import PowerUp from "./assets/PowerUp";
import CameraAspectUpdater from "./components/CameraAspectUpdater";
import InterpolatedCar from "./components/InterpolatedCar";
import FollowCamera from "./components/FollowCamera";
import DebugPanel from "./components/DebugPanel";
import AudioHeaderButton from "../components/AudioHeaderButton";
import MobileControls from "./components/MobileControls";
import RuntimeDiagnostics from "./components/RuntimeDiagnostics";
import usePowerUps from "./hooks/usePowerUps";
import useInitializePowerUps from "./hooks/useInitializePowerUps";
import usePowerupVisuals from "./hooks/usePowerupVisuals";
// MapLoader removed: maps should be added as static data in code

// CameraAspectUpdater extracted to ./components/CameraAspectUpdater

type JoystickState = {
  active: boolean;
  x: number;
  y: number;
};

// Debug helper: enable console logs only in dev or when `window.__GAME_DEBUG__` is set.
const __IS_GAME_DEBUG__ =
  (typeof window !== "undefined" && !!(window as any).__GAME_DEBUG__) ||
  process.env.NODE_ENV !== "production";
function dbg(...args: any[]) {
  if (__IS_GAME_DEBUG__) console.log(...args);
}

export default function RacePage() {
  const router = useRouter();
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Throttle/logging helpers for preparing polls
    let pollCount = 0;
    let prevPollState: any = null;
    let preparingStartedAt: number | null = null;
    async function check() {
      try {
        const res = await fetch("/api/game", { method: "GET" });
        if (!mounted) return;
        if (!res.ok) {
          // If we couldn't fetch status, send user to homepage as a fallback
          router.replace("/");
          return;
        }
        const data = await res.json();
        // Diagnostic log to help investigate why clients may not see "racing"
        // Visible in browser console; remove when issue is resolved.
        try {
          // Use console.info so it's easy to filter in devtools
          console.info("[race] /api/game GET ->", {
            gameState: data.gameState,
            timer: data.timer,
            matchToken: data.matchToken,
            instanceId: data.instanceId,
          });
        } catch (e) {}
        if (!mounted) return;
        // If the server reports the match is active, continue.
        if (data.gameState === "racing") {
          setPreparing(false);
          return;
        }

        // If the server has a future `startedAt`, stay on this page and show
        // a lightweight preparing screen until the official start time.
        const startedAt = data.timer?.startedAt;
        if (typeof startedAt === "number" && startedAt > Date.now()) {
          setPreparing(true);
          preparingStartedAt = Date.now();
          // Poll until the server transitions to racing or the start time passes
          const poll = setInterval(async () => {
            try {
              const r2 = await fetch("/api/game", { method: "GET" });
              if (!r2.ok) return;
              const d2 = await r2.json();
              // Throttled logging: log on state change or once every 5 polls
              try {
                pollCount++;
                const changed = !prevPollState || prevPollState.gameState !== d2.gameState || JSON.stringify(prevPollState.timer) !== JSON.stringify(d2.timer);
                if (changed || pollCount % 5 === 0) {
                  console.info("[race] poll /api/game ->", {
                    gameState: d2.gameState,
                    timer: d2.timer,
                    matchToken: d2.matchToken,
                    instanceId: d2.instanceId,
                    pollCount,
                  });
                  prevPollState = d2;
                }
                // If we've been preparing for a while, escalate the log to warn every 10s
                if (preparingStartedAt && Date.now() - preparingStartedAt > 10000 && pollCount % 10 === 0) {
                  console.warn("[race] still preparing after >10s, last server timer:", d2.timer, "instanceId:", d2.instanceId);
                }
              } catch (e) {}
              if (d2.gameState === "racing" || (d2.timer && d2.timer.startedAt <= Date.now())) {
                clearInterval(poll);
                setPreparing(false);
                // trigger a reload so the main loop picks up the racing state
                window.location.reload();
              }
            } catch (e) {}
          }, 500);
          return;
        }

        // Not racing and no future start — go back to lobby
        router.replace("/lobby");
      } catch (e) {
        try {
          router.replace("/");
        } catch (err) {}
      }
    }
    check();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <>
      {preparing ? (
        <div className="flex items-center justify-center h-screen">
          <div className="bg-white/90 p-6 rounded shadow text-center">
            <h2 className="text-xl font-semibold">Preparing match…</h2>
            <p className="mt-2 text-sm text-gray-700">Waiting for server to initialize the race.</p>
          </div>
        </div>
      ) : (
        <>
          <RaceClient />
        </>
      )}
      {/* Telemetry HUD hidden in production */}
    </>
  );
}


function FPSCounter({
  interval = 500,
  className,
}: {
  interval?: number;
  className?: string;
}) {
  const [fps, setFps] = useState<number>(0);
  const framesRef = useRef(0);
  const lastRef = useRef<number>(performance.now());
  const emaRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId = 0;
    let visible =
      typeof document !== "undefined"
        ? document.visibilityState === "visible"
        : true;

    function onVisibilityChange() {
      visible = document.visibilityState === "visible";
      // reset counters when hidden so we don't get skewed samples
      if (!visible) {
        framesRef.current = 0;
        lastRef.current = performance.now();
      }
    }

    function loop() {
      if (!visible) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      framesRef.current++;
      const now = performance.now();
      const dt = now - lastRef.current;
      if (dt >= interval) {
        const sampled = (framesRef.current * 1000) / dt;
        // exponential moving average to smooth spikes between 30/60
        const alpha = 0.25;
        emaRef.current =
          emaRef.current == null
            ? sampled
            : alpha * sampled + (1 - alpha) * emaRef.current;
        setFps(Math.round(emaRef.current));
        framesRef.current = 0;
        lastRef.current = now;
      }
      rafId = requestAnimationFrame(loop);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [interval]);

  return (
    <span className={className} title="Frames per second">
      FPS: <span className="font-mono">{fps}</span>
    </span>
  );
}

function RaceClient() {
  // Runtime mount/diagnostic instrumentation to help detect leaks when
  // navigating away/returning. Controlled by `window.__GAME_DEBUG__`.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__RACE_MOUNTS = (window as any).__RACE_MOUNTS || 0;
    (window as any).__RACE_MOUNTS++;
    let loggerId: number | undefined;
    if ((window as any).__GAME_DEBUG__) {
      loggerId = window.setInterval(() => {
        try {
          const diags = (window as any).__GAME_DIAGS || {};
          // Count canvases and nodes under the game canvas to spot duplicates
          const canvases = document.querySelectorAll("canvas").length;
          const gameNodes = document.querySelectorAll(".game-canvas *").length;
          // Log compact summary
          // eslint-disable-next-line no-console
          dbg(
            "[RACE_DIAGS] mounts=",
            (window as any).__RACE_MOUNTS,
            "canvases=",
            canvases,
            "gameNodes=",
            gameNodes,
            "particleSystems=",
            diags.particleSystems || 0,
            "totalParticles=",
            diags.totalParticles || 0,
            "powerUps=",
            (window as any).__GAME_POWERUPS_COUNT || 0
          );
        } catch (e) {}
      }, 3000) as unknown as number;
    }
    return () => {
      (window as any).__RACE_MOUNTS = Math.max(
        0,
        ((window as any).__RACE_MOUNTS || 1) - 1
      );
      if (loggerId) window.clearInterval(loggerId);
    };
  }, []);

  // Prevent the page root from scrolling while the game is mounted (mobile fix).
  // We add/remove the `no-scroll` class defined in `globals.css` so this is
  // reversible when the user navigates away.
  useEffect(() => {
    try {
      document.body.classList.add("no-scroll");
    } catch (e) {}
    return () => {
      try {
        document.body.classList.remove("no-scroll");
      } catch (e) {}
    };
  }, []);

  // Redirect guard: if a player navigates to `/race` while there's no active
  // racing match, send them back to the lobby. This avoids clients entering
  // the race view when the server is still in lobby/finished state.
  const router = useRouter();
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const res = await fetch("/api/game", { method: "GET" });
        if (!mounted) return;
        if (!res.ok) {
          // If we couldn't fetch status, send user to homepage as a fallback
          router.replace("/");
          return;
        }
        const data = await res.json();
        if (!mounted) return;
        // If the server reports the match is active, continue.
        if (data.gameState === "racing") {
          setPreparing(false);
          return;
        }

        // If the server has a future `startedAt`, stay on this page and show
        // a lightweight preparing screen until the official start time.
        const startedAt = data.timer?.startedAt;
        if (typeof startedAt === "number" && startedAt > Date.now()) {
          setPreparing(true);
          // Poll until the server transitions to racing or the start time passes
          const poll = setInterval(async () => {
            try {
              const r2 = await fetch("/api/game", { method: "GET" });
              if (!r2.ok) return;
              const d2 = await r2.json();
              if (d2.gameState === "racing" || (d2.timer && d2.timer.startedAt <= Date.now())) {
                clearInterval(poll);
                setPreparing(false);
                // trigger a reload so the main loop picks up the racing state
                window.location.reload();
              }
            } catch (e) {}
          }, 500);
          return;
        }

        // Not racing and no future start — go back to lobby
        router.replace("/lobby");
      } catch (e) {
        try {
          router.replace("/");
        } catch (err) {}
      }
    }
    check();
    return () => {
      mounted = false;
    };
  }, [router]);

  // Procedural ground textures: subtle noise for roughness/bump maps
  const groundTextures = useMemo(() => {
    if (typeof document === "undefined") {
      const placeholder = new THREE.Texture();
      return {
        map: placeholder,
        bumpMap: placeholder,
        roughnessMap: placeholder,
      } as {
        map: THREE.Texture;
        bumpMap: THREE.Texture;
        roughnessMap: THREE.Texture;
      };
    }

    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return {} as any;

    // Base slightly bluish snow color with subtle variation
    ctx.fillStyle = "#eef6fb";
    ctx.fillRect(0, 0, size, size);

    // Draw subtle noise for roughness/variation
    const image = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      // small random darkening
      const t = Math.floor((Math.random() - 0.5) * 20);
      image.data[i] = Math.max(200, image.data[i] - t); // r
      image.data[i + 1] = Math.max(200, image.data[i + 1] - t + 4); // g
      image.data[i + 2] = Math.max(220, image.data[i + 2] - t + 8); // b
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);

    // Use same canvas as bump/roughness map for a subtle effect
    const bump = tex.clone();
    const rough = tex.clone();

    return { map: tex, bumpMap: bump, roughnessMap: rough } as {
      map: THREE.Texture;
      bumpMap: THREE.Texture;
      roughnessMap: THREE.Texture;
    };
  }, []);

  // Precompute border tree positions (deterministic layout)
  const borderTreePositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    const EDGE = 96; // keep trees a little inside the wall (wall at 100)
    const SPACING = 12;

    // North (+Z)
    for (let x = -EDGE; x <= EDGE; x += SPACING) {
      positions.push([x, 0, EDGE]);
    }

    // South (-Z)
    for (let x = -EDGE; x <= EDGE; x += SPACING) {
      positions.push([x + SPACING / 2, 0, -EDGE]);
    }

    // East (+X)
    for (let z = -EDGE + SPACING; z <= EDGE - SPACING; z += SPACING) {
      positions.push([EDGE, 0, z]);
    }

    // West (-X)
    for (let z = -EDGE + SPACING; z <= EDGE - SPACING; z += SPACING) {
      positions.push([-EDGE, 0, z + SPACING / 3]);
    }

    return positions as [number, number, number][];
  }, []);
  const [cars, setCars] = useState<PlayerCar[]>([]);
  const [destructibles, setDestructibles] = useState<DestructibleState[]>([]);
  const [name, setName] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [gameState, setGameState] = useState<"lobby" | "racing" | "finished">(
    "lobby"
  );
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [hasLoadedScene, setHasLoadedScene] = useState(false);
  const [joystick, setJoystick] = useState<JoystickState>({
    active: false,
    x: 0,
    y: 0,
  });
  const [acceleratorHeld, setAcceleratorHeld] = useState(false);
  const [brakeHeld, setBrakeHeld] = useState(false);
  const [scoreBursts, setScoreBursts] = useState<
    { id: string; amount: number; message: string; createdAt: number }[]
  >([]);
  const [isMobile, setIsMobile] = useState(false);
  const [collisionEffects, setCollisionEffects] = useState<
    Array<{
      id: string;
      position: [number, number, number];
      timestamp: number;
      color?: string;
      kind?: string;
      variant?: string;
    }>
  >([]);
  const [powerUps, setPowerUps] = useState<PowerUpItem[]>([]);
  const [serverFps, setServerFps] = useState<number>(0);

  const prevPowerUpsRef = useRef<Map<string, boolean>>(new Map());
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [debugLogs, setDebugLogs] = useState<
    Array<{
      id: string;
      ts: number;
      level: "info" | "warn" | "error";
      msg: string;
    }>
  >([]);
  const [debugVisible, setDebugVisible] = useState<boolean>(true);
  const [fogMode, setFogMode] = useState<"exp2" | "linear" | "off">("exp2");
  const [fogDensity, setFogDensity] = useState<number>(0.01);
  const [fogStart, setFogStart] = useState<number>(10);
  const [fogEnd, setFogEnd] = useState<number>(80);
  const [nightMode, setNightMode] = useState<boolean>(true);
  const destructiblesRef = useRef<DestructibleState[]>([]);
  const knownEventIdsRef = useRef<Set<string>>(new Set());
  const [infoOpen, setInfoOpen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const interpolatedPositionsRef = useRef<
    Map<string, { x: number; y: number }>
  >(new Map());
  // Short circular buffer of recent authoritative snapshots per-player.
  // Used by `InterpolatedCar` to render a slightly older state (interpolation delay)
  // to hide network jitter. Each entry is { ts, x, y, z, angle, vx, vy }.
  const snapshotsRef = useRef<Map<string, any[]>>(new Map());
  // Track current local input so InterpolatedCar can apply a lightweight
  // prediction offset for the local player to reduce perceived input lag.
  const playerInputRef = useRef<{ steer: number; throttle: number } | null>(
    null
  );
  // Measured RTT (smoothed) used to adapt interpolation delay.
  const rttRef = useRef<number>(150);
  const interpolationDelayRef = useRef<number>(150);
  const matchTokenRef = useRef<string | null>(null);
  useEffect(() => {
    try {
      const mt = sessionStorage.getItem("matchToken");
      if (mt) matchTokenRef.current = mt;
    } catch (e) {}
  }, []);
  const carDamageRef = useRef<Map<string, number>>(new Map());
  const collisionCooldownRef = useRef<Map<string, number>>(new Map());
  const collisionSpeedRef = useRef<Map<string, number>>(new Map());
  const prevSpeedMultRef = useRef<number>(1);
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const joystickValueRef = useRef({ x: 0, y: 0 });
  const rotatorRef = useRef<HTMLDivElement | null>(null);
  const buttonThrottleRef = useRef(0);
  const lastScoreRef = useRef(0);

  const pushDebug = useCallback(
    (msg: string, level: "info" | "warn" | "error" = "info") => {
      if (typeof window === "undefined") return;

      // Client-side debug toggle. You can enable verbose debug messages by
      // setting `sessionStorage.setItem('GAME_DEBUG','1')` or by assigning
      // `window.__GAME_DEBUG = true` in the console. This prevents spamming
      // logs during normal play while allowing quick troubleshooting.
      const CLIENT_DEBUG = ((): boolean => {
        try {
          // Explicit runtime flag (highest precedence)
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          if (typeof window !== "undefined" && (window as any).__GAME_DEBUG) {
            return true;
          }
          // sessionStorage toggle
          if (typeof window !== "undefined") {
            const v = sessionStorage.getItem("GAME_DEBUG");
            if (v === "1" || v === "true") return true;
          }
        } catch (e) {
          // ignore
        }
        // Build-time env check (NEXT_PUBLIC_GAME_LOG_LEVEL=debug)
        try {
          // This will be replaced at build time by Next.js for client bundles
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          if (process.env.NEXT_PUBLIC_GAME_LOG_LEVEL === "debug") return true;
        } catch (e) {}
        return false;
      })();

      if (!CLIENT_DEBUG) return;

      const entry = {
        id: `dbg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ts: Date.now(),
        level,
        msg,
      };
      setDebugLogs((prev) => [entry, ...prev].slice(0, 50));
      if (level === "error") console.error(`[DEBUG] ${msg}`);
      else if (level === "warn") console.warn(`[DEBUG] ${msg}`);
      else dbg(`[DEBUG] ${msg}`);
    },
    []
  );

  // Hotkey to toggle debug panel (` or ~)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeTag =
        (typeof document !== "undefined" &&
          document.activeElement &&
          (document.activeElement as HTMLElement).tagName) ||
        "";
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
      if (e.key === "`" || e.key === "~") {
        setDebugVisible((v) => !v);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Wire powerup handling via extracted hook
  usePowerUps({
    playerId,
    cars,
    powerUps,
    setPowerUps,
    setActivePowerUps,
    setCars,
    pushDebug,
    setCollisionEffects,
  });

  // Detect mobile/tablet on mount
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) || window.innerWidth <= 1024;
      setIsMobile(isMobileDevice);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    const onOrient = () =>
      setIsPortrait(window.innerHeight > window.innerWidth);
    onOrient();
    window.addEventListener("resize", onOrient);
    window.addEventListener("orientationchange", onOrient);
    // debug mobile/orientation changes
    const onMobileChange = () =>
      pushDebug(
        `Device check: isMobile=${window.innerWidth <= 1024} isPortrait=${
          window.innerHeight > window.innerWidth
        }`
      );
    window.addEventListener("resize", onMobileChange);
    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("resize", onOrient);
      window.removeEventListener("orientationchange", onOrient);
      window.removeEventListener("resize", onMobileChange);
    };
  }, []);

  const enqueueScoreBurst = useCallback((amount: number) => {
    if (amount <= 0) return;
    const id = `${Date.now()}-${amount}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const message = describeScoreBurst(amount);
    setScoreBursts((prev) => {
      const now = Date.now();
      const trimmed = prev.filter((burst) => now - burst.createdAt < 1600);
      return [...trimmed, { id, amount, message, createdAt: now }];
    });

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setScoreBursts((prev) => prev.filter((burst) => burst.id !== id));
      }, 2000);
    }
  }, []);

  const setJoystickState = (next: JoystickState) => {
    joystickValueRef.current = { x: next.x, y: next.y };
    setJoystick(next);
    // Debug log joystick vector
    pushDebug(
      `Joystick: active=${next.active} x=${next.x.toFixed(
        2
      )} y=${next.y.toFixed(2)}`
    );
  };

  const resetJoystick = () => {
    setJoystickState({ active: false, x: 0, y: 0 });
  };

  const getJoystickVector = (event: ReactPointerEvent<HTMLDivElement>) => {
    const base = joystickBaseRef.current;
    if (!base) return { x: 0, y: 0 };
    // Map client coordinates through rotator when portrait-rotated so touch positions match visuals
    let clientX = event.clientX;
    let clientY = event.clientY;
    // Prepare debug variables
    let cx = 0;
    let cy = 0;
    let dx = 0;
    let dy = 0;
    let rx = 0;
    let ry = 0;
    if (isMobile && isPortrait && rotatorRef.current) {
      const r = rotatorRef.current.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      dx = event.clientX - cx;
      dy = event.clientY - cy;
      // inverse rotate by -90deg: cos(-90)=0, sin(-90)=-1
      rx = dy; // dx*0 - dy*(-1) => dy
      ry = -dx; // dx*(-1) + dy*0 => -dx
      clientX = rx + cx;
      clientY = ry + cy;
    } else {
      // set center based on base rect when not rotated
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      dx = event.clientX - cx;
      dy = event.clientY - cy;
    }
    const rect = base.getBoundingClientRect();
    const relativeX =
      (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    let relativeY =
      (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    // When simulating mobile with a mouse, invert Y so dragging up yields
    // a forward (negative-by-coordinate) joystick value matching touch input.
    try {
      // React PointerEvent exposes `pointerType` ("mouse" | "touch" | "pen")
      // Use it to correct mouse input when `isMobile` is active.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (event && event.pointerType === "mouse" && isMobile) {
        relativeY = -relativeY;
      }
    } catch (e) {}
    let nextX = clamp(relativeX, -1, 1);
    let nextY = clamp(relativeY, -1, 1);
    const magnitude = Math.hypot(nextX, nextY);
    if (magnitude > 1) {
      nextX /= magnitude;
      nextY /= magnitude;
    }

    // Deadzone + exponential curve to make throttle control less jumpy and
    // allow smooth reversing. Small touches around center are ignored.
    const DEADZONE = 0.12;
    const curve = (v: number) => {
      const s = Math.sign(v);
      const a = Math.abs(v);
      if (a <= DEADZONE) return 0;
      const scaled = (a - DEADZONE) / (1 - DEADZONE);
      // exponent >1 gives finer low-end control
      return s * Math.pow(scaled, 1.5);
    };

    // Joystick debug overlay removed; no global debug object will be set.

    // Horizontal axis: positive = right, negative = left — keep this
    // convention so keyboard and joystick align consistently.
    const finalX = curve(nextX);
    const finalY = curve(nextY);
    return { x: finalX, y: finalY };
  };

  const handleJoystickPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = getJoystickVector(event);
    setJoystickState({ active: true, ...next });
  };

  const handleJoystickPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (!joystick.active) return;
    event.preventDefault();
    const next = getJoystickVector(event);
    setJoystickState({ active: true, ...next });
  };

  const handleJoystickPointerEnd = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetJoystick();
  };

  useKeyboardControls();

  useEffect(() => {
    buttonThrottleRef.current =
      (acceleratorHeld ? 1 : 0) + (brakeHeld ? -1 : 0);
    pushDebug(
      `Drive throttle state: accelerator=${acceleratorHeld} brake=${brakeHeld} throttle=${buttonThrottleRef.current}`
    );
  }, [acceleratorHeld, brakeHeld]);

  // spacebar mapping from mobile removed (shoot button removed)

  useEffect(() => {
    if (playerId) return;
    if (typeof window === "undefined") return;

    let storedId = sessionStorage.getItem("playerId");
    if (!storedId) {
      storedId = `player-${Math.random().toString(36).substring(2, 11)}`;
      sessionStorage.setItem("playerId", storedId);
    }
    window.requestAnimationFrame(() => setPlayerId(storedId));

    const params = new URLSearchParams(window.location.search);
    const nameParam = params.get("name");
    const resolvedName =
      nameParam || `Player-${Math.floor(Math.random() * 1000)}`;
    window.requestAnimationFrame(() => setName(resolvedName));
  }, [playerId]);

  // NOTE: runtime map import via localStorage removed. Use static map modules instead.

  useEffect(() => {
    if (!playerId || !name) return;

    dbg("Starting adaptive game loop for player:", playerId, name);

    let mounted = true;

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    (async () => {
      // Exponential backoff state for transient network errors
      let backoff = 0;
      while (mounted) {
        try {
          // Standardize steering signs: left = -1, right = +1 so joystick X
          // (positive = right) matches keyboard inputs.
          const keyboardSteer =
            (keys.ArrowLeft || keys.a ? -1 : 0) +
            (keys.ArrowRight || keys.d ? 1 : 0);
          const keyboardThrottle =
            (keys.ArrowUp || keys.w ? 1 : 0) +
            (keys.ArrowDown || keys.s ? -0.5 : 0);
          const steer = clamp(keyboardSteer + joystickValueRef.current.x);
          // Use joystick Y such that pushing up yields forward motion.
          const throttle = clamp(
            keyboardThrottle -
              joystickValueRef.current.y +
              buttonThrottleRef.current
          );

          const clientSendTs = Date.now();

          // update local input ref immediately so visuals can be predicted
          try {
            playerInputRef.current = { steer, throttle };
          } catch (e) {}

          const response = await fetch("/api/game", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              playerId,
              name,
              steer,
              throttle,
              // Send last known interpolated position and angle so any
              // serverless worker that hasn't seen this player can initialize
              // them at the client's current location instead of a random spawn.
              lastX: interpolatedPositionsRef.current.get(playerId)?.x,
              lastY: interpolatedPositionsRef.current.get(playerId)?.y,
              lastAngle: cars.find((c) => c.id === playerId)?.angle,
              // Diagnostics: client send timestamp for RTT measurement
              clientSendTs,
              // include current matchToken (if any) so other instances can adopt
              matchToken: matchTokenRef.current,
            }),
          });

          if (response.ok) {
            const data = await response.json();

            try {
              const clientReceiveTs = Date.now();

              console.log("game update", {
                instanceId: data.instanceId,
                serverFps: data.serverFps,
                timing: data.timing,
              });

              // Expose adoptOk (if present) for quick client-side visibility
              try {
                if (typeof data.adoptOk !== "undefined") {
                  const tk = data.matchToken || null;
                  const masked = tk
                    ? `${String(tk).slice(0, 8)}...${String(tk).slice(-8)}`
                    : null;
                  console.info("[race] adoptOk ->", {
                    adoptOk: data.adoptOk,
                    matchToken: masked,
                    instanceId: data.instanceId,
                  });
                }
              } catch (e) {}

              // RTT
              let rtt = 0;
              let approxOneWay = 0;
              if (data.timing && data.timing.clientSendMs != null) {
                rtt = clientReceiveTs - data.timing.clientSendMs;
                const processing = data.timing.processingMs ?? null;
                approxOneWay =
                  processing != null
                    ? Math.max(0, (rtt - processing) / 2)
                    : rtt / 2;
                console.log("latency", {
                  rtt,
                  processing: data.timing.processingMs,
                  approxOneWay,
                });
                // smooth RTT into a running estimate used to adapt interpolation
                try {
                  const prev = rttRef.current || rtt;
                  // simple EMA smoothing
                  rttRef.current = Math.round(prev * 0.75 + rtt * 0.25);
                  // set interpolation delay to half RTT + cushion (ms)
                  // Raise the minimum interpolation delay to reduce extrapolation
                  // at moderate RTTs (e.g. ~120ms). This trades a bit of input
                  // responsiveness for visual smoothness.
                  interpolationDelayRef.current = Math.min(300, Math.max(150, Math.round(rttRef.current / 2 + 40)));
                } catch (e) {}
              } else {
                console.log(
                  "latency: clientSendTs not present in response/timing"
                );
              }

              // Position delta: server vs interpolated visual
              if (playerId) {
                const serverMe = (data.players || []).find(
                  (p: any) => p.id === playerId
                );
                const localPos = interpolatedPositionsRef.current.get(playerId);
                if (serverMe && localPos) {
                  const delta = Math.hypot(
                    serverMe.x - localPos.x,
                    serverMe.y - localPos.y
                  );
                  console.log("position-delta", {
                    delta,
                    server: { x: serverMe.x, y: serverMe.y },
                    visual: localPos,
                  });
                }
              }
            } catch (e) {
              console.warn("diagnostic logging failed", e);
            }
            // persist matchToken from server so we can include it in future requests
            if (data.matchToken) {
              matchTokenRef.current = data.matchToken;
              try {
                sessionStorage.setItem("matchToken", data.matchToken);
              } catch (e) {}
            }
            // Defensive: deduplicate players by id in case server returns
            // duplicate entries (observed as flickering/dual-render issues).
            const rawPlayers = data.players || [];
            const playersById = new Map<string, any>();
            for (const p of rawPlayers) {
              playersById.set(p.id, p);
            }
            const dedupedPlayers = Array.from(playersById.values());
            // record snapshots for interpolation buffering
            try {
              for (const p of dedupedPlayers) {
                  const arr = snapshotsRef.current.get(p.id) || [];
                  const ts = (data.timing && data.timing.serverSendMs) ? data.timing.serverSendMs : Date.now();
                  // ensure monotonic timestamps
                  const lastTs = arr.length ? arr[arr.length - 1].ts : 0;
                  const safeTs = ts <= lastTs ? lastTs + 1 : ts;
                  // diagnostic: detect large gaps or late-arriving samples
                  try {
                    const prevTs = lastTs;
                    const gap = ts - prevTs;
                    if (prevTs && gap > 400) {
                      pushDebug(
                        `Large snapshot gap for ${p.id}: ${gap}ms (serverSendMs ${ts}, prev ${prevTs})`,
                        "warn"
                      );
                    }
                    if (ts < prevTs) {
                      pushDebug(
                        `Out-of-order snapshot ts for ${p.id}: ${ts} < ${prevTs}`,
                        "warn"
                      );
                    }
                  } catch (e) {}
                  // small low-pass filter to reduce spike magnitude from late-arriving corrections
                  const prev = arr.length ? arr[arr.length - 1] : null;
                  const SMOOTH_ALPHA = 0.28; // how much new sample influences stored snapshot
                  const sx = prev ? (prev.x * (1 - SMOOTH_ALPHA) + p.x * SMOOTH_ALPHA) : p.x;
                  const sy = prev ? (prev.y * (1 - SMOOTH_ALPHA) + p.y * SMOOTH_ALPHA) : p.y;
                  // compute velocity from previous stored snapshot when server doesn't provide it
                  let vx = 0;
                  let vy = 0;
                  if (typeof p.vx === "number" && typeof p.vy === "number") {
                    vx = p.vx;
                    vy = p.vy;
                  } else if (prev) {
                    const dtMs = Math.max(1, safeTs - prev.ts);
                    const dt = dtMs / 1000;
                    // raw instantaneous velocity
                    let rawVx = (sx - prev.x) / dt;
                    let rawVy = (sy - prev.y) / dt;
                    // clamp absurd velocities before smoothing
                    const MAX_V = 200; // units/sec
                    if (!Number.isFinite(rawVx) || Math.abs(rawVx) > MAX_V) rawVx = Math.sign(rawVx) * MAX_V;
                    if (!Number.isFinite(rawVy) || Math.abs(rawVy) > MAX_V) rawVy = Math.sign(rawVy) * MAX_V;
                    // smooth velocity using previous stored vx/vy to reduce jitter in tangents
                    const V_SMOOTH_ALPHA = 0.45; // how much new velocity influences stored velocity
                    const prevVx = typeof prev.vx === 'number' ? prev.vx : rawVx;
                    const prevVy = typeof prev.vy === 'number' ? prev.vy : rawVy;
                    vx = prevVx * (1 - V_SMOOTH_ALPHA) + rawVx * V_SMOOTH_ALPHA;
                    vy = prevVy * (1 - V_SMOOTH_ALPHA) + rawVy * V_SMOOTH_ALPHA;
                  }

                  // If there's a big time gap since the last stored snapshot,
                  // insert a few interpolated snapshots to give the renderer
                  // more samples to interpolate between. This helps hide
                  // stepping when server updates are sparse or bursty.
                  const prevTs = prev ? prev.ts : 0;
                  const gapMs = safeTs - prevTs;
                  const FILL_SPACING_MS = isMobile ? 40 : 60; // desired spacing for filler samples (smaller spacing -> smoother)
                    const MAX_FILL = isMobile ? 12 : 8; // cap how many filler samples to insert
                  if (prev && gapMs > FILL_SPACING_MS * 1.25) {
                    // compute number of intermediate samples (exclude endpoints)
                    const approx = Math.floor(gapMs / FILL_SPACING_MS) - 1;
                    const fillCount = Math.max(0, Math.min(MAX_FILL, approx));
                    if (fillCount > 0) {
                      if (fillCount > 0) {
                        // Use Hermite interpolation to generate smoother filler samples
                        // between `prev` and the new sample (sx,sy) using the
                        // derived velocities. This produces smoother tangents than
                        // simple linear lerp when snapshots are sparse.
                        const totalMs = Math.max(1, safeTs - prevTs);
                        const totalSec = totalMs / 1000;
                        for (let i = 1; i <= fillCount; i++) {
                          const its = Math.round(prevTs + (totalMs * i) / (fillCount + 1));
                          const s = (its - prevTs) / totalMs;
                          const s2 = s * s;
                          const s3 = s2 * s;
                          const h00 = 2 * s3 - 3 * s2 + 1;
                          const h10 = s3 - 2 * s2 + s;
                          const h01 = -2 * s3 + 3 * s2;
                          const h11 = s3 - s2;

                          const pvx = typeof prev.vx === 'number' ? prev.vx : vx;
                          const pvy = typeof prev.vy === 'number' ? prev.vy : vy;
                          const bvx = vx; // use current derived vx/vy for b
                          const bvy = vy;
                          const tangentScale = 0.6;
                          const m0x = pvx * totalSec * tangentScale;
                          const m1x = bvx * totalSec * tangentScale;
                          const m0y = pvy * totalSec * tangentScale;
                          const m1y = bvy * totalSec * tangentScale;

                          const ix = h00 * prev.x + h10 * m0x + h01 * sx + h11 * m1x;
                          const iy = h00 * prev.y + h10 * m0y + h01 * sy + h11 * m1y;
                          const iz = h00 * (prev.z || 0.3) + h01 * (p.z ?? 0.3);
                          const ia = typeof prev.angle === "number" && typeof p.angle === "number"
                            ? (() => {
                                let d = (p.angle || 0) - (prev.angle || 0);
                                if (d > Math.PI) d -= Math.PI * 2;
                                if (d < -Math.PI) d += Math.PI * 2;
                                return (prev.angle || 0) + d * s;
                              })()
                            : p.angle;
                          arr.push({ ts: its, x: ix, y: iy, z: iz, angle: ia, vx: (ix - prev.x) / ((its - prevTs) / 1000 || 1), vy: (iy - prev.y) / ((its - prevTs) / 1000 || 1) });
                        }
                        // record telemetry
                        try {
                          const gd = (window as any).__GAME_DIAGS = (window as any).__GAME_DIAGS || {};
                          gd.fillers = (gd.fillers || 0) + fillCount;
                          gd.fillEvents = (gd.fillEvents || 0) + 1;
                          gd.gapCount = (gd.gapCount || 0) + 1;
                          gd.gapSum = (gd.gapSum || 0) + gapMs;
                          if ((window as any).__GAME_DEBUG__) {
                            console.info("interp: inserted", fillCount, "fillers for", p.id, "gapMs", gapMs);
                          }
                        } catch (e) {}
                      }
                    }
                  }

                  // finally push the reported (smoothed) sample
                  arr.push({
                    ts: safeTs,
                    x: sx,
                    y: sy,
                    z: p.z ?? 0.3,
                    angle: p.angle,
                    vx,
                    vy,
                  });
                // keep only last ~40 snapshots per player (enough for buffering)
                if (arr.length > 40) arr.splice(0, arr.length - 40);
                snapshotsRef.current.set(p.id, arr);
              }
            } catch (e) {}
                setCars(dedupedPlayers);
                // (Debug instrumentation removed) setCars already updated above.
            setServerFps(data.serverFps || 0);
            // Compare destructibles for changes (destroyed state & debris counts)
            try {
              const newDestructibles: DestructibleState[] =
                data.destructibles || [];
              const prevMap = new Map(
                destructiblesRef.current.map((d) => [d.id, d])
              );
              for (const nd of newDestructibles) {
                const prev = prevMap.get(nd.id);
                if (prev && !prev.destroyed && nd.destroyed) {
                  pushDebug(`Destructible destroyed: ${nd.id}`);
                }
                if (
                  prev &&
                  prev.debris &&
                  nd.debris &&
                  prev.debris.length !== nd.debris.length
                ) {
                  pushDebug(
                    `Debris count for ${nd.id}: ${prev.debris.length} -> ${nd.debris.length}`
                  );
                }
              }
              destructiblesRef.current = newDestructibles;
              setDestructibles(newDestructibles);
            } catch (e) {
              // Fallback
              setDestructibles(data.destructibles || []);
            }
            // dispatch game state change events for audio manager
            const prevState = ((): string | null => {
              try {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                return window.__lastGameState || null;
              } catch (e) {
                return null;
              }
            })();
            const newState = data.gameState || "lobby";
            setGameState(newState);
            try {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              window.__lastGameState = newState;
            } catch (e) {}
            if (prevState !== newState) {
              if (newState === "racing") {
                window.dispatchEvent(new CustomEvent("audio:playRacing"));
              } else {
                window.dispatchEvent(new CustomEvent("audio:playLobby"));
              }
              // If the game has just finished, clear the stored match token and
              // POST the final leaderboard to the instance leaderboard API
              try {
                if (newState === "finished") {
                  try {
                    sessionStorage.removeItem("matchToken");
                  } catch (e) {}
                  (async () => {
                    try {
                      const body = { leaderboard: data.leaderboard || [] };
                      await fetch("/api/leaderboard", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                    } catch (e) {
                      // ignore network errors
                    }
                  })();
                }
              } catch (e) {}
            }
            setTimerState(data.timer || null);
            setLeaderboard(data.leaderboard || []);
            setDeliveries(data.deliveries || []);
            setMatchEvents(data.events || []);
            // Push any new match/system events into the debug panel for visibility
            if (data.events && Array.isArray(data.events)) {
              for (const ev of data.events) {
                if (!knownEventIdsRef.current.has(ev.id)) {
                  knownEventIdsRef.current.add(ev.id);
                  pushDebug(
                    `${new Date(ev.timestamp).toLocaleTimeString()} ${
                      ev.description
                    }`
                  );
                }
              }
            }
            // Always sync server powerups (use empty array fallback) to avoid
            // keeping stale client-side powerups when the server has none.
            setPowerUps(data.powerUps || []);
            if (playerId && data.players) {
              const me = (data.players || []).find(
                (p: any) => p.id === playerId
              );
              if (me && me.activePowerUps) {
                setActivePowerUps(me.activePowerUps as any[]);
                // Log speed activation/ending only on change (rising/falling edge)
                const speedMult = (me.activePowerUps || [])
                  .filter((a: any) => a.type === "speed")
                  .reduce((acc: number, a: any) => acc * (a.value || 1), 1);
                const prev = prevSpeedMultRef.current || 1;
                if (speedMult !== prev) {
                  if (speedMult > prev) {
                    pushDebug(
                      `PowerUp activated: speed x${speedMult.toFixed(2)}`
                    );
                  } else if (speedMult < prev) {
                    pushDebug(`PowerUp ended: speed effect ended`);
                  }
                  prevSpeedMultRef.current = speedMult;
                }
              } else {
                setActivePowerUps([]);
                // If we had a speed multiplier active and now none, log the end
                if (
                  prevSpeedMultRef.current &&
                  prevSpeedMultRef.current !== 1
                ) {
                  pushDebug(`PowerUp ended: speed effect ended`);
                  prevSpeedMultRef.current = 1;
                }
              }
            }
            setHasLoadedScene(true);

            // compute adaptive delay based on server fps and measured rtt
            let targetHz = Math.max(6, Math.min(data.serverFps || 15, 30));
            let nextDelay = Math.round(1000 / targetHz);
            // Prefer a slightly slower poll if network latency is high
            try {
              const timing = data.timing || {};
              const rtt =
                typeof timing.clientSendMs === "number"
                  ? Date.now() - timing.clientSendMs
                  : 0;
              if (rtt > 200) nextDelay = Math.max(nextDelay, 200);
              if (rtt > 500) nextDelay = Math.max(nextDelay, 500);
            } catch (e) {}

            // reset backoff on success
            backoff = 0;
            // Ensure we don't poll faster than the owner's snapshot cadence
            // (owner saves every ~200ms). Use a conservative lower bound so
            // remote clients don't request updates more frequently than
            // the server will produce them.
            nextDelay = Math.max(nextDelay, 150);
            // sleep until next iteration
            if (!mounted) break;
            await sleep(nextDelay);
            continue;
          } else {
            // non-ok response - small delay before retry
            await sleep(250 + Math.min(2000, backoff * 200));
            backoff = Math.min(10, backoff + 1);
            continue;
          }
        } catch (error) {
          console.error("Error updating game state:", error);
          // On network error, back off exponentially
          const backoffMs = Math.min(5000, 250 * Math.pow(2, Math.min(8, 1)));
          await sleep(backoffMs);
          continue;
        }
      }
    })();

    return () => {
      dbg("Stopping adaptive game loop");
      mounted = false;
    };
  }, [playerId, name]);

  const myCar = cars.find((c) => c.id === playerId);
  const myScore = Math.round(myCar?.score || 0);
  const destroyedObjects = destructibles.filter((d) => d.destroyed).length;
  const totalDestructibles = destructibles.length;
  const timeRemainingMs = timerState
    ? Math.max(timerState.timeRemainingMs, 0)
    : null;
  const formattedTimer =
    timeRemainingMs !== null
      ? `${Math.floor(timeRemainingMs / 60000)}:${Math.floor(
          (timeRemainingMs % 60000) / 1000
        )
          .toString()
          .padStart(2, "0")}`
      : "--:--";
  const timerProgress =
    timerState && timeRemainingMs !== null && timerState.durationMs
      ? Math.min(Math.max(1 - timeRemainingMs / timerState.durationMs, 0), 1)
      : 0;
  const elapsedMs =
    timerState && timeRemainingMs !== null
      ? Math.max(timerState.durationMs - timeRemainingMs, 0)
      : null;

  // If the server has provided a `startedAt` in the future, compute a
  // pre-start countdown based on the official start time so the UI and
  // server are aligned. Otherwise, fall back to the existing in-race
  // countdown which counts from race start.
  const nowMs = Date.now();
  const preStartRemainingMs =
    timerState && typeof timerState.startedAt === "number"
      ? Math.max(timerState.startedAt - nowMs, 0)
      : 0;

  const isPreStart = preStartRemainingMs > 0;
  const countdownRemainingMs = isPreStart
    ? preStartRemainingMs
    : gameState === "racing" && elapsedMs !== null && elapsedMs < COUNTDOWN_DURATION_MS
    ? COUNTDOWN_DURATION_MS - elapsedMs
    : 0;

  const showCountdown = countdownRemainingMs > 0;

  const showGoSignal = !isPreStart &&
    gameState === "racing" &&
    elapsedMs !== null &&
    elapsedMs >= COUNTDOWN_DURATION_MS &&
    elapsedMs < COUNTDOWN_DURATION_MS + GO_FLASH_MS;

  const countdownNumber = showCountdown
    ? Math.ceil(countdownRemainingMs / 1000)
    : null;

  const trafficActiveIndex = showCountdown
    ? Math.min(2, 3 - (countdownNumber || 3))
    : showGoSignal
    ? 2
    : -1;

  const leaderboardSource: LeaderboardEntry[] = leaderboard?.length
    ? leaderboard
    : cars.map((car) => ({
        id: car.id,
        name: car.name,
        score: Math.round(car.score || 0),
        color: car.color,
      }));

  const liveLeaderboard = [...leaderboardSource].sort(
    (a, b) => b.score - a.score
  );

  const carryingDeliveryId = myCar?.carryingDeliveryId;
  const carryingDelivery = carryingDeliveryId
    ? deliveries.find((d) => d.id === carryingDeliveryId)
    : undefined;
  const waitingDeliveries = deliveries.filter(
    (d) => d.state === "waiting"
  ).length;
  const recentEvents = matchEvents.length
    ? [...matchEvents]
        .filter((ev) => ev.playerId !== "system")
        .slice(-10)
        .reverse()
    : [];
  // Count how many deliveries were completed during the match by inspecting events
  const deliveredCount = matchEvents.filter((ev) =>
    typeof ev.description === "string"
      ? ev.description.toLowerCase().includes("deliver")
      : false
  ).length;
  const deliveriesByPlayer: Record<string, number> = matchEvents.reduce(
    (acc: Record<string, number>, ev) => {
      if (
        typeof ev.description === "string" &&
        ev.description.toLowerCase().includes("deliver")
      ) {
        acc[ev.playerId] = (acc[ev.playerId] || 0) + 1;
      }
      return acc;
    },
    {}
  );
  const carrierElevations = useMemo(() => {
    const map: Record<string, number> = {};
    for (const car of cars) {
      map[car.id] = car.z ?? 0.3;
    }
    return map;
  }, [cars]);

  // Repair timer for when local player's car is destroyed.
  const REPAIR_DELAY_MS = 20000; // 20 seconds
  const REPAIR_AMOUNT = 10; // reduce damage by 10 (i.e. +10% health)
  const [repairRemainingMs, setRepairRemainingMs] = useState<number | null>(
    null
  );
  const repairTimerRef = useRef<number | null>(null);
  const [repairToast, setRepairToast] = useState<string | null>(null);

  const requestRepair = async (amount = REPAIR_AMOUNT) => {
    if (!playerId) return;
    try {
      const res = await fetch("/api/game/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, amount }),
      });
      if (res.ok) {
        setRepairToast(`Requested repair +${amount}%`);
        setTimeout(() => setRepairToast(null), 3000);
      } else {
        setRepairToast("Repair request failed");
        setTimeout(() => setRepairToast(null), 3000);
      }
    } catch (e) {
      setRepairToast("Repair request error");
      setTimeout(() => setRepairToast(null), 3000);
    }
    // clear any scheduled countdown/timer
    setRepairRemainingMs(null);
    if (repairTimerRef.current) {
      window.clearInterval(repairTimerRef.current);
      repairTimerRef.current = null;
    }
  };

  // Start/stop the 20s repair countdown when local player's destroyed state changes
  useEffect(() => {
    if (!playerId) return;
    if (myCar && myCar.destroyed) {
      // start countdown
      setRepairRemainingMs(REPAIR_DELAY_MS);
      if (repairTimerRef.current) window.clearInterval(repairTimerRef.current);
      repairTimerRef.current = window.setInterval(() => {
        setRepairRemainingMs((prev) => {
          if (prev === null) return prev;
          const next = prev - 1000;
          if (next <= 0) return 0;
          return next;
        });
      }, 1000) as unknown as number;
    } else {
      // clear if repaired or no longer destroyed
      setRepairRemainingMs(null);
      if (repairTimerRef.current) {
        window.clearInterval(repairTimerRef.current);
        repairTimerRef.current = null;
      }
    }
    return () => {
      if (repairTimerRef.current) {
        window.clearInterval(repairTimerRef.current);
        repairTimerRef.current = null;
      }
    };
  }, [playerId, myCar?.destroyed]);

  // When countdown reaches zero, call server to apply repair
  useEffect(() => {
    if (repairRemainingMs === null) return;
    if (repairRemainingMs > 0) return;
    // perform repair once
    (async () => {
      try {
        await fetch("/api/game/repair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, amount: REPAIR_AMOUNT }),
        });
      } catch (e) {
        // ignore network errors; server will correct state on next poll
      } finally {
        setRepairRemainingMs(null);
        if (repairTimerRef.current) {
          window.clearInterval(repairTimerRef.current);
          repairTimerRef.current = null;
        }
      }
    })();
  }, [repairRemainingMs, playerId]);

  // NOTE: visual pickup effects are handled by `usePowerupVisuals` hook.

  useEffect(() => {
    if (!playerId) return;
    const currentScore = myScore;
    const previous = lastScoreRef.current;
    if (currentScore > previous) {
      enqueueScoreBurst(currentScore - previous);
    }
    lastScoreRef.current = currentScore;
  }, [playerId, myScore, enqueueScoreBurst]);

  useEffect(() => {
    if (gameState === "lobby") {
      lastScoreRef.current = myScore;
    }
  }, [gameState, myScore]);

  // Initialize powerups when game starts (delegated to hook)
  // Initialize powerups when the race begins. Use `timerState` presence
  // as a reliable indicator the race has started (server provides timer).
  useInitializePowerUps({
    gameState: timerState ? "racing" : gameState,
    deliveries,
    powerUps,
    setPowerUps,
  });

  // Drive visuals for powerup pickups
  usePowerupVisuals({ powerUps, setCollisionEffects, pushDebug });

  // Debug: log distances to powerups for local player to diagnose pickup issues
  useEffect(() => {
    if (!playerId) return;
    const me = cars.find((c) => c.id === playerId);
    if (!me || !powerUps || !powerUps.length) return;
    for (const pu of powerUps) {
      const dx = me.x - pu.x;
      const dy = me.y - (pu.y ?? 0);
      const dist = Math.hypot(dx, dy);
      if (dist < 12) {
        const msg = `DBG: pu=${pu.id} type=${
          pu.type
        } pu.col=${!!pu.collected} pu.pos=${Math.round(pu.x)},${Math.round(
          pu.y ?? 0
        )} me=${Math.round(me.x)},${Math.round(me.y)} dist=${dist.toFixed(2)}`;
        pushDebug(msg, dist <= 3 ? "info" : "info");
        // Only emit the verbose console.debug if client debug is enabled
        const clientDebug = (() => {
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (typeof window !== "undefined" && (window as any).__GAME_DEBUG)
              return true;
            if (typeof window !== "undefined") {
              const v = sessionStorage.getItem("GAME_DEBUG");
              if (v === "1" || v === "true") return true;
            }
          } catch (e) {}
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (process.env.NEXT_PUBLIC_GAME_LOG_LEVEL === "debug") return true;
          } catch (e) {}
          return false;
        })();
        if (clientDebug) console.debug(msg);
      }
    }
  }, [powerUps, cars, playerId]);

  // Cleanup old collision effects after 1.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCollisionEffects((prev) =>
        prev.filter((effect) => now - effect.timestamp < 1500)
      );
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Add collision effect when car damage increases or has collision speed
  useEffect(() => {
    cars.forEach((car) => {
      const prevDamage = carDamageRef.current.get(car.id);
      const currentDamage = car.damage || 0;

      // Check if collision just happened (only consider if we have a previous damage value)
      // This prevents spawning effects when the car first appears (prevDamage === undefined).
      const hitByDamage =
        prevDamage !== undefined && currentDamage > prevDamage;
      const prevSpeed = collisionSpeedRef.current.get(car.id) ?? 0;
      const hitBySpeed =
        prevDamage !== undefined &&
        car.lastCollisionSpeed &&
        // Increase threshold to avoid false-positive collision effects (e.g. on pickups)
        car.lastCollisionSpeed > 8 &&
        // Only trigger when there's a rising edge in reported collision speed (avoid repeats)
        car.lastCollisionSpeed > prevSpeed + 0.5;
      if (hitByDamage || hitBySpeed) {
        const now = Date.now();
        const lastTs = collisionCooldownRef.current.get(car.id) || 0;
        // Debounce repeated collision effects per car (400ms)
        if (now - lastTs > 400) {
          collisionCooldownRef.current.set(car.id, now);
          // Add collision effect with smoke and sparks
          setCollisionEffects((prev) => [
            ...prev,
            {
              id: `${car.id}-${Date.now()}`,
              position: [car.x, (car.z || 0.3) + 0.5, car.y],
              timestamp: Date.now(),
            },
          ]);
          pushDebug(
            `Collision effect for car=${car.id} reason=${
              hitByDamage ? "damage" : "impactSpeed"
            } dmg=${currentDamage} prev=${prevDamage} speed=${
              car.lastCollisionSpeed
            } prevSpeed=${prevSpeed}`
          );
        }
      }
      // Store current damage for next comparison
      carDamageRef.current.set(car.id, currentDamage);
      // Store current reported collision speed
      if (car.lastCollisionSpeed)
        collisionSpeedRef.current.set(car.id, car.lastCollisionSpeed);
    });
  }, [cars]);

  // Local pickup handling moved to `usePowerUps` hook to avoid duplicate logs/logic

  const mainRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const [controlsSize, setControlsSize] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  // Postprocessing feature flags - disabled by default to avoid accidental heavy blur
  const [enableChromatic, setEnableChromatic] = useState<boolean>(false);
  const [enableDoF, setEnableDoF] = useState<boolean>(false);

  useEffect(() => {
    const gl = glRef.current;
    if (!gl) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    // Size renderer using the real canvas client dimensions so CSS-based
    // rotations (100vh/100vw) do not require manual swapped math.
    const canvasEl = (gl as any).domElement as HTMLCanvasElement | undefined;
    if (canvasEl) {
      const cssW = Math.max(1, canvasEl.clientWidth);
      const cssH = Math.max(1, canvasEl.clientHeight);
      gl.setPixelRatio(dpr);
      gl.setSize(cssW, cssH, true);
    } else {
      gl.setPixelRatio(dpr);
      gl.setSize(canvasSize.w || 1, canvasSize.h || 1, true);
    }
  }, [canvasSize]);

  // Ensure three.js renderer is disposed when this page unmounts to avoid
  // leaking WebGL contexts / RAF loops when navigating away and back.
  useEffect(() => {
    return () => {
      try {
        const gl = glRef.current as any;
        if (gl) {
          dbg("Disposing WebGL renderer on unmount");
          try {
            const canvas = gl.domElement as HTMLCanvasElement | undefined;
            if (canvas) {
              // attempt to remove canvas from DOM to fully relinquish context
              if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            }
          } catch (e) {}
          try {
            // force context loss then dispose renderer
            try {
              const ctx = (gl as any).getContext && (gl as any).getContext();
              const alreadyLost = ctx && typeof ctx.isContextLost === "function" && ctx.isContextLost();
              if (!alreadyLost && typeof gl.forceContextLoss === "function") {
                gl.forceContextLoss();
              }
            } catch (e) {
              // ignore context-loss errors
            }
          } catch (e) {}
          try {
            if (typeof gl.dispose === "function") gl.dispose();
          } catch (e) {}
          glRef.current = null;
        }
      } catch (err) {
        console.warn("Error disposing GL on unmount:", err);
      }
    };
  }, []);

  useEffect(() => {
    if (!mainRef.current) return;

    const getObservedEl = () => {
      // When rotated, the visual container is the rotator; otherwise use mainRef
      if (isMobile && isPortrait && rotatorRef.current)
        return rotatorRef.current;
      return mainRef.current as Element;
    };

    // Compute authoritative target size. Prefer visualViewport (when available)
    // for mobile since it accounts for soft keyboards/zoom. When rotated, swap
    // width/height once using the rotator rect or visualViewport.
    const computeTargetSize = () => {
      const mainRect = mainRef.current?.getBoundingClientRect();
      const rotRect = rotatorRef.current?.getBoundingClientRect();
      const viewport =
        typeof window !== "undefined" && (window as any).visualViewport
          ? (window as any).visualViewport
          : null;

      if (isMobile && isPortrait && rotRect) {
        if (viewport && viewport.width && viewport.height) {
          return {
            w: Math.floor(viewport.height),
            h: Math.floor(viewport.width),
            controlRect: rotRect,
          } as const;
        }
        return {
          w: Math.floor(rotRect.height),
          h: Math.floor(rotRect.width),
          controlRect: rotRect,
        } as const;
      }

      const observed = getObservedEl();
      if (observed) {
        const rect = observed.getBoundingClientRect();
        return {
          w: Math.floor(rect.width),
          h: Math.floor(rect.height),
          controlRect: rect,
        } as const;
      }

      if (mainRect)
        return {
          w: Math.floor(mainRect.width),
          h: Math.floor(mainRect.height),
          controlRect: mainRect,
        } as const;
      return { w: 1, h: 1, controlRect: undefined } as const;
    };

    let debounceId: number | undefined;
    let lastApplied = { w: 0, h: 0 };
    const scheduleApply = () => {
      const { w, h, controlRect } = computeTargetSize();
      const clientDebug = (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          if (typeof window !== "undefined" && (window as any).__GAME_DEBUG)
            return true;
          if (typeof window !== "undefined") {
            const v = sessionStorage.getItem("GAME_DEBUG");
            if (v === "1" || v === "true") return true;
          }
        } catch (e) {}
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          if (process.env.NEXT_PUBLIC_GAME_LOG_LEVEL === "debug") return true;
        } catch (e) {}
        return false;
      })();
      if (clientDebug) {
        try {
          const canvasEl = glRef.current?.domElement as
            | HTMLCanvasElement
            | undefined;
          if (__IS_GAME_DEBUG__) {
            console.groupCollapsed(
              `Race resize debug (scheduled): computed ${w}x${h} (isMobile=${isMobile} isPortrait=${isPortrait})`
            );
            dbg("rotRect:", rotatorRef.current?.getBoundingClientRect());
            dbg("observedRect:", getObservedEl().getBoundingClientRect());
            dbg("visualViewport:", (window as any).visualViewport || null);
            if (canvasEl)
              dbg(
                "canvas.domRect:",
                canvasEl.getBoundingClientRect(),
                "pixels:",
                canvasEl.width,
                canvasEl.height
              );
            console.groupEnd();
          }
        } catch (e) {}
      }

      // Avoid thrash: only apply after a small debounce and only if the size changed
      if (debounceId) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        if (lastApplied.w === w && lastApplied.h === h) return;
        lastApplied = { w, h };
        setCanvasSize({ w: Math.max(1, w), h: Math.max(1, h) });
        if (controlRect) {
          setControlsSize({
            w: Math.max(1, Math.floor(controlRect.width)),
            h: Math.max(1, Math.floor(controlRect.height)),
          });
        }
      }, 80) as unknown as number;
    };

    const ro = new ResizeObserver(scheduleApply);
    // observe both so we react if either changes while mounted
    ro.observe(mainRef.current);
    if (rotatorRef.current) ro.observe(rotatorRef.current);

    // helper to trigger multiple measurements: immediate RAF + delayed retry
    const triggerMeasurements = () => {
      requestAnimationFrame(scheduleApply);
      // some browsers update layout after a short delay when orientation changes
      setTimeout(scheduleApply, 120);
      setTimeout(scheduleApply, 360);
    };

    // initial
    scheduleApply();
    // In some browsers the rotator element may not be fully laid out yet; re-measure on next frame
    triggerMeasurements();

    // Global listeners to ensure we recalc after orientation/resize events
    const onGlobalResize = () => {
      triggerMeasurements();
    };
    window.addEventListener("resize", onGlobalResize);
    window.addEventListener("orientationchange", onGlobalResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onGlobalResize);
      window.removeEventListener("orientationchange", onGlobalResize);
    };
  }, [isMobile, isPortrait]);

  return (
    <main
      ref={mainRef}
      className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden"
    >
      {isMobile && (
        <style>{`
        /* Force the canvas and three.js wrapper to fill the rotator/container
           on mobile. A previous rule used 'auto' which prevented full-bleed sizing
           causing the renderer to appear too small and permitting page scroll. */
        .game-canvas, .game-canvas > div, .game-canvas canvas { width: 100% !important; height: 100% !important; display: block !important; }
      `}</style>
      )}

      {/* Rotator: when on mobile portrait rotate the entire UI + canvas so everything stays aligned */}
      <div
        ref={rotatorRef}
        id="rotator"
        style={
          isMobile && isPortrait
            ? {
                position: "absolute",
                left: "50%",
                top: "50%",
                width: "100vh",
                height: "100vw",
                transform: "translate(-50%,-50%) rotate(90deg)",
                transformOrigin: "center center",
              }
            : { width: "100%", height: "100%" }
        }
        className="w-full h-full"
      >
        {!hasLoadedScene && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950">
            <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-300 rounded-full animate-spin" />
            <p className="mt-6 text-lg text-slate-200 font-semibold tracking-wide">
              Warming up the sleigh...
            </p>
          </div>
        )}
        {hasLoadedScene && (
          <CountdownOverlay
            showCountdown={showCountdown}
            showGoSignal={showGoSignal}
            countdownNumber={countdownNumber}
            trafficActiveIndex={trafficActiveIndex}
          />
        )}
        <ScoreBursts bursts={scoreBursts} />
        <header className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-slate-900/80 to-transparent">
          <div className="flex items-center gap-3">
            <button
              aria-label="open-info"
              onClick={() => setInfoOpen(true)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-50 mr-2 pointer-events-auto"
            >
              ?
            </button>
            {/* Map import/export buttons removed: maps are static in code */}
            <div>
              <h1 className="text-2xl font-bold drop-shadow-lg">
                Grand Theft Giftwrap
              </h1>
              <p className="text-sm text-slate-300 drop-shadow">{name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AudioHeaderButton />
            {myCar?.destroyed && (
              <div className="flex items-center gap-2 mr-4">
                <p className="text-sm text-red-400 font-semibold drop-shadow">
                  💥 Your car is totaled!{/* Show repair countdown if active */}
                  {repairRemainingMs !== null ? (
                    <span>
                      {" "}
                      Repairing in {(repairRemainingMs / 1000).toFixed(0)}s
                    </span>
                  ) : (
                    <span> Auto-heal every 30s</span>
                  )}
                </p>
                <button
                  onClick={() => requestRepair()}
                  className="px-2 py-1 text-xs rounded bg-emerald-500 hover:bg-emerald-600"
                >
                  Repair now
                </button>
              </div>
            )}
            <div className="text-xs text-slate-300 drop-shadow flex items-center gap-4">
              <span>Controls: WASD / Arrow Keys</span>
              <span className="font-mono">⏱️ {formattedTimer}</span>
              <FPSCounter interval={500} className="text-xs text-slate-300" />
              <span className="font-mono">Server: {serverFps}Hz</span>
              <span className="text-pink-300 font-semibold">
                Score: {Math.round(myCar?.score || 0)} pts
              </span>
            </div>
          </div>
        </header>

        {/* <RuntimeDiagnostics
          powerUps={powerUps}
          destructibles={destructibles}
          collisionEffects={collisionEffects}
        /> */}

        {/* Joystick debug removed */}

        {/* Repair toast */}
        {repairToast && (
          <div className="absolute top-4 right-4 z-40">
            <div className="px-3 py-2 rounded bg-emerald-600 text-white text-sm">
              {repairToast}
            </div>
          </div>
        )}

        {/* Collected powerup toast removed — HUD displays active power-ups now. */}

        {/* Info Modal */}
        {infoOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setInfoOpen(false)}
            />
            <div className="relative z-50 w-[min(640px,95%)] max-h-[90vh] overflow-auto bg-slate-900/95 p-6 rounded-lg border border-white/10">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">Game Info</h2>
                <button
                  onClick={() => setInfoOpen(false)}
                  className="px-3 py-1 bg-white/10 rounded"
                >
                  Close
                </button>
              </div>
              <div className="text-sm text-slate-300 space-y-3">
                <p>Controls: WASD / Arrow Keys</p>
                <p className="text-blue-400">SPACE - Throw Present 🎁</p>
                <p className="text-purple-400">Collect PowerUps ⚡🔧🛡️🧲</p>
                <div className="pt-2">
                  <p className="font-semibold text-slate-200">
                    ⭐ PowerUps Guide
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-slate-300">
                    {(Object.keys(POWERUP_CONFIGS) as PowerUpType[]).map(
                      (type) => {
                        const cfg = POWERUP_CONFIGS[type];
                        return (
                          <div key={type} className="flex items-start gap-3">
                            <div className="text-lg">{cfg.icon}</div>
                            <div className="flex-1">
                              <div className="font-semibold">
                                {cfg.name}{" "}
                                {cfg.duration > 0 ? (
                                  <span className="text-xs text-slate-400">
                                    ({cfg.duration / 1000}s)
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    (Instant)
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">
                                {cfg.description || cfg.name}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-mono text-base text-yellow-300">
                    ⏱️ {formattedTimer}
                  </p>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-1">
                    <span
                      className="block h-full bg-yellow-400"
                      style={{ width: `${timerProgress * 100}%` }}
                    />
                  </div>
                </div>
                <p className="text-pink-300 font-semibold">
                  Score: {Math.round(myCar?.score || 0)} pts
                </p>
                <p className="text-amber-200">
                  Deliveries ready: {waitingDeliveries}/
                  {deliveries.length || "?"}
                </p>
                <div className="mt-3 p-3 bg-slate-800/60 rounded">
                  <p className="font-semibold">🎁 Holiday Deliveries</p>
                  <p className="text-sm text-slate-300">
                    Rush to the centre, grab a licence, and smash your way to
                    the drop zone.
                  </p>
                  <div className="flex gap-4 mt-2 text-sm text-slate-300">
                    <span>Waiting: {waitingDeliveries}</span>
                    <span>Total: {deliveries.length}</span>
                  </div>
                </div>
                <p className="text-emerald-300">
                  Environment: {destroyedObjects}/{totalDestructibles || "?"}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 h-full relative">
          {/* When on mobile in portrait we automatically rotate the canvas via CSS instead of blocking it.
            The canvas is placed into a centered rotator which flips width/height so it fills the screen.
            Input/touch coordinate mapping will need compensation elsewhere (left for caller to adjust). */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* <div
              className="flex"
              id="otherrotator"
              style={
                isMobile && isPortrait
                  ? { width: "100vh", height: "100vw" }
                  : canvasSize.w && canvasSize.h
                  ? { width: `${canvasSize.w}px`, height: `${canvasSize.h}px` }
                  : { width: "100%", height: "100%" }
              }
            > */}
            <Canvas
              className="game-canvas"
              shadows
              camera={{ position: [0, 50, 50], fov: 70 }}
              style={{ display: "block", width: "100%", height: "100%" }}
              onCreated={({ gl }) => {
                glRef.current = gl;
                const dpr = Math.max(1, window.devicePixelRatio || 1);
                try {
                  gl.setPixelRatio(dpr);
                } catch (e) {}

                // Guard WebGL init: some browsers/layouts report 0x0 canvas
                // initially which causes GL errors (invalid texture/framebuffer).
                // Retry a few times using the canvas client size before calling
                // `setSize`. If size stays zero, postpone sizing until a resize
                // event (the ResizeObserver will handle it) and log a single
                // warning to reduce console spam.
                let attempts = 0;
                const applySizeWhenReady = () => {
                  attempts++;
                  const canvasEl = (gl as any).domElement as
                    | HTMLCanvasElement
                    | undefined;
                  const measuredW = canvasEl?.clientWidth || canvasSize.w || 0;
                  const measuredH = canvasEl?.clientHeight || canvasSize.h || 0;
                  if (measuredW > 0 && measuredH > 0) {
                    try {
                      gl.setSize(Math.max(1, measuredW), Math.max(1, measuredH), true);
                    } catch (e) {
                      console.warn("[Game] gl.setSize failed:", e);
                    }
                  } else if (attempts < 20) {
                    // retry on next frame for a short window (~333ms)
                    requestAnimationFrame(applySizeWhenReady);
                  } else {
                    console.warn(
                      "[Game] WebGL init: canvas size remained 0x0 after retries; initialization postponed until resize"
                    );
                  }
                };
                applySizeWhenReady();

                // Configure renderer properties (safe to set even before sizing)
                try {
                  (gl as any).shadowMap.enabled = true;
                  (gl as any).shadowMap.type = (THREE as any).PCFSoftShadowMap;
                  (gl as any).physicallyCorrectLights = true;
                  (gl as any).outputEncoding = (THREE as any).sRGBEncoding;
                  (gl as any).toneMapping = (THREE as any).ACESFilmicToneMapping;
                  (gl as any).toneMappingExposure = 0.9;
                } catch (e) {
                  // non-fatal renderer property set failure
                }

                // canvas DOM sizing is handled by three.js when using gl.setSize(..., true)
              }}
            >
              <CameraAspectUpdater width={canvasSize.w} height={canvasSize.h} />
              {/* Background & lighting adapt to nightMode */}
              <color
                attach="background"
                args={[nightMode ? "#020217" : "#020617"]}
              />
              {/* Scene fog for depth / snow haze. Controlled by debug UI (toggle with ` key). */}
              {fogMode === "exp2" && (
                // FogExp2: soft exponential haze tuned by density
                <fogExp2 attach="fog" args={[0x0d0d1a, fogDensity]} />
              )}
              {fogMode === "linear" && (
                // Linear fog: start/end (useful when camera is far away)
                <fog attach="fog" args={[0x0d0d1a, fogStart, fogEnd]} />
              )}
              {/* Lighting — values adjust when nightMode is active */}
              {}
              <ambientLight
                intensity={nightMode ? 0.25 : 0.45}
                color="#fef9c3"
              />
              <hemisphereLight
                color="#f8fafc"
                groundColor="#0f172a"
                intensity={nightMode ? 0.25 : 0.45}
              />
              <directionalLight
                position={[20, 30, 20]}
                intensity={nightMode ? 0.6 : 0.9}
                color={nightMode ? "#e8f3ff" : "#fff7ed"}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-far={50}
                shadow-camera-left={-30}
                shadow-camera-right={30}
                shadow-camera-top={30}
                shadow-camera-bottom={-30}
                shadow-bias={-0.0005}
                shadow-normalBias={0.05}
                shadow-radius={2}
              />
              <spotLight
                position={[0, 45, 10]}
                intensity={0.95}
                angle={Math.PI / 5}
                penumbra={0.6}
                decay={1.5}
                color="#fde68a"
                castShadow
                shadow-bias={-0.0005}
                shadow-normalBias={0.02}
              />
              <spotLight
                position={[0, 35, -25]}
                intensity={0.85}
                angle={Math.PI / 6}
                penumbra={0.7}
                decay={1.3}
                color="#c7d2fe"
                castShadow
                shadow-bias={-0.0006}
                shadow-normalBias={0.02}
              />
              {[
                [-15, 6, 0],
                [15, 6, 0],
                [0, 4, 18],
              ].map((pos, idx) => (
                <pointLight
                  key={`track-glow-${idx}`}
                  position={pos as [number, number, number]}
                  intensity={0.6}
                  distance={30}
                  color={idx === 2 ? "#fbbf24" : "#38bdf8"}
                  castShadow={idx === 2}
                />
              ))}
              <Environment preset="sunset" blur={0.65} />

              {/* Stars and postprocessing */}
              {nightMode && (
                <Stars
                  radius={120}
                  depth={60}
                  count={3000}
                  factor={4}
                  saturation={0}
                  fade
                  speed={0.02}
                />
              )}

              {/* Postprocessing: Bloom via @react-three/postprocessing */}
              <EffectComposer multisampling={0}>
                {/* Balanced bloom: slightly higher threshold and lower intensity for subtle glow */}
                <Bloom
                  luminanceThreshold={0.75}
                  luminanceSmoothing={0.12}
                  intensity={0.55}
                  radius={0.45}
                />
                {/* // Runtime TypeError
Cannot read properties of undefined (reading 'replace')
                <ChromaticAberration
                  blendFunction={1}
                  offset={[0.0006, 0.0012]}
                /> */}
                <Vignette eskil={false} offset={0.35} darkness={0.5} />
                <Noise opacity={0.03} />
                <SMAA />
              </EffectComposer>

              {/* Soft contact shadows for objects on the ground */}
              <ContactShadows
                position={[0, 0.01, 0]}
                opacity={0.6}
                scale={240}
                blur={2}
                far={6}
              />

              {/* Global snow effect: lightweight world-space snow to add atmosphere. */}
              <Snow position={[0, 0, 0]} count={320} area={80} scale={2} />

              <Physics gravity={[0, -15, 0]}>
                {/* Ground plane - white for Christmas */}
                <RigidBody type="fixed" colliders="cuboid">
                  <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    receiveShadow
                    position={[0, 0, 0]}
                  >
                    <planeGeometry args={[200, 200]} />
                    <meshStandardMaterial
                      color="#eef6fb"
                      roughness={0.6}
                      metalness={0}
                      envMapIntensity={0.9}
                      bumpMap={groundTextures?.bumpMap}
                      bumpScale={0.06}
                      roughnessMap={groundTextures?.roughnessMap}
                    />
                  </mesh>
                </RigidBody>

                {/* Perimeter walls to keep players inside the map */}
                <group name="perimeter-walls">
                  {/* North wall (+Z) - lower so DVLA remains visible */}
                  <RigidBody type="fixed">
                    <CuboidCollider args={[100, 3, 2]} position={[0, 6, 100]} />
                    <mesh position={[0, 3, 100]} castShadow receiveShadow>
                      <boxGeometry args={[200, 6, 4]} />
                      <meshStandardMaterial
                        color="#d1d5db"
                        transparent
                        opacity={0.05}
                      />
                    </mesh>
                  </RigidBody>

                  {/* South wall (-Z) */}
                  <RigidBody type="fixed">
                    <CuboidCollider
                      args={[100, 3, 2]}
                      position={[0, 6, -100]}
                    />
                    <mesh position={[0, 3, -100]} castShadow receiveShadow>
                      <boxGeometry args={[200, 6, 4]} />
                      <meshStandardMaterial
                        color="#d1d5db"
                        transparent
                        opacity={0.05}
                      />
                    </mesh>
                  </RigidBody>

                  {/* East wall (+X) */}
                  <RigidBody type="fixed">
                    <CuboidCollider args={[2, 3, 100]} position={[100, 6, 0]} />
                    <mesh position={[100, 3, 0]} castShadow receiveShadow>
                      <boxGeometry args={[4, 6, 200]} />
                      <meshStandardMaterial
                        color="#d1d5db"
                        transparent
                        opacity={0.05}
                      />
                    </mesh>
                  </RigidBody>

                  {/* West wall (-X) */}
                  <RigidBody type="fixed">
                    <CuboidCollider
                      args={[2, 3, 100]}
                      position={[-100, 6, 0]}
                    />
                    <mesh position={[-100, 3, 0]} castShadow receiveShadow>
                      <boxGeometry args={[4, 6, 200]} />
                      <meshStandardMaterial
                        color="#d1d5db"
                        transparent
                        opacity={0.05}
                      />
                    </mesh>
                  </RigidBody>
                </group>

                {/* Decorative trees along the border (fixed) */}
                {borderTreePositions.map((pos, i) => (
                  <ChristmasTree
                    key={`border-tree-${i}`}
                    id={`bt-${i}`}
                    position={pos}
                    physics={false}
                  />
                ))}

                {/* Santa and reindeer are rendered from server destructibles via `DestructibleField` */}

                {/* Map shapes: runtime import removed. Use static map modules when needed. */}

                {/* <DVLABuilding /> */}
                {/* Custom model from ModelBuilder (temporary test placement) - removed
                      to avoid static duplicates. Destructibles will render MyBuilding
                      via `DestructibleField`. */}
                <DestructibleField destructibles={destructibles} />
                <DeliveryDropZones deliveries={deliveries} cars={cars} />
                <DeliveryTokens
                  deliveries={deliveries}
                  carrierElevations={carrierElevations}
                  interpolatedPositionsRef={interpolatedPositionsRef}
                  cars={cars}
                  localPlayerId={playerId}
                />

                {cars.map((car) => {
                  // Respect server-side invisibility or fallback to checking activePowerUps:
                  // don't render other players who are currently invisible.
                  const isInvisible =
                    car.hidden ||
                    (!!car.activePowerUps &&
                      car.activePowerUps.some(
                        (ap: any) =>
                          ap.type === "invisibility" &&
                          ap.expiresAt > Date.now()
                      ));
                  if (isInvisible && car.id !== playerId) return null;
                  const damage =
                    (car as any).damagePercent ??
                    Math.min(car.damage || 0, 100);
                  const destroyed = !!car.destroyed;
                  const bodyColor = destroyed
                    ? "#111827"
                    : damage > 65
                    ? "#3f3f46"
                    : car.color || "#ef4444";
                  const trimColor = destroyed
                    ? "#1f2937"
                    : damage > 45
                    ? "#155e75"
                    : "#111827";

                  const isReversing =
                    car.id === playerId && joystick.active && joystick.y > 0.3;

                  return (
                    <InterpolatedCar
                      key={car.id}
                      car={car}
                      positionsRef={interpolatedPositionsRef}
                      snapshotsRef={snapshotsRef}
                      interpolationDelayRef={interpolationDelayRef}
                      isMobile={isMobile}
                      trailColor={bodyColor}
                      localPlayerId={playerId}
                      playerInputRef={playerInputRef}
                    >
                      <CarModel
                        position={[0, 0, 0]}
                        rotation={[0, Math.PI, 0]}
                        bodyColor={bodyColor}
                        trimColor={trimColor}
                        isReversing={isReversing}
                        // If this car has an active invisibility power-up, render semi-transparent for the local player
                        alpha={
                          !!car.activePowerUps &&
                          car.activePowerUps.some(
                            (ap: any) =>
                              ap.type === "invisibility" &&
                              ap.expiresAt > Date.now()
                          )
                            ? 0.15
                            : 1
                        }
                        shieldActive={
                          !!car.activePowerUps &&
                          car.activePowerUps.some(
                            (ap: any) =>
                              ap.type === "shield" && ap.expiresAt > Date.now()
                          )
                        }
                      />

                      {/* Delivery pointers: when carrying show pointer to delivery target; otherwise show nearest delivery */}
                      {(() => {
                        // carried delivery
                        const carriedDelivery = car.carryingDeliveryId
                          ? deliveries.find(
                              (d) => d.id === car.carryingDeliveryId
                            )
                          : undefined;
                        const deliveryTarget = carriedDelivery
                          ? {
                              x: carriedDelivery.targetX,
                              y: carriedDelivery.targetY,
                              radius: carriedDelivery.targetRadius || 6.5,
                            }
                          : undefined;

                        // nearest delivery when not carrying
                        let nearestDelivery: DeliveryItem | null = null;
                        if (!car.carryingDeliveryId && deliveries.length > 0) {
                          let minD = Infinity;
                          for (const d of deliveries) {
                            if (
                              d.state !== "waiting" &&
                              !(d.state === "carried" && d.carrierId !== car.id)
                            )
                              continue;
                            const dx = d.x - car.x;
                            const dz = d.y - car.y;
                            const dist = Math.sqrt(dx * dx + dz * dz);
                            if (dist < minD) {
                              minD = dist;
                              nearestDelivery = d;
                            }
                          }
                        }

                        const deliveryPointerHeading = deliveryTarget
                          ? Math.atan2(
                              deliveryTarget.x - car.x,
                              deliveryTarget.y - car.y
                            )
                          : null;
                        const nearestDeliveryHeading = nearestDelivery
                          ? Math.atan2(
                              nearestDelivery.x - car.x,
                              nearestDelivery.y - car.y
                            )
                          : null;

                        // Resolve dynamic colors: prefer carrier/dropzone colors, fall back to player color then defaults
                        const carsMapForPointers = new Map<
                          string,
                          string | undefined
                        >((cars || []).map((c) => [c.id, c.color]));

                        const carriedCarrierColor =
                          carriedDelivery && carriedDelivery.carrierId
                            ? carsMapForPointers.get(carriedDelivery.carrierId)
                            : undefined;
                        const deliveryPointerColor =
                          carriedCarrierColor || car.color || "#22d3ee";
                        const deliveryPointerEmissive =
                          carriedCarrierColor || "#06b6d4";

                        const nearestCarrierColor =
                          nearestDelivery && nearestDelivery.carrierId
                            ? carsMapForPointers.get(nearestDelivery.carrierId)
                            : undefined;
                        const nearestPointerColor =
                          nearestCarrierColor || car.color || "#34d399";
                        const nearestPointerEmissive =
                          nearestCarrierColor || "#10b981";

                        return (
                          <>
                            {deliveryTarget &&
                              deliveryPointerHeading !== null && (
                                <group
                                  position={[0, 1.2, -0.15]}
                                  rotation={[
                                    0,
                                    deliveryPointerHeading - car.angle,
                                    0,
                                  ]}
                                >
                                  <mesh position={[0, 0, 1]}>
                                    <cylinderGeometry
                                      args={[0.05, 0.05, 0.05, 8]}
                                    />
                                    <meshStandardMaterial
                                      color={deliveryPointerColor}
                                      emissive={deliveryPointerEmissive}
                                      emissiveIntensity={0.6}
                                      opacity={0.7}
                                      transparent
                                    />
                                  </mesh>
                                  <mesh
                                    position={[0, 0, 2.6]}
                                    rotation={[Math.PI / 2, 0, 0]}
                                  >
                                    <coneGeometry args={[0.28, 1.45, 8]} />
                                    <meshStandardMaterial
                                      color={deliveryPointerColor}
                                      emissive={deliveryPointerEmissive}
                                      emissiveIntensity={1}
                                    />
                                  </mesh>
                                </group>
                              )}

                            {nearestDelivery &&
                              nearestDeliveryHeading !== null && (
                                <group
                                  position={[0, 1.2, -0.15]}
                                  rotation={[
                                    0,
                                    nearestDeliveryHeading - car.angle,
                                    0,
                                  ]}
                                >
                                  <mesh position={[0, 0, 1]}>
                                    <cylinderGeometry
                                      args={[0.05, 0.05, 0.05, 8]}
                                    />
                                    <meshStandardMaterial
                                      color={nearestPointerColor}
                                      emissive={nearestPointerEmissive}
                                      emissiveIntensity={0.6}
                                      opacity={0.7}
                                      transparent
                                    />
                                  </mesh>
                                  <mesh
                                    position={[0, 0, 2.6]}
                                    rotation={[Math.PI / 2, 0, 0]}
                                  >
                                    <coneGeometry args={[0.28, 1.45, 8]} />
                                    <meshStandardMaterial
                                      color={nearestPointerColor}
                                      emissive={nearestPointerEmissive}
                                      emissiveIntensity={1}
                                    />
                                  </mesh>
                                </group>
                              )}
                          </>
                        );
                      })()}
                    </InterpolatedCar>
                  );
                })}
              </Physics>

              {/* Collision effects - variants: powerup vs collision */}
              {collisionEffects.map((effect) => (
                <group key={effect.id} position={effect.position}>
                  {effect.kind === "powerup" ? (
                    <>
                      <Fire
                        position={[0, 0, 0]}
                        scale={0.45}
                        count={24}
                        color={effect.color || "#ffffff"}
                      />
                      <Sparks
                        position={[0, 0, 0]}
                        scale={0.45}
                        count={12}
                        color={effect.color || "#ffffff"}
                      />
                    </>
                  ) : (
                    <>
                      <Smoke
                        position={[0, 0, 0]}
                        scale={0.3}
                        count={20}
                        color={effect.color || "#888888"}
                      />
                      <Sparks
                        position={[0, 0, 0]}
                        scale={0.5}
                        count={30}
                        color={effect.color || "#ff9500"}
                      />
                    </>
                  )}
                </group>
              ))}

              {/* Debug: world-space shield markers (rendered from interpolated positions to ensure visibility)
                    This is a fallback visual if the model-attached bubble isn't appearing. */}
              {cars.map((car) => {
                const hasShield =
                  !!car.activePowerUps &&
                  car.activePowerUps.some(
                    (ap: any) =>
                      ap.type === "shield" && ap.expiresAt > Date.now()
                  );
                if (!hasShield) return null;
                const pos = interpolatedPositionsRef.current.get(car.id);
                const y = carrierElevations?.[car.id] ?? car.z ?? 0.6;
                if (!pos) return null;
                return (
                  <mesh
                    key={`shield-debug-${car.id}`}
                    position={[pos.x, y + 0.55, pos.y]}
                    renderOrder={1000}
                  >
                    <sphereGeometry args={[1.6, 12, 10]} />
                    <meshBasicMaterial
                      color="#3b82f6"
                      transparent
                      opacity={0.16}
                      depthWrite={false}
                      depthTest={false}
                    />
                  </mesh>
                );
              })}

              {/* PowerUps */}
              {powerUps.map((powerUp) => (
                <PowerUp
                  key={powerUp.id}
                  type={powerUp.type}
                  position={[powerUp.x, powerUp.z || 0.8, powerUp.y]}
                  collected={powerUp.collected}
                />
              ))}

              {isMobile ? (
                <FollowCamera
                  playerId={playerId}
                  cars={cars}
                  isMobile={isMobile}
                  mobileHeight={6}
                />
              ) : (
                <OrbitControls
                  enableDamping
                  dampingFactor={0.05}
                  minDistance={30}
                  maxDistance={100}
                  maxPolarAngle={Math.PI / 2.5}
                />
              )}
            </Canvas>
            {/* </div> */}
          </div>
        </div>

        {/* Final leaderboard / end-of-match overlay */}
        {gameState === "finished" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl px-4">
            <div className="max-w-5xl w-full bg-white/5 border border-white/20 rounded-3xl p-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-extrabold text-amber-200 drop-shadow">
                  🎄 Merry Christmas! 🎄
                </h2>
                <p className="text-slate-200">
                  Deliveries complete — here are the final standings.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-slate-900/60 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-200">
                    Final Leaderboard
                  </p>
                  <ol className="space-y-2 text-left">
                    {liveLeaderboard.slice(0, 8).map((entry, index) => (
                      <li
                        key={entry.id}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl ${
                          entry.id === playerId
                            ? "bg-blue-500/30"
                            : "bg-white/5"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            #{index + 1}
                          </span>
                          <span
                            className="w-3 h-3 rounded-full inline-block"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-slate-200 font-medium ml-2">
                            {entry.name}
                          </span>
                        </span>
                        <div className="text-right">
                          <div className="text-slate-300 font-mono">
                            {entry.score} pts
                          </div>
                          <div className="text-xs text-slate-400">
                            {deliveriesByPlayer[entry.id] || 0} deliveries
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="bg-slate-900/60 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-200">
                    Match Summary
                  </p>
                  <div className="text-sm text-slate-300">
                    <p>Players: {cars.length}</p>
                    <p>Deliveries delivered: {deliveredCount}</p>
                    <p>
                      Final time:{" "}
                      {timerState
                        ? formatMatchTime(timerState.durationMs)
                        : "—"}
                    </p>
                  </div>

                  <div className="pt-3">
                    <p className="text-sm font-semibold text-slate-200">
                      Recent Events
                    </p>
                    {recentEvents.length === 0 ? (
                      <p className="text-xs text-slate-400 mt-2">
                        No notable events.
                      </p>
                    ) : (
                      <ol className="mt-2 space-y-2 text-left max-h-48 overflow-auto">
                        {recentEvents.map((ev) => (
                          <li key={ev.id} className="flex items-start gap-2">
                            <div className="text-xs text-slate-400 w-20">
                              {new Date(ev.timestamp).toLocaleTimeString()}
                            </div>
                            <div className="flex-1 text-sm text-slate-200">
                              <span className="font-medium text-slate-100">
                                {ev.playerName === "system"
                                  ? "System"
                                  : ev.playerName}
                              </span>
                              <span className="text-slate-300">
                                {" "}
                                — {ev.description}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              {ev.points ? `+${ev.points}` : ""}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-center mt-6">
                <Link href="/">
                  <button className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg text-white font-semibold">
                    End Game
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* PowerUp legend removed (moved into Info modal) */}

        {/* Active PowerUps Display */}
        {activePowerUps.length > 0 && (
          <div className="absolute top-24 right-6 z-10 space-y-2">
            {activePowerUps.map((powerUp, index) => {
              const config = POWERUP_CONFIGS[powerUp.type];
              const remaining = Math.max(0, powerUp.expiresAt - Date.now());
              const progress =
                config.duration > 0 ? remaining / config.duration : 0;
              return (
                <div
                  key={`${powerUp.type}-${powerUp.expiresAt}-${index}`}
                  className="w-48 bg-slate-900/80 backdrop-blur-sm rounded-xl p-2 border border-white/10 flex items-center gap-3"
                >
                  <div className="text-2xl" style={{ width: 36 }}>
                    {config.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white">
                        {config.name}
                      </div>
                      <div className="text-xs text-slate-300 tabular-nums">
                        {(remaining / 1000).toFixed(1)}s
                      </div>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded mt-2 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
                          background: config.accentColor || config.baseColor,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile: compact active powerups bar (visible above mobile controls) */}
        {isMobile && activePowerUps.length > 0 && (
          <div className="absolute z-30 left-1/2 transform -translate-x-1/2 bottom-36 flex gap-2 px-2">
            {activePowerUps.map((powerUp, index) => {
              const cfg = POWERUP_CONFIGS[powerUp.type];
              const remaining = Math.max(0, powerUp.expiresAt - Date.now());
              const progress = cfg.duration > 0 ? remaining / cfg.duration : 0;
              return (
                <div
                  key={`${powerUp.type}-${powerUp.expiresAt}-${index}-mobile`}
                  className="w-24 bg-slate-900/80 backdrop-blur-sm rounded-xl p-2 border border-white/10 flex flex-col items-center text-center"
                >
                  <div className="text-lg">{cfg.icon}</div>
                  <div className="text-xs text-slate-300 mt-1">{cfg.name}</div>
                  {cfg.duration > 0 && (
                    <div className="w-full h-1 bg-white/10 rounded mt-2 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
                          background: cfg.accentColor || cfg.baseColor,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <footer className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900/80 to-transparent backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold">Players ({cars.length}):</span>
            {cars.length === 0 ? (
              <span className="text-slate-400">Waiting for players...</span>
            ) : (
              cars.map((c) => {
                const cInvisible =
                  c.hidden ||
                  (!!c.activePowerUps &&
                    c.activePowerUps.some(
                      (ap: any) =>
                        ap.type === "invisibility" && ap.expiresAt > Date.now()
                    ));
                if (cInvisible && c.id !== playerId) {
                  return (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 text-slate-500"
                    >
                      <span className="w-3 h-3 rounded-full inline-block bg-gray-600/40" />
                      (hidden)
                    </span>
                  );
                }
                return (
                  <span
                    key={c.id}
                    className={`inline-flex items-center gap-1 ${
                      c.id === playerId
                        ? "font-bold text-blue-400"
                        : "text-slate-300"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                    {c.id === playerId && " (You)"}
                    {c.destroyed ? (
                      <span className="text-red-400 text-xs ml-1">💥</span>
                    ) : (
                      <span className="text-slate-400 text-xs ml-1">
                        {(
                          ((c as any).damagePercent ??
                            Math.min(c.damage || 0, 100)) as number
                        ).toFixed(0)}
                        %
                      </span>
                    )}
                  </span>
                );
              })
            )}
          </div>
        </footer>

        {/* Speedometer & Damage Indicator */}
        {myCar && (
          <div className="absolute bottom-24 right-8 space-y-3">
            {/* Speedometer (candy-cane striped border wrapper) */}
            <div
              style={{
                padding: 3,
                borderRadius: 12,
                display: "inline-block",
                background:
                  "repeating-linear-gradient(45deg,#ffffff 0 8px,#ef4444 8px 16px)",
              }}
            >
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-4">
                <div className="text-center">
                  <div className="text-5xl font-bold text-blue-400 mb-1">
                    {Math.abs(myCar.speed).toFixed(0)}
                  </div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">
                    {myCar.speed >= 0 ? "Speed" : "Reverse"}
                  </div>
                </div>
              </div>
            </div>

            {/* Damage Indicator (candy-cane striped border wrapper) */}
            <div
              style={{
                padding: 3,
                borderRadius: 12,
                display: "inline-block",
                background:
                  "repeating-linear-gradient(45deg,#ffffff 0 8px,#ef4444 8px 16px)",
              }}
            >
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-4">
                <div className="text-center">
                  <div
                    className="text-2xl font-bold mb-1"
                    style={{
                      color: myCar.destroyed
                        ? "#ef4444"
                        : ((myCar as any).damagePercent ??
                            Math.min(myCar.damage || 0, 100)) > 70
                        ? "#ef4444"
                        : ((myCar as any).damagePercent ??
                            Math.min(myCar.damage || 0, 100)) > 40
                        ? "#eab308"
                        : "#22c55e",
                    }}
                  >
                    {myCar.destroyed
                      ? "WRECKED"
                      : `${(
                          ((myCar as any).damagePercent ??
                            Math.min(myCar.damage || 0, 100)) as number
                        ).toFixed(0)}%`}
                  </div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">
                    Damage
                  </div>
                  {myCar.destroyed ? (
                    <div className="text-xs text-red-400 mt-1">
                      Systems offline
                    </div>
                  ) : ((myCar as any).damagePercent ??
                      Math.min(myCar.damage || 0, 100)) > 50 ? (
                    <div className="text-xs text-red-400 mt-1">⚠️ Critical</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Log Panel (extracted) */}
        <DebugPanel
          debugLogs={debugLogs}
          onClear={() => setDebugLogs([])}
          visible={debugVisible && !isMobile}
        />

        {/* Interpolation tuner removed - using stored defaults in InterpolatedCar */}

        {/* Measurement overlay - shows main/rotator rects + canvasSize for debugging on mobile */}
        {/* Measurement overlay removed per request */}

        {/* Mobile controls (extracted) */}
        <MobileControls
          isMobile={isMobile}
          joystickBaseRef={joystickBaseRef}
          joystick={joystick}
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerEnd={handleJoystickPointerEnd}
          acceleratorHeld={acceleratorHeld}
          brakeHeld={brakeHeld}
          setAcceleratorHeld={setAcceleratorHeld}
          setBrakeHeld={setBrakeHeld}
        />
      </div>
    </main>
  );
}
