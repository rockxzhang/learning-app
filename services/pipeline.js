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

async function run(dataDir, cfg, filePath, log) {
  const logMsg = (m) => { if (log) log(m); };
  config.save(dataDir, cfg);
  try {
    logMsg('读取题目 ' + path.basename(filePath) + ' …');
    const info = await parseFile.read(filePath);
    logMsg('模型分析中（结合你的学习档案）…');
    const memctx = memory.weakContext(dataDir);
    const model = await analyze.analyze(cfg, info, memctx);
    logMsg('生成讲解语音（' + (model.teaching || []).length + ' 段）…');
    const audio = await tts.synthesize(path.join(dataDir, 'tts'), cfg, model.teaching || []);
    const version = nextVersion(dataDir, cfg);
    memory.add(dataDir, { title: model.title || info.name, knowledgePoints: model.knowledgePoints || [] });
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
