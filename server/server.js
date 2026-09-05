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

// 计费：DeepSeek-V4-Flash-Vision-Exp 官方单价(元/百万tokens, 缓存未命中) × 高峰/全谷(北京时间)
const INPUT_PER_1M = Number(process.env.INPUT_PER_1M || 3);   // 高峰输入(缓存未命中)
const OUTPUT_PER_1M = Number(process.env.OUTPUT_PER_1M || 9); // 高峰输出
const VALLEY_MULT = Number(process.env.VALLEY_MULT || 0.5);   // 全谷=高峰×0.5
// 高峰时段(北京时间)：工作日 09:00-12:00 与 14:00-18:00；其余(含周末)为全谷
function isValley(d) {
  const b = new Date(d.getTime() + 8 * 3600 * 1000);   // 转北京时间
  const dow = b.getUTCDay(), h = b.getUTCHours();
  if (dow === 0 || dow === 6) return true;              // 周末全谷
  const peak = (h >= 9 && h < 12) || (h >= 14 && h < 18);
  return !peak;
}
function calcCost(input, output, d) {
  const mult = isValley(d) ? VALLEY_MULT : 1;
  const c = (input / 1e6) * INPUT_PER_1M * mult + (output / 1e6) * OUTPUT_PER_1M * mult;
  return Math.round(c * 10000) / 10000;
}
fs.mkdirSync(DATA, { recursive: true });
if (!fs.existsSync(USERF)) fs.writeFileSync(USERF, '[]', 'utf8');
if (!fs.existsSync(USAGEF)) fs.writeFileSync(USAGEF, '[]', 'utf8');
if (!fs.existsSync(FORBIDDEN)) fs.writeFileSync(FORBIDDEN, 'admin\nroot\ntest\n张老师\n管理员\n系统\n'.slice(0, -1), 'utf8');

// 回填历史费用：旧记录无 token 用量 → 用代表性默认值按发生时段的峰/谷估价，并重算各用户累计费用
const BACKFILL_INPUT = Number(process.env.BACKFILL_INPUT || 3000);
const BACKFILL_OUTPUT = Number(process.env.BACKFILL_OUTPUT || 1500);
function backfillCosts() {
  const users = readJSON(USERF), usage = readJSON(USAGEF);
  let uChanged = false;
  for (const x of usage) {
    if (typeof x.cost !== 'number' || x.cost == null) {
      const it = Number(x.inputTokens) || BACKFILL_INPUT, ot = Number(x.outputTokens) || BACKFILL_OUTPUT;
      x.inputTokens = it; x.outputTokens = ot;
      x.cost = calcCost(it, ot, new Date(x.time)); uChanged = true;
    }
  }
  if (uChanged) writeJSON(USAGEF, usage);
  let userChanged = false;
  for (const u of users) {
    const sum = usage.filter(x => x.username === u.username && x.phone === u.phone).reduce((s, x) => s + (x.cost || 0), 0);
    const rc = Math.round(sum * 10000) / 10000;
    if ((u.cost || 0) !== rc) { u.cost = rc; userChanged = true; }
  }
  if (userChanged) writeJSON(USERF, users);
}

const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return []; } };
const writeJSON = (f, a) => fs.writeFileSync(f, JSON.stringify(a, null, 2), 'utf8');
const forbidden = () => fs.readFileSync(FORBIDDEN, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const now = () => new Date().toISOString();

// 管理后台固定登录
const ADMIN_USER = process.env.ADMIN_USER || 'zhangxin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'jackyso5';
const ADMIN_PASS_HASH = hash(ADMIN_PASS);
let adminToken = null;
function getCookie(req, name) {
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function isAdmin(req) {
  const tok = getCookie(req, 'admin_token') || (req.headers['x-admin-token'] || '');
  return !!adminToken && tok === adminToken;
}

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
    // 防注入：用户名仅允许 中文/字母/数字/下划线/短横线，1-20 位；拒绝 <script> 等风险字符
    if (!/^[A-Za-z0-9_\-\u4e00-\u9fa5]{1,20}$/.test(username)) return { ok: false, error: '用户名仅限中英文、数字、下划线、短横线(1-20位)' };
    if (!/^\d{6,11}$/.test(phone)) return { ok: false, error: '手机号格式不正确' };
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
    // 防注入：账号仅允许 用户名安全字符 或 纯数字手机号
    if (!(/^[A-Za-z0-9_\-\u4e00-\u9fa5]{1,20}$/.test(id) || /^\d{6,11}$/.test(id))) return { ok: false, error: '账号格式不正确' };
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
    // 计费：按本次 token 用量 + 高峰/全谷时段
    const input_t = Number(body.input_tokens || 0), output_t = Number(body.output_tokens || 0);
    const cost = calcCost(input_t, output_t, new Date());
    u.cost = Math.round(((u.cost || 0) + cost) * 10000) / 10000;   // 用户累计费用
    writeJSON(USERF, users);
    const usage = readJSON(USAGEF);
    usage.push({ username, phone, ip: clientIp(req), city: geo(clientIp(req)), time: d, count: u.count, monthCount: u.monthCount, inputTokens: input_t, outputTokens: output_t, cost });
    writeJSON(USAGEF, usage);
    return { ok: true, count: u.count, monthCount: u.monthCount, month: u.month, cost };
  },
  'POST /api/info': async (req, body) => {
    const username = String(body.username || '').trim();
    const phone = String(body.phone || '').trim();
    const u = readJSON(USERF).find(x => x.username === username && x.phone === phone);
    if (!u) return { ok: false, error: '未找到用户' };
    const mkey = now().slice(0, 7);
    const monthCount = u.month === mkey ? (u.monthCount || 0) : 0;
    return { ok: true, username: u.username, phone: u.phone, count: u.count || 0, monthCount, month: mkey, limit: MONTH_LIMIT, cost: u.cost || 0 };
  },
  'GET /api/admin/stats': async () => {
    const usage = readJSON(USAGEF);
    return { ok: true, userCount: readJSON(USERF).length, usageCount: usage.length, totalCost: Math.round(usage.reduce((s, x) => s + (x.cost || 0), 0) * 10000) / 10000 };
  },
  'GET /api/admin/users': async () => readJSON(USERF).map(u => ({ username: u.username, phone: u.phone, count: u.count, monthCount: u.monthCount || 0, month: u.month || '', cost: u.cost || 0, createdAt: u.createdAt })),
  'GET /api/admin/usage': async () => readJSON(USAGEF),
  'GET /api/admin/costtrend': async () => {
    // 起算点：当天(北京) 06:00；若当前不到 06:00 则回退到昨日 06:00
    const BJ = 8 * 3600 * 1000;
    const bj = new Date(Date.now() + BJ);
    let startBj = new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate(), 6, 0, 0));
    if (startBj.getTime() > bj.getTime()) startBj = new Date(startBj.getTime() - 24 * 3600 * 1000);
    const startMs = startBj.getTime() - BJ;   // 转 UTC 毫秒
    const now5 = Math.floor(Date.now() / 300000) * 300000;
    // 各 5 分钟桶的费用
    const buckets = {};
    for (const x of readJSON(USAGEF)) {
      const t = new Date(x.time).getTime();
      if (t < startMs || t > now5) continue;
      const k = Math.floor(t / 300000) * 300000;
      buckets[k] = (buckets[k] || 0) + (x.cost || 0);
    }
    // 每 5 分钟一个点，显示自 06:00 起的累计总消耗费用
    const out = []; let run = 0;
    for (let s = startMs; s <= now5; s += 300000) {
      if (buckets[s]) run += buckets[s];
      out.push({ t: new Date(s).toISOString(), cost: Math.round(run * 10000) / 10000 });
    }
    return out;
  },
  'POST /api/admin/login': async (req, body) => {
    const u = String(body.username || ''), p = String(body.password || '');
    if (u === ADMIN_USER && hash(p) === ADMIN_PASS_HASH) {
      adminToken = crypto.randomBytes(24).toString('hex');
      return { ok: true, token: adminToken };
    }
    return { ok: false, error: '用户名或密码错误' };
  },
};

backfillCosts();   // 回填历史费用（需在 readJSON/writeJSON 定义后调用）
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const key = req.method + ' ' + url;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (url === '/admin' || url === '/admin/') {
    if (!isAdmin(req)) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(ROOT, 'public', 'admin-login.html'), 'utf8')); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(ROOT, 'public', 'admin.html'), 'utf8'));
    return;
  }
  if (url.indexOf('/api/admin/') === 0 && url !== '/api/admin/login') {
    if (!isAdmin(req)) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ ok: false, error: '未登录' })); return; }
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
