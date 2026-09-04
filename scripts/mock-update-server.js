// scripts/mock-update-server.js - 本地模拟更新后台
// 用法(切换场景):
//   LATEST_VERSION=1.0.1023 CHANGELOG=您好这是热更新版本                          node scripts/mock-update-server.js    (小/热更)
//   LATEST_VERSION=1.1.1022 CHANGELOG=您好，这是中版本   FILE=release/V1.0.1022/张老师随身讲-V1.0.1022.exe  node scripts/mock-update-server.js  (中/差分)
//   LATEST_VERSION=2.0.1022 CHANGELOG=您好这是大版本     FILE=release/V1.0.1022/张老师随身讲-V1.0.1022.exe  node scripts/mock-update-server.js  (大/整包)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 9577);
const latest = process.env.LATEST_VERSION || '1.0.1023';
const changelog = process.env.CHANGELOG || '您好这是热更新版本';
const FILE = process.env.FILE ? path.resolve(process.cwd(), process.env.FILE) : '';

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/update.json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      latest,
      changelog,
      downloadUrl: `http://127.0.0.1:${PORT}/download/package`,
      sizeMb: FILE && fs.existsSync(FILE) ? Math.round((fs.statSync(FILE).size / 1048576) * 100) / 100 : 0,
    }));
    return;
  }
  if (u === '/download/package') {
    if (!FILE || !fs.existsSync(FILE)) { res.statusCode = 404; res.end('no file'); return; }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fs.statSync(FILE).size);
    fs.createReadStream(FILE).pipe(res);
    return;
  }
  res.statusCode = 404; res.end('not found');
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('[mock-update] http://127.0.0.1:' + PORT + '  latest=' + latest + '  changelog=' + changelog + '  file=' + (FILE || '(无,纯模拟)'));
});
