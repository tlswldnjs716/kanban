# TRD (Technical Requirements Document) — 칸반보드

> 근거 문서: `plan.md`, `PRD.md`

## 1. 기술 스택
- HTML5, CSS3, Vanilla JavaScript (ES6+)
- 외부 라이브러리/프레임워크/빌드 도구 없음 (CDN, npm 등 의존성 없음)
- 데이터 저장: 브라우저 `localStorage`

## 2. 파일 구조
```
day03/kanban/
├── index.html   # 마크업, style.css / script.js 로드
├── style.css    # 전체 스타일
└── script.js    # 상태 관리, 렌더링, 이벤트 핸들링
```
- 관심사 분리 원칙에 따라 마크업(HTML)·스타일(CSS)·동작(JS)을 파일 단위로 완전히 분리한다.
- `script.js`는 `index.html`에서 `defer` 속성으로 로드해 DOM 파싱 이후 실행되도록 한다.

## 3. 아키텍처 개요
순수 클라이언트 사이드 SPA(단일 정적 페이지). 서버 통신 없음. 데이터 흐름은 다음 단방향 루프를 따른다.

```
[localStorage] --load--> [state 객체] --render--> [DOM]
       ^                      |
       |                  사용자 이벤트(추가/삭제/드롭)
       |                      v
       +------ save ---- [state 변경]
```

- **단일 상태 소스(Single Source of Truth)**: 메모리상의 `state` 객체가 항상 진실의 기준이며, DOM은 `state`로부터 다시 그려진다(re-render). DOM을 직접 조작해 상태를 추론하지 않는다.
- **상태 변경 → 저장 → 재렌더링**이 모든 변경 동작(추가/삭제/이동)에서 동일한 패턴으로 반복된다.

## 4. 모듈/함수 설계 (script.js)
| 함수 | 책임 |
|---|---|
| `loadState()` | localStorage에서 상태를 읽어 파싱. 없거나 손상 시 기본 빈 상태 반환 |
| `saveState(state)` | 상태 객체를 JSON으로 직렬화해 localStorage에 저장 |
| `renderBoard(state)` | 상태를 기준으로 3개 컬럼의 카드 리스트 DOM을 다시 그림 |
| `addCard(status, text)` | 카드 생성 후 상태에 추가 → save → render |
| `removeCard(cardId)` | 카드를 상태에서 찾아 제거 → save → render |
| `moveCard(cardId, targetStatus)` | 카드를 기존 컬럼 배열에서 제거하고 대상 컬럼 배열 끝에 추가 → save → render |
| 드래그 이벤트 핸들러 | `dragstart`/`dragend`(카드), `dragover`/`dragleave`/`drop`(컬럼 리스트) |

## 5. 데이터 모델 (런타임 상태)
```js
{
  todo:       [{ id: string, text: string }],
  inprogress: [{ id: string, text: string }],
  done:       [{ id: string, text: string }],
}
```
- `id`는 `crypto.randomUUID()`로 생성 (미지원 구형 브라우저는 고려하지 않음).
- localStorage 키: `kanban-board-state` (상세 스키마는 `DATABASE_DESIGN.md` 참고).

## 6. 드래그 앤 드롭 구현 규칙
- 네이티브 HTML5 Drag and Drop API만 사용 (`draggable="true"`, `dataTransfer`).
- 카드 엘리먼트: `dragstart`에서 `dataTransfer.setData('text/plain', cardId)` 설정, `.dragging` 클래스 부여; `dragend`에서 클래스 제거.
- 컬럼의 카드 리스트(drop target): `dragover`에서 `preventDefault()` 호출(필수, 없으면 drop 미발생) + `.drag-over` 클래스로 시각 피드백; `drop`에서 `dataTransfer.getData('text/plain')`로 카드 id를 읽어 `moveCard()` 호출.
- 카드 내 순서(같은 컬럼 안에서의 위치) 제어는 범위 밖 — 드롭 시 항상 대상 컬럼의 마지막에 추가.

## 7. 에러/예외 처리 원칙
- `localStorage` 파싱 실패(JSON.parse 예외) 시 빈 상태로 폴백하고 콘솔에 경고만 남긴다 (사용자 알림 UI는 만들지 않음).
- 빈 텍스트로 카드 추가 시도는 무시한다 (폼 `required` 속성 + JS 단에서 trim 후 길이 체크).
- localStorage 용량 초과 등 비정상 상황은 이번 범위에서 처리하지 않는다 (개인용 소규모 데이터 가정).

## 8. 호환성 및 제약
- 모던 브라우저(Chrome/Edge/Firefox 최신) 기준. IE 미지원.
- HTML5 Drag and Drop API는 데스크톱 마우스 드래그 기준이며, 모바일 터치 드래그는 별도 보장하지 않음 (PRD 비기능 요구사항 참고).
- 서버 없는 정적 파일이므로 `file://`로 직접 열어도 동작 (CORS/네트워크 의존 없음).

## 9. 테스트/검증 방법
- 별도 테스트 프레임워크 도입하지 않음 (정적 파일, 백엔드 없음).
- 수동 검증: 브라우저로 `index.html` 직접 열기 또는 `python3 -m http.server`로 띄워 확인. Playwright 등 브라우저 자동화 도구는 사용하지 않는다 (`CLAUDE.md` 규칙).
