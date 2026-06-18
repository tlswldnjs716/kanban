# TASKS — 칸반보드 구현 작업 분해

> 근거 문서: `plan.md`, `PRD.md`, `TRD.md`, `USER_FLOW.md`, `DATABASE_DESIGN.md`, `DESIGN_SYSTEM.md`

## 1. 마크업 (index.html)
- [x] T-1.1 `<head>`에 `style.css` link, `<body>` 끝에 `script.js` (`defer`) script 태그 연결
- [x] T-1.2 `.board` 컨테이너 안에 3개 `.column` (`data-status="todo"|"inprogress"|"done"`) 작성
- [x] T-1.3 각 컬럼에 헤더(제목 + 카드 개수 표시용 엘리먼트) 작성
- [x] T-1.4 각 컬럼에 카드 추가 폼(`<form>` + `<input>` + 추가 버튼) 작성, `aria-label`/`label` 연결
- [x] T-1.5 각 컬럼에 카드 리스트 컨테이너(`<ul class="card-list">`) 작성 (드롭 타깃)

## 2. 스타일 (style.css) — `DESIGN_SYSTEM.md` 기준
- [x] T-2.1 CSS 변수로 컬러 팔레트 정의 (`--color-todo`, `--color-inprogress`, `--color-done` 등)
- [x] T-2.2 `.board` flex 레이아웃 (데스크톱 가로 3컬럼)
- [x] T-2.3 `.column` 스타일 (배경, radius, 헤더/폼/리스트 영역 구분)
- [x] T-2.4 `.card` 스타일 (배경, 그림자, 삭제 버튼 배치, `cursor: grab`)
- [x] T-2.5 `.dragging`, `.drag-over` 상태 클래스 스타일
- [x] T-2.6 카드 추가 폼/버튼 스타일
- [x] T-2.7 `@media (max-width: 768px)` 반응형 — 컬럼 세로 스택

## 3. 상태 관리 및 저장 (script.js) — `TRD.md` §4, §5 기준
- [x] T-3.1 초기 상태 모델 정의 (`{ todo: [], inprogress: [], done: [] }`)
- [x] T-3.2 `loadState()` 구현: localStorage 읽기 + JSON 파싱, 실패 시 빈 상태로 폴백
- [x] T-3.3 `saveState(state)` 구현: localStorage에 JSON 직렬화 저장
- [x] T-3.4 페이지 로드 시 `loadState()` → `renderBoard()` 초기 호출 연결

## 4. 렌더링 (script.js)
- [x] T-4.1 `renderBoard(state)` 구현: 3개 컬럼의 `.card-list`를 상태 기준으로 다시 그림
- [x] T-4.2 카드 엘리먼트 생성 함수: `draggable="true"`, `data-id`, 텍스트, 삭제 버튼 포함
- [x] T-4.3 컬럼 헤더의 카드 개수 배지 갱신

## 5. 카드 추가/삭제 (script.js) — `USER_FLOW.md` §2, §3 기준
- [x] T-5.1 각 컬럼 폼의 `submit` 이벤트 → 입력값 trim/길이 검증 → `addCard(status, text)` 호출
- [x] T-5.2 `addCard()` 구현: 카드 생성(`crypto.randomUUID()`) → 상태 push → save → render → 입력창 초기화
- [x] T-5.3 삭제 버튼 클릭 시 `removeCard(cardId)` 호출 (실제 구현: 카드별 버튼에 직접 리스너 부착, 이벤트 위임 대신 카드 생성 시점에 바인딩)
- [x] T-5.4 `removeCard()` 구현: 상태에서 카드 제거 → save → render

## 6. 드래그 앤 드롭 (script.js) — `TRD.md` §6, `USER_FLOW.md` §4 기준
- [x] T-6.1 카드 `dragstart`: `dataTransfer.setData('text/plain', cardId)`, `.dragging` 클래스 추가
- [x] T-6.2 카드 `dragend`: `.dragging` 클래스 제거
- [x] T-6.3 컬럼 `.card-list`의 `dragover`: `preventDefault()` + `.drag-over` 클래스 추가
- [x] T-6.4 컬럼 `.card-list`의 `dragleave`: `.drag-over` 클래스 제거
- [x] T-6.5 컬럼 `.card-list`의 `drop`: 카드 id 추출 → `moveCard(cardId, targetStatus)` 호출 → `.drag-over` 제거
- [x] T-6.6 `moveCard()` 구현: 기존 컬럼 배열에서 제거 → 대상 컬럼 배열 끝에 추가 → save → render

## 7. 통합 검증 — `PRD.md` §6 Acceptance Criteria 기준
- [x] T-7.1 정적 서버(`python3 -m http.server`)로 세 파일이 정상 서빙되는지 확인 (`node --check script.js` 문법 검증 포함, Playwright 미사용)
- [x] T-7.2 3개 컬럼 정상 표시 + 카드 개수 배지 확인 (사용자 브라우저 수동 확인 완료, 이상 없음)
- [x] T-7.3 카드 추가/삭제 동작 확인 (사용자 브라우저 수동 확인 완료, 이상 없음)
- [x] T-7.4 드래그로 카드가 다른 컬럼으로 이동하는지 확인 (To-do→In-progress→Done, 역방향도 확인) (사용자 브라우저 수동 확인 완료, 이상 없음)
- [x] T-7.5 새로고침 후 상태 유지 확인 (사용자 브라우저 수동 확인 완료, 이상 없음)
- [x] T-7.6 768px 이하 화면에서 반응형 레이아웃 확인 (개발자도구 디바이스 툴바) (사용자 브라우저 수동 확인 완료, 이상 없음)
- [x] T-7.7 브라우저 콘솔 에러 없는지 확인 (사용자 브라우저 수동 확인 완료, 이상 없음)

## 8. 범위 외 — 이번에 하지 않음 (`PRD.md` §4.2 참고)
- 컬럼 내 카드 순서 변경, 컬럼 추가/이름 변경
- 백엔드/RDB 연동 (`DATABASE_DESIGN.md`는 설계만 선반영, 구현은 범위 외)
- 모바일 터치 드래그 보장, 다국어, 실행 취소(undo)
