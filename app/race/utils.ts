export const clamp = (value: number, min = -1, max = 1) =>
  Math.max(min, Math.min(max, value));

export const describeScoreBurst = (amount: number) => {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (amount >= 200)
    return pick([
      "Special delivery!",
      "Certified legend!",
      "Top-tier motorist!",
      "DVLA: Exceptional driving!",
    ]);

  if (amount >= 100)
    return pick([
      "Massive impact!",
      "Turbo triumph!",
      "Licence-worthy collision!",
      "DVLA: Nearly earned extra points!",
    ]);

  if (amount >= 75)
    return pick([
      "Holiday heist!",
      "Festive smash!",
      "Driving test pass? Almost!",
      "DVLA: You've got style behind the wheel!",
    ]);

  if (amount >= 25)
    return pick([
      "Licence secured!",
      "Provisional licence issued!",
      "Driving legend in training!",
      "DVLA: Santa would approve!",
    ]);

  return pick(["Keep smashing!", "Tidy turn!", "Nice nudge!", "Careful now!"]);
};

export const COUNTDOWN_DURATION_MS = 3000;
export const GO_FLASH_MS = 900;

export const formatMatchTime = (matchTimeMs: number) => {
  if (!Number.isFinite(matchTimeMs) || matchTimeMs < 0) return "0:00";
  const totalSeconds = Math.floor(matchTimeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};
