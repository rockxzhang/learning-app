// services/parseFile.js - 读取上传的题目文件为归一化载荷 {name,ext,text,b64,size}
const fs = require('fs');
const path = require('path');

async function read(filePath) {
  const base = path.basename(filePath);
  const e = path.extname(base).replace('.', '').toLowerCase();
  const buf = fs.readFileSync(filePath);
  let text = '', b64 = '';
  if (['md','txt','html','htm'].includes(e)) {
    text = buf.toString('utf8');
  } else if (e === 'pdf') {
    try { const pdf = require('pdf-parse'); const r = await pdf(buf); text = r.text || ''; }
    catch (err) { text = ''; }
  } else if (e === 'docx') {
    try { const mammoth = require('mammoth'); const r = await mammoth.extractRawText({ buffer: buf }); text = r.value || ''; }
    catch (err) { text = ''; }
  } else if (['png','jpg','jpeg','bmp','gif','webp'].includes(e)) {
    b64 = buf.toString('base64');
  }
  return { name: base, ext: e, text, b64, size: buf.length };
}
module.exports = { read };
