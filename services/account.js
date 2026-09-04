// services/account.js - 用户注册/登录/使用记录（连到后台 server/server.js）
const fs = require('fs');
const path = require('path');

async function post(cfg, url, body) {
  const r = await fetch(cfg.serverUrl + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
function sessionFile(dir) { return path.join(dir, 'session.json'); }
function saveSession(dir, s) { fs.writeFileSync(sessionFile(dir), JSON.stringify(s || {}), 'utf8'); }
function loadSession(dir) { try { return JSON.parse(fs.readFileSync(sessionFile(dir), 'utf8')); } catch (e) { return null; } }
function clearSession(dir) { try { fs.unlinkSync(sessionFile(dir)); } catch (e) {} }

async function register(dir, cfg, username, phone, password) {
  const r = await post(cfg, '/api/register', { username, phone, password });
  if (r.ok) saveSession(dir, { username, phone });
  return r;
}
async function login(dir, cfg, identifier, password) {
  const r = await post(cfg, '/api/login', { identifier, password });
  if (r.ok) saveSession(dir, { username: r.username, phone: r.phone });
  return r;
}
// 记录一次使用（后台记 IP/城市/时间/累计次数），需已登录
async function record(dir, cfg) {
  const s = loadSession(dir);
  if (!s || !s.username) return { ok: false, error: '未登录' };
  try { return await post(cfg, '/api/usage', { username: s.username, phone: s.phone }); }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
// 我的信息（累计次数 / 本月次数 / 上限）
async function info(dir, cfg) {
  const s = loadSession(dir);
  if (!s || !s.username) return { ok: false, error: '未登录' };
  try { return await post(cfg, '/api/info', { username: s.username, phone: s.phone }); }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
module.exports = { register, login, record, info, saveSession, loadSession, clearSession };
