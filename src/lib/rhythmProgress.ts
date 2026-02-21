import type { ChartEvolutionLevel } from "@/lib/rhythmEngine";

const STORAGE_KEY = "ascii-rhythm-best-records-v1";

export type RhythmModeKeyParams = {
  difficulty: ChartEvolutionLevel;
  laneCount: number;
  speedMultiplier: number;
};

export type RhythmModeBestRecord = {
  score: number;
  accuracyPercent: number;
  maxCombo: number;
  rank: string;
  updatedAt: string;
};

type RhythmBestRecordStore = Record<string, RhythmModeBestRecord>;

function toModeKey(params: RhythmModeKeyParams) {
  const { difficulty, laneCount, speedMultiplier } = params;
  return `${difficulty}|${laneCount}L|${speedMultiplier.toFixed(2)}`;
}

function parseStoreValue(raw: string | null): RhythmBestRecordStore {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as RhythmBestRecordStore;
  } catch {
    return {};
  }
}

function readStore(): RhythmBestRecordStore {
  if (typeof window === "undefined") {
    return {};
  }

  return parseStoreValue(window.localStorage.getItem(STORAGE_KEY));
}

function writeStore(store: RhythmBestRecordStore) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function loadBestRecordForMode(
  mode: RhythmModeKeyParams
): RhythmModeBestRecord | null {
  const store = readStore();
  return store[toModeKey(mode)] ?? null;
}

export function saveBestRecordForMode(
  mode: RhythmModeKeyParams,
  candidate: Omit<RhythmModeBestRecord, "updatedAt">
) {
  const store = readStore();
  const key = toModeKey(mode);
  const current = store[key];

  const shouldReplace =
    !current ||
    candidate.score > current.score ||
    (candidate.score === current.score && candidate.accuracyPercent > current.accuracyPercent) ||
    (candidate.score === current.score &&
      candidate.accuracyPercent === current.accuracyPercent &&
      candidate.maxCombo > current.maxCombo);

  if (!shouldReplace) {
    return {
      updated: false,
      record: current
    };
  }

  const nextRecord: RhythmModeBestRecord = {
    ...candidate,
    updatedAt: new Date().toISOString()
  };

  const nextStore: RhythmBestRecordStore = {
    ...store,
    [key]: nextRecord
  };
  writeStore(nextStore);

  return {
    updated: true,
    record: nextRecord
  };
}
