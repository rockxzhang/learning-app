// scripts/build-portable.js - 生成免安装便携版 exe（无需安装即可运行测试）
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
console.log('便携版版本号：' + v);
fs.writeFileSync(verFile, JSON.stringify({ current: ver + 1 }, null, 2), 'utf8');

execSync('npx electron-builder --win portable --publish never --config.directories.output=' + outDir.replace(/\\/g, '/'), {
  cwd: ROOT,
  stdio: 'inherit',
  env: Object.assign({}, process.env, {
    APP_VERSION: v,
    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR: process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://npmmirror.com/mirrors/electron-builder-binaries/',
  }),
});
console.log('完成。产物目录：' + outDir);
