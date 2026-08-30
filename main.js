// main.js - Electron 主进程 for 数字人讲题
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const services = require('./services/index');

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 840, minWidth: 980, minHeight: 640,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  // 渲染层 console / 错误 透传到主进程 stdout（便于排查）
  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    console.log('[renderer] ' + message);
  });
  win.webContents.on('render-process-gone', (e, details) => {
    console.error('[renderer] process gone: ' + JSON.stringify(details));
  });
  win.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('[renderer] did-fail-load: ' + code + ' ' + desc);
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

const DATA_DIR = path.join(app.getPath('userData'), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---- IPC ----
ipcMain.handle('cfg:load', () => services.config.load(DATA_DIR));
ipcMain.handle('cfg:save', (e, cfg) => services.config.save(DATA_DIR, cfg));

ipcMain.handle('file:pick', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: '选择题目文件',
    properties: ['openFile'],
    filters: [{ name: '题目文件', extensions: ['png','jpg','jpeg','bmp','gif','webp','pdf','docx','doc','md','txt','html','htm'] }],
  });
  return r.canceled ? null : r.filePaths[0];
});

// 一次讲解：读取 -> 分析 -> 语音 -> 记忆
ipcMain.handle('teach:run', async (e, cfg, filePath) => {
  try {
    return await services.pipeline.run(DATA_DIR, cfg, filePath,
      (m) => win.webContents.send('teach:log', m),
      (p) => win.webContents.send('teach:progress', p));
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

// 学习档案
ipcMain.handle('memory:profile', () => services.memory.profile(DATA_DIR));
ipcMain.handle('memory:weak', (e, title, weakPoints) => services.memory.addWeak(DATA_DIR, title, weakPoints));

ipcMain.handle('version:current', () => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'version.json'), 'utf8')).current; }
  catch (e) { return services.config.load(DATA_DIR).baseVersion; }
});
