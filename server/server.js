// server/server.js - 用户/使用记录/管理后台 后端（纯 Node http，本地/生产皆可）
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname);
const DATA = path.join(ROOT, 'data');
const USERF = path.join(DATA, 'users.json');
const USAGEF = path.join(DATA, 'usage.json');
const FORBIDDEN = path.join(DATA, 'forbidden.txt');
const PORT = Number(process.env.PORT || 9588);
const MONTH_LIMIT = Number(process.env.MONTH_LIMIT || 600);   // 每月使用次数封顶
fs.mkdirSync(DATA, { recursive: true });
if (!fs.existsSync(USERF)) fs.writeFileSync(USERF, '[]', 'utf8');
if (!fs.existsSync(USAGEF)) fs.writeFileSync(USAGEF, '[]', 'utf8');
if (!fs.existsSync(FORBIDDEN)) fs.writeFileSync(FORBIDDEN, 'admin\nroot\ntest\n张老师\n管理员\n系统\n'.slice(0, -1), 'utf8');

const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return []; } };
const writeJSON = (f, a) => fs.writeFileSync(f, JSON.stringify(a, null, 2), 'utf8');
const forbidden = () => fs.readFileSync(FORBIDDEN, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const now = () => new Date().toISOString();

// IP -> 城市（ip2region 离线地理库，精确到市）；回环返回本地
let searcher = null, geoErr = null;
function geo(ip) {
  const norm = String(ip || '').replace(/^::ffff:/, '');
  if (!norm || norm === '127.0.0.1' || norm === '::1') return '本地（回环）';
  try {
    if (!searcher) {
      const Searcher = require('ip2region').default;
      const db = process.env.IP2REGION_DB || path.join(__dirname, '..', 'node_modules', 'ip2region', 'data', 'ip2region.db');
      searcher = new Searcher(db);
    }
    const r = searcher.search(norm);
    if (!r || !r.city) return '未知地区';
    if (r.city === '内网IP') return '本地（回环）';
    return [r.country, r.province, r.city].filter(Boolean).join('·');
  } catch (e) { geoErr = e; return '未知地区'; }
}
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0].trim() : req.socket.remoteAddress) || '';
}

function readBody(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); });
}

const routes = {
  'POST /api/register': async (req, body) => {
    const username = String(body.username || '').trim();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    const users = readJSON(USERF);
    if (!username) return { ok: false, error: '用户名不能为空' };
    if (forbidden().some(w => username.toLowerCase() === w.toLowerCase())) return { ok: false, error: '违规' };
    if (users.some(u => u.username === username)) return { ok: false, error: '用户名重复' };
    if (!/^\d{6,11}$/.test(phone)) return { ok: false, error: '手机号格式不正确' };
    if ((password || '').length < 6) return { ok: false, error: '密码至少6位' };
    users.push({ username, phone, pass: hash(password), count: 0, month: '', monthCount: 0, createdAt: now() });
    writeJSON(USERF, users);
    return { ok: true, username };
  },
  'POST /api/login': async (req, body) => {
    const id = String(body.identifier || '').trim();
    const password = String(body.password || '');
    const users = readJSON(USERF);
    const u = users.find(x => x.username === id || x.phone === id);
    if (!u || u.pass !== hash(password)) return { ok: false, error: '账号或密码错误' };
    return { ok: true, username: u.username, phone: u.phone, count: u.count };
  },
  'POST /api/usage': async (req, body) => {
    const username = String(body.username || '').trim();
    const phone = String(body.phone || '').trim();
    const users = readJSON(USERF);
    const u = users.find(x => x.username === username && x.phone === phone);
    if (!u) return { ok: false, error: '未找到用户' };
    // 月度使用次数封顶
    const d = now(), mkey = d.slice(0, 7);
    if (u.month !== mkey) { u.month = mkey; u.monthCount = 0; }
    if ((u.monthCount || 0) >= MONTH_LIMIT) return { ok: false, error: '本月使用次数已达上限（' + MONTH_LIMIT + ' 次）' };
    u.monthCount = (u.monthCount || 0) + 1;
    u.count = (u.count || 0) + 1;
    writeJSON(USERF, users);
    const usage = readJSON(USAGEF);
    usage.push({ username, phone, ip: clientIp(req), city: geo(clientIp(req)), time: d, count: u.count, monthCount: u.monthCount });
    writeJSON(USAGEF, usage);
    return { ok: true, count: u.count, monthCount: u.monthCount, month: u.month };
  },
  'POST /api/info': async (req, body) => {
    const username = String(body.username || '').trim();
    const phone = String(body.phone || '').trim();
    const u = readJSON(USERF).find(x => x.username === username && x.phone === phone);
    if (!u) return { ok: false, error: '未找到用户' };
    const mkey = now().slice(0, 7);
    const monthCount = u.month === mkey ? (u.monthCount || 0) : 0;
    return { ok: true, username: u.username, phone: u.phone, count: u.count || 0, monthCount, month: mkey, limit: MONTH_LIMIT };
  },
  'GET /api/admin/stats': async () => {
    return { ok: true, userCount: readJSON(USERF).length, usageCount: readJSON(USAGEF).length };
  },
  'GET /api/admin/users': async () => readJSON(USERF).map(u => ({ username: u.username, phone: u.phone, count: u.count, monthCount: u.monthCount || 0, month: u.month || '', createdAt: u.createdAt })),
  'GET /api/admin/usage': async () => readJSON(USAGEF),
};

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const key = req.method + ' ' + url;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (url === '/admin' || url === '/admin/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(ROOT, 'public', 'admin.html'), 'utf8'));
    return;
  }
  if (routes[key]) {
    const body = (req.method === 'POST') ? await readBody(req) : {};
    try { const r = await routes[key](req, body); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(r)); }
    catch (e) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: String(e) })); }
    return;
  }
  res.statusCode = 404; res.end('not found');
});
server.listen(PORT, () => console.log('[server] http://127.0.0.1:' + PORT + '  (注册/登录/使用记录/管理后台)'));
