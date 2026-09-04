// services/index.js - 导出所有服务
const config = require('./config');
const parseFile = require('./parseFile');
const analyze = require('./analyze');
const tts = require('./tts');
const memory = require('./memory');
const pipeline = require('./pipeline');
const screenshot = require('./screenshot');
const update = require('./update');
module.exports = { config, parseFile, analyze, tts, memory, pipeline, screenshot, update };
