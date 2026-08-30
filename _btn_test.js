// _btn_test.js - 验证按钮三态: 讲解中(禁) -> 讲解完毕(禁) -> 上传新题后开始讲解(可点)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const DATA_DIR = path.join(os.tmpdir(), 'bt'); fs.mkdirSync(DATA_DIR, { recursive: true });
ipcMain.handle('cfg:load', () => ({ baseVersion: 1000 }));
ipcMain.handle('cfg:save', () => true);
ipcMain.handle('version:current', () => 1000);
ipcMain.handle('memory:profile', () => ({ counts: 0, knowledgePoints: [], weakPoints: [] }));
ipcMain.handle('memory:weak', () => true);
ipcMain.handle('file:pick', () => 'C:/fake_problem.png');
const canned = {
  ok: true, version: 'V1.0.1000', title: 'A+B', fileName: 'fake_problem.png',
  code: 'int main(){int a,b;cin>>a>>b;cout<<a+b;return 0;}',
  solution: '# 思路\n直接相加。',
  teaching: [{ text: '很简单，直接加。', from: 1, to: 1 }],
  knowledgePoints: ['加法'],
  audio: [{ text: '很简单，直接加。', path: 'C:/fake.mp3', size: 0, boundaries: [] }],
};
ipcMain.handle('teach:run', () => new Promise((r) => setTimeout(() => r(canned), 1000)));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 980, height: 640, show: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win.webContents.on('console-message', (e, lvl, msg) => { if (lvl >= 3) console.log('[err]', msg); });
  await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  await new Promise((r) => setTimeout(r, 1000));
  const state = () => JSON.stringify(await win.webContents.executeJavaScript('(function(){var b=document.getElementById("runBtn");return {t:b.textContent.trim(), dis:b.disabled};})()'));
  console.log('initial:', state());
  await win.webContents.executeJavaScript('(function(){document.getElementById("pickBtn").click();})()');
  await new Promise((r) => setTimeout(r, 300));
  console.log('afterPick:', state());
  await win.webContents.executeJavaScript('(function(){document.getElementById("runBtn").click();})()');
  await new Promise((r) => setTimeout(r, 400));
  console.log('during:', state());
  await new Promise((r) => setTimeout(r, 1200));
  console.log('afterDone:', state());
  app.quit();
});
