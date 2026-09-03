// services/tts.js - 纯 Node 实现微软 Edge TTS（带 Sec-MS-GEC 签名），自然中文语音
// 说明：Edge TTS 端点对快速连续建连会间歇返回 0 字节（限流），这里做「段内重试+退避+段间间隔」提升可靠性。
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_BASE = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=' + TRUSTED_CLIENT_TOKEN;
const SEC_MS_GEC_VERSION = '1-143.0.3650.75';
const WIN_EPOCH = 11644473600;

function secMsGec() {
  let ticks = Date.now() / 1000 + WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= 1e7;
  const s = `${Math.round(ticks)}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(s, 'ascii').digest('hex').toUpperCase();
}
function muid() { return crypto.randomBytes(16).toString('hex').toUpperCase(); }
function uuidHex() { return crypto.randomUUID().replace(/-/g, ''); }
function dateStr() {
  const d = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const ms = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const p = (n) => String(n).padStart(2, '0');
  return `${days[d.getUTCDay()]} ${ms[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function mkssml(voice, ratePct, text) {
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='${ratePct}' volume='+0%'>${esc(text)}</prosody></voice></speak>`;
}
function rateToPct(mul) {
  const p = Math.round(((mul || 1) - 1) * 100);
  return (p >= 0 ? '+' : '') + p + '%';
}

function synthOnce(voice, ratePct, text) {
  return new Promise((resolve, reject) => {
    const url = `${WSS_BASE}&ConnectionId=${uuidHex()}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
    const ws = new WebSocket(url, {
      headers: {
        'Pragma': 'no-cache', 'Cache-Control': 'no-cache',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Accept-Encoding': 'gzip, deflate, br, zstd', 'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': `muid=${muid()};`,
      },
    });
    const chunks = [];
    let done = false;
    const settle = (err, buf) => {
      if (done) return;
      done = true;
      try { ws.close(); } catch (e) {}
      err ? reject(err) : resolve(Buffer.concat(buf));
    };
    ws.on('open', () => {
      ws.send(`X-Timestamp:${dateStr()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
      ws.send(`X-RequestId:${uuidHex()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateStr()}Z\r\nPath:ssml\r\n\r\n${mkssml(voice, ratePct, text)}`);
    });
    ws.on('message', (data, isBinary) => {
      if (!isBinary) { const s = data.toString('utf8'); if (s.indexOf('turn.end') >= 0) settle(null, chunks); return; }
      if (data.length < 2) return;
      const headerLen = data.readUInt16BE(0);
      if (headerLen > data.length) return;
      chunks.push(data.slice(headerLen + 2));
    });
    ws.on('error', (e) => settle(e, chunks));
    ws.on('close', () => settle(null, chunks));
  });
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// 合成单段：重试最多 8 次（退避递增），仍失败则抛出（不静默丢段）
async function segment(dir, voice, rateMul, text, idx, retries = 8) {
  const outPath = path.join(dir, 'seg_' + idx + '.mp3');
  let lastErr = null;
  for (let a = 0; a < retries; a++) {
    try {
      const buf = await synthOnce(voice, rateToPct(rateMul), text);
      if (buf && buf.length >= 200) {
        fs.writeFileSync(outPath, buf);
        return { text, path: outPath, size: buf.length, boundaries: [] };
      }
      lastErr = new Error('TTS 未生成有效音频（长度 ' + (buf ? buf.length : 0) + '）');
    } catch (e) { lastErr = e; }
    await delay(600 + a * 500);
  }
  throw lastErr;
}

// 合成整段讲解；teaching 为 [{text,from,to}] 或字符串；段间留间隔避免限流
async function synthesize(dir, cfg, teaching, onProgress) {
  fs.mkdirSync(dir, { recursive: true });
  const results = [];
  const segs = teaching.map((s) => (typeof s === 'string' ? { text: s, from: null, to: null } : s));
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i] || {};
    const t = String(s.text || '').trim();
    if (!t) continue;
    if (onProgress) try { onProgress(i, segs.length); } catch (e) {}
    const a = await segment(dir, cfg.teacherVoice, cfg.speechRate || 1, t, i);   // 重试直到成功；不静默丢段
    a.from = s.from == null ? null : Number(s.from);
    a.to = s.to == null ? null : Number(s.to);
    results.push(a);
    await delay(280);
  }
  return results;
}
module.exports = { synthesize, segment };
