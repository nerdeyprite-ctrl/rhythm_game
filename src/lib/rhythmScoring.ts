import type { ChartEvolutionLevel } from "@/lib/rhythmEngine";

export type HitGrade = "PERFECT" | "GREAT" | "GOOD";
export type HitCounts = {
  PERFECT: number;
  GREAT: number;
  GOOD: number;
  MISS: number;
};
export type MissionKey = "precision" | "hold" | "fever";

export const FEVER_THRESHOLD = 100;
const FEVER_DURATION_MS = 7200;
const FEVER_SCORE_MULTIPLIER = 1.55;
const FEVER_HOLD_COMPLETE_MULTIPLIER = 1.35;
const FEVER_HOLD_TICK_MULTIPLIER = 1.4;
const FEVER_DRAIN_PER_MISS_MS = 420;
export const MISSION_HP_BONUS = 11;

const SCORE_PER_HIT = {
  PERFECT: 320,
  GREAT: 220,
  GOOD: 120
} as const;
const HOLD_COMPLETE_BONUS = 180;
const GROOVE_GAIN = {
  PERFECT: 8,
  GREAT: 5,
  GOOD: 3
} as const;
const GROOVE_LOSS_PER_MISS = 16;
const MISSION_REWARDS = {
  precision: 1900,
  hold: 1300,
  fever: 1700
} as const;

export function calculateGroovePercent(groove: number) {
  return Math.max(0, Math.min(100, Math.round((groove / FEVER_THRESHOLD) * 100)));
}

export function calculateAccuracyPercent(hitCounts: HitCounts) {
  const totalJudged =
    hitCounts.PERFECT + hitCounts.GREAT + hitCounts.GOOD + hitCounts.MISS;
  if (totalJudged === 0) {
    return 0;
  }

  const weightedAccuracy =
    (hitCounts.PERFECT * 1 + hitCounts.GREAT * 0.72 + hitCounts.GOOD * 0.45) /
    totalJudged;
  return Math.round(weightedAccuracy * 1000) / 10;
}

export function getSessionRank(params: {
  accuracyPercent: number;
  missCount: number;
  totalJudged: number;
}) {
  const { accuracyPercent, missCount, totalJudged } = params;
  if (totalJudged === 0) {
    return "--";
  }

  if (accuracyPercent >= 97.5 && missCount <= 2) {
    return "S";
  }

  if (accuracyPercent >= 92) {
    return "A";
  }

  if (accuracyPercent >= 85) {
    return "B";
  }

  if (accuracyPercent >= 75) {
    return "C";
  }

  return "D";
}

export function getMissionTargets(level: ChartEvolutionLevel) {
  return {
    perfect: level === "surge" ? 44 : level === "flow" ? 36 : 28,
    hold: level === "surge" ? 8 : level === "flow" ? 6 : 4,
    fever: level === "surge" ? 2 : 1
  };
}

export function getMissionRewardScore(mission: MissionKey) {
  return MISSION_REWARDS[mission];
}

export function resolveGrooveChange(params: {
  currentGroove: number;
  delta: number;
  timelineMs: number;
  feverEndsAtMs: number;
}) {
  const { currentGroove, delta, timelineMs, feverEndsAtMs } = params;
  if (timelineMs < feverEndsAtMs) {
    return {
      nextGroove: currentGroove,
      nextFeverEndsAtMs: feverEndsAtMs,
      triggered: false
    };
  }

  const nextGroove = Math.max(0, Math.min(FEVER_THRESHOLD, currentGroove + delta));
  if (nextGroove >= FEVER_THRESHOLD) {
    return {
      nextGroove: 0,
      nextFeverEndsAtMs: timelineMs + FEVER_DURATION_MS,
      triggered: true
    };
  }

  return {
    nextGroove,
    nextFeverEndsAtMs: feverEndsAtMs,
    triggered: false
  };
}

export function applyMissToFever(params: {
  timelineMs: number;
  feverEndsAtMs: number;
  missCount: number;
}) {
  const { timelineMs, feverEndsAtMs, missCount } = params;
  if (timelineMs >= feverEndsAtMs) {
    return feverEndsAtMs;
  }

  return Math.max(timelineMs, feverEndsAtMs - missCount * FEVER_DRAIN_PER_MISS_MS);
}

export function getHitGrooveDelta(grade: HitGrade, sectionGrooveMultiplier: number) {
  return Math.max(1, Math.round(GROOVE_GAIN[grade] * sectionGrooveMultiplier));
}

export function getHoldGrooveDelta(sectionGrooveMultiplier: number) {
  return Math.round(4 * sectionGrooveMultiplier);
}

export function getMissGrooveDelta(missCount: number) {
  return -GROOVE_LOSS_PER_MISS * missCount;
}

export function calculateHitScoreDelta(params: {
  grade: HitGrade;
  comboAfterHit: number;
  timelineMs: number;
  feverEndsAtMs: number;
  sectionScoreMultiplier: number;
}) {
  const { grade, comboAfterHit, timelineMs, feverEndsAtMs, sectionScoreMultiplier } =
    params;
  const comboBonus = Math.min(420, comboAfterHit * 5);
  const feverMultiplier = timelineMs < feverEndsAtMs ? FEVER_SCORE_MULTIPLIER : 1;
  return Math.round(
    (SCORE_PER_HIT[grade] + comboBonus) * feverMultiplier * sectionScoreMultiplier
  );
}

export function calculateHoldCompleteScoreDelta(params: {
  timelineMs: number;
  feverEndsAtMs: number;
  sectionScoreMultiplier: number;
}) {
  const { timelineMs, feverEndsAtMs, sectionScoreMultiplier } = params;
  const feverMultiplier =
    timelineMs < feverEndsAtMs ? FEVER_HOLD_COMPLETE_MULTIPLIER : 1;
  return Math.round(HOLD_COMPLETE_BONUS * feverMultiplier * sectionScoreMultiplier);
}

export function calculateHoldTickScoreDelta(params: {
  rawHoldTickGain: number;
  timelineMs: number;
  feverEndsAtMs: number;
  sectionHoldTickMultiplier: number;
}) {
  const { rawHoldTickGain, timelineMs, feverEndsAtMs, sectionHoldTickMultiplier } =
    params;
  const feverMultiplier = timelineMs < feverEndsAtMs ? FEVER_HOLD_TICK_MULTIPLIER : 1;
  return Math.round(rawHoldTickGain * feverMultiplier * sectionHoldTickMultiplier);
}
