const editor = document.getElementById('editor');
const charCount = document.getElementById('char-count');
const saveStatus = document.getElementById('save-status');
const copyBtn = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');
const undoBtn = document.getElementById('undo-btn');

const pinBtn = document.getElementById('pin-btn');


const STORAGE_KEY = 'quickdrop_content';
let saveTimeout;
let deletedContent = ''; 
let isPinned = false;

function init() {
  const savedContent = localStorage.getItem(STORAGE_KEY);
  if (savedContent) {
    editor.value = savedContent;
    updateCounts();
  }
  editor.focus();
}

pinBtn.addEventListener('click', () => {
  isPinned = !isPinned;
  if (isPinned) {
    pinBtn.classList.add('active');
  } else {
    pinBtn.classList.remove('active');
  }
  window.electronAPI.toggleAlwaysOnTop(isPinned);
});


function updateCounts() {
  const text = editor.value;
  const totalChars = text.replace(/\n/g, '').length;
  const selStart = editor.selectionStart;
  const selEnd = editor.selectionEnd;
  
  if (selStart !== selEnd) {
    // 選択中：選択文字数 / 全体
    const selectedChars = text.slice(selStart, selEnd).replace(/\n/g, '').length;
    charCount.textContent = `${selectedChars} / ${totalChars}`;
  } else {
    charCount.textContent = totalChars;
  }
}

// 選択状態が変わったときもカウントを更新
editor.addEventListener('select', updateCounts);
editor.addEventListener('mouseup', updateCounts);
editor.addEventListener('keyup', updateCounts);

function showSaveStatus(message = 'Saved') {
  saveStatus.textContent = message;
  saveStatus.classList.add('show');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveStatus.classList.remove('show');
  }, 2000);
}

editor.addEventListener('input', () => {
  updateCounts();
  localStorage.setItem(STORAGE_KEY, editor.value);
  showSaveStatus();
  
  if (editor.value.length > 0 && deletedContent !== '') {
    deletedContent = '';
    undoBtn.classList.add('hidden');
  }
});

copyBtn.addEventListener('click', async () => {
  const text = editor.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg> Copied';
    setTimeout(() => { copyBtn.innerHTML = originalText; }, 2000);
  } catch (err) {
    console.error(err);
  }
});

clearBtn.addEventListener('click', () => {
  if (editor.value === '') return;
  deletedContent = editor.value;
  editor.value = '';
  localStorage.setItem(STORAGE_KEY, '');
  updateCounts();
  showSaveStatus('Cleared');
  undoBtn.classList.remove('hidden');
  editor.focus();
});

undoBtn.addEventListener('click', () => {
  if (deletedContent === '') return;
  editor.value = deletedContent;
  localStorage.setItem(STORAGE_KEY, editor.value);
  updateCounts();
  showSaveStatus('Restored');
  deletedContent = '';
  undoBtn.classList.add('hidden');
  editor.focus();
});

document.addEventListener('DOMContentLoaded', init);

// --- Settings (Flip UI) ---
const flipContainer = document.getElementById('flip-container');
const settingsBtn = document.getElementById('settings-btn');
const backBtn = document.getElementById('back-btn');

const settingStartup = document.getElementById('setting-startup');
const settingShortcut = document.getElementById('setting-shortcut');
const settingHistoryLimit = document.getElementById('setting-history-limit');

// 起動時に設定を読み込む
window.electronAPI.getSettings().then(settings => {
  if (settings) {
    settingStartup.checked = settings.openAtLogin;
    settingShortcut.value = settings.shortcutMain || 'Alt+Space';
    settingHistoryLimit.value = settings.historyLimit || '50';
  }
});

function toggleSettings() {
  flipContainer.classList.toggle('flipped');
}

settingsBtn.addEventListener('click', toggleSettings);

backBtn.addEventListener('click', () => {
  // 設定を保存して裏返す
  const newSettings = {
    openAtLogin: settingStartup.checked,
    shortcutMain: settingShortcut.value,
    historyLimit: parseInt(settingHistoryLimit.value, 10)
  };
  
  window.electronAPI.saveSettings(newSettings);
  toggleSettings();
});
