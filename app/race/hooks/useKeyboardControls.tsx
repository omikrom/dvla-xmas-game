"use client";

import { useEffect } from "react";

export const keys: Record<string, boolean> = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  w: false,
  s: false,
  a: false,
  d: false,
  " ": false,
};

export default function useKeyboardControls() {
  useEffect(() => {
    const downHandler = (e: KeyboardEvent) => {
      if (e.key in keys) keys[e.key] = true;
    };
    const upHandler = (e: KeyboardEvent) => {
      if (e.key in keys) keys[e.key] = false;
    };
    window.addEventListener("keydown", downHandler);
    window.addEventListener("keyup", upHandler);
    return () => {
      window.removeEventListener("keydown", downHandler);
      window.removeEventListener("keyup", upHandler);
    };
  }, []);
}
