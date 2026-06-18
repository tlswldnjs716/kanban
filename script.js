// ─── Supabase ─────────────────────────────────────────
const SUPABASE_URL = 'https://ggpjhrfeujjsloelerax.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncGpocmZldWpqc2xvZWxlcmF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Njg2MTgsImV4cCI6MjA5NzI0NDYxOH0.2RfIIvMqLnlywBq1otepXRRFI5U91pAJVKnYS3YI9uE';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── State ────────────────────────────────────────────
const STATUSES = ['todo', 'inprogress', 'done'];
const STATUS_LABELS = { todo: 'To-do', inprogress: 'In-progress', done: 'Done' };
let currentUser = null;
let state = { todo: [], inprogress: [], done: [] };
let authMode = 'signin';
let realtimeChannel = null;

// ─── Log Layer ────────────────────────────────────────
async function insertLog(action, cardText, fromStatus = null, toStatus = null) {
  if (!currentUser) return;
  await db.from('logs').insert({
    user_email: currentUser.email ?? currentUser.user_metadata?.full_name ?? '사용자',
    action,
    card_text: cardText,
    from_status: fromStatus,
    to_status: toStatus,
  });
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60)   return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function statusBadge(status) {
  const label = STATUS_LABELS[status] ?? status;
  return `<span class="log-status log-status--${status}">${label}</span>`;
}

function buildLogDesc(log) {
  const card = `<span class="log-card-text">'${log.card_text}'</span>`;
  if (log.action === 'add')    return `${card} → ${statusBadge(log.to_status)}에 추가`;
  if (log.action === 'delete') return `${statusBadge(log.from_status)}에서 ${card} 삭제`;
  if (log.action === 'move')   return `${card} ${statusBadge(log.from_status)} → ${statusBadge(log.to_status)}`;
  return card;
}

function renderLogs(logs) {
  const logList = document.getElementById('log-list');
  logList.innerHTML = '';

  if (!logs.length) {
    logList.innerHTML = '<li class="log-empty">아직 활동이 없어요 🌊</li>';
    return;
  }

  const ICONS = { add: '✏️', move: '🔀', delete: '🗑️' };
  for (const log of logs) {
    const li = document.createElement('li');
    li.className = 'log-item';
    li.innerHTML = `
      <span class="log-icon">${ICONS[log.action] ?? '•'}</span>
      <span class="log-actor" title="${log.user_email}">${log.user_email}</span>
      <span class="log-desc">${buildLogDesc(log)}</span>
      <span class="log-time">${timeAgo(log.created_at)}</span>
    `;
    logList.appendChild(li);
  }
}

function prependLogItem(log) {
  const logList = document.getElementById('log-list');
  const empty = logList.querySelector('.log-empty');
  if (empty) logList.innerHTML = '';

  const ICONS = { add: '✏️', move: '🔀', delete: '🗑️' };
  const li = document.createElement('li');
  li.className = 'log-item';
  li.innerHTML = `
    <span class="log-icon">${ICONS[log.action] ?? '•'}</span>
    <span class="log-actor" title="${log.user_email}">${log.user_email}</span>
    <span class="log-desc">${buildLogDesc(log)}</span>
    <span class="log-time">${timeAgo(log.created_at)}</span>
  `;
  logList.prepend(li);

  // 30개 초과 시 마지막 항목 제거
  const items = logList.querySelectorAll('.log-item');
  if (items.length > 30) items[items.length - 1].remove();
}

async function loadLogs() {
  const { data, error } = await db
    .from('logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) { console.error('loadLogs error:', error); return; }
  renderLogs(data ?? []);
  document.getElementById('log-panel').hidden = false;
}

// ─── Data Layer (Supabase) ────────────────────────────
async function loadCards() {
  const { data, error } = await db
    .from('cards')
    .select('id, status, text')
    .order('created_at', { ascending: true });

  if (error) { console.error('loadCards error:', error); return; }

  state = { todo: [], inprogress: [], done: [] };
  for (const card of (data ?? [])) {
    if (state[card.status]) state[card.status].push({ id: card.id, text: card.text });
  }
  renderBoard();
}

// ─── Kanban ───────────────────────────────────────────
function findCardLocation(cardId) {
  for (const status of STATUSES) {
    const index = state[status].findIndex((c) => c.id === cardId);
    if (index !== -1) return { status, index };
  }
  return null;
}

async function addCard(status, text) {
  const id = crypto.randomUUID();
  // 낙관적 업데이트: 즉시 로컬에 반영
  state[status].push({ id, text });
  renderBoard();

  const { error } = await db.from('cards').insert({ id, status, text });
  if (error) {
    // 실패 시 롤백
    state[status] = state[status].filter((c) => c.id !== id);
    renderBoard();
    alert('카드 추가에 실패했어요: ' + error.message);
    return;
  }
  insertLog('add', text, null, status);
}

async function removeCard(cardId) {
  const loc = findCardLocation(cardId);
  if (!loc) return;
  const [card] = state[loc.status].splice(loc.index, 1);
  renderBoard();

  const { error } = await db.from('cards').delete().eq('id', cardId);
  if (error) {
    state[loc.status].splice(loc.index, 0, card);
    renderBoard();
    alert('카드 삭제에 실패했어요: ' + error.message);
    return;
  }
  insertLog('delete', card.text, loc.status, null);
}

async function moveCard(cardId, targetStatus) {
  const loc = findCardLocation(cardId);
  if (!loc || loc.status === targetStatus) return;
  const fromStatus = loc.status;
  const [card] = state[loc.status].splice(loc.index, 1);
  state[targetStatus].push(card);
  renderBoard();

  const { error } = await db.from('cards').update({ status: targetStatus }).eq('id', cardId);
  if (error) {
    state[targetStatus] = state[targetStatus].filter((c) => c.id !== cardId);
    state[loc.status].splice(loc.index, 0, card);
    renderBoard();
    alert('카드 이동에 실패했어요: ' + error.message);
    return;
  }
  insertLog('move', card.text, fromStatus, targetStatus);
}

// ─── Realtime (팀 공유 동기화) ───────────────────────
function subscribeToCards() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);

  realtimeChannel = db.channel('kanban-shared')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards' }, ({ new: card }) => {
      // 내가 추가한 카드는 이미 낙관적으로 반영했으므로 중복 방지
      if (STATUSES.some((s) => state[s].some((c) => c.id === card.id))) return;
      if (state[card.status]) {
        state[card.status].push({ id: card.id, text: card.text });
        renderBoard();
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'cards' }, ({ old: card }) => {
      for (const status of STATUSES) {
        const idx = state[status].findIndex((c) => c.id === card.id);
        if (idx !== -1) {
          state[status].splice(idx, 1);
          renderBoard();
          return;
        }
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cards' }, ({ new: card }) => {
      // 기존 위치에서 제거
      for (const status of STATUSES) {
        const idx = state[status].findIndex((c) => c.id === card.id);
        if (idx !== -1) {
          if (status === card.status) return; // 이미 낙관적으로 이동됨
          state[status].splice(idx, 1);
          break;
        }
      }
      // 새 위치에 추가 (중복 방지)
      if (state[card.status] && !state[card.status].find((c) => c.id === card.id)) {
        state[card.status].push({ id: card.id, text: card.text });
      }
      renderBoard();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, ({ new: log }) => {
      prependLogItem(log);
    })
    .subscribe();
}

function unsubscribeFromCards() {
  if (realtimeChannel) {
    db.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ─── Render ───────────────────────────────────────────
function createCardElement(card) {
  const li = document.createElement('li');
  li.className = 'card';
  li.draggable = true;
  li.dataset.id = card.id;

  const text = document.createElement('span');
  text.className = 'card-text';
  text.textContent = card.text;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'card-delete-btn';
  deleteBtn.type = 'button';
  deleteBtn.textContent = '×';
  deleteBtn.setAttribute('aria-label', '카드 삭제');

  li.append(text, deleteBtn);

  li.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', card.id);
    li.classList.add('dragging');
  });
  li.addEventListener('dragend', () => li.classList.remove('dragging'));
  deleteBtn.addEventListener('click', () => removeCard(card.id));

  return li;
}

function renderBoard() {
  for (const status of STATUSES) {
    const list = document.querySelector(`.card-list[data-status="${status}"]`);
    list.innerHTML = '';
    state[status].forEach((card) => list.appendChild(createCardElement(card)));
    document.querySelector(`[data-count-for="${status}"]`).textContent = String(state[status].length);
  }
}

function setupAddCardForms() {
  document.querySelectorAll('.add-card-form').forEach((form) => {
    const input = form.querySelector('input');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addCard(form.dataset.status, text);
      input.value = '';
      input.focus();
    });
  });
}

function setupDropTargets() {
  document.querySelectorAll('.card-list').forEach((list) => {
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      list.classList.add('drag-over');
    });
    list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      list.classList.remove('drag-over');
      moveCard(e.dataTransfer.getData('text/plain'), list.dataset.status);
    });
  });
}

// ─── Auth UI ──────────────────────────────────────────
const authOverlay   = document.getElementById('auth-overlay');
const authCardTitle = document.getElementById('auth-card-title');
const authForm      = document.getElementById('auth-form');
const authEmail     = document.getElementById('auth-email');
const authPassword  = document.getElementById('auth-password');
const authError     = document.getElementById('auth-error');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleText = document.getElementById('auth-toggle-text');
const authToggleLink = document.getElementById('auth-toggle-link');
const userBar       = document.getElementById('user-bar');
const userEmailLabel = document.getElementById('user-email-label');
const logoutBtn     = document.getElementById('logout-btn');

function showAuthError(msg) {
  authError.textContent = msg;
  authError.hidden = false;
}

function clearAuthError() {
  authError.hidden = true;
  authError.textContent = '';
}

function setAuthMode(mode) {
  authMode = mode;
  if (mode === 'signup') {
    authCardTitle.textContent = '회원가입';
    authSubmitBtn.textContent = '가입하기';
    authToggleText.textContent = '이미 계정이 있으신가요?';
    authToggleLink.textContent = '로그인';
    authPassword.autocomplete = 'new-password';
  } else {
    authCardTitle.textContent = '로그인';
    authSubmitBtn.textContent = '로그인';
    authToggleText.textContent = '계정이 없으신가요?';
    authToggleLink.textContent = '가입하기';
    authPassword.autocomplete = 'current-password';
  }
  clearAuthError();
}

function showBoard(user) {
  authOverlay.hidden = true;
  userBar.hidden = false;
  userEmailLabel.textContent = user.email ?? user.user_metadata?.full_name ?? '사용자';
}

function showAuth() {
  authOverlay.hidden = false;
  userBar.hidden = true;
}

// ─── Auth Logic ───────────────────────────────────────
async function signUp(email, password) {
  authSubmitBtn.disabled = true;
  const { error } = await db.auth.signUp({ email, password });
  authSubmitBtn.disabled = false;
  if (error) { showAuthError(error.message); return; }
  showAuthError('✅ 가입 확인 이메일을 보냈어요. 메일함을 확인해주세요!');
}

async function signIn(email, password) {
  authSubmitBtn.disabled = true;
  const { error } = await db.auth.signInWithPassword({ email, password });
  authSubmitBtn.disabled = false;
  if (error) showAuthError(error.message);
}

async function signInWithOAuth(provider) {
  const { error } = await db.auth.signInWithOAuth({
    provider,
    options: { redirectTo: 'https://tlswldnjs716.github.io/kanban' },
  });
  if (error) showAuthError(error.message);
}

// ─── Auth Event Bindings ──────────────────────────────
authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  clearAuthError();
  const email    = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) { showAuthError('이메일과 비밀번호를 입력해주세요.'); return; }
  if (authMode === 'signup') signUp(email, password);
  else signIn(email, password);
});

authToggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
});

document.getElementById('github-btn').addEventListener('click', () => signInWithOAuth('github'));
document.getElementById('google-btn').addEventListener('click', () => signInWithOAuth('google'));

logoutBtn.addEventListener('click', async () => {
  await db.auth.signOut();
});

// ─── Auth State Listener ──────────────────────────────
db.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    loadCards();
    loadLogs();
    subscribeToCards();
    showBoard(currentUser);
  } else {
    unsubscribeFromCards();
    state = { todo: [], inprogress: [], done: [] };
    renderBoard();
    document.getElementById('log-panel').hidden = true;
    showAuth();
  }
});

// ─── Init ─────────────────────────────────────────────
setupAddCardForms();
setupDropTargets();

document.getElementById('log-toggle-btn').addEventListener('click', () => {
  const panel = document.getElementById('log-panel');
  const btn   = document.getElementById('log-toggle-btn');
  const collapsed = panel.classList.toggle('collapsed');
  btn.textContent = collapsed ? '펼치기 ▼' : '접기 ▲';
});
