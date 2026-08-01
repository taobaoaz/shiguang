// WenXiBuddy · Electron preload
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('wenxibuddy', {
  platform: process.platform,
  isElectron: true,
});
