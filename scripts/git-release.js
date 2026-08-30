// scripts/git-release.js - 一键发布：提交源码 -> 版本+1 打安装包 -> (可选) 推送 GitHub
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const push = process.argv.includes('--push');

// 取即将发布的版本号（build-release 会把它 +1）
let ver = 1000;
try { ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'release', 'version.json'), 'utf8')).current; } catch (e) {}
const v = 'V1.0.' + ver;

// 1) 提交源码
execSync('git add -A', { cwd: ROOT, stdio: 'inherit' });
execSync(`git commit -m "release ${v}"`, { cwd: ROOT, stdio: 'inherit' });
console.log('已提交源码：release ' + v);

// 2) 打版本安装包
execSync('node scripts/build-release.js', { cwd: ROOT, stdio: 'inherit' });

// 3) 推送（--push 且在设置了远端时）
if (push) {
  try {
    const remote = execSync('git remote get-url origin', { cwd: ROOT, encoding: 'utf8' }).trim();
    execSync('git push origin HEAD', { cwd: ROOT, stdio: 'inherit' });
    console.log('已推送到 ' + remote);
  } catch (e) {
    console.error('推送失败（未配置远程或需认证）：' + e.message);
  }
}
console.log('完成。产物：release/' + v + '/');
