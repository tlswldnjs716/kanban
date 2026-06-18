# AUTH.md — 인증 설계 및 설정 가이드

## 개요

Supabase Auth를 사용한 이메일/비밀번호 + GitHub·Google 소셜 로그인.  
백엔드 없이 프론트엔드(정적 사이트)에서 직접 Supabase JS SDK로 인증 처리.

---

## 사용 Supabase 프로젝트

todo 앱(`day03/todo`)과 동일한 프로젝트 공유.

| 항목 | 값 |
|------|-----|
| Project URL | `https://zmglwglsxnjryclvmtpb.supabase.co` |
| Anon Key | `script.js` 상단에 하드코딩 |

---

## 인증 흐름

```
앱 로드
  │
  ▼
Supabase onAuthStateChange 리스너 등록
  │
  ├─ [세션 있음] → 보드 표시, 유저별 localStorage 키로 데이터 로드
  │
  └─ [세션 없음] → 인증 오버레이 표시
        │
        ├─ 이메일/비밀번호 로그인 → signInWithPassword()
        ├─ 이메일/비밀번호 회원가입 → signUp()
        ├─ GitHub OAuth → signInWithOAuth('github')
        └─ Google OAuth → signInWithOAuth('google')
              │
              └─ redirectTo: https://tlswldnjs716.github.io/kanban
```

---

## 유저별 데이터 분리

localStorage 키에 유저 ID를 포함해 계정별 보드 상태 분리:

```js
storageKey = `kanban-board-state-${currentUser.id}`;
```

---

## Supabase 대시보드 설정

### 1. OAuth Provider 활성화

**Authentication → Providers** 에서:
- **GitHub**: Client ID / Secret 입력 (GitHub OAuth App 생성 필요)
- **Google**: Client ID / Secret 입력 (Google Cloud Console 설정 필요)

### 2. Redirect URL 허용 목록 추가

**Authentication → URL Configuration → Redirect URLs** 에 추가:

```
https://tlswldnjs716.github.io/kanban
http://localhost:3000
http://localhost:8000
```

### 3. GitHub OAuth App 설정

- Homepage URL: `https://tlswldnjs716.github.io/kanban`
- Authorization callback URL: `https://zmglwglsxnjryclvmtpb.supabase.co/auth/v1/callback`

### 4. Google OAuth 설정

- 승인된 JavaScript 원본: `https://zmglwglsxnjryclvmtpb.supabase.co`
- 승인된 리디렉션 URI: `https://zmglwglsxnjryclvmtpb.supabase.co/auth/v1/callback`

---

## 이메일 확인 설정 (선택)

개발 중에는 **Authentication → Email Templates → Confirm signup** 에서  
이메일 확인을 비활성화하면 즉시 로그인 가능:

**Authentication → Providers → Email → "Confirm email"** 토글 OFF
