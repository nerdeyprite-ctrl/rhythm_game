import type { ChartEvolutionLevel } from "@/lib/rhythmEngine";

export const LANE_LAYOUTS = {
  2: [
    { label: "F", code: "KeyF" },
    { label: "J", code: "KeyJ" }
  ],
  3: [
    { label: "D", code: "KeyD" },
    { label: "F", code: "KeyF" },
    { label: "J", code: "KeyJ" }
  ],
  4: [
    { label: "D", code: "KeyD" },
    { label: "F", code: "KeyF" },
    { label: "J", code: "KeyJ" },
    { label: "K", code: "KeyK" }
  ]
} as const;

export type LaneCount = keyof typeof LANE_LAYOUTS;
export type DifficultyId = ChartEvolutionLevel;

export const GAME_DURATION_MS = 48000;
export const BASE_TRAVEL_MS = 1500;
export const HIT_LINE_BOTTOM_OFFSET_PX = 72;
export const NOTE_ENTRY_CENTER_Y = -280;
export const NOTE_EXIT_EXTRA_PX = 190;
export const NOTE_PAST_HIT_BUFFER_MS = 260;

export const MAX_HP = 100;

export const HOLD_TICK_SCORE = 18;
export const HOLD_TICK_INTERVAL_MS = 120;
export const HOLD_RELEASE_TOLERANCE_MS = 70;

export type DifficultyPreset = {
  id: ChartEvolutionLevel;
  label: string;
  density: number;
  holdRatio: number;
  chordRatio: number;
  judgeScale: number;
  missBaseDamage: number;
  missStreakStep: number;
  missDamageCap: number;
  hpRegenPerSec: number;
  hpRegenDelayMs: number;
  includeHolds: boolean;
  includeChords: boolean;
};

export const DIFFICULTY_PRESETS: Record<ChartEvolutionLevel, DifficultyPreset> = {
  calm: {
    id: "calm",
    label: "CALM",
    density: 0.72,
    holdRatio: 0.18,
    chordRatio: 0.1,
    judgeScale: 1.15,
    missBaseDamage: 5.4,
    missStreakStep: 1.6,
    missDamageCap: 16,
    hpRegenPerSec: 8.2,
    hpRegenDelayMs: 620,
    includeHolds: true,
    includeChords: false
  },
  flow: {
    id: "flow",
    label: "FLOW",
    density: 0.94,
    holdRatio: 0.34,
    chordRatio: 0.28,
    judgeScale: 1,
    missBaseDamage: 7,
    missStreakStep: 2.2,
    missDamageCap: 22,
    hpRegenPerSec: 6.5,
    hpRegenDelayMs: 900,
    includeHolds: true,
    includeChords: true
  },
  surge: {
    id: "surge",
    label: "SURGE",
    density: 1.14,
    holdRatio: 0.5,
    chordRatio: 0.46,
    judgeScale: 0.86,
    missBaseDamage: 8.6,
    missStreakStep: 3,
    missDamageCap: 27,
    hpRegenPerSec: 4.8,
    hpRegenDelayMs: 1180,
    includeHolds: true,
    includeChords: true
  }
};

export const DIFFICULTY_ORDER: ChartEvolutionLevel[] = ["calm", "flow", "surge"];
