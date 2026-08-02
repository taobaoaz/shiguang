// 拾光 · Electron preload
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shiguang', {
  platform: process.platform,
  isElectron: true,

  // 更新检查
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_event, data) => callback(data));
  },
});
