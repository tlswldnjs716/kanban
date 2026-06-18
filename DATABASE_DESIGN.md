# Database Design — 칸반보드

> 근거 문서: `plan.md`, `TRD.md`
> 현재는 백엔드/DBMS가 없는 정적 클라이언트 앱이지만, 향후 MySQL/PostgreSQL 같은 RDB와 연동할 가능성을 고려해 설계한다.

## 1. 현재 단계: localStorage (No DBMS)

### 1.1 저장 위치
- 브라우저 `localStorage`, 키: `kanban-board-state`
- 값: 아래 구조를 가진 객체를 `JSON.stringify`한 문자열

### 1.2 스키마
```ts
type CardStatus = 'todo' | 'inprogress' | 'done';

interface Card {
  id: string;     // crypto.randomUUID()
  text: string;   // 카드 내용
}

interface BoardState {
  todo: Card[];
  inprogress: Card[];
  done: Card[];
}
```

### 1.3 특징 및 한계
- 컬럼이 객체의 키(`todo`/`inprogress`/`done`)로 고정되어 있어 컬럼 추가/이름 변경이 불가능하다.
- 카드 순서는 배열 인덱스로만 표현되고, 별도 정렬 필드가 없다.
- 단일 브라우저/단일 사용자 범위를 벗어나지 못한다(기기 간 동기화 불가).
- 아래 2장의 RDB 스키마는 이런 한계를 해소하는 방향으로 설계한다 — **컬럼을 데이터로 분리하고, 카드에 명시적 정렬 필드를 둔다.**

## 2. 향후 단계: RDB(MySQL/PostgreSQL) 마이그레이션 설계

지금 당장 구현하지는 않지만, 추후 백엔드 API + RDB를 도입할 때 그대로 적용 가능하도록 정규화된 스키마를 미리 정의한다. MySQL과 PostgreSQL 양쪽에서 큰 변경 없이 쓸 수 있도록 표준 SQL 타입 위주로 설계했다(아래 5장에 방언별 차이 정리).

### 2.1 ER 개요
```
users (향후 멀티유저 대비, 1단계 RDB 전환 시점엔 생략 가능)
  └─ 1:N ─ boards
              └─ 1:N ─ board_columns   ("todo/in-progress/done"을 데이터로 표현)
                          └─ 1:N ─ cards
```
- `boards`: 칸반보드 자체 (지금은 사용자당 보드 1개만 쓰지만, 테이블로 분리해 향후 보드 여러 개를 둘 수 있게 한다).
- `board_columns`: 지금의 To-do/In-progress/Done이 더 이상 코드에 하드코딩된 키가 아니라 행(row)이 된다. 컬럼 추가/이름 변경/순서 변경을 DB 차원에서 지원하기 위한 구조.
- `cards`: 실제 작업 카드. 어느 컬럼에 속하는지(`column_id`)와 컬럼 내 순서(`position`)를 가진다.

### 2.2 테이블 정의

#### `users` (향후 인증 도입 시)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT / UUID | PK | 사용자 식별자 |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 로그인 이메일 |
| created_at | TIMESTAMP | NOT NULL DEFAULT now() | 가입일 |

#### `boards`
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT / UUID | PK | 보드 식별자 |
| user_id | BIGINT / UUID | FK → users.id, NOT NULL | 보드 소유자 (1인용 단계에서는 고정값/생략 가능) |
| name | VARCHAR(100) | NOT NULL DEFAULT '칸반보드' | 보드 이름 |
| created_at | TIMESTAMP | NOT NULL DEFAULT now() | 생성일 |
| updated_at | TIMESTAMP | NOT NULL DEFAULT now() | 수정일 |

#### `board_columns`
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT / UUID | PK | 컬럼 식별자 |
| board_id | BIGINT / UUID | FK → boards.id, NOT NULL | 소속 보드 |
| key | VARCHAR(30) | NOT NULL | 코드에서 참조하는 안정적 키 (예: `todo`, `inprogress`, `done`) |
| title | VARCHAR(50) | NOT NULL | 화면에 표시되는 컬럼 제목 (예: "To-do") |
| position | INTEGER | NOT NULL | 컬럼 표시 순서 (0부터 시작) |
| created_at | TIMESTAMP | NOT NULL DEFAULT now() | 생성일 |
| | | UNIQUE (board_id, key) | 한 보드 안에서 컬럼 key는 유일 |

초기 데이터(seed): 보드 생성 시 `(key='todo', title='To-do', position=0)`, `(key='inprogress', title='In-progress', position=1)`, `(key='done', title='Done', position=2)` 3행을 함께 생성 — 지금의 정적 3컬럼 구조와 동일하게 시작.

#### `cards`
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT / UUID | PK | 카드 식별자 (클라이언트의 `crypto.randomUUID()`와 호환되도록 UUID 권장) |
| column_id | BIGINT / UUID | FK → board_columns.id, NOT NULL | 현재 속한 컬럼 |
| text | TEXT | NOT NULL | 카드 내용 |
| position | INTEGER | NOT NULL | 같은 컬럼 내 카드 순서 (0부터 시작) |
| created_at | TIMESTAMP | NOT NULL DEFAULT now() | 생성일 |
| updated_at | TIMESTAMP | NOT NULL DEFAULT now() | 마지막 수정/이동 시각 |

### 2.3 인덱스
- `board_columns (board_id, position)` — 보드 화면에서 컬럼을 순서대로 조회.
- `cards (column_id, position)` — 컬럼 안에서 카드를 순서대로 조회 (드래그 앤 드롭 시 가장 빈번한 조회 패턴).
- `boards (user_id)` — 사용자별 보드 목록 조회 (멀티유저 도입 시).

### 2.4 드래그 앤 드롭(카드 이동)을 RDB로 옮길 때의 동작
현재 클라이언트 로직(`moveCard`)은 배열에서 빼서 다른 배열 끝에 넣는 것이지만, RDB에서는 다음과 같이 매핑된다.
1. 카드를 다른 컬럼으로 옮길 때: `UPDATE cards SET column_id = :targetColumnId, position = :newPosition, updated_at = now() WHERE id = :cardId`
2. 같은 컬럼 안에서 순서를 바꿀 때(향후 기능): 영향받는 범위의 카드들의 `position`을 재정렬.
3. 단순화를 원하면 `position`을 정수 대신 부동소수로 두고 두 카드 사이 값을 끼워 넣는 방식(fractional indexing)도 고려할 수 있다 — 재정렬 범위를 줄이는 트레이드오프.

### 2.5 클라이언트(현재 코드) ↔ RDB 매핑 메모
- 지금의 `BoardState.todo/inprogress/done` 배열은 RDB 도입 시 `board_columns.key` 기준으로 그룹핑한 `cards` 조회 결과로 대체된다.
- 지금의 `Card.id`(UUID)는 RDB `cards.id`(UUID)로 그대로 이어갈 수 있어 마이그레이션 시 데이터 변환 비용이 적다.
- API 도입 시 엔드포인트 예시: `GET /boards/:id` (컬럼+카드 전체 조회), `POST /cards`, `PATCH /cards/:id` (컬럼 이동/순서 변경), `DELETE /cards/:id`.

## 3. 마이그레이션 전략 (localStorage → RDB)
1. 백엔드 API가 추가되면, 클라이언트의 `loadState()`/`saveState()`를 `fetch` 기반 API 호출로 교체한다 (상태 모델 형태는 최대한 유지해 `renderBoard()` 등 렌더링 로직 변경을 최소화).
2. 기존 localStorage 데이터를 1회성으로 API에 업로드하는 마이그레이션 스크립트(또는 "가져오기" 버튼)를 추가해 사용자 데이터 손실 없이 전환한다.
3. 멀티유저가 필요해지는 시점에 `users`/`boards`의 소유권 개념을 활성화한다 (1인용 단계에서는 `user_id`를 고정값 또는 NULL 허용으로 둘 수 있음).

## 4. DDL 예시 (PostgreSQL 기준)
```sql
CREATE TABLE boards (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  name VARCHAR(100) NOT NULL DEFAULT '칸반보드',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE board_columns (
  id BIGSERIAL PRIMARY KEY,
  board_id BIGINT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  key VARCHAR(30) NOT NULL,
  title VARCHAR(50) NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (board_id, key)
);

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id BIGINT NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_board_columns_board_position ON board_columns (board_id, position);
CREATE INDEX idx_cards_column_position ON cards (column_id, position);
```

## 5. MySQL ↔ PostgreSQL 방언 차이 참고
| 항목 | PostgreSQL | MySQL |
|---|---|---|
| Auto-increment PK | `BIGSERIAL` | `BIGINT ... AUTO_INCREMENT` |
| UUID 생성 | `gen_random_uuid()` (pgcrypto) | `UUID()` 또는 애플리케이션에서 생성 후 `CHAR(36)`/`BINARY(16)` 저장 |
| TEXT 타입 | `TEXT` | `TEXT` (동일하게 사용 가능) |
| 현재시각 함수 | `now()` | `CURRENT_TIMESTAMP` |
| CASCADE 삭제 | `ON DELETE CASCADE` 지원 동일 | `ON DELETE CASCADE` 지원 동일 (InnoDB 필요) |

설계 자체는 두 DBMS 모두 호환되도록 표준 SQL 위주로 작성했으며, 실제 도입 시점에 선택한 DBMS의 방언에 맞춰 위 표 기준으로 DDL만 조정하면 된다.
