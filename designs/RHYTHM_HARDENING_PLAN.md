# Rhythm Gameplay Hardening Plan

## Objective
- 기존 플레이 감성을 유지하면서 안정성/튜닝 용이성/회귀 방지력을 높인다.
- 대규모 기능 추가보다 구조 정리와 검증 자동화를 우선한다.

## Phase 1 (Completed)
- `GameplayFrame` 내부 하드코딩 설정을 `src/lib/rhythmGameplayConfig.ts`로 분리.
- 노트/홀드 Y 투영 계산 중복을 `src/lib/rhythmProjection.ts`로 통합.
- 모드별 베스트 기록 저장/로드를 `src/lib/rhythmProgress.ts`로 추가.

### Exit Criteria
- 빌드 통과.
- `/preview` 라우트 정상 응답.
- 기존 입력/판정/홀드/레이어 동작 회귀 없음.

## Phase 2 (Completed)
- 완료: 판정/데미지/회복 루프를 순수 함수로 분리 (`src/lib/rhythmSurvival.ts`).
- 완료: 세션 종료 리포트(점수 구성/미스 구간/미션 타임라인) 모듈 추가 (`src/lib/rhythmSessionReport.ts`).
- 완료: 설정 프리셋(입문/표준/고급) UX 도입 (`src/lib/rhythmModePreset.ts` + HUD 프리셋 바).

### Exit Criteria
- `GameplayFrame` 내 도메인 계산 로직 30% 이상 감소.
- 스코어/HP 관련 회귀 체크 항목을 verify 스킬에 추가.

## Phase 3 (Completed: Verification Upgrade)
- 완료: `verify-rhythm-gameplay-integrity`에 `rhythmModePreset`/`rhythmSurvival`/`rhythmProjection`/`rhythmSessionReport`/`rhythmProgress` 커버리지 반영.
- 완료: `scripts/verify-rhythm-gameplay.sh` + `npm run verify:rhythm` 통합 러너 추가.
- 완료: `manage-skills` 등록 테이블에 리듬게임 신규 모듈/러너 경로 반영.

### Exit Criteria
- `npm run verify:rhythm` PASS.
- 새 파일 추가 시 `manage-skills` 기준 미커버 항목 0개 유지.

## Phase 4 (In Progress: Balance + UX Resilience)
- 기본 체감 속도/난이도 프리셋 밸런스를 플레이 로그 기준으로 재조정.
- 판정 피드백(정확도, 미스 스트릭, HP 변동) 가시성을 HUD에서 더 즉시적으로 노출.
- 게임 오버/클리어 결과 화면에 재시작 동선과 모드 비교(현재/베스트)를 강화.
- 포커스 손실/복귀 시 입력 상태 꼬임 방지 회귀 테스트 케이스를 verify 단계에 추가.

### Exit Criteria
- 프리셋 3종 모두에서 "초기 10초 생존성 + 판정 가시성" 수동 플레이 체크 통과.
- 게임 오버/클리어 후 재시작까지 클릭 1회 이내.
- 포커스 손실 후 복귀 시 홀드/입력 상태 불일치 재현 0건.

## 운영 규칙
- 변경 후 순서: `build` -> `/preview` 확인 -> verify 스킬 실행.
- 모듈 분리 시 반드시 Related Files/커버 패턴을 함께 갱신.
- 난이도/점수 밸런스 변경은 최소 1회 플레이 검증 로그를 남긴다.
