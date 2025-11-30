"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Playlist = string[];

function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  duration = 800
) {
  const steps = 20;
  const stepTime = duration / steps;
  let currentStep = 0;
  const delta = (to - from) / steps;
  audio.volume = Math.max(0, Math.min(1, from));
  return new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      currentStep++;
      const v = Math.max(0, Math.min(1, audio.volume + delta));
      audio.volume = v;
      if (currentStep >= steps) {
        clearInterval(iv);
        audio.volume = Math.max(0, Math.min(1, to));
        resolve();
      }
    }, stepTime);
  });
}

export default function AudioManager() {
  const IS_DEBUG =
    (typeof window !== "undefined" && !!(window as any).__GAME_DEBUG__) ||
    process.env.NODE_ENV !== "production";
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playlistRef = useRef<Playlist>([]);
  const indexRef = useRef<number>(0);
  const playRequestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const isFadingRef = useRef(false);
  const [requiresUserGesture, setRequiresUserGesture] = useState(false);
  const lastVolumeRef = useRef<number>(0.7);
  const lastMutedRef = useRef<boolean>(false);
  const desiredStateRef = useRef<string | null>(null);

  function readAudioState() {
    try {
      // Prefer localStorage so user preferences persist across sessions.
      const raw =
        localStorage.getItem("GAME_AUDIO_STATE") ||
        sessionStorage.getItem("GAME_AUDIO_STATE");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { desired: "playing", volume: 0.7, muted: false };
  }

  function writeAudioState(obj: any) {
    try {
      // Persist to localStorage for cross-session persistence. Also
      // write to sessionStorage as a fallback for older sessions.
      try {
        localStorage.setItem("GAME_AUDIO_STATE", JSON.stringify(obj));
      } catch (e) {
        /* ignore localStorage errors */
      }
      try {
        sessionStorage.setItem("GAME_AUDIO_STATE", JSON.stringify(obj));
      } catch (e) {}
    } catch (e) {}
  }

  // Define playlists (public folder)
  const lobbyPlaylist = [
    "/christmas-rock-348506.mp3",
    "/christmas-blaze-264919.mp3",
    "/rock-happy-christmas-music-429976.mp3",
  ];
  const racingPlaylist = [
    "/alexander-nakarada-carol-of-the-bells-metal-version.mp3",
    "/electric-christmas-rumble-262180.mp3",
    "/rock-n-christmas-80s-127420.mp3",
    "/rock-happy-christmas-music-429976.mp3",
  ];

  useEffect(() => {
    mountedRef.current = true;
    // initialise persisted audio state
    try {
      const s = readAudioState();
      lastVolumeRef.current =
        typeof s.volume === "number" ? s.volume : lastVolumeRef.current;
      lastMutedRef.current = !!s.muted;
      desiredStateRef.current = s.desired || "playing";
    } catch (e) {}

    const playTrack = async (playlist: Playlist, startIndex = 0) => {
      // mark this play request so concurrent calls can be ignored
      playRequestIdRef.current += 1;
      const myPlayId = playRequestIdRef.current;
      if (!mountedRef.current) return;
      playlistRef.current = playlist;
      indexRef.current = startIndex % playlist.length;

      // stop existing audio gracefully (abort if another play request started)
      const cur = currentAudioRef.current;
      if (cur) {
        try {
          await fadeVolume(cur, cur.volume, 0, 600);
        } catch (e) {
          /* ignore */
        }
        if (playRequestIdRef.current !== myPlayId) {
          // another play request started while we were fading — abort
          return;
        }
        try {
          cur.pause();
        } catch (e) {}
        currentAudioRef.current = null;
      }

      const src = playlistRef.current[indexRef.current];
      const audio = new Audio(src);
      audio.loop = false;
      audio.volume = 0;
      currentAudioRef.current = audio;

      try {
        await audio.play();
      } catch (err) {
        // autoplay blocked until user interacts
        // signal UI to the user and bail — we'll start playback on user gesture
        console.warn("Audio play() rejected (autoplay blocked)", err);
        setRequiresUserGesture(true);
        return;
      }

      // fade in to the last known master volume
      const targetVol = Math.max(0, Math.min(1, lastVolumeRef.current || 0.7));
      await fadeVolume(audio, 0, targetVol, 1000).catch(() => {});
      lastVolumeRef.current = targetVol;

      // notify UI that audio is now playing
      try {
        window.dispatchEvent(
          new CustomEvent("audio:status", { detail: { playing: true } })
        );
      } catch (e) {}

      audio.onended = async () => {
        if (!mountedRef.current) return;
        indexRef.current = (indexRef.current + 1) % playlistRef.current.length;
        // crossfade to next
        const nextSrc = playlistRef.current[indexRef.current];
        const nextAudio = new Audio(nextSrc);
        nextAudio.volume = 0;
        nextAudio.play().catch(() => {});
        // fade out current and fade in next
        const old = currentAudioRef.current;
        currentAudioRef.current = nextAudio;
        const target = Math.max(0, Math.min(1, lastVolumeRef.current || 0.7));
        await Promise.all([
          fadeVolume(nextAudio, 0, target, 900).catch(() => {}),
          old
            ? fadeVolume(old, old.volume, 0, 900).catch(() => {})
            : Promise.resolve(),
        ]).catch(() => {});
        lastVolumeRef.current = target;
        try {
          old && old.pause();
        } catch (e) {}
        // set handler again
        nextAudio.onended = audio.onended;
      };
    };

    const handlePlayLobby = () => {
      // Respect explicit user stop preference
      if (desiredStateRef.current === "stopped") return;
      const idx = Math.floor(Math.random() * Math.max(1, lobbyPlaylist.length));
      playTrack(lobbyPlaylist, idx).catch(() => {});
    };
    const handlePlayRacing = () => {
      // Respect explicit user stop preference
      if (desiredStateRef.current === "stopped") return;
      const idx = Math.floor(
        Math.random() * Math.max(1, racingPlaylist.length)
      );
      playTrack(racingPlaylist, idx).catch(() => {});
    };

    const handleStop = async () => {
      const cur = currentAudioRef.current;
      if (cur) {
        try {
          await fadeVolume(cur, cur.volume || 0, 0, 600).catch(() => {});
        } catch (e) {}
        try {
          cur.pause();
        } catch (e) {}
        currentAudioRef.current = null;
      }
      // emit status
      try {
        window.dispatchEvent(
          new CustomEvent("audio:status", { detail: { playing: false } })
        );
      } catch (e) {}
      // persist desired stopped state
      try {
        desiredStateRef.current = "stopped";
        writeAudioState({
          desired: "stopped",
          volume: lastVolumeRef.current,
          muted: lastMutedRef.current,
        });
      } catch (e) {}
    };

    const handleToggle = () => {
      const cur = currentAudioRef.current;
      if (cur && !cur.paused) {
        handleStop().catch(() => {});
      } else {
        // start lobby playlist
        handlePlayLobby();
        try {
          desiredStateRef.current = "playing";
          writeAudioState({
            desired: "playing",
            volume: lastVolumeRef.current,
          });
        } catch (e) {}
      }
    };

    const handleNext = async () => {
      // advance index and crossfade to next track
      if (!playlistRef.current || playlistRef.current.length === 0) return;
      indexRef.current = (indexRef.current + 1) % playlistRef.current.length;
      const nextSrc = playlistRef.current[indexRef.current];
      const nextAudio = new Audio(nextSrc);
      nextAudio.volume = 0;
      // attempt to play next (may fail if autoplay is blocked)
      try {
        await nextAudio.play();
      } catch (e) {
        // ignore play failures — we'll still attempt a swap
      }
      const old = currentAudioRef.current;
      currentAudioRef.current = nextAudio;
      // set ended handler to continue playlist
      nextAudio.onended = async () => {
        if (!mountedRef.current) return;
        indexRef.current = (indexRef.current + 1) % playlistRef.current.length;
        const following = new Audio(playlistRef.current[indexRef.current]);
        following.volume = 0;
        following.play().catch(() => {});
        const prev = currentAudioRef.current;
        currentAudioRef.current = following;
        const target = Math.max(0, Math.min(1, lastVolumeRef.current || 0.7));
        await Promise.all([
          fadeVolume(following, 0, target, 900).catch(() => {}),
          prev
            ? fadeVolume(prev, prev.volume, 0, 900).catch(() => {})
            : Promise.resolve(),
        ]).catch(() => {});
        try {
          prev && prev.pause();
        } catch (e) {}
        following.onended = nextAudio.onended;
      };
      // perform crossfade
      const target = Math.max(0, Math.min(1, lastVolumeRef.current || 0.7));
      await Promise.all([
        fadeVolume(nextAudio, 0, target, 900).catch(() => {}),
        old
          ? fadeVolume(old, old.volume, 0, 900).catch(() => {})
          : Promise.resolve(),
      ]).catch(() => {});
      lastVolumeRef.current = target;
      try {
        old && old.pause();
      } catch (e) {}
    };

    const handleSetVolume = async (ev: any) => {
      try {
        const detail = ev.detail || {};
        const target = Math.max(0, Math.min(1, Number(detail.volume) || 0));
        const fadeMs = typeof detail.fadeMs === "number" ? detail.fadeMs : 0;
        const cur = currentAudioRef.current;
        if (!cur) {
          // no active audio — store master volume for next track
          lastVolumeRef.current = target;
          // Changing volume implies user intent — clear muted flag
          lastMutedRef.current = false;
          // notify UI
          try {
            window.dispatchEvent(
              new CustomEvent("audio:volume", {
                detail: { volume: target, muted: lastMutedRef.current },
              })
            );
          } catch (e) {}
          return;
        }
        if (fadeMs && fadeMs > 0) {
          await fadeVolume(cur, cur.volume || 0, target, fadeMs).catch(
            () => {}
          );
        } else {
          cur.volume = target;
        }
        lastVolumeRef.current = cur.volume;
        // Changing volume implies user intent — clear muted flag
        lastMutedRef.current = false;
        // notify UI
        try {
          window.dispatchEvent(
            new CustomEvent("audio:volume", {
              detail: { volume: cur.volume, muted: lastMutedRef.current },
            })
          );
        } catch (e) {}
        try {
          writeAudioState({
            desired: desiredStateRef.current || "playing",
            volume: lastVolumeRef.current,
            muted: lastMutedRef.current,
          });
        } catch (e) {}
      } catch (e) {}
    };

    const handleSetMuted = async (ev: any) => {
      try {
        const detail = ev.detail || {};
        const muted =
          typeof detail.muted === "boolean"
            ? detail.muted
            : !lastMutedRef.current;
        lastMutedRef.current = muted;
        const cur = currentAudioRef.current;
        if (cur) {
          try {
            cur.volume = muted
              ? 0
              : Math.max(0, Math.min(1, lastVolumeRef.current || 0.7));
          } catch (e) {}
        }
        // notify UI about volume + muted state
        try {
          window.dispatchEvent(
            new CustomEvent("audio:volume", {
              detail: { volume: muted ? 0 : lastVolumeRef.current, muted },
            })
          );
          window.dispatchEvent(
            new CustomEvent("audio:status", {
              detail: {
                playing: !!(
                  currentAudioRef.current && !currentAudioRef.current.paused
                ),
                muted,
              },
            })
          );
        } catch (e) {}
        try {
          writeAudioState({
            desired: desiredStateRef.current || "playing",
            volume: lastVolumeRef.current,
            muted: lastMutedRef.current,
          });
        } catch (e) {}
      } catch (e) {}
    };

    // Do not auto-start music on mount. Playback should only begin in
    // response to explicit `audio:playLobby` / `audio:playRacing` events.
    // This prevents navigation (eg. entering `/race`) from starting audio
    // unexpectedly if the user previously stopped playback.

    window.addEventListener("audio:playLobby", handlePlayLobby);
    window.addEventListener("audio:playRacing", handlePlayRacing);
    window.addEventListener("audio:stop", handleStop as any);
    window.addEventListener("audio:toggle", handleToggle as any);
    window.addEventListener("audio:next", handleNext as any);
    window.addEventListener("audio:setVolume", handleSetVolume as any);
    window.addEventListener("audio:setMuted", handleSetMuted as any);
    window.addEventListener("audio:toggleMuted", handleSetMuted as any);

    // debug helpers (kept as named functions so we can remove them cleanly)
    const dbgLobby = () =>
      IS_DEBUG && console.log("AudioManager: received audio:playLobby");
    const dbgRacing = () =>
      IS_DEBUG && console.log("AudioManager: received audio:playRacing");
    window.addEventListener("audio:playLobby", dbgLobby);
    window.addEventListener("audio:playRacing", dbgRacing);

    // Emit initial UI state so controls can initialize to user's preferences.
    try {
      window.dispatchEvent(
        new CustomEvent("audio:volume", {
          detail: {
            volume: lastMutedRef.current ? 0 : lastVolumeRef.current,
            muted: lastMutedRef.current,
          },
        })
      );
      window.dispatchEvent(
        new CustomEvent("audio:status", {
          detail: { playing: false, muted: lastMutedRef.current },
        })
      );
    } catch (e) {}

    return () => {
      mountedRef.current = false;
      window.removeEventListener("audio:playLobby", handlePlayLobby);
      window.removeEventListener("audio:playRacing", handlePlayRacing);
      window.removeEventListener("audio:stop", handleStop as any);
      window.removeEventListener("audio:toggle", handleToggle as any);
      window.removeEventListener("audio:next", handleNext as any);
      window.removeEventListener("audio:setVolume", handleSetVolume as any);
      window.removeEventListener("audio:setMuted", handleSetMuted as any);
      window.removeEventListener("audio:toggleMuted", handleSetMuted as any);
      window.removeEventListener("audio:playLobby", dbgLobby);
      window.removeEventListener("audio:playRacing", dbgRacing);
      const cur = currentAudioRef.current;
      if (cur) {
        try {
          cur.pause();
        } catch (e) {}
      }
    };
  }, []);

  const enableAudio = useCallback(async () => {
    const cur = currentAudioRef.current;
    if (cur) {
      try {
        IS_DEBUG &&
          console.log("AudioManager: enableAudio() invoked — attempting play");
        await cur.play();
        setRequiresUserGesture(false);
        const target = Math.max(0, Math.min(1, lastVolumeRef.current || 0.7));
        await fadeVolume(cur, cur.volume || 0, target, 800).catch(() => {});
        return;
      } catch (err) {
        console.warn("EnableAudio: play() failed", err);
      }
    }

    // If there is no current audio (perhaps autoplay failed before creating), start lobby playlist
    const evt = new Event("audio:playLobby");
    window.dispatchEvent(evt);
    setRequiresUserGesture(false);
    try {
      desiredStateRef.current = "playing";
      writeAudioState({ desired: "playing", volume: lastVolumeRef.current });
    } catch (e) {}
  }, []);

  // Listen for playback start to inform UI
  useEffect(() => {
    // when we begin playback via playTrack we dispatch status events in a couple places
    const notifyPlaying = () => {
      try {
        window.dispatchEvent(
          new CustomEvent("audio:status", { detail: { playing: true } })
        );
      } catch (e) {}
    };
    // attach to global handlers to try to catch when current audio changes
    window.addEventListener("audio:playLobby", notifyPlaying);
    window.addEventListener("audio:playRacing", notifyPlaying);
    return () => {
      window.removeEventListener("audio:playLobby", notifyPlaying);
      window.removeEventListener("audio:playRacing", notifyPlaying);
    };
  }, []);

  // Auto-resume audio on first user gesture (pointer or key press).
  // This helps when autoplay was blocked on mount — a single user gesture
  // anywhere on the page will trigger playback without needing the floating
  // button click specifically.
  useEffect(() => {
    if (!requiresUserGesture) return;
    const onUserGesture = () => {
      IS_DEBUG &&
        console.log(
          "AudioManager: user interaction detected, attempting resume"
        );
      enableAudio();
    };
    window.addEventListener("pointerdown", onUserGesture, { once: true });
    window.addEventListener("keydown", onUserGesture, { once: true });
    return () => {
      try {
        window.removeEventListener("pointerdown", onUserGesture as any);
        window.removeEventListener("keydown", onUserGesture as any);
      } catch (e) {}
    };
  }, [requiresUserGesture, enableAudio]);

  return (
    <>
      {requiresUserGesture ? (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 9999,
          }}
        >
          <button
            onClick={() => {
              enableAudio();
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#111",
              color: "#ffd76a",
              border: "1px solid rgba(255,215,106,0.15)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Enable Audio
          </button>
        </div>
      ) : null}
    </>
  );
}
