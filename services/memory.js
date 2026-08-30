// services/memory.js - 跨题目记忆 + 个性化学习档案
const fs = require('fs');
const path = require('path');

function file(dir) { return path.join(dir, 'memory.json'); }
function load(dir) {
  try { return JSON.parse(fs.readFileSync(file(dir), 'utf8')); } catch (e) { return []; }
}
function save(dir, recs) { fs.writeFileSync(file(dir), JSON.stringify(recs, null, 2), 'utf8'); }

function add(dir, rec) {
  const recs = load(dir);
  recs.push(Object.assign({ _time: Date.now() }, rec));
  save(dir, recs);
  return recs;
}
// 用户在某道题上标记的薄弱点
function addWeak(dir, title, weakPoints) {
  const recs = load(dir);
  const r = recs.find((x) => x.title === title);
  if (r) r.weakPoints = Array.isArray(weakPoints) ? weakPoints : [];
  else recs.push({ title, weakPoints: Array.isArray(weakPoints) ? weakPoints : [], _time: Date.now() });
  save(dir, recs);
  return recs;
}
// 汇总学习档案
function profile(dir) {
  const recs = load(dir);
  const kp = new Set();
  const wp = [];
  recs.forEach((r) => {
    (r.knowledgePoints || []).forEach((k) => kp.add(k));
    (r.weakPoints || []).forEach((w) => { if (w && !wp.includes(w)) wp.push(w); });
  });
  return { counts: recs.length, knowledgePoints: [...kp], weakPoints: wp };
}
// 生成给模型的个性化上下文
function weakContext(dir) {
  const p = profile(dir);
  if (!p.weakPoints.length && !p.knowledgePoints.length) return '';
  let s = '';
  if (p.knowledgePoints.length) s += '已学知识点：' + p.knowledgePoints.join('、') + '。';
  if (p.weakPoints.length) s += '薄弱点：' + p.weakPoints.join('、') + '（请针对性地多讲、多复习）。';
  return s;
}
module.exports = { load, save, add, addWeak, profile, weakContext };
