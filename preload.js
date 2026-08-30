// preload.js - 安全暴露 IPC 给渲染层
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  cfgLoad: () => ipcRenderer.invoke('cfg:load'),
  cfgSave: (cfg) => ipcRenderer.invoke('cfg:save', cfg),
  pickFile: () => ipcRenderer.invoke('file:pick'),
  saveFile: (defaultName, content, filterName, ext) => ipcRenderer.invoke('file:save', defaultName, content, filterName, ext),
  startShot: () => ipcRenderer.invoke('shot:start'),
  runTeach: (cfg, filePath) => ipcRenderer.invoke('teach:run', cfg, filePath),
  memoryProfile: () => ipcRenderer.invoke('memory:profile'),
  markWeak: (title, weakPoints) => ipcRenderer.invoke('memory:weak', title, weakPoints),
  versionCurrent: () => ipcRenderer.invoke('version:current'),
  onLog: (cb) => ipcRenderer.on('teach:log', (e, m) => cb(m)),
  onProgress: (cb) => ipcRenderer.on('teach:progress', (e, p) => cb(p)),
});
