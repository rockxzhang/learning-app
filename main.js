// main.js - Electron 主进程 for 张老师随身讲
const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const services = require('./services/index');

// 崩溃兜底：捕获未处理异常/拒绝，记录原因，避免整个应用“直接结束”
process.on('uncaughtException', (e) => { console.error('[main] uncaughtException:', e && (e.stack || e.message) || e); });
process.on('unhandledRejection', (e) => { console.error('[main] unhandledRejection:', e && (e.stack || e.message) || e); });

let win;
let overlayWin = null;
function createWindow() {
  const wa = screen.getPrimaryDisplay().workAreaSize;   // 铺满工作区 = 默认最大化
  win = new BrowserWindow({
    width: wa.width, height: wa.height,
    resizable: false,                 // 固定窗口，不可拖动缩放/缩小
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.once('ready-to-show', () => { try { win.maximize(); } catch (e) {} win.show(); });
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
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);   // 隐藏 File/Edit/View/Window/Help 默认菜单
  createWindow();
});
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

// 自定义老师头像：用户把 teacher.png/jpg 放到应用数据目录或 exe 旁边即可替换数字人
ipcMain.handle('avatar:getImage', () => {
  const exeDir = (() => { try { return path.dirname(app.getPath('exe')); } catch (e) { return __dirname; } })();
  const cands = [
    path.join(__dirname, 'build', 'teacher.png'), path.join(__dirname, 'build', 'teacher.jpg'),
    path.join(DATA_DIR, 'teacher.png'), path.join(DATA_DIR, 'teacher.jpg'),
    path.join(app.getPath('userData'), 'teacher.png'),
    path.join(exeDir, 'teacher.png'), path.join(exeDir, 'teacher.jpg'),
  ];
  for (const p of cands) {
    try { if (fs.existsSync(p)) { const ext = path.extname(p).slice(1).toLowerCase(); return 'data:image/' + ext + ';base64,' + fs.readFileSync(p).toString('base64'); } } catch (e) {}
  }
  return null;
});

// 保存文件（下载代码/讲解）
ipcMain.handle('file:save', async (e, defaultName, content, filterName, ext) => {
  const r = await dialog.showSaveDialog(win, {
    title: '保存 ' + defaultName,
    defaultPath: defaultName,
    filters: [{ name: filterName, extensions: [ext] }],
  });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  try { fs.writeFileSync(r.filePath, content, 'utf8'); return { ok: true, filePath: r.filePath }; }
  catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
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

// 界面显示的实际软件版本 = 构建版本（打包时写入 build/appver.json）；否则回退到基础版本
ipcMain.handle('version:current', () => {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'build', 'appver.json'), 'utf8')).ver;
    if (v) return v;
  } catch (e) {}
  return services.config.load(DATA_DIR).baseVersion;
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
