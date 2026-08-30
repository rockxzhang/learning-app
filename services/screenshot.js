// services/screenshot.js - 捕获屏幕 + 保存随机名 PNG
const { desktopCapturer, screen } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function capture() {
  const b = screen.getPrimaryDisplay().bounds;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: b.width, height: b.height },
  });
  const src = sources[0];
  if (!src) throw new Error('没有可截取的屏幕');
  return src.thumbnail; // NativeImage
}

function randomName() {
  // 临时文件名：随机数字+字母
  return 'shot_' + crypto.randomBytes(4).toString('hex') + '.png';
}

function savePng(dataUrl, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const b64 = String(dataUrl || '').replace(/^data:image\/png;base64,/, '');
  const fp = path.join(dir, randomName());
  fs.writeFileSync(fp, Buffer.from(b64, 'base64'));
  return fp;
}

module.exports = { capture, savePng };
