export type RhythmProjectionParams = {
  nowMs: number;
  targetHitMs: number;
  travelMs: number;
  entryY: number;
  hitLineY: number;
  exitY: number;
  pastBufferMs: number;
};

export function projectRhythmNoteY(params: RhythmProjectionParams) {
  const { nowMs, targetHitMs, travelMs, entryY, hitLineY, exitY, pastBufferMs } =
    params;

  const startMs = targetHitMs - travelMs;
  const endMs = targetHitMs + pastBufferMs;

  if (nowMs < startMs) {
    return entryY;
  }

  if (nowMs <= targetHitMs) {
    const preProgress = Math.max(0, Math.min(1, (nowMs - startMs) / travelMs));
    return entryY + (hitLineY - entryY) * preProgress;
  }

  const postProgress = Math.max(
    0,
    Math.min(1.08, (nowMs - targetHitMs) / pastBufferMs)
  );
  const y = hitLineY + (exitY - hitLineY) * postProgress;
  return nowMs > endMs ? exitY : y;
}
