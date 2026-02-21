export type MissPenaltyParams = {
  currentHp: number;
  currentMissStreak: number;
  missCount: number;
  missBaseDamage: number;
  missStreakStep: number;
  missDamageCap: number;
};

export type MissPenaltyResult = {
  nextHp: number;
  nextMissStreak: number;
  totalDamage: number;
};

export type HpRegenParams = {
  currentHp: number;
  maxHp: number;
  deltaMs: number;
  regenPerSec: number;
  timelineMs: number;
  lastMissAtMs: number;
  regenDelayMs: number;
};

export function applyMissPenalty(params: MissPenaltyParams): MissPenaltyResult {
  const {
    currentHp,
    currentMissStreak,
    missCount,
    missBaseDamage,
    missStreakStep,
    missDamageCap
  } = params;

  if (missCount <= 0) {
    return {
      nextHp: currentHp,
      nextMissStreak: currentMissStreak,
      totalDamage: 0
    };
  }

  let hpNext = currentHp;
  let streakNext = currentMissStreak;
  let totalDamage = 0;

  for (let i = 0; i < missCount; i += 1) {
    streakNext += 1;
    const damage = Math.min(
      missDamageCap,
      missBaseDamage + streakNext * missStreakStep
    );
    hpNext = Math.max(0, hpNext - damage);
    totalDamage += damage;
  }

  return {
    nextHp: hpNext,
    nextMissStreak: streakNext,
    totalDamage
  };
}

export function calculateRegenHp(params: HpRegenParams) {
  const {
    currentHp,
    maxHp,
    deltaMs,
    regenPerSec,
    timelineMs,
    lastMissAtMs,
    regenDelayMs
  } = params;

  if (currentHp >= maxHp) {
    return currentHp;
  }

  if (timelineMs - lastMissAtMs < regenDelayMs) {
    return currentHp;
  }

  return Math.min(maxHp, currentHp + (deltaMs / 1000) * regenPerSec);
}
