export const BPM = 120;
const BEAT_MS = 60000 / BPM;
const LOOP_BEATS = 16;
export const CHART_START_OFFSET_MS = 1800;

export const JUDGE_WINDOWS_MS = {
  PERFECT: 45,
  GREAT: 90,
  GOOD: 140
} as const;

export const MAX_LANES = 4;
export const STAGE_SECTIONS = [
  {
    id: "PROLOGUE",
    startRatio: 0,
    endRatio: 0.26,
    scoreMultiplier: 1,
    grooveMultiplier: 1,
    holdTickMultiplier: 1
  },
  {
    id: "LIFT",
    startRatio: 0.26,
    endRatio: 0.56,
    scoreMultiplier: 1.08,
    grooveMultiplier: 1.1,
    holdTickMultiplier: 1.08
  },
  {
    id: "DRIVE",
    startRatio: 0.56,
    endRatio: 0.82,
    scoreMultiplier: 1.18,
    grooveMultiplier: 1.22,
    holdTickMultiplier: 1.16
  },
  {
    id: "FINALE",
    startRatio: 0.82,
    endRatio: 1.01,
    scoreMultiplier: 1.3,
    grooveMultiplier: 1.32,
    holdTickMultiplier: 1.22
  }
] as const;

export type NoteClassName = "note-tier-a" | "note-tier-b" | "note-tier-c";
type HitGrade = "PERFECT" | "GREAT" | "GOOD";
export type ChartEvolutionLevel = "calm" | "flow" | "surge";
export type StageSection = (typeof STAGE_SECTIONS)[number];

export type LiveChartNote = {
  id: string;
  lane: number;
  glyph: string;
  className: NoteClassName;
  hitMs: number;
  holdEndMs: number | null;
  judged: boolean;
  missed: boolean;
};

type PatternNote = {
  beat: number;
  lane: number;
  glyph: string;
  className: NoteClassName;
  holdBeats?: number;
};

type BuildOptions = {
  density?: number;
  holdRatio?: number;
  chordRatio?: number;
  includeHolds?: boolean;
  includeChords?: boolean;
};

type EvolveChartOptions = {
  gameDurationMs: number;
  level: ChartEvolutionLevel;
  chartStartOffsetMs?: number;
  extraTailMs?: number;
};

const LOOP_PATTERN: PatternNote[] = [
  { beat: 0, lane: 0, glyph: "#", className: "note-tier-a" },
  { beat: 0.5, lane: 1, glyph: "@", className: "note-tier-b", holdBeats: 1 },
  { beat: 1, lane: 2, glyph: "*", className: "note-tier-c" },
  { beat: 1.5, lane: 3, glyph: "=", className: "note-tier-b" },
  { beat: 2.5, lane: 1, glyph: "%", className: "note-tier-a" },
  { beat: 3, lane: 0, glyph: "+", className: "note-tier-c", holdBeats: 1.5 },
  { beat: 3.5, lane: 2, glyph: "#", className: "note-tier-b" },
  { beat: 4, lane: 3, glyph: "*", className: "note-tier-a", holdBeats: 1 },
  { beat: 5, lane: 2, glyph: "=", className: "note-tier-c" },
  { beat: 5.5, lane: 1, glyph: "#", className: "note-tier-b" },
  { beat: 6, lane: 0, glyph: "%", className: "note-tier-a" },
  { beat: 7, lane: 3, glyph: "@", className: "note-tier-a", holdBeats: 1.5 },
  { beat: 8, lane: 1, glyph: "+", className: "note-tier-c" },
  { beat: 8.5, lane: 2, glyph: "#", className: "note-tier-b" },
  { beat: 9, lane: 3, glyph: "=", className: "note-tier-c" },
  { beat: 9.5, lane: 0, glyph: "*", className: "note-tier-a" },
  { beat: 10, lane: 2, glyph: "%", className: "note-tier-b" },
  { beat: 11, lane: 1, glyph: "@", className: "note-tier-a" },
  { beat: 12, lane: 3, glyph: "#", className: "note-tier-b" },
  { beat: 12.5, lane: 2, glyph: "+", className: "note-tier-c" },
  { beat: 13, lane: 0, glyph: "=", className: "note-tier-b" },
  { beat: 13.5, lane: 1, glyph: "*", className: "note-tier-a" },
  { beat: 14, lane: 2, glyph: "@", className: "note-tier-a" },
  { beat: 15, lane: 3, glyph: "%", className: "note-tier-b" }
];

export function estimateLoopCountForDuration(durationMs: number) {
  const loopMs = LOOP_BEATS * BEAT_MS;
  return Math.max(8, Math.ceil((durationMs + CHART_START_OFFSET_MS) / loopMs) + 2);
}

function keepByDensity(
  loopIndex: number,
  patternIndex: number,
  density: number,
  beat: number
) {
  // Keep downbeats and early structure notes, then sample others deterministically.
  if (beat % 4 === 0 || beat === 0.5 || beat === 8.5) {
    return true;
  }

  const seed = (loopIndex * 53 + patternIndex * 31 + 17) % 100;
  return seed / 100 <= density;
}

function enableHold(
  loopIndex: number,
  patternIndex: number,
  holdRatio: number,
  includeHolds: boolean
) {
  if (!includeHolds) {
    return false;
  }

  const seed = (loopIndex * 61 + patternIndex * 29 + 7) % 100;
  return seed / 100 <= holdRatio;
}

export function buildLoopedChart(
  laneCount = MAX_LANES,
  loopCount = 80,
  options: BuildOptions = {}
): LiveChartNote[] {
  const clampedLaneCount = Math.max(1, Math.min(MAX_LANES, laneCount));
  const density = Math.max(0.4, Math.min(1.25, options.density ?? 1));
  const holdRatio = Math.max(0, Math.min(1, options.holdRatio ?? 0.2));
  const chordRatio = Math.max(0, Math.min(1, options.chordRatio ?? 0.22));
  const includeHolds = options.includeHolds ?? true;
  const includeChords = options.includeChords ?? true;
  const chart: LiveChartNote[] = [];
  let serial = 0;

  for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
    LOOP_PATTERN.forEach((patternNote, patternIndex) => {
      if (!keepByDensity(loopIndex, patternIndex, density, patternNote.beat)) {
        return;
      }

      const absoluteBeat = loopIndex * LOOP_BEATS + patternNote.beat;
      const hitMs = CHART_START_OFFSET_MS + absoluteBeat * BEAT_MS;
      const canHold = Boolean(patternNote.holdBeats);
      const willHold =
        canHold && enableHold(loopIndex, patternIndex, holdRatio, includeHolds);
      const holdEndMs =
        willHold && patternNote.holdBeats
          ? hitMs + patternNote.holdBeats * BEAT_MS
          : null;

      chart.push({
        id: `n-${serial}`,
        lane: patternNote.lane % clampedLaneCount,
        glyph: patternNote.glyph,
        className: patternNote.className,
        hitMs,
        holdEndMs,
        judged: false,
        missed: false
      });
      serial += 1;
    });

    // Add deterministic chord pulses to avoid monotony and create rhythm peaks.
    if (includeChords && clampedLaneCount >= 3) {
      const chordBeat = loopIndex * LOOP_BEATS + 11.5;
      const chordSeed = (loopIndex * 73 + 11) % 100;
      if (chordSeed / 100 <= chordRatio) {
        const chordHitMs = CHART_START_OFFSET_MS + chordBeat * BEAT_MS;
        const lanes =
          clampedLaneCount === 3
            ? chordSeed % 3 === 0
              ? [0, 1]
              : [0, 2]
            : chordSeed % 3 === 0
              ? [0, 2, 3]
              : chordSeed % 2 === 0
                ? [0, 3]
                : [1, 2];
        for (const lane of lanes) {
          chart.push({
            id: `n-${serial}`,
            lane,
            glyph: "#",
            className: "note-tier-a",
            hitMs: chordHitMs,
            holdEndMs: null,
            judged: false,
            missed: false
          });
          serial += 1;
        }
      }
    }
  }

  chart.sort((a, b) => a.hitMs - b.hitMs || a.lane - b.lane);
  return chart;
}

export function getStageSectionByTimeline(
  timelineMs: number,
  gameDurationMs: number
): StageSection {
  const ratio = Math.max(0, Math.min(1, timelineMs / gameDurationMs));
  for (const section of STAGE_SECTIONS) {
    if (ratio >= section.startRatio && ratio < section.endRatio) {
      return section;
    }
  }

  return STAGE_SECTIONS[STAGE_SECTIONS.length - 1];
}

export function evolveChartWithSections(
  chart: LiveChartNote[],
  laneCount: number,
  options: EvolveChartOptions
) {
  const clampedLaneCount = Math.max(2, laneCount);
  const chartStartOffsetMs = options.chartStartOffsetMs ?? CHART_START_OFFSET_MS;
  const extraTailMs = options.extraTailMs ?? 900;
  const playableEndMs = chartStartOffsetMs + options.gameDurationMs + extraTailMs;
  const boostStartMs = chartStartOffsetMs + options.gameDurationMs * 0.55;
  const finaleStartMs = chartStartOffsetMs + options.gameDurationMs * 0.82;
  const injectionRate =
    options.level === "surge" ? 0.46 : options.level === "flow" ? 0.3 : 0.17;
  const existingKeys = new Set<string>();
  let serial = chart.length;

  for (const note of chart) {
    existingKeys.add(`${note.lane}@${Math.round(note.hitMs)}`);
  }

  const extra: LiveChartNote[] = [];
  for (let index = 0; index < chart.length; index += 1) {
    const note = chart[index];
    if (note.hitMs < boostStartMs || note.hitMs > playableEndMs) {
      continue;
    }

    const sectionBoost = note.hitMs >= finaleStartMs ? 1.24 : 1;
    const laneShift = note.hitMs >= finaleStartMs ? 1 : 2;
    const seed = (index * 43 + note.lane * 17 + Math.round(note.hitMs / 7)) % 100;
    if (seed / 100 > Math.min(0.92, injectionRate * sectionBoost)) {
      continue;
    }

    const candidateLane =
      (note.lane +
        (seed % 2 === 0 ? laneShift : Math.max(1, clampedLaneCount - laneShift))) %
      clampedLaneCount;
    if (candidateLane === note.lane) {
      continue;
    }

    const key = `${candidateLane}@${Math.round(note.hitMs)}`;
    if (existingKeys.has(key)) {
      continue;
    }

    existingKeys.add(key);
    const includeHold =
      note.hitMs >= finaleStartMs &&
      options.level !== "calm" &&
      seed % 5 === 0 &&
      note.holdEndMs === null;
    extra.push({
      id: `n-${serial}`,
      lane: candidateLane,
      glyph: seed % 3 === 0 ? "#" : seed % 3 === 1 ? "*" : "+",
      className: note.hitMs >= finaleStartMs ? "note-tier-a" : "note-tier-b",
      hitMs: note.hitMs,
      holdEndMs: includeHold ? note.hitMs + 430 : null,
      judged: false,
      missed: false
    });
    serial += 1;
  }

  const merged = chart.concat(extra);
  merged.sort((a, b) => a.hitMs - b.hitMs || a.lane - b.lane);
  return merged;
}

export function judgeDeltaMs(absDeltaMs: number): HitGrade | null {
  if (absDeltaMs <= JUDGE_WINDOWS_MS.PERFECT) {
    return "PERFECT";
  }

  if (absDeltaMs <= JUDGE_WINDOWS_MS.GREAT) {
    return "GREAT";
  }

  if (absDeltaMs <= JUDGE_WINDOWS_MS.GOOD) {
    return "GOOD";
  }

  return null;
}
