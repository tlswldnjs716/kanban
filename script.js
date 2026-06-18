// ─── Supabase ─────────────────────────────────────────
const SUPABASE_URL = 'https://ggpjhrfeujjsloelerax.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncGpocmZldWpqc2xvZWxlcmF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Njg2MTgsImV4cCI6MjA5NzI0NDYxOH0.2RfIIvMqLnlywBq1otepXRRFI5U91pAJVKnYS3YI9uE';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── State ────────────────────────────────────────────
const STATUSES = ['todo', 'inprogress', 'done'];
let currentUser = null;
let storageKey = 'kanban-board-state';
let state = { todo: [], inprogress: [], done: [] };
let authMode = 'signin';

// ─── Storage ──────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { todo: [], inprogress: [], done: [] };
    const parsed = JSON.parse(raw);
    return {
      todo:       Array.isArray(parsed.todo)       ? parsed.todo       : [],
      inprogress: Array.isArray(parsed.inprogress) ? parsed.inprogress : [],
      done:       Array.isArray(parsed.done)       ? parsed.done       : [],
    };
  } catch {
    return { todo: [], inprogress: [], done: [] };
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

// ─── Kanban ───────────────────────────────────────────
function findCardLocation(cardId) {
  for (const status of STATUSES) {
    const index = state[status].findIndex((c) => c.id === cardId);
    if (index !== -1) return { status, index };
  }
  return null;
}

function addCard(status, text) {
  state[status].push({ id: crypto.randomUUID(), text });
  saveState();
  renderBoard();
}

function removeCard(cardId) {
  const loc = findCardLocation(cardId);
  if (!loc) return;
  state[loc.status].splice(loc.index, 1);
  saveState();
  renderBoard();
}

function moveCard(cardId, targetStatus) {
  const loc = findCardLocation(cardId);
  if (!loc || loc.status === targetStatus) return;
  const [card] = state[loc.status].splice(loc.index, 1);
  state[targetStatus].push(card);
  saveState();
  renderBoard();
}

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
    storageKey = `kanban-board-state-${currentUser.id}`;
    state = loadState();
    renderBoard();
    showBoard(currentUser);
  } else {
    state = { todo: [], inprogress: [], done: [] };
    renderBoard();
    showAuth();
  }
});

// ─── Init ─────────────────────────────────────────────
setupAddCardForms();
setupDropTargets();
