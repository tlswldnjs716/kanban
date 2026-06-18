# WORKFLOW.md — 스티치 칸반보드

## 1. 전체 구조

```
브라우저 (index.html + style.css + script.js)
    │
    ▼
Supabase
    ├── Auth      — 이메일/GitHub/Google 로그인
    ├── Database  — cards 테이블, logs 테이블
    └── Realtime  — 팀원 간 실시간 동기화
```

정적 HTML/CSS/JS만으로 구성된 클라이언트 앱이다. 별도 서버 없이 Supabase를 백엔드로 사용한다.

---

## 2. 인증 흐름

```
접속
 └─▶ auth-overlay 표시
       ├── 이메일 + 비밀번호 로그인 / 회원가입
       └── OAuth (GitHub / Google)
             │
             ▼
       db.auth.onAuthStateChange()
             │
      ┌──────┴───────┐
   로그인 성공      로그아웃
      │                │
 loadCards()      state 초기화
 loadLogs()       로그 패널 숨김
 subscribeToCards()
 showBoard()
```

- 로그인 상태는 Supabase가 세션으로 관리한다. 새로고침해도 유지된다.
- OAuth 콜백 URL: `https://tlswldnjs716.github.io/kanban`
- RLS(Row Level Security)로 로그인한 사용자만 카드/로그에 접근할 수 있다.

---

## 3. 카드 CRUD 흐름

모든 쓰기 작업은 **낙관적 업데이트** → **Supabase 저장** → **실패 시 롤백** 순서로 동작한다.

### 카드 추가
```
사용자 입력 → addCard(status, text)
  1. 로컬 state에 즉시 반영 + renderBoard()    ← 낙관적
  2. db.from('cards').insert(...)              ← DB 저장
  3. 성공: insertLog('add', text, null, status)
     실패: 로컬에서 제거 + 롤백
  4. Realtime INSERT 이벤트 → 다른 팀원 화면에 반영
```

### 카드 이동 (드래그 앤 드롭)
```
dragstart → dragend → drop
  1. moveCard(cardId, targetStatus)
  2. 로컬 state에서 이동 + renderBoard()       ← 낙관적
  3. db.from('cards').update({ status })       ← DB 저장
  4. 성공: insertLog('move', text, from, to)
     실패: 원래 위치로 롤백
  5. Realtime UPDATE 이벤트 → 다른 팀원 화면에 반영
```

### 카드 삭제
```
× 버튼 클릭 → removeCard(cardId)
  1. 로컬 state에서 제거 + renderBoard()       ← 낙관적
  2. db.from('cards').delete().eq('id', ...)   ← DB 삭제
  3. 성공: insertLog('delete', text, from, null)
     실패: 원래 위치에 복원
  4. Realtime DELETE 이벤트 → 다른 팀원 화면에 반영
```

---

## 4. 실시간 동기화 (Realtime)

```
subscribeToCards()
  └── db.channel('kanban-shared')
        ├── cards INSERT  → 내가 추가하지 않은 카드면 state에 추가
        ├── cards DELETE  → state에서 제거
        ├── cards UPDATE  → 이전 위치에서 제거 후 새 위치에 추가
        └── logs INSERT   → 로그 목록 맨 위에 항목 추가
```

**중복 방지**: 낙관적 업데이트로 이미 반영된 내 카드는 Realtime 이벤트가 와도 무시한다.

로그아웃 시 `unsubscribeFromCards()`로 채널을 해제한다.

---

## 5. 활동 로그

로그인한 모든 팀원의 행동이 `logs` 테이블에 기록되고 실시간으로 공유된다.

| action   | 기록 내용 |
|----------|-----------|
| `add`    | user_email, card_text, to_status |
| `move`   | user_email, card_text, from_status, to_status |
| `delete` | user_email, card_text, from_status |

- 화면에 최근 30개까지 표시 (최신순)
- 새 로그는 Realtime으로 수신해 맨 위에 추가
- 접기/펼치기 토글 가능

---

## 6. Supabase 테이블 설계

### cards
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | 클라이언트에서 `crypto.randomUUID()`로 생성 |
| status | TEXT | `todo` / `inprogress` / `done` |
| text | TEXT | 카드 내용 |
| created_at | TIMESTAMPTZ | 정렬 기준 |

### logs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | 자동 생성 |
| user_email | TEXT | 행동한 사용자 이메일 |
| action | TEXT | `add` / `move` / `delete` |
| card_text | TEXT | 대상 카드 내용 |
| from_status | TEXT | 이동 전 컬럼 (add면 NULL) |
| to_status | TEXT | 이동 후 컬럼 (delete면 NULL) |
| created_at | TIMESTAMPTZ | 로그 발생 시각 |

---

## 7. Supabase 초기 설정 SQL

```sql
-- cards 테이블
CREATE TABLE cards (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('todo', 'inprogress', 'done')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read"   ON cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "team insert" ON cards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team update" ON cards FOR UPDATE TO authenticated USING (true);
CREATE POLICY "team delete" ON cards FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE cards;

-- logs 테이블
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('add', 'move', 'delete')),
  card_text TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read"   ON logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "team insert" ON logs FOR INSERT TO authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE logs;
```

---

## 8. 팀원 공유 방법

1. 팀원에게 칸반보드 URL 공유
2. 팀원이 회원가입 또는 소셜 로그인
3. 로그인하면 즉시 같은 보드를 공유하며 실시간으로 동기화됨
