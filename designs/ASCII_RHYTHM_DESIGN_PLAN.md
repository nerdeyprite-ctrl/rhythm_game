# ASCII Rhythm Game Design Plan (V2)

## 1. 목표
- ASCII 미니멀리즘을 유지하면서도 오브젝트 품질을 끌어올린다.
- 색상 수를 줄여 단일한 분위기와 통일성을 확보한다.
- 구현 전에 화면 구조, 모션, 시각 규칙을 먼저 고정한다.

## 2. 시각 원칙
- Borderless: 카드/패널/박스 윤곽선 사용 금지.
- Minimal Palette: 배경 2톤 + 텍스트 2톤 + 액센트 1색만 사용.
- Typography First: 모든 계층은 폰트 크기, 자간, 명도 차이로 구분.
- Single Accent: 강조는 한 가지 액센트 색으로만 처리.

## 3. 색상 규칙 (Solarized Light 축소판)
- Background
  - `#fdf6e3` (primary)
  - `#eee8d5` (secondary)
- Text
  - `#586e75` (primary)
  - `#657b83` (secondary)
- Accent
  - `#268bd2` (single accent)
- 금지
  - 추가 상태색 확장 금지 (cyan/green/orange/red 사용 금지)

## 4. 레이아웃 규칙
- 기준 뷰포트: 1440 x 900
- 구성
  - Top HUD: score / progress / combo
  - Main Stage: 4-lane + ASCII object
  - Bottom HUD: bpm / caption / key hints
- 비율
  - Lane 48%
  - Object 52%

## 5. ASCII 오브젝트 규격
- 기존 큐브형을 폐기하고, 유선형 링/자이로 계열 오브젝트로 교체.
- 4프레임( A/B/C/D ) 레이어를 겹쳐 저강도 착시 회전 구현.
- 형태 변형은 크기/회전/투명도 중심으로만 사용.

## 6. 모션 규칙
- BPM Anchor: 120
- Note fall: 1.4s ~ 1.5s
- Object wave: 7.8s 주기
- Motion Intensity: low
- 목적: 리듬감을 전달하되 시각 피로를 만들지 않는다.

## 7. QA 체크리스트
- 색상이 5색 체계를 넘지 않는가.
- 주요 객체가 단일 액센트 기준으로 읽히는가.
- ASCII 오브젝트가 프레임 전환 시 깨져 보이지 않는가.
- HUD/Stage/Footer 간 정보 밀도가 과하지 않은가.

## 8. 다음 단계
- 위 규칙을 기준으로 로컬 디자인 시안을 고정
- 코드 구현은 현재 `preview` 라우트를 기준으로 점진 개선
