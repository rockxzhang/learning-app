// main.js - Electron 主进程 for 数字人讲题
const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const services = require('./services/index');

let win;
let overlayWin = null;
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

// ---- 题目截图 ----
ipcMain.handle('shot:start', () => new Promise((resolve) => {
  let settled = false;
  const onCrop = (e, base64) => {
    try { const fp = services.screenshot.savePng(base64, DATA_DIR); finish({ ok: true, filePath: fp }); }
    catch (err) { finish({ ok: false, error: String((err && err.message) || err) }); }
  };
  const onCancel = () => finish({ ok: false, canceled: true });
  const cleanup = () => {
    ipcMain.removeListener('shot:crop', onCrop);
    ipcMain.removeListener('shot:cancel', onCancel);
  };
  const finish = (result) => {
    if (settled) return;
    settled = true;
    cleanup();
    if (overlayWin) { try { overlayWin.destroy(); } catch (e) {} overlayWin = null; }
    if (win) { win.show(); win.focus(); }
    resolve(result);
  };
  ipcMain.on('shot:crop', onCrop);
  ipcMain.on('shot:cancel', onCancel);

  win.hide();
  setTimeout(async () => {
    try {
      const img = await services.screenshot.capture();
      const dataUrl = img.toDataURL();
      const b = screen.getPrimaryDisplay().bounds;
      overlayWin = new BrowserWindow({
        width: b.width, height: b.height, x: b.x, y: b.y,
        frame: false, resizable: false, movable: false, skipTaskbar: true,
        alwaysOnTop: true, transparent: true, backgroundColor: '#000000', hasShadow: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false },
      });
      overlayWin.setAlwaysOnTop(true, 'screen-saver');
      overlayWin.on('closed', () => finish({ ok: false, canceled: true }));
      overlayWin.loadFile(path.join(__dirname, 'renderer', 'snipper.html'), {
        query: { data: encodeURIComponent(dataUrl), w: String(b.width), h: String(b.height) },
      });
    } catch (err) {
      finish({ ok: false, error: String((err && err.message) || err) });
    }
  }, 250);
}));
