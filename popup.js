const historyListEl = document.getElementById('history-list');
const emptyStateEl = document.getElementById('empty-state');
const clearBtn = document.getElementById('clear-btn');
const popupContainer = document.querySelector('.popup-container');

let focusedIndex = -1;

function getItems() {
  return Array.from(historyListEl.querySelectorAll('.history-item'));
}

function setFocus(index) {
  const items = getItems();
  if (!items.length) return;
  items.forEach(el => el.classList.remove('keyboard-focus'));
  focusedIndex = Math.max(0, Math.min(index, items.length - 1));
  items[focusedIndex].classList.add('keyboard-focus');
  items[focusedIndex].scrollIntoView({ block: 'nearest' });
}

function renderHistory(history) {
  focusedIndex = -1;
  historyListEl.innerHTML = '';

  if (!history || history.length === 0) {
    emptyStateEl.classList.remove('hidden');
    return;
  }

  emptyStateEl.classList.add('hidden');

  history.forEach(text => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.textContent = text;

    item.addEventListener('click', () => {
      popupContainer.classList.remove('show-anim');
      popupContainer.classList.add('hide-anim');

      setTimeout(() => {
        window.popupAPI.pasteItem(text);
      }, 100);
    });

    historyListEl.appendChild(item);
  });
}

window.popupAPI.on('history-updated', (history) => {
  renderHistory(history);
});

window.popupAPI.getHistory().then((history) => {
  renderHistory(history);
});

const editBtn = document.getElementById('edit-btn');
let isEditMode = false;
let clearConfirmTimeout;

editBtn.addEventListener('click', () => {
  isEditMode = !isEditMode;
  if (isEditMode) {
    editBtn.textContent = 'Done';
    clearBtn.classList.remove('hidden');
  } else {
    editBtn.textContent = 'Edit';
    clearBtn.classList.add('hidden');
    clearBtn.textContent = 'Delete All';
  }
});

clearBtn.addEventListener('click', () => {
  if (clearBtn.textContent === 'Delete All') {
    clearBtn.textContent = 'Confirm Delete';

    clearTimeout(clearConfirmTimeout);
    clearConfirmTimeout = setTimeout(() => {
      clearBtn.textContent = 'Delete All';
    }, 3000);
  } else {
    window.popupAPI.clearHistory();

    isEditMode = false;
    editBtn.textContent = 'Edit';
    clearBtn.classList.add('hidden');
    clearBtn.textContent = 'Delete All';
    clearTimeout(clearConfirmTimeout);
  }
});

document.body.addEventListener('click', (e) => {
  if (e.target === document.body) {
    popupContainer.classList.remove('show-anim');
    popupContainer.classList.add('hide-anim');
    setTimeout(() => {
      window.popupAPI.hideHistoryWindow();
    }, 150);
  }
});

window.popupAPI.on('window-shown', (pos) => {
  const width = 300;
  const height = 400;
  const screenW = document.body.clientWidth;
  const screenH = document.body.clientHeight;

  let x = pos.x;
  let y = pos.y;

  if (x + width > screenW) x = screenW - width - 10;
  if (y + height > screenH) y = screenH - height - 10;

  popupContainer.style.left = `${x}px`;
  popupContainer.style.top = `${y}px`;

  popupContainer.classList.remove('hide-anim');
  void popupContainer.offsetWidth;
  popupContainer.classList.add('show-anim');

  isEditMode = false;
  editBtn.textContent = 'Edit';
  clearBtn.classList.add('hidden');
  clearBtn.textContent = 'Delete All';
});

window.popupAPI.on('trigger-hide', () => {
  popupContainer.classList.remove('show-anim');
  popupContainer.classList.add('hide-anim');
  setTimeout(() => {
    window.popupAPI.hideHistoryWindow();
  }, 150);
});

document.addEventListener('keydown', (e) => {
  const items = getItems();
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setFocus(focusedIndex < 0 ? 0 : focusedIndex + 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setFocus(Math.max(0, focusedIndex - 1));
  } else if (e.key === 'Enter' && focusedIndex >= 0) {
    e.preventDefault();
    items[focusedIndex]?.click();
  }
});
