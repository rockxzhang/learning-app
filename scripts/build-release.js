// scripts/build-release.js - 打包 V1.0.N + 差异更新包 + 更新公告
const { execSync } = require('child_process');
const crypto = require('crypto');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const verFile = path.join(ROOT, 'release', 'version.json');

// ---- 版本号：支持 --version=V1.0.N 固定(不递增)，否则读 version.json 且 +1 ----
let v;
const vi = process.argv.findIndex((a) => a.startsWith('--version='));
if (vi >= 0) { v = process.argv[vi].split('=')[1]; }
else if (process.env.VERSION) { v = process.env.VERSION; }
else {
  let ver = 1000; try { ver = JSON.parse(fs.readFileSync(verFile, 'utf8')).current; } catch (e) {}
  v = 'V1.0.' + ver;
  fs.writeFileSync(verFile, JSON.stringify({ current: ver + 1 }, null, 2), 'utf8');
}
const outDir = path.join(ROOT, 'release', v);
fs.mkdirSync(outDir, { recursive: true });
console.log('发布版本号：' + v);

// ---- 本次更新内容（公告）----
function readChangelog() {
  const f = path.join(ROOT, 'release', 'changelog.txt');
  try { if (fs.existsSync(f)) { const c = fs.readFileSync(f, 'utf8').trim(); if (c) return c; } } catch (e) {}
  const i = process.argv.indexOf('--changelog');
  if (i >= 0) return String(process.argv[i + 1] || '').trim();
  return String(process.env.CHANGELOG || '').trim();
}
async function promptChangelog() {
  const i = process.argv.indexOf('--changelog');
  if (i >= 0) return String(process.argv[i + 1] || '').trim();
  if (process.env.CHANGELOG) return String(process.env.CHANGELOG).trim();
  const fileHint = readChangelog();   // 已有文件内容作为默认提示
  if (!process.stdin.isTTY) return fileHint || '（无更新说明）';   // CI/非交互
  // 交互：总是询问，并给出默认(上次文件)便于确认
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return await new Promise((res) => {
    rl.question('请输入本次更新内容(客户端更新公告)' + (fileHint ? '（默认:' + fileHint + '，回车用默认）' : '：'), (ans) => {
      rl.close();
      const a = String(ans || '').trim();
      res(a || fileHint || '（无更新说明）');
    });
  });
}

// 写入界面显示版本
fs.writeFileSync(path.join(ROOT, 'build', 'appver.json'), JSON.stringify({ ver: Number(v.split('.')[2]) }, null, 2), 'utf8');

// ---- electron-builder ----
execSync('npx electron-builder --win nsis --publish never --config.directories.output=' + outDir.replace(/\\/g, '/'), {
  cwd: ROOT, stdio: 'inherit',
  env: Object.assign({}, process.env, {
    APP_VERSION: v,
    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR: process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://npmmirror.com/mirrors/electron-builder-binaries/',
  }),
});
console.log('完成。产物目录：' + outDir);

// ---- 差异更新包：始终包含 resources/app.asar；其余与上一版对比，无上一版则整包 ----
function walk(dir) { const out = []; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) out.push(...walk(p)); else out.push(p); } return out; }
function hashFile(f) { return crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'); }
function buildUpdatePatch(curUp, prevUp, patchZip) {
  const stage = path.join(outDir, '_patchstage');
  fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(stage, { recursive: true });
  const changed = new Set();
  const asarDir = 'resources' + path.sep + 'app.asar';
  // 关键：始终包含 app.asar（app 代码，每次都会变）
  if (fs.existsSync(path.join(curUp, asarDir))) changed.add(asarDir);
  if (fs.existsSync(prevUp)) {
    for (const curFile of walk(curUp)) {
      const rel = path.relative(curUp, curFile);
      if (rel === asarDir) continue;                     // 已加入
      const prevFile = path.join(prevUp, rel);
      if (!fs.existsSync(prevFile) || hashFile(curFile) !== hashFile(prevFile)) changed.add(rel);
    }
  } else {
    for (const curFile of walk(curUp)) { const rel = path.relative(curUp, curFile); if (rel !== asarDir) changed.add(rel); }   // 无上一版：整包
  }
  console.log('更新包文件数：' + changed.size + '（含 app.asar=' + changed.has(asarDir) + '）');
  if (!changed.size) { console.warn('无变更文件，未生成差异包'); return; }
  for (const rel of changed) {
    const dst = path.join(stage, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(curUp, rel), dst);
  }
  execSync('powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path \'' + stage.replace(/\\/g, '/') + '/*\' -DestinationPath \'' + patchZip.replace(/\\/g, '/') + '\' -Force"', { cwd: ROOT, stdio: 'inherit' });
  console.log('差异更新包已生成：' + patchZip);
}

// ---- 更新 manifest（含差异包信息）----
async function main() {
  const changelog = await promptChangelog();
  const installer = path.join(outDir, '张老师随身讲-' + v + '.exe');
  const curUp = path.join(outDir, 'win-unpacked');
  const prevVerNum = Number(v.split('.')[2]);
  const prevUp = path.join(ROOT, 'release', 'V1.0.' + (prevVerNum - 1), 'win-unpacked');
  const patchZip = path.join(outDir, 'update-patch.zip');
  // 先生成差异包(需在 darwin 前, 读取 win-unpacked)
  let patchMb = 0;
  try { buildUpdatePatch(curUp, prevUp, patchZip); if (fs.existsSync(patchZip)) patchMb = Math.round((fs.statSync(patchZip).size / 1048576) * 100) / 100; } catch (e) { console.warn('差异包失败：' + (e && e.message)); }

  const sizeMb = fs.existsSync(installer) ? Math.round((fs.statSync(installer).size / 1048576) * 100) / 100 : 0;
  const manifest = { latest: v, changelog, downloadUrl: '', sizeMb, patchUrl: '', patchSizeMb: patchMb };
  fs.writeFileSync(path.join(ROOT, 'release', 'update-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('已写入更新 manifest：版本=' + v + ' 更新内容="' + changelog + '" 差异包=' + patchMb + 'MB');

  // 说明书
  try { execSync('python make_manual.py', { cwd: ROOT, stdio: 'inherit', env: Object.assign({}, process.env, { MANUAL_OUT: path.join(outDir, '张老师随身讲-使用说明书.pdf') }) }); } catch (e) { console.warn('说明书生成失败：' + (e && e.message)); }

  // 免安装 zip
  try {
    const up = curUp.replace(/\\/g, '/');
    const zp = path.join(outDir, '张老师随身讲-免安装.zip').replace(/\\/g, '/');
    execSync('powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path \'' + up + '/*\' -DestinationPath \'' + zp + '\' -Force"', { cwd: ROOT, stdio: 'inherit' });
    console.log('免安装 zip 已生成：' + zp);
  } catch (e) { console.warn('免安装 zip 失败：' + (e && e.message)); }
}
main();
