const STORAGE_KEY = 'kanban-board-state';
const STATUSES = ['todo', 'inprogress', 'done'];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { todo: [], inprogress: [], done: [] };
    const parsed = JSON.parse(raw);
    return {
      todo: Array.isArray(parsed.todo) ? parsed.todo : [],
      inprogress: Array.isArray(parsed.inprogress) ? parsed.inprogress : [],
      done: Array.isArray(parsed.done) ? parsed.done : [],
    };
  } catch (err) {
    console.warn('Failed to load kanban state, starting empty.', err);
    return { todo: [], inprogress: [], done: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

function findCardLocation(cardId) {
  for (const status of STATUSES) {
    const index = state[status].findIndex((card) => card.id === cardId);
    if (index !== -1) return { status, index };
  }
  return null;
}

function addCard(status, text) {
  state[status].push({ id: crypto.randomUUID(), text });
  saveState(state);
  renderBoard();
}

function removeCard(cardId) {
  const location = findCardLocation(cardId);
  if (!location) return;
  state[location.status].splice(location.index, 1);
  saveState(state);
  renderBoard();
}

function moveCard(cardId, targetStatus) {
  const location = findCardLocation(cardId);
  if (!location || location.status === targetStatus) return;
  const [card] = state[location.status].splice(location.index, 1);
  state[targetStatus].push(card);
  saveState(state);
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
  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
  });
  deleteBtn.addEventListener('click', () => removeCard(card.id));

  return li;
}

function renderBoard() {
  for (const status of STATUSES) {
    const list = document.querySelector(`.card-list[data-status="${status}"]`);
    list.innerHTML = '';
    for (const card of state[status]) {
      list.appendChild(createCardElement(card));
    }

    const countBadge = document.querySelector(`[data-count-for="${status}"]`);
    countBadge.textContent = String(state[status].length);
  }
}

function setupAddCardForms() {
  document.querySelectorAll('.add-card-form').forEach((form) => {
    const status = form.dataset.status;
    const input = form.querySelector('input');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addCard(status, text);
      input.value = '';
      input.focus();
    });
  });
}

function setupDropTargets() {
  document.querySelectorAll('.card-list').forEach((list) => {
    const status = list.dataset.status;

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      list.classList.add('drag-over');
    });

    list.addEventListener('dragleave', () => {
      list.classList.remove('drag-over');
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      list.classList.remove('drag-over');
      const cardId = e.dataTransfer.getData('text/plain');
      moveCard(cardId, status);
    });
  });
}

setupAddCardForms();
setupDropTargets();
renderBoard();
