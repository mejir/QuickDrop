const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;
let historyWindow;
let tray = null;
let clipboardInterval;
let clipboardHistory = [];
let lastClipboardText = '';

const boundsFilePath = path.join(app.getPath('userData'), 'window-bounds.json');

// 多重起動の防止（2つ目以降は既存のインスタンスにフォーカスを移して終了）
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 履歴の永続化と設定
const historyFilePath = path.join(app.getPath('userData'), 'clipboard-history.json');
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');

let appSettings = {
  openAtLogin: false,
  shortcutMain: 'Alt+Space',
  historyLimit: 50
};

try {
  if (fs.existsSync(historyFilePath)) {
    clipboardHistory = JSON.parse(fs.readFileSync(historyFilePath, 'utf-8'));
  }
} catch (e) {
  console.error(e);
}

function loadSettings() {
  try {
    if (fs.existsSync(settingsFilePath)) {
      appSettings = { ...appSettings, ...JSON.parse(fs.readFileSync(settingsFilePath, 'utf-8')) };
    }
  } catch(e) {
    console.error(e);
  }
  
  // 自動起動の反映（Mac/Windows対応）
  app.setLoginItemSettings({
    openAtLogin: appSettings.openAtLogin,
    path: app.getPath('exe')
  });
}

function saveCurrentSettings(newSettings) {
  const oldShortcut = appSettings.shortcutMain;
  appSettings = { ...appSettings, ...newSettings };
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(appSettings));
  } catch(e) {}
  
  // 自動起動の再反映
  app.setLoginItemSettings({
    openAtLogin: appSettings.openAtLogin,
    path: app.getPath('exe')
  });
  
  // ショートカットが変更された場合は再登録
  if (oldShortcut !== appSettings.shortcutMain) {
    globalShortcut.unregister(oldShortcut);
    registerMainShortcut();
  }
}

function saveHistory() {
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(clipboardHistory));
  } catch (e) {
    console.error(e);
  }
}

// ウィンドウ状態管理
function loadBounds() {
  try {
    if (fs.existsSync(boundsFilePath)) {
      return JSON.parse(fs.readFileSync(boundsFilePath, 'utf-8'));
    }
  } catch (e) {}
  return { width: 600, height: 600 };
}
function saveBounds(bounds) {
  try {
    fs.writeFileSync(boundsFilePath, JSON.stringify(bounds));
  } catch (e) {}
}

function createMainWindow() {
  const bounds = loadBounds();
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 400,
    minHeight: 300,
    frame: false,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('close', () => {
    saveBounds(mainWindow.getBounds());
  });
}

function createHistoryWindow() {
  historyWindow = new BrowserWindow({
    width: 300,
    height: 400,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  historyWindow.loadFile('popup.html');
}

// クリップボード監視
function startClipboardMonitor() {
  lastClipboardText = clipboard.readText();
  
  clipboardInterval = setInterval(() => {
    const currentText = clipboard.readText();
    if (currentText && currentText.trim() !== '' && currentText !== lastClipboardText) {
      if (clipboardHistory.length > 0 && clipboardHistory[0] === currentText) return;
      
      lastClipboardText = currentText;
      clipboardHistory.unshift(currentText);
      // 設定された上限件数を超えたら古いものを削除
      if (clipboardHistory.length > appSettings.historyLimit) {
        clipboardHistory.pop();
      }
      saveHistory();
      
      if (historyWindow && !historyWindow.isDestroyed() && historyWindow.isVisible()) {
        historyWindow.webContents.send('history-updated', clipboardHistory);
      }
    }
  }, 1000);
}

// メイン画面（メモ帳）の呼び出しショートカット登録
function registerMainShortcut() {
  if (!appSettings.shortcutMain) return;
  
  try {
    globalShortcut.register(appSettings.shortcutMain, () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
          globalShortcut.unregister('Escape');
        } else {
          mainWindow.show();
          mainWindow.focus();
          globalShortcut.register('Escape', () => {
            if (mainWindow.isVisible()) mainWindow.hide();
            if (historyWindow.isVisible()) historyWindow.webContents.send('trigger-hide');
            globalShortcut.unregister('Escape');
          });
        }
      }
    });
  } catch(e) {
    console.error("Failed to register shortcut:", e);
  }
}

app.whenReady().then(() => {
  loadSettings();
  createMainWindow();
  createHistoryWindow();
  startClipboardMonitor();

  registerMainShortcut();

  // タスクトレイの作成
  const iconPath = path.join(__dirname, 'icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('QuickDrop');
  
  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Show Notepad',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(trayMenu);
  
  // トレイアイコンをダブルクリックでメモ帳を表示
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Ctrl+Shift+V で履歴ポップアップを表示
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (historyWindow) {
      if (historyWindow.isVisible()) {
        historyWindow.webContents.send('trigger-hide');
      } else {
        const cursorPoint = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(cursorPoint);
        
        historyWindow.setBounds(display.bounds);
        historyWindow.showInactive();
        
        historyWindow.webContents.send('window-shown', {
          x: cursorPoint.x - display.bounds.x,
          y: cursorPoint.y - display.bounds.y
        });
        
        globalShortcut.register('Escape', () => {
          if (historyWindow.isVisible()) historyWindow.webContents.send('trigger-hide');
          if (mainWindow.isVisible()) mainWindow.hide();
          globalShortcut.unregister('Escape');
        });
        
        historyWindow.webContents.send('history-updated', clipboardHistory);
      }
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// ウィンドウが全部閉じてもアプリは終了しない（常駐アプリ）
app.on('window-all-closed', function () {
  // 何もしない（トレイに常駐し続ける）
});

app.on('will-quit', () => {
  clearInterval(clipboardInterval);
  globalShortcut.unregisterAll();
  if (tray) tray.destroy();
});

// IPCイベントハンドラ
ipcMain.on('toggle-always-on-top', (event, isAlwaysOnTop) => {
  if (mainWindow) mainWindow.setAlwaysOnTop(isAlwaysOnTop);
});

// アニメーション完了後に呼ばれる非表示処理
ipcMain.on('hide-history-window', () => {
  if (historyWindow) {
    historyWindow.hide();
    globalShortcut.unregister('Escape');
  }
});

// ポップアップからのペースト指示
ipcMain.on('paste-item', (event, text) => {
  if (historyWindow) {
    historyWindow.hide();
    globalShortcut.unregister('Escape');
  }
  
  clipboard.writeText(text);
  lastClipboardText = text;
  
  setTimeout(() => {
    const script = `powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v'); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wshell) | Out-Null"`;
    exec(script, (err) => {
      if (err) console.error('Auto paste failed:', err);
    });
  }, 100); 
});

// ポップアップ起動時の履歴取得
ipcMain.handle('get-history', () => {
  return clipboardHistory;
});

// 履歴のクリア
ipcMain.on('clear-history', () => {
  clipboardHistory = [];
  saveHistory();
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.webContents.send('history-updated', clipboardHistory);
  }
});

// 設定の取得と保存
ipcMain.handle('get-settings', () => {
  return appSettings;
});

ipcMain.on('save-settings', (event, newSettings) => {
  saveCurrentSettings(newSettings);
});
