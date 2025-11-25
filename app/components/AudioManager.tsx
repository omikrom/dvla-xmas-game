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
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playlistRef = useRef<Playlist>([]);
  const indexRef = useRef<number>(0);
  const playRequestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const isFadingRef = useRef(false);
  const [requiresUserGesture, setRequiresUserGesture] = useState(false);

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

      // fade in
      await fadeVolume(audio, 0, 0.7, 1000).catch(() => {});

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
        await Promise.all([
          fadeVolume(nextAudio, 0, 0.7, 900).catch(() => {}),
          old
            ? fadeVolume(old, old.volume, 0, 900).catch(() => {})
            : Promise.resolve(),
        ]).catch(() => {});
        try {
          old && old.pause();
        } catch (e) {}
        // set handler again
        nextAudio.onended = audio.onended;
      };
    };

    const handlePlayLobby = () => {
      const idx = Math.floor(Math.random() * Math.max(1, lobbyPlaylist.length));
      playTrack(lobbyPlaylist, idx).catch(() => {});
    };
    const handlePlayRacing = () => {
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
    };

    const handleToggle = () => {
      const cur = currentAudioRef.current;
      if (cur && !cur.paused) {
        handleStop().catch(() => {});
      } else {
        // start lobby playlist
        handlePlayLobby();
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
        await Promise.all([
          fadeVolume(following, 0, 0.7, 900).catch(() => {}),
          prev ? fadeVolume(prev, prev.volume, 0, 900).catch(() => {}) : Promise.resolve(),
        ]).catch(() => {});
        try {
          prev && prev.pause();
        } catch (e) {}
        following.onended = nextAudio.onended;
      };
      // perform crossfade
      await Promise.all([
        fadeVolume(nextAudio, 0, 0.7, 900).catch(() => {}),
        old ? fadeVolume(old, old.volume, 0, 900).catch(() => {}) : Promise.resolve(),
      ]).catch(() => {});
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
        if (!cur) return;
        if (fadeMs && fadeMs > 0) {
          await fadeVolume(cur, cur.volume || 0, target, fadeMs).catch(
            () => {}
          );
        } else {
          cur.volume = target;
        }
        // notify UI
        try {
          window.dispatchEvent(
            new CustomEvent("audio:volume", { detail: { volume: cur.volume } })
          );
        } catch (e) {}
      } catch (e) {}
    };

    // Start lobby music by default
    handlePlayLobby();

    window.addEventListener("audio:playLobby", handlePlayLobby);
    window.addEventListener("audio:playRacing", handlePlayRacing);
    window.addEventListener("audio:stop", handleStop as any);
    window.addEventListener("audio:toggle", handleToggle as any);
    window.addEventListener("audio:next", handleNext as any);
    window.addEventListener("audio:setVolume", handleSetVolume as any);

    // debug helpers (kept as named functions so we can remove them cleanly)
    const dbgLobby = () =>
      console.log("AudioManager: received audio:playLobby");
    const dbgRacing = () =>
      console.log("AudioManager: received audio:playRacing");
    window.addEventListener("audio:playLobby", dbgLobby);
    window.addEventListener("audio:playRacing", dbgRacing);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("audio:playLobby", handlePlayLobby);
      window.removeEventListener("audio:playRacing", handlePlayRacing);
      window.removeEventListener("audio:stop", handleStop as any);
      window.removeEventListener("audio:toggle", handleToggle as any);
      window.removeEventListener("audio:next", handleNext as any);
      window.removeEventListener("audio:setVolume", handleSetVolume as any);
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
        console.log("AudioManager: enableAudio() invoked — attempting play");
        await cur.play();
        setRequiresUserGesture(false);
        await fadeVolume(cur, cur.volume || 0, 0.7, 800).catch(() => {});
        return;
      } catch (err) {
        console.warn("EnableAudio: play() failed", err);
      }
    }

    // If there is no current audio (perhaps autoplay failed before creating), start lobby playlist
    const evt = new Event("audio:playLobby");
    window.dispatchEvent(evt);
    setRequiresUserGesture(false);
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
      console.log("AudioManager: user interaction detected, attempting resume");
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
