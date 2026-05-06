const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { sanitizeText, mergeSettings } = require('./src/utils');

let mainWindow;
let historyWindow;
let tray = null;
let clipboardInterval;
let clipboardHistory = [];
let lastClipboardText = '';

let boundsFilePath;
let historyFilePath;
let settingsFilePath;

let appSettings = {
  openAtLogin: false,
  shortcutMain: 'Alt+Space',
  historyLimit: 50
};

function loadSettings(app) {
  try {
    if (fs.existsSync(settingsFilePath)) {
      appSettings = mergeSettings(appSettings, JSON.parse(fs.readFileSync(settingsFilePath, 'utf-8')));
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  app.setLoginItemSettings({ openAtLogin: appSettings.openAtLogin, path: app.getPath('exe') });
}

function saveCurrentSettings(app, globalShortcut, newSettings, registerMainShortcut) {
  const oldShortcut = appSettings.shortcutMain;
  appSettings = mergeSettings(appSettings, newSettings);
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(appSettings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
  app.setLoginItemSettings({ openAtLogin: appSettings.openAtLogin, path: app.getPath('exe') });
  if (oldShortcut !== appSettings.shortcutMain) {
    globalShortcut.unregister(oldShortcut);
    registerMainShortcut();
  }
}

function saveHistory() {
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(clipboardHistory));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}
const saveHistoryDebounced = debounce(saveHistory, 300);

function loadBounds() {
  try {
    if (fs.existsSync(boundsFilePath)) return JSON.parse(fs.readFileSync(boundsFilePath, 'utf-8'));
  } catch (e) {}
  return { width: 600, height: 600 };
}

function saveBounds(bounds) {
  try { fs.writeFileSync(boundsFilePath, JSON.stringify(bounds)); } catch (e) {}
}

// Dynamic import to work around Electron 41 Windows require('electron') bug
import('electron').then(({ app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, Tray, Menu, nativeImage }) => {

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });

  function createMainWindow() {
    const bounds = loadBounds();
    mainWindow = new BrowserWindow({
      width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y,
      minWidth: 400, minHeight: 300,
      frame: false, show: false, transparent: true,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: false, contextIsolation: true, sandbox: false,
        preload: path.join(__dirname, 'preload-main.js')
      }
    });
    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);
    mainWindow.on('close', () => saveBounds(mainWindow.getBounds()));
  }

  function createHistoryWindow() {
    historyWindow = new BrowserWindow({
      width: 300, height: 400,
      frame: false, show: false, alwaysOnTop: true,
      skipTaskbar: true, focusable: true, hasShadow: false,
      transparent: true, backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: false, contextIsolation: true, sandbox: false,
        preload: path.join(__dirname, 'preload-popup.js')
      }
    });
    historyWindow.loadFile('popup.html');
  }

  function startClipboardMonitor() {
    lastClipboardText = clipboard.readText();
    clipboardInterval = setInterval(() => {
      const currentText = clipboard.readText();
      if (currentText && currentText.trim() !== '' && currentText !== lastClipboardText) {
        if (clipboardHistory.length > 0 && clipboardHistory[0] === currentText) return;
        lastClipboardText = currentText;
        clipboardHistory.unshift(currentText);
        if (clipboardHistory.length > appSettings.historyLimit) clipboardHistory.pop();
        saveHistoryDebounced();
        if (historyWindow && !historyWindow.isDestroyed() && historyWindow.isVisible()) {
          historyWindow.webContents.send('history-updated', clipboardHistory);
        }
      }
    }, 1000);
  }

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
              if (historyWindow && historyWindow.isVisible()) historyWindow.webContents.send('trigger-hide');
              globalShortcut.unregister('Escape');
            });
          }
        }
      });
    } catch (e) { console.error('Failed to register shortcut:', e); }
  }

  app.whenReady().then(() => {
    boundsFilePath = path.join(app.getPath('userData'), 'window-bounds.json');
    historyFilePath = path.join(app.getPath('userData'), 'clipboard-history.json');
    settingsFilePath = path.join(app.getPath('userData'), 'settings.json');

    try {
      if (fs.existsSync(historyFilePath)) {
        clipboardHistory = JSON.parse(fs.readFileSync(historyFilePath, 'utf-8'));
      }
    } catch (e) { console.error('Failed to load history:', e); }

    loadSettings(app);
    createMainWindow();
    createHistoryWindow();
    startClipboardMonitor();
    registerMainShortcut();

    const iconPath = path.join(__dirname, 'icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    tray.setToolTip('QuickDrop');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show Notepad', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]));
    tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });

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
            if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
            globalShortcut.unregister('Escape');
          });
          historyWindow.webContents.send('history-updated', clipboardHistory);
        }
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => { /* トレイに常駐し続ける */ });

  app.on('will-quit', () => {
    clearInterval(clipboardInterval);
    globalShortcut.unregisterAll();
    if (tray) tray.destroy();
  });

  // --- IPC ハンドラ ---

  ipcMain.on('toggle-always-on-top', (event, isAlwaysOnTop) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setAlwaysOnTop(!!isAlwaysOnTop);
    } catch (e) { console.error('toggle-always-on-top error:', e); }
  });

  ipcMain.on('hide-history-window', () => {
    try {
      if (historyWindow && !historyWindow.isDestroyed()) {
        historyWindow.hide();
        globalShortcut.unregister('Escape');
      }
    } catch (e) { console.error('hide-history-window error:', e); }
  });

  ipcMain.on('paste-item', (event, text) => {
    try {
      const safe = sanitizeText(text);
      if (!safe) return;
      if (historyWindow && !historyWindow.isDestroyed()) {
        historyWindow.hide();
        globalShortcut.unregister('Escape');
      }
      clipboard.writeText(safe);
      lastClipboardText = safe;
      setTimeout(() => {
        const script = `powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v'); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wshell) | Out-Null"`;
        exec(script, (err) => { if (err) console.error('Auto paste failed:', err); });
      }, 100);
    } catch (e) { console.error('paste-item error:', e); }
  });

  ipcMain.handle('get-history', () => {
    try { return clipboardHistory; }
    catch (e) { console.error('get-history error:', e); return []; }
  });

  ipcMain.on('clear-history', () => {
    try {
      clipboardHistory = [];
      saveHistory();
      if (historyWindow && !historyWindow.isDestroyed()) {
        historyWindow.webContents.send('history-updated', clipboardHistory);
      }
    } catch (e) { console.error('clear-history error:', e); }
  });

  ipcMain.handle('get-settings', () => {
    try { return appSettings; }
    catch (e) { console.error('get-settings error:', e); return {}; }
  });

  ipcMain.on('save-settings', (event, newSettings) => {
    try {
      if (newSettings && typeof newSettings === 'object') {
        saveCurrentSettings(app, globalShortcut, newSettings, registerMainShortcut);
      }
    } catch (e) { console.error('save-settings error:', e); }
  });

}).catch(err => {
  console.error('Failed to load electron module:', err);
  process.exit(1);
});
