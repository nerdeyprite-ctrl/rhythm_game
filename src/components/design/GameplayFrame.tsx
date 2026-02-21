"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import {
  buildLoopedChart,
  CHART_START_OFFSET_MS,
  estimateLoopCountForDuration,
  evolveChartWithSections,
  getStageSectionByTimeline,
  JUDGE_WINDOWS_MS,
  type LiveChartNote
} from "@/lib/rhythmEngine";
import {
  MISSION_HP_BONUS,
  applyMissToFever,
  calculateAccuracyPercent,
  calculateGroovePercent,
  calculateHitScoreDelta,
  calculateHoldCompleteScoreDelta,
  calculateHoldTickScoreDelta,
  getHitGrooveDelta,
  getHoldGrooveDelta,
  getMissionRewardScore,
  getMissionTargets,
  getMissGrooveDelta,
  getSessionRank,
  resolveGrooveChange,
  type HitGrade
} from "@/lib/rhythmScoring";
import {
  DEFAULT_SPEED_INDEX,
  SPEED_LEVELS,
  formatSpeedLabel,
  scaleTravelDurationMs
} from "@/lib/rhythmSpeed";
import {
  BASE_TRAVEL_MS,
  DIFFICULTY_ORDER,
  DIFFICULTY_PRESETS,
  GAME_DURATION_MS,
  HIT_LINE_BOTTOM_OFFSET_PX,
  HOLD_RELEASE_TOLERANCE_MS,
  HOLD_TICK_INTERVAL_MS,
  HOLD_TICK_SCORE,
  LANE_LAYOUTS,
  MAX_HP,
  NOTE_ENTRY_CENTER_Y,
  NOTE_EXIT_EXTRA_PX,
  NOTE_PAST_HIT_BUFFER_MS,
  type DifficultyId,
  type LaneCount
} from "@/lib/rhythmGameplayConfig";
import { projectRhythmNoteY } from "@/lib/rhythmProjection";
import {
  loadBestRecordForMode,
  saveBestRecordForMode,
  type RhythmModeBestRecord
} from "@/lib/rhythmProgress";
import {
  type BuiltInGameplayModePresetId,
  CUSTOM_PRESET_ID,
  GAMEPLAY_MODE_PRESETS,
  getGameplayModePresetById,
  resolveGameplayModePresetId
} from "@/lib/rhythmModePreset";
import { applyMissPenalty, calculateRegenHp } from "@/lib/rhythmSurvival";
import {
  buildSessionReport,
  EMPTY_SCORE_BREAKDOWN,
  type MissionEvent,
  type MissEvent,
  type ScoreBreakdown,
  type SessionReport
} from "@/lib/rhythmSessionReport";

const SCULPTURE_FRAME = String.raw`
                   .-=======================-.
               .-==-.                   .-==-.
            .-==-      .-::::::::::-.      -==-.
          .==-.      .:-=+*######*+=-:.      .-==.
         +=:       .:-+*#%%@@@@@@%%#*+-:.       :+=
       .+=       .:-+*#%%@@@####@@@%%#*+-:.       =+.
      .+=      .:-=+*#%%@@@##::##@@@%%#*+=-:.      =+.
      +=      .:-=+*#%%%@@@##::##@@@%%%#*+=-:.      +=
      +=      .:-=+*#%%%@@@@@@@@@@@@%%%#*+=-:.      +=
      .+=      .:-=+**##%%@@@@@@%%##**+=-:.       =+.
       .+=       .:--=++**######**++=--:.       .=+.
         +=:        .::--========--::.         :+=
          .==-.         .--::::--.          .-==.
            .-==-..                      ..-==-.
               .-===--..            ..--===-.
                    '--================--'`;
type GamePhase = "idle" | "playing" | "ended";
type EndReason = "CLEAR" | "GAME_OVER";
type HitJudgement = "PERFECT" | "GREAT" | "GOOD" | "MISS";
type HUDJudgement = HitJudgement | "READY" | "HOLD" | "FEVER";

type HitStats = {
  PERFECT: number;
  GREAT: number;
  GOOD: number;
  MISS: number;
};

type VisibleLaneNote = {
  id: string;
  glyph: string;
  className: string;
  y: number;
  holdTopY: number | null;
  holdHeight: number;
};

type VisibleActiveHold = {
  id: string;
  lane: number;
  topY: number;
  height: number;
};

type ActiveHold = {
  noteId: string;
  lane: number;
  endMs: number;
  nextTickMs: number;
  requiresKeyHold: boolean;
};

type MissionStatus = {
  precision: boolean;
  hold: boolean;
  fever: boolean;
};

const EMPTY_HIT_STATS: HitStats = {
  PERFECT: 0,
  GREAT: 0,
  GOOD: 0,
  MISS: 0
};

const EMPTY_MISSION_STATUS: MissionStatus = {
  precision: false,
  hold: false,
  fever: false
};

export default function GameplayFrame() {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [hp, setHp] = useState(MAX_HP);
  const [, setMissStreak] = useState(0);
  const [judgement, setJudgement] = useState<HUDJudgement>("READY");
  const [judgementTick, setJudgementTick] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(
    SPEED_LEVELS[DEFAULT_SPEED_INDEX].multiplier
  );
  const [laneCount, setLaneCount] = useState<LaneCount>(4);
  const [difficulty, setDifficulty] = useState<DifficultyId>("flow");
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [endReason, setEndReason] = useState<EndReason>("CLEAR");
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_DURATION_MS);
  const [nowMs, setNowMs] = useState(0);
  const [hitStats, setHitStats] = useState<HitStats>(EMPTY_HIT_STATS);
  const [holdClears, setHoldClears] = useState(0);
  const [groove, setGroove] = useState(0);
  const [feverTriggers, setFeverTriggers] = useState(0);
  const [missionStatus, setMissionStatus] =
    useState<MissionStatus>(EMPTY_MISSION_STATUS);
  const [laneHeight, setLaneHeight] = useState(560);
  const [activeLanes, setActiveLanes] = useState<boolean[]>(
    Array.from({ length: LANE_LAYOUTS[4].length }, () => false)
  );
  const [holdLanes, setHoldLanes] = useState<boolean[]>(
    Array.from({ length: LANE_LAYOUTS[4].length }, () => false)
  );
  const [bestRecord, setBestRecord] = useState<RhythmModeBestRecord | null>(null);
  const [scoreBreakdown, setScoreBreakdown] =
    useState<ScoreBreakdown>(EMPTY_SCORE_BREAKDOWN);
  const [maxMissStreak, setMaxMissStreak] = useState(0);
  const [sessionReport, setSessionReport] = useState<SessionReport | null>(null);

  const laneLayout = useMemo(() => LANE_LAYOUTS[laneCount], [laneCount]);
  const difficultyPreset = DIFFICULTY_PRESETS[difficulty];
  const laneFieldRef = useRef<HTMLDivElement | null>(null);
  const laneTimersRef = useRef<Array<number | null>>([]);
  const chartRef = useRef<LiveChartNote[]>([]);
  const activeHoldsRef = useRef<Map<number, ActiveHold>>(new Map());
  const heldKeysRef = useRef<boolean[]>([]);
  const nowMsRef = useRef(0);
  const prevFrameMsRef = useRef(0);
  const nextMissIndexRef = useRef(0);
  const lastMissVisualAtRef = useRef(-1000);
  const lastMissAtRef = useRef(-10000);
  const grooveRef = useRef(0);
  const feverEndsAtRef = useRef(0);
  const missionStatusRef = useRef<MissionStatus>(EMPTY_MISSION_STATUS);
  const missStreakRef = useRef(0);
  const hpRef = useRef(MAX_HP);
  const playableUntilMsRef = useRef(0);
  const resultPersistedRef = useRef(false);
  const missEventsRef = useRef<MissEvent[]>([]);
  const missionEventsRef = useRef<MissionEvent[]>([]);

  const travelMs = useMemo(
    () => scaleTravelDurationMs(BASE_TRAVEL_MS, speedMultiplier),
    [speedMultiplier]
  );
  const judgeWindows = useMemo(() => {
    const perfect = Math.max(
      18,
      Math.round(JUDGE_WINDOWS_MS.PERFECT * difficultyPreset.judgeScale)
    );
    const great = Math.max(
      perfect + 16,
      Math.round(JUDGE_WINDOWS_MS.GREAT * difficultyPreset.judgeScale)
    );
    const good = Math.max(
      great + 16,
      Math.round(JUDGE_WINDOWS_MS.GOOD * difficultyPreset.judgeScale)
    );

    return {
      PERFECT: perfect,
      GREAT: great,
      GOOD: good
    };
  }, [difficultyPreset.judgeScale]);

  const judgeDeltaWithDifficulty = useCallback(
    (absDeltaMs: number): Exclude<HitJudgement, "MISS"> | null => {
      if (absDeltaMs <= judgeWindows.PERFECT) {
        return "PERFECT";
      }

      if (absDeltaMs <= judgeWindows.GREAT) {
        return "GREAT";
      }

      if (absDeltaMs <= judgeWindows.GOOD) {
        return "GOOD";
      }

      return null;
    },
    [judgeWindows]
  );

  const hpPercent = Math.max(0, Math.min(100, Math.round(hp)));
  const feverLeftMs = Math.max(0, feverEndsAtRef.current - nowMs);
  const isFever = phase === "playing" && feverLeftMs > 0;
  const groovePercent = calculateGroovePercent(groove);
  const stageSection = useMemo(
    () => getStageSectionByTimeline(nowMs, GAME_DURATION_MS),
    [nowMs]
  );
  const missionTargets = useMemo(() => getMissionTargets(difficulty), [difficulty]);
  const totalJudged =
    hitStats.PERFECT + hitStats.GREAT + hitStats.GOOD + hitStats.MISS;
  const accuracyPercent = calculateAccuracyPercent(hitStats);
  const sessionRank = useMemo(
    () =>
      getSessionRank({
        accuracyPercent,
        missCount: hitStats.MISS,
        totalJudged
      }),
    [accuracyPercent, hitStats.MISS, totalJudged]
  );

  useEffect(() => {
    setBestRecord(loadBestRecordForMode({ difficulty, laneCount, speedMultiplier }));
  }, [difficulty, laneCount, speedMultiplier]);

  useEffect(() => {
    if (phase !== "ended" || resultPersistedRef.current) {
      return;
    }

    resultPersistedRef.current = true;
    const { record } = saveBestRecordForMode(
      { difficulty, laneCount, speedMultiplier },
      {
        score,
        accuracyPercent,
        maxCombo,
        rank: sessionRank
      }
    );
    setBestRecord(record);
  }, [
    accuracyPercent,
    difficulty,
    laneCount,
    maxCombo,
    phase,
    score,
    sessionRank,
    speedMultiplier
  ]);

  useEffect(() => {
    if (phase !== "ended") {
      return;
    }

    setSessionReport(
      buildSessionReport({
        scoreBreakdown,
        missEvents: missEventsRef.current,
        missionEvents: missionEventsRef.current,
        maxMissStreak
      })
    );
  }, [maxMissStreak, phase, scoreBreakdown]);

  useEffect(() => {
    const field = laneFieldRef.current;
    if (!field) {
      return;
    }

    const update = () => {
      setLaneHeight(field.clientHeight || 560);
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(field);

    return () => {
      observer.disconnect();
    };
  }, [laneLayout.length]);

  useEffect(() => {
    setActiveLanes(Array.from({ length: laneLayout.length }, () => false));
    setHoldLanes(Array.from({ length: laneLayout.length }, () => false));
    laneTimersRef.current = Array.from({ length: laneLayout.length }, () => null);
    heldKeysRef.current = Array.from({ length: laneLayout.length }, () => false);
    activeHoldsRef.current.clear();
  }, [laneLayout.length]);

  const flashLane = useCallback((laneIndex: number) => {
    setActiveLanes((prev) => prev.map((v, i) => (i === laneIndex ? true : v)));

    const prevTimer = laneTimersRef.current[laneIndex];
    if (prevTimer !== null && prevTimer !== undefined) {
      window.clearTimeout(prevTimer);
    }

    laneTimersRef.current[laneIndex] = window.setTimeout(() => {
      setActiveLanes((prev) => prev.map((v, i) => (i === laneIndex ? false : v)));
      laneTimersRef.current[laneIndex] = null;
    }, 140);
  }, []);

  const adjustGroove = useCallback((delta: number, timelineMs: number) => {
    const next = resolveGrooveChange({
      currentGroove: grooveRef.current,
      delta,
      timelineMs,
      feverEndsAtMs: feverEndsAtRef.current
    });

    grooveRef.current = next.nextGroove;
    feverEndsAtRef.current = next.nextFeverEndsAtMs;
    setGroove(next.nextGroove);

    if (next.triggered) {
      setFeverTriggers((prev) => prev + 1);
      setJudgement("FEVER");
      setJudgementTick((prev) => prev + 1);
    }
  }, []);

  const grantMission = useCallback(
    (mission: keyof MissionStatus, timelineMs: number) => {
      if (missionStatusRef.current[mission]) {
        return;
      }

      missionStatusRef.current = {
        ...missionStatusRef.current,
        [mission]: true
      };
      setMissionStatus(missionStatusRef.current);
      const missionReward = getMissionRewardScore(mission);
      setScore((prev) => prev + missionReward);
      setScoreBreakdown((prev) => ({
        ...prev,
        missions: prev.missions + missionReward
      }));
      missionEventsRef.current.push({
        mission,
        timelineMs
      });

      if (hpRef.current > 0) {
        const hpNext = Math.min(MAX_HP, hpRef.current + MISSION_HP_BONUS);
        hpRef.current = hpNext;
        setHp(hpNext);
      }

      lastMissAtRef.current = timelineMs;
      setJudgement("FEVER");
      setJudgementTick((prev) => prev + 1);
    },
    []
  );

  const clearHoldLane = useCallback((laneIndex: number) => {
    activeHoldsRef.current.delete(laneIndex);
    setHoldLanes((prev) => prev.map((v, i) => (i === laneIndex ? false : v)));
  }, []);

  const clearAllHolds = useCallback(() => {
    activeHoldsRef.current.clear();
    setHoldLanes(Array.from({ length: laneLayout.length }, () => false));
  }, [laneLayout.length]);

  const completeHold = useCallback(
    (laneIndex: number, timelineMs: number, showVisual = true) => {
      const hold = activeHoldsRef.current.get(laneIndex);
      if (!hold || phase !== "playing") {
        return;
      }

      activeHoldsRef.current.delete(laneIndex);
      setHoldLanes((prev) => prev.map((v, i) => (i === laneIndex ? false : v)));
      const section = getStageSectionByTimeline(timelineMs, GAME_DURATION_MS);
      const holdScoreDelta = calculateHoldCompleteScoreDelta({
        timelineMs,
        feverEndsAtMs: feverEndsAtRef.current,
        sectionScoreMultiplier: section.scoreMultiplier
      });
      setScore((prev) => prev + holdScoreDelta);
      setScoreBreakdown((prev) => ({
        ...prev,
        holdCompletes: prev.holdCompletes + holdScoreDelta
      }));
      setHoldClears((prev) => prev + 1);

      if (timelineMs >= feverEndsAtRef.current) {
        adjustGroove(getHoldGrooveDelta(section.grooveMultiplier), timelineMs);
      }

      if (showVisual) {
        setJudgement("HOLD");
        setJudgementTick((prev) => prev + 1);
      }
    },
    [adjustGroove, phase]
  );

  const markGameOver = useCallback(() => {
    clearAllHolds();
    setEndReason("GAME_OVER");
    setPhase("ended");
    setTimeLeftMs(0);
  }, [clearAllHolds]);

  const registerMiss = useCallback(
    (count: number, timelineMs: number, showVisual = true) => {
      if (count <= 0 || phase !== "playing") {
        return;
      }

      const missOutcome = applyMissPenalty({
        currentHp: hpRef.current,
        currentMissStreak: missStreakRef.current,
        missCount: count,
        missBaseDamage: difficultyPreset.missBaseDamage,
        missStreakStep: difficultyPreset.missStreakStep,
        missDamageCap: difficultyPreset.missDamageCap
      });
      const hpNext = missOutcome.nextHp;
      const streakNext = missOutcome.nextMissStreak;

      hpRef.current = hpNext;
      missStreakRef.current = streakNext;
      lastMissAtRef.current = timelineMs;
      missEventsRef.current.push({
        timelineMs,
        count,
        missStreakAfter: streakNext
      });

      setHp(hpNext);
      setMissStreak(streakNext);
      setMaxMissStreak((prev) => Math.max(prev, streakNext));
      setCombo(0);
      setHitStats((prev) => ({
        ...prev,
        MISS: prev.MISS + count
      }));

      if (timelineMs < feverEndsAtRef.current) {
        feverEndsAtRef.current = applyMissToFever({
          timelineMs,
          feverEndsAtMs: feverEndsAtRef.current,
          missCount: count
        });
      } else {
        adjustGroove(getMissGrooveDelta(count), timelineMs);
      }

      if (showVisual && timelineMs - lastMissVisualAtRef.current > 120) {
        lastMissVisualAtRef.current = timelineMs;
        setJudgement("MISS");
        setJudgementTick((prev) => prev + 1);
      }

      if (hpNext <= 0) {
        markGameOver();
      }
    },
    [adjustGroove, difficultyPreset, markGameOver, phase]
  );

  const registerHit = useCallback(
    (grade: HitGrade, timelineMs: number) => {
      setJudgement(grade);
      setJudgementTick((prev) => prev + 1);

      missStreakRef.current = 0;
      setMissStreak(0);

      setHitStats((prev) => ({
        ...prev,
        [grade]: prev[grade] + 1
      }));

      setCombo((prev) => {
        const nextCombo = prev + 1;
        const section = getStageSectionByTimeline(timelineMs, GAME_DURATION_MS);
        const hitScoreDelta = calculateHitScoreDelta({
          grade,
          comboAfterHit: nextCombo,
          timelineMs,
          feverEndsAtMs: feverEndsAtRef.current,
          sectionScoreMultiplier: section.scoreMultiplier
        });
        setScore((scorePrev) => scorePrev + hitScoreDelta);
        setScoreBreakdown((scorePrev) => ({
          ...scorePrev,
          hits: scorePrev.hits + hitScoreDelta
        }));
        setMaxCombo((maxPrev) => Math.max(maxPrev, nextCombo));
        return nextCombo;
      });

      if (timelineMs >= feverEndsAtRef.current) {
        const section = getStageSectionByTimeline(timelineMs, GAME_DURATION_MS);
        adjustGroove(getHitGrooveDelta(grade, section.grooveMultiplier), timelineMs);
      }
    },
    [adjustGroove]
  );

  const startSession = useCallback(() => {
    const playableUntil = GAME_DURATION_MS + CHART_START_OFFSET_MS;
    const loopCount = estimateLoopCountForDuration(playableUntil + travelMs + 1400);

    const baseChart = buildLoopedChart(laneCount, loopCount, {
      density: difficultyPreset.density,
      holdRatio: difficultyPreset.holdRatio,
      chordRatio: difficultyPreset.chordRatio,
      includeHolds: difficultyPreset.includeHolds,
      includeChords: difficultyPreset.includeChords
    });

    chartRef.current = evolveChartWithSections(baseChart, laneCount, {
      gameDurationMs: GAME_DURATION_MS,
      level: difficulty
    }).filter((note) => note.hitMs <= playableUntil + judgeWindows.GOOD + 400);

    playableUntilMsRef.current = playableUntil;
    nextMissIndexRef.current = 0;
    nowMsRef.current = 0;
    prevFrameMsRef.current = 0;
    lastMissVisualAtRef.current = -1000;
    lastMissAtRef.current = -10000;
    missStreakRef.current = 0;
    grooveRef.current = 0;
    feverEndsAtRef.current = 0;
    missionStatusRef.current = { ...EMPTY_MISSION_STATUS };
    hpRef.current = MAX_HP;
    resultPersistedRef.current = false;
    missEventsRef.current = [];
    missionEventsRef.current = [];
    activeHoldsRef.current.clear();
    heldKeysRef.current = Array.from({ length: laneLayout.length }, () => false);

    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setHp(MAX_HP);
    setMissStreak(0);
    setJudgement("READY");
    setJudgementTick(0);
    setHitStats({ ...EMPTY_HIT_STATS });
    setHoldClears(0);
    setGroove(0);
    setFeverTriggers(0);
    setScoreBreakdown({ ...EMPTY_SCORE_BREAKDOWN });
    setMaxMissStreak(0);
    setSessionReport(null);
    setMissionStatus({ ...EMPTY_MISSION_STATUS });
    setNowMs(0);
    setTimeLeftMs(GAME_DURATION_MS);
    setEndReason("CLEAR");
    setActiveLanes(Array.from({ length: laneLayout.length }, () => false));
    setHoldLanes(Array.from({ length: laneLayout.length }, () => false));
    setPhase("playing");
  }, [difficultyPreset, judgeWindows.GOOD, laneCount, laneLayout.length, travelMs]);

  useEffect(() => {
    if (phase !== "playing") {
      return;
    }

    const startedAt = performance.now();
    let frameId = 0;

    const frame = () => {
      const timelineMs = performance.now() - startedAt;
      const deltaMs = prevFrameMsRef.current === 0 ? 16 : timelineMs - prevFrameMsRef.current;
      prevFrameMsRef.current = timelineMs;

      nowMsRef.current = timelineMs;
      setNowMs(timelineMs);
      setTimeLeftMs(Math.max(0, GAME_DURATION_MS - timelineMs));

      const chart = chartRef.current;
      let cursor = nextMissIndexRef.current;
      let missedCount = 0;

      while (cursor < chart.length) {
        const note = chart[cursor];

        if (note.hitMs > playableUntilMsRef.current + judgeWindows.GOOD) {
          break;
        }

        if (note.judged || note.missed) {
          cursor += 1;
          continue;
        }

        if (timelineMs > note.hitMs + judgeWindows.GOOD) {
          note.missed = true;
          missedCount += 1;
          cursor += 1;
          continue;
        }

        break;
      }

      nextMissIndexRef.current = cursor;

      if (missedCount > 0) {
        registerMiss(missedCount, timelineMs, true);
      }

      let holdTickGain = 0;
      const holdsToMiss: number[] = [];
      const holdsToComplete: number[] = [];
      for (const [laneIndex, hold] of activeHoldsRef.current.entries()) {
        const isHeld = heldKeysRef.current[laneIndex] ?? false;
        if (
          hold.requiresKeyHold &&
          !isHeld &&
          timelineMs < hold.endMs - HOLD_RELEASE_TOLERANCE_MS
        ) {
          holdsToMiss.push(laneIndex);
          continue;
        }

        while (
          timelineMs >= hold.nextTickMs &&
          hold.nextTickMs < hold.endMs - HOLD_RELEASE_TOLERANCE_MS
        ) {
          holdTickGain += HOLD_TICK_SCORE;
          hold.nextTickMs += HOLD_TICK_INTERVAL_MS;
        }

        if (timelineMs >= hold.endMs - HOLD_RELEASE_TOLERANCE_MS) {
          holdsToComplete.push(laneIndex);
        }
      }

      if (holdTickGain > 0) {
        const section = getStageSectionByTimeline(timelineMs, GAME_DURATION_MS);
        const holdTickScoreDelta = calculateHoldTickScoreDelta({
          rawHoldTickGain: holdTickGain,
          timelineMs,
          feverEndsAtMs: feverEndsAtRef.current,
          sectionHoldTickMultiplier: section.holdTickMultiplier
        });
        setScore((prev) => prev + holdTickScoreDelta);
        setScoreBreakdown((prev) => ({
          ...prev,
          holdTicks: prev.holdTicks + holdTickScoreDelta
        }));
      }

      if (holdsToMiss.length > 0) {
        for (const laneIndex of holdsToMiss) {
          clearHoldLane(laneIndex);
        }
        registerMiss(holdsToMiss.length, timelineMs, true);
      }

      if (holdsToComplete.length > 0) {
        for (const laneIndex of holdsToComplete) {
          completeHold(laneIndex, timelineMs, true);
        }
      }

      if (phase === "playing") {
        const hpNext = calculateRegenHp({
          currentHp: hpRef.current,
          maxHp: MAX_HP,
          deltaMs,
          regenPerSec: difficultyPreset.hpRegenPerSec,
          timelineMs,
          lastMissAtMs: lastMissAtRef.current,
          regenDelayMs: difficultyPreset.hpRegenDelayMs
        });
        if (hpNext !== hpRef.current) {
          hpRef.current = hpNext;
          setHp(hpNext);
        }
      }

      if (hpRef.current <= 0) {
        return;
      }

      if (timelineMs >= GAME_DURATION_MS) {
        clearAllHolds();
        setEndReason("CLEAR");
        setPhase("ended");
        setTimeLeftMs(0);
        return;
      }

      frameId = window.requestAnimationFrame(frame);
    };

    frameId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    clearAllHolds,
    clearHoldLane,
    completeHold,
    difficultyPreset.hpRegenDelayMs,
    difficultyPreset.hpRegenPerSec,
    judgeWindows.GOOD,
    phase,
    registerMiss
  ]);

  useEffect(() => {
    if (phase === "idle") {
      return;
    }

    if (!missionStatusRef.current.precision && hitStats.PERFECT >= missionTargets.perfect) {
      grantMission("precision", nowMs);
    }

    if (!missionStatusRef.current.hold && holdClears >= missionTargets.hold) {
      grantMission("hold", nowMs);
    }

    if (!missionStatusRef.current.fever && feverTriggers >= missionTargets.fever) {
      grantMission("fever", nowMs);
    }
  }, [
    feverTriggers,
    grantMission,
    hitStats.PERFECT,
    holdClears,
    missionTargets,
    nowMs,
    phase
  ]);

  const evaluateHitForLane = useCallback(
    (laneIndex: number, source: "keyboard" | "pointer") => {
      if (phase !== "playing" || hpRef.current <= 0) {
        return;
      }

      const timelineMs = nowMsRef.current;
      const chart = chartRef.current;
      let best: { note: LiveChartNote; absDeltaMs: number } | null = null;

      for (let i = nextMissIndexRef.current; i < chart.length; i += 1) {
        const note = chart[i];

        if (note.hitMs > playableUntilMsRef.current) {
          break;
        }

        if (note.hitMs > timelineMs + judgeWindows.GOOD) {
          break;
        }

        if (note.lane !== laneIndex || note.judged || note.missed) {
          continue;
        }

        const absDeltaMs = Math.abs(timelineMs - note.hitMs);
        if (
          absDeltaMs <= judgeWindows.GOOD &&
          (!best || absDeltaMs < best.absDeltaMs)
        ) {
          best = {
            note,
            absDeltaMs
          };
        }
      }

      if (!best) {
        registerMiss(1, timelineMs, true);
        return;
      }

      const result = judgeDeltaWithDifficulty(best.absDeltaMs);
      if (!result) {
        registerMiss(1, timelineMs, true);
        return;
      }

      best.note.judged = true;
      registerHit(result, timelineMs);

      if (best.note.holdEndMs && best.note.holdEndMs > best.note.hitMs + 90) {
        activeHoldsRef.current.set(laneIndex, {
          noteId: best.note.id,
          lane: laneIndex,
          endMs: best.note.holdEndMs,
          nextTickMs:
            timelineMs + HOLD_TICK_INTERVAL_MS >= best.note.holdEndMs
              ? best.note.holdEndMs
              : timelineMs + HOLD_TICK_INTERVAL_MS,
          requiresKeyHold: source === "keyboard"
        });
        setHoldLanes((prev) => prev.map((v, i) => (i === laneIndex ? true : v)));
      }

      while (nextMissIndexRef.current < chart.length) {
        const front = chart[nextMissIndexRef.current];
        if (front.judged || front.missed) {
          nextMissIndexRef.current += 1;
          continue;
        }
        break;
      }
    },
    [judgeDeltaWithDifficulty, judgeWindows.GOOD, phase, registerHit, registerMiss]
  );

  const triggerLaneInput = useCallback(
    (laneIndex: number, source: "keyboard" | "pointer") => {
      flashLane(laneIndex);
      evaluateHitForLane(laneIndex, source);
    },
    [evaluateHitForLane, flashLane]
  );

  useEffect(() => {
    const keyToLaneByCode: Record<string, number> = {};
    const keyToLaneByKey: Record<string, number> = {};

    laneLayout.forEach((lane, index) => {
      keyToLaneByCode[lane.code] = index;
      keyToLaneByKey[lane.label.toLowerCase()] = index;
    });

    const resolveLane = (event: KeyboardEvent) => {
      const laneFromCode = keyToLaneByCode[event.code];
      const laneFromKey = keyToLaneByKey[event.key.toLowerCase()];
      return laneFromCode ?? laneFromKey;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const laneIndex = resolveLane(event);

      if (laneIndex === undefined || event.repeat) {
        return;
      }

      heldKeysRef.current[laneIndex] = true;
      event.preventDefault();
      triggerLaneInput(laneIndex, "keyboard");
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const laneIndex = resolveLane(event);

      if (laneIndex === undefined) {
        return;
      }

      heldKeysRef.current[laneIndex] = false;
      if (phase !== "playing") {
        return;
      }

      const activeHold = activeHoldsRef.current.get(laneIndex);
      if (!activeHold) {
        return;
      }

      const timelineMs = nowMsRef.current;
      if (timelineMs < activeHold.endMs - HOLD_RELEASE_TOLERANCE_MS) {
        clearHoldLane(laneIndex);
        registerMiss(1, timelineMs, true);
        return;
      }

      completeHold(laneIndex, timelineMs, true);
    };

    const handleBlur = () => {
      heldKeysRef.current = Array.from({ length: laneLayout.length }, () => false);
      if (phase !== "playing" || activeHoldsRef.current.size === 0) {
        return;
      }

      const missCount = activeHoldsRef.current.size;
      clearAllHolds();
      registerMiss(missCount, nowMsRef.current, true);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      for (const timer of laneTimersRef.current) {
        if (timer !== null) {
          window.clearTimeout(timer);
        }
      }
    };
  }, [clearAllHolds, clearHoldLane, completeHold, laneLayout, phase, registerMiss, triggerLaneInput]);

  const visibleNotesByLane = useMemo(() => {
    const lanes = Array.from({ length: laneLayout.length }, () => [] as VisibleLaneNote[]);

    if (phase === "idle") {
      return lanes;
    }

    const hitLineY = laneHeight - HIT_LINE_BOTTOM_OFFSET_PX;
    const exitY = laneHeight + NOTE_EXIT_EXTRA_PX;
    const chart = chartRef.current;
    const scanStart = Math.max(0, nextMissIndexRef.current - 36);
    const projectionBase = {
      nowMs,
      travelMs,
      entryY: NOTE_ENTRY_CENTER_Y,
      hitLineY,
      exitY,
      pastBufferMs: NOTE_PAST_HIT_BUFFER_MS
    };

    for (let i = scanStart; i < chart.length; i += 1) {
      const note = chart[i];

      if (note.lane >= laneLayout.length) {
        continue;
      }

      if (note.hitMs > playableUntilMsRef.current + judgeWindows.GOOD) {
        break;
      }

      if (note.judged || note.missed) {
        continue;
      }

      const startMs = note.hitMs - travelMs;
      const endMs = note.hitMs + NOTE_PAST_HIT_BUFFER_MS;

      if (startMs > nowMs + travelMs + 600) {
        break;
      }

      if (nowMs < startMs - 180 || nowMs > endMs) {
        continue;
      }

      const y = projectRhythmNoteY({
        ...projectionBase,
        targetHitMs: note.hitMs
      });
      let holdTopY: number | null = null;
      let holdHeight = 0;

      if (note.holdEndMs && note.holdEndMs > note.hitMs) {
        const holdEndY = projectRhythmNoteY({
          ...projectionBase,
          targetHitMs: note.holdEndMs
        });
        holdTopY = Math.min(y, holdEndY);
        holdHeight = Math.max(10, Math.abs(y - holdEndY));
      }

      lanes[note.lane].push({
        id: note.id,
        glyph: note.glyph,
        className: note.className,
        y,
        holdTopY,
        holdHeight
      });
    }

    return lanes;
  }, [judgeWindows.GOOD, laneHeight, laneLayout.length, nowMs, phase, travelMs]);

  const visibleActiveHolds = useMemo(() => {
    const holds: VisibleActiveHold[] = [];
    if (phase !== "playing") {
      return holds;
    }

    const hitLineY = laneHeight - HIT_LINE_BOTTOM_OFFSET_PX;
    const exitY = laneHeight + NOTE_EXIT_EXTRA_PX;
    const projectionBase = {
      nowMs,
      travelMs,
      entryY: NOTE_ENTRY_CENTER_Y,
      hitLineY,
      exitY,
      pastBufferMs: NOTE_PAST_HIT_BUFFER_MS
    };

    for (const hold of activeHoldsRef.current.values()) {
      const endY = projectRhythmNoteY({
        ...projectionBase,
        targetHitMs: hold.endMs
      });
      holds.push({
        id: hold.noteId,
        lane: hold.lane,
        topY: Math.min(hitLineY, endY),
        height: Math.max(12, Math.abs(hitLineY - endY))
      });
    }

    return holds;
  }, [laneHeight, laneLayout.length, nowMs, phase, travelMs]);

  const progressText = useMemo(() => {
    const totalTicks = 20;
    const ratio =
      phase === "ended"
        ? 1
        : phase === "playing"
          ? (GAME_DURATION_MS - timeLeftMs) / GAME_DURATION_MS
          : 0;

    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const filled = Math.floor(clampedRatio * totalTicks);
    return `[${":".repeat(filled)}${".".repeat(totalTicks - filled)}]`;
  }, [phase, timeLeftMs]);

  const formattedScore = score.toString().padStart(7, "0");
  const formattedCombo = combo.toString().padStart(3, "0");
  const judgementClass = `judgement judge-${judgement.toLowerCase()}`;
  const speedLabel = formatSpeedLabel(speedMultiplier);
  const activePresetId = useMemo(
    () =>
      resolveGameplayModePresetId({
        laneCount,
        difficulty,
        speedMultiplier
      }),
    [difficulty, laneCount, speedMultiplier]
  );
  const activePresetLabel =
    activePresetId === CUSTOM_PRESET_ID
      ? "CUSTOM"
      : getGameplayModePresetById(activePresetId)?.label ?? "CUSTOM";
  const judgeLabel = `${judgeWindows.PERFECT}/${judgeWindows.GREAT}/${judgeWindows.GOOD}ms`;
  const missionClearCount =
    Number(missionStatus.precision) +
    Number(missionStatus.hold) +
    Number(missionStatus.fever);
  const timeLabelSec = Math.ceil(timeLeftMs / 1000)
    .toString()
    .padStart(2, "0");
  const bestRecordSummary = bestRecord
    ? `${bestRecord.score.toString().padStart(7, "0")} / ACC ${bestRecord.accuracyPercent.toFixed(1)}% / RANK ${bestRecord.rank}`
    : "NONE";
  const applyModePreset = useCallback((presetId: BuiltInGameplayModePresetId) => {
    const preset = getGameplayModePresetById(presetId);
    if (!preset) {
      return;
    }

    setLaneCount(preset.laneCount);
    setDifficulty(preset.difficulty);
    setSpeedMultiplier(preset.speedMultiplier);
  }, []);

  return (
    <main className="rhythm-root" aria-label="ASCII rhythm gameplay preview">
      <header className="hud-top">
        <p className="hud-score">SCORE {formattedScore}</p>
        <div className="hud-center">
          <p className="hud-progress" aria-label="song progress">
            {progressText}
          </p>
          <div className="preset-module" role="group" aria-label="gameplay preset">
            {GAMEPLAY_MODE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-button ${activePresetId === preset.id ? "is-active" : ""}`}
                onClick={() => applyModePreset(preset.id)}
                disabled={phase === "playing"}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="preset-caption">PRESET {activePresetLabel}</p>
          <div className="speed-module" role="group" aria-label="note speed">
            {SPEED_LEVELS.map((speed) => (
              <button
                key={speed.id}
                type="button"
                className={`speed-button ${speedMultiplier === speed.multiplier ? "is-active" : ""}`}
                onClick={() => setSpeedMultiplier(speed.multiplier)}
                disabled={phase === "playing"}
              >
                {speed.label}
              </button>
            ))}
          </div>
          <div className="difficulty-module" role="group" aria-label="difficulty">
            {DIFFICULTY_ORDER.map((difficultyId) => (
              <button
                key={difficultyId}
                type="button"
                className={`difficulty-button ${difficulty === difficultyId ? "is-active" : ""}`}
                onClick={() => setDifficulty(difficultyId)}
                disabled={phase === "playing"}
              >
                {DIFFICULTY_PRESETS[difficultyId].label}
              </button>
            ))}
          </div>
          <div className="lane-module" role="group" aria-label="lane count">
            {[2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                className={`lane-button ${laneCount === count ? "is-active" : ""}`}
                onClick={() => setLaneCount(count as LaneCount)}
                disabled={phase === "playing"}
              >
                {count}L
              </button>
            ))}
          </div>
          <div className="hp-meter" aria-label={`health ${hpPercent}%`}>
            <span
              className={`hp-fill ${hpPercent <= 33 ? "is-danger" : hpPercent <= 60 ? "is-warn" : ""}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
          <div
            className="groove-meter"
            aria-label={
              isFever
                ? `fever ${Math.ceil(feverLeftMs / 100) / 10} seconds`
                : `groove ${groovePercent}%`
            }
          >
            <span
              className={`groove-fill ${isFever ? "is-fever" : ""}`}
              style={{ width: `${isFever ? 100 : groovePercent}%` }}
            />
          </div>
        </div>
        <p className="hud-combo">
          COMBO {formattedCombo}
          {phase === "playing" ? ` / ${timeLabelSec}s` : ""}
          {phase === "playing" ? ` / ${stageSection.id}` : ""}
          {` / HP ${hpPercent}`}
          {isFever ? ` / FEVER ${(Math.ceil(feverLeftMs / 100) / 10).toFixed(1)}s` : ""}
        </p>
      </header>

      <section className="stage-main">
        <div
          ref={laneFieldRef}
          className="lane-field"
          aria-label="rhythm lane grid"
          style={{ ["--lane-count" as string]: laneLayout.length } as CSSProperties}
        >
          {laneLayout.map((lane, laneIndex) => (
            <div
              className={`lane-column ${activeLanes[laneIndex] || holdLanes[laneIndex] ? "is-active" : ""}`}
              key={lane.code}
              onPointerDown={() => triggerLaneInput(laneIndex, "pointer")}
            >
              <div className="lane-river" aria-hidden />
              {visibleActiveHolds
                .filter((hold) => hold.lane === laneIndex)
                .map((hold) => (
                  <span
                    key={`active-hold-${hold.id}`}
                    className="lane-hold-body lane-hold-active"
                    style={
                      {
                        ["--hold-top-y" as string]: `${Math.round(hold.topY)}px`,
                        ["--hold-height" as string]: `${Math.round(hold.height)}px`
                      } as CSSProperties
                    }
                  />
                ))}
              {visibleNotesByLane[laneIndex].map((note) => (
                <div key={note.id}>
                  {note.holdTopY !== null ? (
                    <span
                      className={`lane-hold-body ${note.className}`}
                      style={
                        {
                          ["--hold-top-y" as string]: `${Math.round(note.holdTopY)}px`,
                          ["--hold-height" as string]: `${Math.round(note.holdHeight)}px`
                        } as CSSProperties
                      }
                    />
                  ) : null}
                  <span
                    className={`lane-note ${note.className}`}
                    style={
                      {
                        ["--note-y" as string]: `${Math.round(note.y)}px`
                      } as CSSProperties
                    }
                  >
                    {note.glyph}
                  </span>
                </div>
              ))}
              <div className="lane-floor" aria-hidden />
              <div className="hit-marker" aria-hidden />
              <p
                className={`key-hint ${activeLanes[laneIndex] || holdLanes[laneIndex] ? "is-active" : ""}`}
              >
                {lane.label}
              </p>
            </div>
          ))}
        </div>

        <div className="core-field">
          <div className="core-glow" aria-hidden />
          <pre className="ascii-core core-main" aria-hidden>
            {SCULPTURE_FRAME}
          </pre>
          <pre className="ascii-core core-ghost" aria-hidden>
            {SCULPTURE_FRAME}
          </pre>

          <div className={`session-overlay ${phase !== "playing" ? "is-visible" : ""}`}>
            {phase === "idle" ? (
              <div className="session-card">
                <p className="session-title">ASCII RHYTHM SCULPTURE</p>
                <p className="session-meta">
                  {laneCount} lanes / speed {speedLabel} / {difficultyPreset.label} / {activePresetLabel}
                </p>
                <p className="session-meta">
                  MISSION P{missionTargets.perfect} / H{missionTargets.hold} / F{missionTargets.fever}
                </p>
                <p className="session-meta">MODE BEST {bestRecordSummary}</p>
                <button type="button" className="session-button" onClick={startSession}>
                  START SESSION
                </button>
              </div>
            ) : null}

            {phase === "ended" ? (
              <div className="session-card">
                <p className="session-title">
                  {endReason === "GAME_OVER" ? "GAME OVER" : "SESSION END"}
                </p>
                <p className="session-meta">
                  SCORE {formattedScore} / ACC {accuracyPercent.toFixed(1)}% / RANK {sessionRank}
                </p>
                <p className="session-meta">
                  MAX COMBO {maxCombo.toString().padStart(3, "0")} / PEAK MISS STREAK {maxMissStreak}
                </p>
                <p className="session-meta">
                  P {hitStats.PERFECT} / G {hitStats.GREAT} / O {hitStats.GOOD} / M {hitStats.MISS}
                </p>
                <p className="session-meta">
                  HOLD CLEAR {holdClears} / {difficultyPreset.label} / {activePresetLabel}
                </p>
                <p className="session-meta">
                  FEVER x{feverTriggers} / GROOVE {groovePercent}%
                </p>
                <p className="session-meta">
                  MISSIONS {missionClearCount}/3
                  {` [P${missionStatus.precision ? "✓" : "·"} H${missionStatus.hold ? "✓" : "·"} F${missionStatus.fever ? "✓" : "·"}]`}
                </p>
                <p className="session-meta">MODE BEST {bestRecordSummary}</p>
                {sessionReport ? (
                  <>
                    <p className="session-meta">{sessionReport.scoreFlowLine}</p>
                    <p className="session-meta">{sessionReport.missFlowLine}</p>
                    <p className="session-meta">{sessionReport.missionLine}</p>
                  </>
                ) : null}
                <button type="button" className="session-button" onClick={startSession}>
                  RESTART
                </button>
              </div>
            ) : null}
          </div>

          <p key={judgementTick} className={judgementClass} aria-live="polite">
            {judgement}
          </p>
        </div>
      </section>

      <footer className="hud-bottom">
        <p className="hud-bpm">120 BPM / SPEED {speedLabel} / {difficultyPreset.label}</p>
        <p className="hud-caption">
          {stageSection.id} / JUDGE {judgeLabel} / M {missionClearCount}/3
        </p>
        <p className="hud-keys">{laneLayout.map((lane) => lane.label).join("  ")}</p>
      </footer>
    </main>
  );
}
