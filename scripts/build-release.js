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
