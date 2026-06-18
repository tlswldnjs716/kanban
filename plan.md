# 칸반보드 (To-do / In-progress / Done)

## Context
`day03/kanban` 디렉토리가 비어 있는 신규 작업. HTML/CSS/JS를 각각 별도 파일로 분리하고,
3개 컬럼(To-do, In-progress, Done) 간 카드를 드래그 앤 드롭으로 이동할 수 있는 칸반보드를 만든다.
사용자 확인 결과 다음 기능도 포함한다:
- 카드 추가/삭제
- localStorage를 이용한 상태 저장(새로고침해도 유지)
- 드래그 앤 드롭은 HTML5 네이티브 Drag and Drop API 사용 (외부 라이브러리 없음)

## 파일 구성
`src/exercise/bardroh/day03/kanban/` 에 아래 3개 파일 생성:
- `index.html`
- `style.css`
- `script.js`

## 구현 설계

### index.html
- `<div class="board">` 안에 3개 `<div class="column" data-status="todo|inprogress|done">` 구성
- 각 컬럼에는 헤더(제목 + 카드 개수), 카드 추가용 입력 폼(`<input>` + `추가` 버튼), 카드 리스트 컨테이너(`<ul class="card-list">`, drop target) 포함
- `style.css`, `script.js` 각각 link/script 태그로 연결 (script는 `defer` 사용)

### style.css
- flex/grid로 3컬럼 가로 배치 (모바일에서는 컬럼 세로 스택으로 반응형 처리)
- 카드 스타일: 카드(`.card`)에 텍스트 + 삭제 버튼(`×`)
- 드래그 중 카드(`.dragging`) 및 드롭 가능 영역 hover(`.drag-over`) 시각 효과 (opacity, outline 등)
- 컬럼별 헤더 색상 구분(To-do/In-progress/Done)

### script.js
핵심 로직:
1. **상태 모델**: `{ todo: [{id, text}], inprogress: [...], done: [...] }` 형태의 객체를 localStorage 키(예: `kanban-board-state`)에 JSON으로 저장/로드
2. **초기화**: 페이지 로드 시 localStorage에서 상태를 읽어 각 컬럼의 `.card-list`를 렌더링. 데이터가 없으면 빈 배열로 시작
3. **카드 렌더링 함수** `renderBoard()`: 상태 객체 기준으로 3개 컬럼의 DOM을 다시 그림. 각 `<li class="card" draggable="true" data-id="...">` 에 카드 텍스트 + 삭제 버튼 포함
4. **카드 추가**: 각 컬럼의 폼 `submit` 이벤트 → 입력값으로 새 카드(id는 `Date.now()` 또는 `crypto.randomUUID()`) 생성 → 해당 컬럼 배열에 push → `saveState()` + `renderBoard()`
5. **카드 삭제**: 카드 내 삭제 버튼 클릭 → 이벤트 위임(컬럼 리스트에 클릭 리스너) 또는 카드별 리스너로 해당 id를 상태에서 제거 → 저장 + 재렌더링
6. **드래그 앤 드롭 (HTML5 Drag and Drop API)**:
   - 카드: `dragstart` 시 `e.dataTransfer.setData('text/plain', cardId)`, 카드에 `.dragging` 클래스 추가; `dragend` 시 클래스 제거
   - 컬럼 리스트(`.card-list`): `dragover`에서 `e.preventDefault()` + `.drag-over` 클래스 토글, `dragleave`에서 클래스 제거
   - `drop` 핸들러: dataTransfer로 카드 id 가져와서, 상태 객체에서 기존 컬럼 배열에서 카드를 찾아 제거하고 드롭된 컬럼의 배열에 push (드롭 위치의 카드 기준으로 순서 삽입까지는 단순화하여 컬럼 끝에 추가) → 저장 + 재렌더링
7. **저장 함수** `saveState()`: `localStorage.setItem('kanban-board-state', JSON.stringify(state))`

## 검증 방법
- 브라우저에서 `index.html`을 직접 열거나 `python3 -m http.server`로 정적 서빙 후 접속
- 각 컬럼에서 카드 추가/삭제 동작 확인
- 카드를 드래그하여 다른 컬럼으로 이동되는지 확인 (마우스 드래그)
- 새로고침 후에도 카드 상태(컬럼 위치, 텍스트)가 유지되는지 확인
- 브라우저 콘솔에 에러 없는지 확인
