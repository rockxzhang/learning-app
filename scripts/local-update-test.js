// scripts/local-update-test.js - 本地验证大/中/小三种版本场景
const { spawn } = require('child_process');
const update = require('../services/update');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 9577;
const BASE = 'http://127.0.0.1:' + PORT;
const cur = '1.0.1022';
const pkg = path.join(ROOT, 'release', '_testpkg.bin');
fs.writeFileSync(pkg, Buffer.alloc(3 * 1024 * 1024));   // 模拟 3MB 更新包

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function scenario(name, latest, changelog, expectType, hasFile) {
  const env = Object.assign({}, process.env, { LATEST_VERSION: latest, CHANGELOG: changelog });
  if (hasFile) env.FILE = pkg;
  const srv = spawn('node', ['scripts/mock-update-server.js'], { env, stdio: 'ignore', cwd: ROOT });
  await delay(900);
  let pass = true; const detail = [];
  try {
    const r = await update.check(BASE + '/update.json', cur);
    detail.push('type=' + r.type + ' latest=' + r.latest + ' changelog="' + r.changelog + '"');
    if (!r.hasUpdate) { pass = false; detail.push('no update'); }
    if (r.type !== expectType) { pass = false; detail.push('type expect ' + expectType + ' got ' + r.type); }
    if (r.changelog !== changelog) { pass = false; detail.push('changelog mismatch'); }
    if (hasFile) {
      const dest = path.join(ROOT, 'release', '_dl_test.exe');
      const d = await update.download(r.downloadUrl, dest, () => {});
      detail.push('downloaded=' + d.size + 'B');
      if (d.size < 100000) { pass = false; detail.push('download too small'); } else { detail.push('download OK'); }
      try { fs.unlinkSync(dest); } catch (e) {}
    } else {
      detail.push('patch=热更(无真实下载)');
    }
  } catch (e) { pass = false; detail.push('ERR ' + e.message); }
  srv.kill();
  await delay(300);
  console.log((pass ? '✅ PASS' : '❌ FAIL') + ' [' + name + ']  ' + detail.join(' | '));
  return pass;
}

(async () => {
  let all = true;
  all = (await scenario('小版本(热更)', '1.0.1023', '您好这是热更新版本', 'patch', false)) && all;
  all = (await scenario('中版本(差分)', '1.1.1022', '您好，这是中版本', 'minor', true)) && all;
  all = (await scenario('大版本(整包)', '2.0.1022', '您好这是大版本', 'major', true)) && all;
  try { fs.unlinkSync(pkg); } catch (e) {}
  console.log(all ? '\n===== 全部通过 =====' : '\n===== 存在失败 ====');
})();
