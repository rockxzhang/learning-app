// services/pipeline.js - 编排一次讲解：读取题目 -> 模型分析 -> 合成语音 -> 写记忆 -> 返回
const fs = require('fs');
const path = require('path');
const config = require('./config');
const parseFile = require('./parseFile');
const analyze = require('./analyze');
const tts = require('./tts');
const memory = require('./memory');

function nextVersion(dataDir, cfg) {
  const f = path.join(dataDir, 'version.json');
  let cur = cfg.baseVersion || 1000;
  try { cur = JSON.parse(fs.readFileSync(f, 'utf8')).current; } catch (e) {}
  fs.writeFileSync(f, JSON.stringify({ current: cur + 1 }), 'utf8');
  return 'V1.0.' + cur;
}

async function run(dataDir, cfg, filePath, log, progress) {
  const logMsg = (m) => { if (log) log(m); };
  const prog = (phase, pct, detail) => { try { if (progress) progress({ phase, pct, detail }); } catch (e) {} };
  config.save(dataDir, cfg);
  try {
    prog('read', 4, '读取题目 ' + path.basename(filePath) + ' …');
    const info = await parseFile.read(filePath);
    prog('analyze', 15, '模型分析中（约 30~60 秒，请稍候）…');
    logMsg('模型分析中（结合你的学习档案）…');
    const memctx = memory.weakContext(dataDir);
    const model = await analyze.analyze(cfg, info, memctx);
    const segs = model.teaching || [];
    prog('tts', 25, '合成讲解语音…');
    logMsg('生成讲解语音（' + segs.length + ' 段）…');
    const ttsDir = path.join(dataDir, 'tts');
    // TTS 偶发失败（Edge 不稳）：整体重试最多 3 次，确保「组完」
    let audio = null, ttsErr = null;
    for (let attempt = 0; attempt < 3 && !audio; attempt++) {
      try {
        audio = await tts.synthesize(ttsDir, cfg, segs, (i, total) => {
          prog('tts', 25 + Math.round(70 * (i / Math.max(1, total))), '合成语音 ' + (i + 1) + '/' + total);
        });
      } catch (e) { ttsErr = e; if (attempt < 2) logMsg('合成失败，重试中…'); await new Promise((r) => setTimeout(r, 700 + attempt * 600)); }
    }
    if (!audio) throw ttsErr || new Error('语音合成失败');
    prog('tts', 95, '语音已就绪，整理讲解…');
    const version = nextVersion(dataDir, cfg);
    memory.add(dataDir, { title: model.title || info.name, knowledgePoints: model.knowledgePoints || [] });
    prog('done', 100, '讲解已就绪');
    return {
      ok: true, version, title: model.title || info.name, fileName: info.name,
      code: model.code || '', solution: model.solution || '',
      teaching: model.teaching || [], knowledgePoints: model.knowledgePoints || [],
      audio,
    };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

module.exports = { run };
