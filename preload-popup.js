const { contextBridge, ipcRenderer } = require('electron');

const VALID_RECEIVE_CHANNELS = ['history-updated', 'window-shown', 'trigger-hide'];

contextBridge.exposeInMainWorld('popupAPI', {
  pasteItem: (text) => ipcRenderer.send('paste-item', text),
  hideHistoryWindow: () => ipcRenderer.send('hide-history-window'),
  clearHistory: () => ipcRenderer.send('clear-history'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  on: (channel, callback) => {
    if (!VALID_RECEIVE_CHANNELS.includes(channel)) return;
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
});
