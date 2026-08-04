// 拾光 · Electron preload。这里只暴露固定 IPC，不读取环境变量或凭据。
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, input = {}) => ipcRenderer.invoke(channel, input);

contextBridge.exposeInMainWorld('shiguang', Object.freeze({
  platform: process.platform,
  isElectron: true,
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openWorkDisk: () => ipcRenderer.invoke('open-work-disk'),
  onUpdateAvailable: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
}));

contextBridge.exposeInMainWorld('shiguangGateway', Object.freeze({
  status: () => invoke('shiguang:gateway:status'),
  pullState: () => invoke('shiguang:gateway:pull-state'),
  pushState: (state) => invoke('shiguang:gateway:push-state', { state }),
}));

contextBridge.exposeInMainWorld('shiguangIntegrations', Object.freeze({
  status: () => invoke('shiguang:integrations:status'),
  configure: (kind, config) => invoke('shiguang:integrations:configure', { kind, config }),
  test: (kind) => invoke('shiguang:integrations:test', { kind }),
  startRuntime: () => invoke('shiguang:integrations:start-runtime'),
}));
