const { ipcRenderer } = require('electron');

const historyListEl = document.getElementById('history-list');
const emptyStateEl = document.getElementById('empty-state');
const clearBtn = document.getElementById('clear-btn');
const popupContainer = document.querySelector('.popup-container');
function renderHistory(history) {
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
    
    // アイテムをクリックしたらメインプロセスに送信して自動ペースト
    item.addEventListener('click', () => {
      // 選択した時もフワッと消えるアニメーションを実行
      popupContainer.classList.remove('show-anim');
      popupContainer.classList.add('hide-anim');
      
      setTimeout(() => {
        ipcRenderer.send('paste-item', text);
      }, 100);
    });
    
    historyListEl.appendChild(item);
  });
}

// メインプロセスから履歴の更新を受け取る
ipcRenderer.on('history-updated', (event, history) => {
  renderHistory(history);
});

// 起動時に最新の履歴を取得
ipcRenderer.invoke('get-history').then((history) => {
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
    ipcRenderer.send('clear-history');
    
    isEditMode = false;
    editBtn.textContent = 'Edit';
    clearBtn.classList.add('hidden');
    clearBtn.textContent = 'Delete All';
    clearTimeout(clearConfirmTimeout);
  }
});


// 背景クリックで閉じる（透明なフルスクリーン領域）
document.body.addEventListener('click', (e) => {
  if (e.target === document.body) {
    popupContainer.classList.remove('show-anim');
    popupContainer.classList.add('hide-anim');
    setTimeout(() => {
      ipcRenderer.send('hide-history-window');
    }, 150);
  }
});

// アニメーション関連の処理
ipcRenderer.on('window-shown', (event, pos) => {
  const width = 300;
  const height = 400;
  const screenW = document.body.clientWidth;
  const screenH = document.body.clientHeight;
  
  let x = pos.x;
  let y = pos.y;
  
  // 画面外にはみ出ないように調整
  if (x + width > screenW) x = screenW - width - 10;
  if (y + height > screenH) y = screenH - height - 10;
  
  popupContainer.style.left = `${x}px`;
  popupContainer.style.top = `${y}px`;

  popupContainer.classList.remove('hide-anim');
  void popupContainer.offsetWidth;
  popupContainer.classList.add('show-anim');
  
  // 表示されるたびに編集モードをリセットする
  isEditMode = false;
  editBtn.textContent = 'Edit';
  clearBtn.classList.add('hidden');
  clearBtn.textContent = 'Delete All';
});

ipcRenderer.on('trigger-hide', () => {
  popupContainer.classList.remove('show-anim');
  popupContainer.classList.add('hide-anim');
  setTimeout(() => {
    ipcRenderer.send('hide-history-window');
  }, 150);
});
