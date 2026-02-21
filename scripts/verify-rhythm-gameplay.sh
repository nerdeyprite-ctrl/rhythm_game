#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_check() {
  local label="$1"
  shift
  echo "[CHECK] $label"
  "$@" >/dev/null
  echo "[PASS]  $label"
}

echo "== verify-rhythm-gameplay =="

run_check "chart engine exports" \
  rg -n "STAGE_SECTIONS|buildLoopedChart\(|evolveChartWithSections\(|getStageSectionByTimeline\(" \
  src/lib/rhythmEngine.ts

run_check "config exports" \
  rg -n "LANE_LAYOUTS|DIFFICULTY_PRESETS|GAME_DURATION_MS|HOLD_TICK_INTERVAL_MS|MAX_HP" \
  src/lib/rhythmGameplayConfig.ts

run_check "mode preset exports" \
  rg -n "GAMEPLAY_MODE_PRESETS|resolveGameplayModePresetId|getGameplayModePresetById" \
  src/lib/rhythmModePreset.ts

run_check "scoring + survival exports" \
  rg -n "calculateHitScoreDelta|calculateHoldCompleteScoreDelta|calculateHoldTickScoreDelta|getSessionRank|applyMissToFever" \
  src/lib/rhythmScoring.ts

run_check "survival exports" \
  rg -n "applyMissPenalty|calculateRegenHp" \
  src/lib/rhythmSurvival.ts

run_check "GameplayFrame module integration" \
  rg -n "@/lib/rhythmEngine|@/lib/rhythmScoring|@/lib/rhythmGameplayConfig|@/lib/rhythmModePreset|@/lib/rhythmSurvival|@/lib/rhythmProjection|@/lib/rhythmSessionReport|@/lib/rhythmProgress|resolveGameplayModePresetId|buildSessionReport" \
  src/components/design/GameplayFrame.tsx

run_check "projection unification" \
  rg -n "projectRhythmNoteY\(" \
  src/components/design/GameplayFrame.tsx

run_check "session report pipeline" \
  rg -n "scoreBreakdown|sessionReport|buildSessionReport|missEventsRef|missionEventsRef" \
  src/components/design/GameplayFrame.tsx

run_check "visual layering selectors" \
  rg -n "lane-note|lane-hold-body|lane-floor|hit-marker|z-index" \
  src/styles/design-tokens.css

run_check "entry route wiring" \
  rg -n "import \"@/styles/design-tokens.css\"|href=\"/preview\"" \
  src/app/layout.tsx src/app/page.tsx

run_check "distDir split guard" \
  rg -n "distDir|\\.next-dev|\\.next-prod|PHASE_DEVELOPMENT_SERVER" \
  next.config.mjs package.json

echo "[CHECK] next build"
npm run build >/dev/null
echo "[PASS]  next build"

echo "== verify-rhythm-gameplay: all checks passed =="
