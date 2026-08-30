// scripts/git-push.js - 创建 GitHub 远程仓库并推送（需认证）
// 用法:
//   node scripts/git-push.js [--repo rockxzhang/learning-app] [--public|--private]
// 认证方式（二选一）:
//   1) 已 gh 登录:  D:\hydro-packager\tools\gh\bin\gh.exe auth status 为通过即可
//   2) 环境变量 GITHUB_TOKEN=<ghp_...> 或第一个参数为 token
const { execSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
const userToken = process.env.GITHUB_TOKEN || '';
const getArg = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };
const isFlag = (f) => args.includes(f);
const repo = getArg('--repo', 'rockxzhang/learning-app');
const visibility = isFlag('--private') ? 'private' : 'public';
const url = `https://github.com/${repo}.git`;

const run = (c) => execSync(c, { cwd: ROOT, stdio: 'inherit' });

// 环境可能配置了 url.<...>.insteadof 把 github.com 改写为代理；push 会误走代理，需临时绕过并在结束后恢复
const REWRITE_KEY = 'url.https://gh-proxy.com/https://github.com/.insteadof';
function withDirectGithub(fn, result) {
  let val = null;
  try { val = execSync('git config --global --get ' + REWRITE_KEY, { encoding: 'utf8' }).trim(); } catch (e) { val = null; }
  if (val) { try { execSync('git config --global --unset ' + REWRITE_KEY, { stdio: 'pipe' }); } catch (e) {} }
  try { return fn(); }
  finally { if (val) { try { execSync('git config --global --add ' + REWRITE_KEY + ' ' + val, { stdio: 'pipe' }); } catch (e) {} } if (result) result(); }
}

function gh() {
  try { return execSync('D:\\hydro-packager\\tools\\gh\\bin\\gh.exe auth status', { cwd: ROOT, stdio: 'pipe' }) && true; }
  catch (e) { return false; }
}

(function main() {
  // 1) 添加远程
  try { execSync('git remote get-url origin', { cwd: ROOT, stdio: 'pipe' }); }
  catch (e) { run(`git remote add origin ${url}`); console.log('已添加远程 ' + url); }

  // 2) 创建远程仓库（用 gh 或 token）
  if (gh()) {
    withDirectGithub(() => execSync(`D:\\hydro-packager\\tools\\gh\\bin\\gh.exe repo create ${repo.split('/')[1]} --${visibility} --source . --remote origin --push`, { cwd: ROOT, stdio: 'inherit' }));
  } else if (userToken) {
    // 用 GitHub API 建仓
    const https = require('https');
    const body = JSON.stringify({ name: repo.split('/')[1], private: visibility === 'private' });
    const req = https.request({
      host: 'api.github.com', path: '/user/repos', method: 'POST',
      headers: { 'Authorization': 'Bearer ' + userToken, 'Content-Type': 'application/json', 'User-Agent': 'ds', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      if (res.statusCode < 300 || res.statusCode === 422) { // 422=已存在
        withDirectGithub(() => run('git push -u origin HEAD'));
        console.log('已推送 ' + repo);
      } else {
        console.error('创建仓库失败 HTTP ' + res.statusCode + ': ' + res.statusMessage);
        process.exit(1);
      }
      res.resume();
    });
    req.write(body); req.end();
  } else {
    console.error('未认证：请先 gh auth login 或设置 GITHUB_TOKEN。');
    console.log('推送命令：git push -u origin HEAD');
  }
})();
