// services/config.js - persisted settings (模型账号内嵌，用户无需配置)
const fs = require('fs');
const path = require('path');

// 制作人密钥不写入源码仓库：优先取环境变量，否则读取 services/api.key（已被 .gitignore 忽略，构建打包时一并打包进 App）。
function readApiKey() {
  try { return fs.readFileSync(path.join(__dirname, 'api.key'), 'utf8').trim(); } catch (e) { return ''; }
}
const DEEPSEEK_API_KEY = (process.env.DEEPSEEK_API_KEY || readApiKey()) || 'sk-REPLACE_ME';

const DEFAULTS = {
  llmEndpoint: 'https://api.deepseek.com/v1/chat/completions',
  llmApiKey: DEEPSEEK_API_KEY,
  llmModel: 'deepseek-v4-flash-vision-exp',   // 视觉模型，可看题图
  teacherVoice: 'zh-CN-YunxiNeural',       // 阳光男声（云希，明亮少年音；Edge TTS）
  speechRate: 1.0,                            // 语速倍率
  autoSpeak: true,                            // 生成后自动开始讲解
  baseVersion: 1000,                          // 软件版本号起始（显示 V1.0.1000），每次讲解/打包 +1
  updateUrl: 'http://47.115.202.192:9588/update.json',  // 更新后台(线上服务器, 提供清单+差异更新包)
  serverUrl: 'http://47.115.202.192:9588',        // 已部署后端(用户/使用记录/管理后台)，端口9588直连
};

function file(dir) { return path.join(dir, 'config.json'); }

function load(dir) {
  try {
    const merged = Object.assign({}, DEFAULTS, JSON.parse(fs.readFileSync(file(dir), 'utf8')));
    merged.teacherVoice = DEFAULTS.teacherVoice;   // 讲解配音固定为阳光男声，不随用户设置覆盖
    merged.updateUrl = DEFAULTS.updateUrl;         // 更新后台固定指向线上服务器，不随旧配置覆盖(否则无更新红点)
    return merged;
  } catch (e) { return Object.assign({}, DEFAULTS); }
}
function save(dir, cfg) {
  fs.writeFileSync(file(dir), JSON.stringify(Object.assign({}, DEFAULTS, cfg), null, 2), 'utf8');
  return true;
}
module.exports = { load, save, DEFAULTS };
