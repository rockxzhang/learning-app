// services/update.js - 版本升级管理：检查更新 + 判断版本类型(大/中/小) + 下载进度
const fs = require('fs');

function parse(v) {
  const m = String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  return [m[0] || 0, m[1] || 0, m[2] || 0];
}
// 更新类型：major(大)/minor(中)/patch(小)/none
function type(cur, latest) {
  const a = parse(cur), b = parse(latest);
  if (!(String(cur) && String(latest))) return 'none';
  if (b[0] > a[0]) return 'major';
  if (b[1] > a[1]) return 'minor';
  if (b[2] > a[2]) return 'patch';
  return 'none';
}
async function check(url, cur) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);   // 6s 超时，防止服务器不可达时挂起
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ds' }, signal: ctl.signal });
    if (!res.ok) return { hasUpdate: false, error: 'HTTP ' + res.status };
    const m = await res.json();
    const typ = type(cur, m.latest);
    return { hasUpdate: typ !== 'none', curVersion: cur, latest: m.latest, changelog: m.changelog || '', type: typ, downloadUrl: m.downloadUrl || '', sizeMb: m.sizeMb || 0 };
  } finally { clearTimeout(timer); }
}
async function download(url, dest, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('下载失败 HTTP ' + res.status);
  const total = parseInt(res.headers.get('content-length') || '0', 10);
  const stream = fs.createWriteStream(dest);
  let received = 0;
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (!stream.write(Buffer.from(value))) await new Promise((r) => stream.once('drain', r));
    if (onProgress) try { onProgress(received, total); } catch (e) {}
  }
  await new Promise((r) => stream.end(r));
  return { size: received };
}
module.exports = { check, download, type, parse };
