import type { DifficultyId, LaneCount } from "@/lib/rhythmGameplayConfig";

export const CUSTOM_PRESET_ID = "custom";

export type BuiltInGameplayModePresetId = "starter" | "standard" | "expert";

export type GameplayModePresetId =
  | BuiltInGameplayModePresetId
  | typeof CUSTOM_PRESET_ID;

export type GameplayModePreset = {
  id: BuiltInGameplayModePresetId;
  label: string;
  laneCount: LaneCount;
  difficulty: DifficultyId;
  speedMultiplier: number;
};

export const GAMEPLAY_MODE_PRESETS: GameplayModePreset[] = [
  {
    id: "starter",
    label: "STARTER",
    laneCount: 2,
    difficulty: "calm",
    speedMultiplier: 0.85
  },
  {
    id: "standard",
    label: "STANDARD",
    laneCount: 3,
    difficulty: "flow",
    speedMultiplier: 1
  },
  {
    id: "expert",
    label: "EXPERT",
    laneCount: 4,
    difficulty: "surge",
    speedMultiplier: 1.15
  }
];

export function resolveGameplayModePresetId(params: {
  laneCount: LaneCount;
  difficulty: DifficultyId;
  speedMultiplier: number;
}): GameplayModePresetId {
  const { laneCount, difficulty, speedMultiplier } = params;

  const matchedPreset = GAMEPLAY_MODE_PRESETS.find(
    (preset) =>
      preset.laneCount === laneCount &&
      preset.difficulty === difficulty &&
      Math.abs(preset.speedMultiplier - speedMultiplier) < 0.001
  );

  return matchedPreset?.id ?? CUSTOM_PRESET_ID;
}

export function getGameplayModePresetById(
  presetId: GameplayModePresetId
): GameplayModePreset | null {
  return GAMEPLAY_MODE_PRESETS.find((preset) => preset.id === presetId) ?? null;
}
