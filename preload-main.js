const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: (isPinned) => ipcRenderer.send('toggle-always-on-top', isPinned),
  saveSettings: (newSettings) => ipcRenderer.send('save-settings', newSettings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
});
