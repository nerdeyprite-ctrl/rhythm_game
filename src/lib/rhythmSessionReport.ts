import type { MissionKey } from "@/lib/rhythmScoring";

export type ScoreBreakdown = {
  hits: number;
  holdCompletes: number;
  holdTicks: number;
  missions: number;
};

export type MissEvent = {
  timelineMs: number;
  count: number;
  missStreakAfter: number;
};

export type MissionEvent = {
  mission: MissionKey;
  timelineMs: number;
};

export type SessionReport = {
  scoreFlowLine: string;
  missFlowLine: string;
  missionLine: string;
};

export const EMPTY_SCORE_BREAKDOWN: ScoreBreakdown = {
  hits: 0,
  holdCompletes: 0,
  holdTicks: 0,
  missions: 0
};

const MISSION_SHORT_LABEL: Record<MissionKey, string> = {
  precision: "P",
  hold: "H",
  fever: "F"
};

function formatMsToSec(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function buildSessionReport(params: {
  scoreBreakdown: ScoreBreakdown;
  missEvents: MissEvent[];
  missionEvents: MissionEvent[];
  maxMissStreak: number;
}): SessionReport {
  const { scoreBreakdown, missEvents, missionEvents, maxMissStreak } = params;

  const totalScore =
    scoreBreakdown.hits +
    scoreBreakdown.holdCompletes +
    scoreBreakdown.holdTicks +
    scoreBreakdown.missions;

  const scoreFlowLine =
    `SCORE FLOW ${totalScore.toString().padStart(7, "0")}` +
    ` / HIT ${scoreBreakdown.hits}` +
    ` / HC ${scoreBreakdown.holdCompletes}` +
    ` / HT ${scoreBreakdown.holdTicks}` +
    ` / M ${scoreBreakdown.missions}`;

  const missFlowLine =
    missEvents.length === 0
      ? `MISS WINDOWS NONE / PEAK STREAK ${maxMissStreak}`
      : `MISS WINDOWS ${missEvents
          .slice()
          .sort((a, b) => b.count - a.count || b.missStreakAfter - a.missStreakAfter)
          .slice(0, 3)
          .map((event) => `${formatMsToSec(event.timelineMs)} x${event.count}`)
          .join(" | ")} / PEAK STREAK ${maxMissStreak}`;

  const missionLine =
    missionEvents.length === 0
      ? "MISSION TIMELINE NONE"
      : `MISSION TIMELINE ${missionEvents
          .slice()
          .sort((a, b) => a.timelineMs - b.timelineMs)
          .map(
            (event) =>
              `${MISSION_SHORT_LABEL[event.mission]}@${formatMsToSec(event.timelineMs)}`
          )
          .join(" ")}`;

  return {
    scoreFlowLine,
    missFlowLine,
    missionLine
  };
}
