// scripts/build-release.js - 读取发布版号(+1)，生成 V1.0.N/数字人讲题-V1.0.N.exe
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const verFile = path.join(ROOT, 'release', 'version.json');
let ver = 1000;
try { ver = JSON.parse(fs.readFileSync(verFile, 'utf8')).current; } catch (e) {}
const v = 'V1.0.' + ver;
const outDir = path.join(ROOT, 'release', v);
fs.mkdirSync(outDir, { recursive: true });
console.log('发布版本号：' + v);

// 本次更新内容：优先读 release/changelog.txt(UTF-8)；其次 --changelog "XXX" 或环境变量 CHANGELOG
function readChangelog() {
  const f = path.join(ROOT, 'release', 'changelog.txt');
  try { if (fs.existsSync(f)) { const c = fs.readFileSync(f, 'utf8').trim(); if (c) return c; } } catch (e) {}
  const i = process.argv.indexOf('--changelog');
  if (i >= 0) return String(process.argv[i + 1] || '').trim();
  return String(process.env.CHANGELOG || '').trim();
}
const changelog = readChangelog();

// 递增发布版本
fs.writeFileSync(verFile, JSON.stringify({ current: ver + 1 }, null, 2), 'utf8');

// 写入界面显示的软件版本（打包进 build/appver.json，随安装包分发）
fs.writeFileSync(path.join(ROOT, 'build', 'appver.json'), JSON.stringify({ ver }, null, 2), 'utf8');

// electron-builder 直接输出到 release/V1.0.N/{productName}-{version}.exe（productName 为中文，用 artifactName 覆盖）
execSync('npx electron-builder --win nsis --publish never --config.directories.output=' + outDir.replace(/\\/g, '/'), {
  cwd: ROOT,
  stdio: 'inherit',
  env: Object.assign({}, process.env, {
    APP_VERSION: v,
    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR: process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://npmmirror.com/mirrors/electron-builder-binaries/',
  }),
});
console.log('完成。产物目录：' + outDir);

// 写入更新 manifest（供更新后台使用）：最新版本 + 本次更新内容 + 安装包大小
try {
  const installer = path.join(outDir, '张老师随身讲-' + v + '.exe');
  const sizeMb = fs.existsSync(installer) ? Math.round((fs.statSync(installer).size / 1048576) * 100) / 100 : 0;
  const manifest = { latest: v, changelog: changelog || '（无更新说明）', downloadUrl: '', sizeMb };
  fs.writeFileSync(path.join(ROOT, 'release', 'update-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('已写入更新 manifest：版本=' + v + ' 更新内容="' + manifest.changelog + '"');
} catch (e) { console.warn('写入 manifest 失败：' + (e && e.message)); }

// 生成《张老师随身讲 使用说明书》PDF
try {
  execSync('python make_manual.py', {
    cwd: ROOT, stdio: 'inherit',
    env: Object.assign({}, process.env, { MANUAL_OUT: path.join(outDir, '张老师随身讲-使用说明书.pdf') }),
  });
} catch (e) { console.warn('说明书生成失败：' + (e && e.message)); }

// 打包免安装 zip（内容直接位于 zip 根，不含 win-unpacked 层）
try {
  const up = path.join(outDir, 'win-unpacked').replace(/\\/g, '/');
  const zp = path.join(outDir, '张老师随身讲-免安装.zip').replace(/\\/g, '/');
  execSync('powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path \'' + up + '/*\' -DestinationPath \'' + zp + '\' -Force"', { cwd: ROOT, stdio: 'inherit' });
  console.log('免安装 zip 已生成：' + zp);
} catch (e) { console.warn('免安装 zip 失败：' + (e && e.message)); }
