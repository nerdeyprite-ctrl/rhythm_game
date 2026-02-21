export const SPEED_LEVELS = [
  { id: "speed-085", label: "x0.85", multiplier: 0.85 },
  { id: "speed-100", label: "x1.00", multiplier: 1.0 },
  { id: "speed-115", label: "x1.15", multiplier: 1.15 },
  { id: "speed-130", label: "x1.30", multiplier: 1.3 }
] as const;

export const DEFAULT_SPEED_INDEX = 1;
const MIN_TRAVEL_DURATION_MS = 520;
const BASE_PLAY_SPEED = 0.5;

export function scaleTravelDurationMs(baseDurationMs: number, speed: number) {
  const effectiveSpeed = Math.max(0.1, speed * BASE_PLAY_SPEED);
  return Math.max(
    MIN_TRAVEL_DURATION_MS,
    Math.round(baseDurationMs / effectiveSpeed)
  );
}

export function formatSpeedLabel(speed: number) {
  return `x${speed.toFixed(2)}`;
}
