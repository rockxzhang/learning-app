// services/analyze.js - 调用配置好的视觉大模型，产出教学内容 {title,code,solution,teaching,knowledgePoints}
const cfg = require('./config');

async function callLLM(cfgObj, contentParts) {
  const body = {
    model: cfgObj.llmModel,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: contentParts }],
    temperature: 0.3,
  };
  const res = await fetch(cfgObj.llmEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfgObj.llmApiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('LLM HTTP ' + res.status);
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const m = String(content || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('模型未返回 JSON');
  const obj = JSON.parse(m[0]);
  if (!Array.isArray(obj.teaching)) obj.teaching = [];
  obj.teaching = obj.teaching.map((t) => {
    if (typeof t === 'string') return { text: t, from: null, to: null };
    const o = t || {};
    return { text: String(o.text || ''), from: o.from == null ? null : Number(o.from), to: o.to == null ? null : Number(o.to) };
  });
  if (!Array.isArray(obj.knowledgePoints)) obj.knowledgePoints = [];
  return obj;
}

const SYSTEM = `你是一位温柔耐心的信息学竞赛老师，用中文给学生一步步讲题。学生给你出一道编程题（材料可能是图片/PDF/Word/Markdown，数字可能因图片丢失需按题意合理推断）。
你只输出一个 JSON 对象，不要输出 JSON 之外的任何内容。字段如下：
{
  "title": "题目名（材料有则沿用，否则自拟）",
  "code": "一份正确、可直接编译的 C++ 参考解法（g++ -std=c++14，算法正确；给出【逐行详细中文注释】，尤其关键算法、边界与易错点要用 // 注明；代码要按行数排列）",
  "solution": "Markdown 格式的【详细解题思路】，包含：题意分析、核心算法思路、为什么这样想、复杂度分析（时间/空间）、一个例子手工推演、易错点提示。用 #、##、- 等 Markdown 排好版",
  "teaching": [ {"text":"一段自然的口头讲解文本","from":1,"to":3}, {"text":"第二段","from":4,"to":5}, "..." ],
  "knowledgePoints": [ "本题涉及的知识点1", "知识点2", "..." ]
}
要求：teaching 是把解题思路转成【老师在黑板前一样】的自然口语讲解，分段、口语化、循序渐进，先读懂题意、再讲思路、再讲关键代码、最后总结易错点；每段不要太长（30~80 字为宜），段与段之间衔接自然；字幕与语音将按这些分段逐个朗读。每段都要用 "from"/"to" 指出它讲解的是 code 中的哪一行到哪一行（1 起始的行号，需与 code 的行号一致；若这段不针对具体代码行，可为 null）。code 必须在所有测试数据上正确。`;

async function analyze(cfgObj, fileInfo, memoryContext) {
  const parts = [];
  let head = `请讲解下面这道题，为学生生成代码+解题思路+讲解台词。`;
  if (memoryContext) {
    head += `\n【学生个人学习档案】他之前学过的知识点与薄弱点如下，请在讲解时适度针对薄弱点多讲、多复习：\n${memoryContext}`;
  }
  parts.push({ type: 'text', text: head + '\n题目材料：\n' + (fileInfo.text || '(看图)' ) });
  if (fileInfo.b64) {
    parts.push({ type: 'image_url', image_url: { url: 'data:image/' + fileInfo.ext + ';base64,' + fileInfo.b64 } });
  }
  return callLLM(cfgObj, parts);
}
module.exports = { analyze };
