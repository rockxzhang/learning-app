// renderer/renderer.js - 界面逻辑
(function () {
  const $ = (id) => document.getElementById(id);
  const api = window.api;

  let cfg = null;
  let filePath = null;
  let current = null;      // 最近一次讲解结果
  let playlist = [];       // [{text,path,boundaries}]
  let index = 0;
  let autoSpeak = true;

  // ---- 进度条 ----
  let creepTimer = null, curPct = 0, ttsTarget = -1;
  function showProg(pct, text) {
    const p = $('prog');
    p.classList.add('bar');          // display:flex
    $('progText').textContent = text || '准备…';
    setProg(pct || 0);
  }
  function setProg(pct) {
    curPct = Math.max(0, Math.min(100, pct));
    $('progFill').style.width = curPct + '%';
  }
  function hideProg() {
    clearInterval(creepTimer); creepTimer = null;
    const p = $('prog');
    p.classList.remove('bar');
    $('progFill').classList.remove('pulse');
    setProg(0);
  }
  function handleProgress(p) {
    if (!p) return;
    const fill = $('progFill');
    if (p.phase === 'done') { hideProg(); return; }
    if (p.phase === 'tts') {
      clearInterval(creepTimer); creepTimer = null;
      fill.classList.remove('pulse');
      setProg(p.pct);
      $('progText').textContent = p.detail || '合成语音…';
      ttsTarget = p.pct;
    } else if (p.phase === 'analyze') {
      // 分析阶段无真实小进度：缓慢蠕动 + 呼吸动画，避免“卡住”的感觉
      setProg(15);
      fill.classList.add('pulse');
      let crept = 15;
      clearInterval(creepTimer);
      creepTimer = setInterval(() => {
        crept += 0.5;
        if (crept >= 24.5) crept = 21;   // 在 21~24.5 之间往复
        setProg(crept);
      }, 300);
      $('progText').textContent = p.detail || '模型分析中…';
    } else {
      setProg(p.pct);
      $('progText').textContent = p.detail || '处理中…';
    }
  }

  // ---- 音频 + WebAudio（驱动口型）----
  const audioEl = document.createElement('audio');
  let actx = null, analyser = null;
  let ampGetter = () => 0;

  function initAudio() {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      const src = actx.createMediaElementSource(audioEl);
      src.connect(analyser);
      analyser.connect(actx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      ampGetter = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        return Math.sqrt(sum / data.length) * 3;   // 放大到 [0, ~1]
      };
    } catch (e) { /* 无 WebAudio 时口型不动，仍可播放 */ }
  }

  function fileUrl(p) { return 'file:///' + String(p).replace(/\\/g, '/'); }

  function loadSegment(i, doPlay) {
    index = Math.max(0, Math.min(playlist.length - 1, i));
    const seg = playlist[index];
    if (!seg) return;
    $('runBtn').textContent = '讲解中';           // 正在讲解 -> 讲解中(不可点)
    $('runBtn').disabled = true;
    highlightTranscript();
    highlightCodeLines(seg.from, seg.to);
    if (seg.path) {
      audioEl.src = fileUrl(seg.path);
      audioEl.playbackRate = Number($('rate').value || 1);
      if (doPlay) audioEl.play().catch(() => {});
    }
  }

  // ---- 讲稿（唯一字幕，当前句高亮）----
  function renderTranscript() {
    const box = $('transcript');
    box.textContent = '';
    playlist.forEach((seg, i) => {
      const div = document.createElement('div');
      div.className = 'line';
      div.dataset.i = i;
      div.textContent = (i + 1) + '. ' + seg.text;
      div.onclick = () => loadSegment(i, true);
      box.appendChild(div);
    });
    highlightTranscript();
  }
  function highlightTranscript() {
    const box = $('transcript');
    Array.from(box.children).forEach((d, i) => {
      d.className = 'line ' + (i === index ? 'current' : (i < index ? 'done' : ''));
    });
    if (box.children[index]) box.children[index].scrollIntoView({ block: 'nearest' });
  }

  // ---- 重置为初始状态（新题/截图上传前清空旧内容）----
  function resetUI() {
    $('title1').textContent = '—';
    $('kpoint').textContent = '';
    $('code').innerHTML = '<span class="empty">点击「开始讲解」生成带逐行注释的 C++ 代码</span>';
    $('solution').innerHTML = '<span class="empty">讲解时会生成：题意分析、核心算法、复杂度、样例推演、易错点</span>';
    $('transcript').innerHTML = '<div class="line">请先选择题目并点「开始讲解」，老师会逐句讲给你听。</div>';
    $('runBtn').textContent = '开始讲解';
    $('runBtn').disabled = !filePath;
    $('dlCodeBtn').disabled = true;
    $('dlDocBtn').disabled = true;
    $('printBtn').disabled = true;
    try { audioEl.pause(); audioEl.src = ''; } catch (e) {}
    index = -1; playlist = []; current = null;
    setProg(0);
  }

  // ---- 渲染代码（单遍 tokenizer：边转义边包裹，不再二次处理已插入的标记）----
  const KW = /^(include|using|namespace|int|long|short|char|bool|float|double|void|return|if|else|for|while|do|break|continue|cin|cout|endl|const|struct|class|public|private|typedef|auto|string|vector|map|sort|max|min|abs|size|begin|end|define|scanf|printf)$/;
  function escH(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function hl(code) {
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(\b\d+\b)|(\b[A-Za-z_]\w*)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += escH(code.slice(last, m.index));
      let cls = null, val = m[0];
      if (m[1]) { cls = 'cm'; }
      else if (m[2]) { cls = 'st'; }
      else if (m[3]) { cls = 'nu'; }
      else if (m[4]) {
        if (KW.test(val)) cls = 'kw';
        else if (/^\s*\(/.test(code.slice(m.index + val.length))) cls = 'fn';
        else cls = null;
      }
      if (cls) out += '<span class="' + cls + '">' + escH(val) + '</span>';
      else out += escH(val);
      last = m.index + m[0].length;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    out += escH(code.slice(last));
    return out;
  }
  // ---- 代码：逐行渲染 + 高亮 ----
  function renderCode(code) {
    const box = $('code');
    const raw = String(code || '');
    const lines = stripFence(raw).split('\n');
    box.innerHTML = lines.map((l, i) => '<div class="cl-row" data-line="' + (i + 1) + '"><span class="cl-no">' + (i + 1) + '</span><div class="cl">' + (hl(l) || '&nbsp;') + '</div></div>').join('');
    if (!raw.trim()) box.innerHTML = '<span class="empty">未生成代码</span>';
  }
  function highlightCodeLines(from, to) {
    const rows = document.querySelectorAll('#code .cl-row');
    if (rows.length) for (let i = 0; i < rows.length; i++) rows[i].classList.remove('active');
    if (from == null) return;
    let first = null;
    for (let i = from; i <= (to == null ? from : to); i++) {
      const el = rows[i - 1];
      if (el) { el.classList.add('active'); if (!first) first = el; }
    }
    if (first) first.scrollIntoView({ block: 'nearest' });
  }

  function stripFence(s) {
    return String(s || '').replace(/^\s*```[a-zA-Z]*\s*\n?([\s\S]*?)```\s*$/g, '$1').trim();
  }

  // ---- Markdown 渲染 ----
  function mdToHtml(md) {
    md = String(md || '');
    const lines = md.split('\n');
    let html = '', i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^```/.test(l.trim())) {
        const lang = l.trim().slice(3).trim();
        let code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) { code.push(lines[i]); i++; }
        i++; // skip closing fence
        html += '<pre><code>' + hl(code.join('\n')) + '</code></pre>';
      } else if (/^#{1,6}\s/.test(l)) {
        const n = l.match(/^#+/)[0].length;
        html += '<h' + n + '>' + inline(l.replace(/^#{1,6}\s*/, '')) + '</h' + n + '>';
        i++;
      } else if (/^>\s?/.test(l)) {
        let q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        html += '<blockquote>' + inline(q.join('<br>')) + '</blockquote>';
      } else if (/^([-*])\s+/.test(l)) {
        html += '<ul>';
        while (i < lines.length && /^([-*])\s+/.test(lines[i])) { html += '<li>' + inline(lines[i].replace(/^([-*])\s+/, '')) + '</li>'; i++; }
        html += '</ul>';
      } else if (/^\d+[.)]\s+/.test(l)) {
        html += '<ol>';
        while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) { html += '<li>' + inline(lines[i].replace(/^\d+[.)]\s+/, '')) + '</li>'; i++; }
        html += '</ol>';
      } else if (l.trim() === '') {
        i++;
      } else if (/^\|.*\|$/.test(l.trim())) {
        // 简单表格
        let rows = [];
        while (i < lines.length && /^\|/.test(lines[i].trim())) { rows.push(lines[i]); i++; }
        html += '<table>' + rows.map((r, ri) => {
          const cells = r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
          const tag = ri === 0 ? 'th' : 'td';
          return '<tr>' + cells.map((c) => '<' + tag + '>' + inline(c) + '</' + tag + '>').join('') + '</tr>';
        }).join('') + '</table>';
      } else {
        let p = [l];
        i++;
        while (i < lines.length && lines[i].trim() !== '' && !/^(#|```|>|[-*]\s|\d+[.)]\s|\|)/.test(lines[i])) { p.push(lines[i]); i++; }
        html += '<p>' + inline(p.join(' ')) + '</p>';
      }
    }
    return html;
  }
  function inline(s) {
    return String(s || '')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  // ---- (已移除「标记知识点」功能) ----

  // ---- 主流程 ----
  async function boot() {
    cfg = await api.cfgLoad();
    const cur = await api.versionCurrent();
    $('curVer').textContent = 'V1.0.' + (cur || cfg.baseVersion || 1000);
    let avatarImg = null;
    try { avatarImg = await api.getAvatarImage(); } catch (e) {}
    const av = window.teacher($('avatar'), avatarImg);
    av.start();
    initAudio();
    av.setAmpGetter(ampGetter);
    window.__teacher = av;
    api.onProgress(handleProgress);
  }

  $('pickBtn').onclick = async () => {
    const p = await api.pickFile();
    if (!p) return;
    filePath = p;
    $('fname').textContent = p.split(/[\\/]/).pop();
    $('runBtn').disabled = false;
    resetUI();
  };

  // 截图：最小化 -> 区域截图 -> 绿√确认/红×取消 -> 存临时png -> 回自动上传分析
  $('shotBtn').onclick = async () => {
    resetUI();
    const r = await api.startShot();
    if (!r || !r.ok || !r.filePath) { if (r && r.canceled) toast('已取消截图'); return; }
    filePath = r.filePath;
    $('fname').textContent = filePath.split(/[\\/]/).pop();
    $('runBtn').disabled = false;
    analyze();
  };

  async function analyze() {
    if (!filePath) return;
    $('runBtn').disabled = true;
    $('runBtn').textContent = '讲解中…';
    $('transcript').innerHTML = '<div class="line">正在读取题目并生成讲解…</div>';
    showProg(0, '准备…');
    let ok = false;
    try {
      const res = await api.runTeach(cfg, filePath);
      if (!res || !res.ok) { toast('讲解失败：' + ((res && res.error) || '未知错误')); }
      else { await applyResult(res); ok = true; }
    } catch (e) {
      toast('讲解失败：' + e.message);
    } finally {
      hideProg();
      if (!ok) { $('runBtn').textContent = '开始讲解'; $('runBtn').disabled = false; }
      // ok 时 applyResult 已加载首句 -> 按钮为「讲解中」，由播放结束切换为「讲解完毕」
    }
  }

  $('runBtn').onclick = () => { if (filePath) { resetUI(); analyze(); } };

  async function applyResult(res) {
    current = res;
    $('title1').textContent = res.title || '';
    $('kpoint').textContent = (res.knowledgePoints || []).slice(0, 2).map((k) => k).join('、') || '知识点';
    renderCode(res.code);
    $('solution').innerHTML = mdToHtml(res.solution) || '<span class="empty">未生成思路</span>';
    playlist = res.audio || [];
    renderTranscript();
    $('dlCodeBtn').disabled = false;
    $('dlDocBtn').disabled = false;
    $('printBtn').disabled = false;
    if (playlist.length) {
      loadSegment(0, true);
      toast('已生成 ' + res.teaching.length + ' 句讲解，共 ' + playlist.length + ' 段语音');
    } else {
      $('transcript').innerHTML = '<div class="line">' + ((res.teaching && res.teaching.map((t) => t.text || t).join('<br>')) || '（未生成语音）') + '</div>';
      $('runBtn').textContent = '讲解完毕';
      toast('已生成讲解，但没有语音');
    }
  }

  // 下载：示例代码(题目名.cpp) / 讲解文档(题目名.doc)
  function sanitizeName(s) { return String(s || '').replace(/[\\\/:*?"<>|\s.]+/g, '_').replace(/^_+|_+$/g, '') || '题目'; }
  function escH2(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function buildDocHtml(res) {
    const kp = (res.knowledgePoints || []).map((k) => '<font color="#b06a00">' + escH2(k) + '</font>').join('、');
    const teach = (res.teaching || []).map((t) => (t && t.text) || t).map((t, i) => '<p><b>' + (i + 1) + '.</b> ' + escH2(t) + '</p>').join('');
    const title = escH2(res.title || '讲解');
    return '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + title + '</title>'
      + '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->'
      + '<style>'
      + '@page { size: A4; margin: 22mm 20mm; }'
      + 'body{font-family:"微软雅黑","SimSun",serif;font-size:11pt;line-height:1.7;color:#222;max-width:100%;}'
      + 'h1{font-size:22pt;color:#1a3b8f;text-align:center;margin:0 0 6mm;padding-bottom:4mm;border-bottom:2px solid #1a3b8f;}'
      + 'h2{font-size:15pt;color:#1a3b8f;margin:14px 0 6px;padding-left:8px;border-left:4px solid #1a3b8f;}'
      + 'p{text-align:justify;}'
      + 'pre{background:#f4f6fb;padding:10px;border:1px solid #dde3f0;font:10pt Consolas,monospace;color:#1c2b4a;white-space:pre-wrap;word-break:break-word;}'
      + 'table{border-collapse:collapse;} th,td{border:1px solid #ccc;padding:4px 8px;}'
      + 'code{font-family:Consolas,monospace;font-size:10pt;}'
      + '.meta{color:#777;font-size:10pt;text-align:center;margin-bottom:10px}'
      + '.foot{position:fixed;bottom:6px;left:0;right:0;text-align:center;font-size:9pt;color:#999;border-top:1px solid #ddd;padding-top:4px;}'
      + '</style></head><body>'
      + '<h1>' + title + '</h1>'
      + '<p class="meta">张老师随身讲 · 自动生成讲解文档</p>'
      + '<p><b>涉及知识点：</b>' + kp + '</p>'
      + '<h2>一、解题思路</h2>' + mdToHtml(res.solution || '')
      + '<h2>二、讲解内容</h2>' + teach
      + '<h2>三、参考代码</h2><pre>' + escH2(stripFence(res.code || '')) + '</pre>'
      + '<div class="foot">张老师随身讲</div>'
      + '</body></html>';
  }
  $('dlCodeBtn').onclick = async () => {
    if (!current) return;
    const r = await api.saveFile(sanitizeName(current.title) + '.cpp', stripFence(current.code || ''), 'C++ 源文件', 'cpp');
    if (r && r.ok) toast('已保存代码：' + r.filePath); else if (r && r.canceled) toast('已取消');
    else if (r && r.error) toast('保存失败：' + r.error);
  };
  $('dlDocBtn').onclick = async () => {
    if (!current) return;
    const r = await api.saveFile(sanitizeName(current.title) + '.doc', buildDocHtml(current), 'Word 文档', 'doc');
    if (r && r.ok) toast('已保存讲解：' + r.filePath); else if (r && r.canceled) toast('已取消');
    else if (r && r.error) toast('保存失败：' + r.error);
  };
  // 打印讲解：直接复用 A4 文档 HTML，调系统打印
  $('printBtn').onclick = async () => {
    if (!current) return;
    const r = await api.printDoc(buildDocHtml(current));
    if (r && !r.ok && r.error) toast('打印失败：' + r.error);
  };

  // ---- 播放控制 ----
  $('playBtn').onclick = () => audioEl.play().catch(() => toast('无法播放，请检查网络'));
  $('pauseBtn').onclick = () => audioEl.pause();
  $('prevBtn').onclick = () => loadSegment(index - 1, true);
  $('nextBtn').onclick = () => loadSegment(index + 1, true);
  $('rate').onchange = () => { audioEl.playbackRate = Number($('rate').value || 1); };

  audioEl.addEventListener('ended', () => {
    if (index >= playlist.length - 1) { $('runBtn').textContent = '讲解完毕'; $('runBtn').disabled = true; }
    else if (autoSpeak) loadSegment(index + 1, true);
  });

  // ---- 代码字号调节：最小=默认 12.5px，最多 +5 号(到 17.5px) ----
  const CFS_BASE = 12.5, CFS_MAX = 17.5;
  let codeSize = CFS_BASE;
  function setCodeSize(delta) {
    codeSize = Math.max(CFS_BASE, Math.min(CFS_MAX, codeSize + delta));
    $('code').style.setProperty('--cfs', codeSize + 'px');
    $('codeMinus').disabled = codeSize <= CFS_BASE;
    $('codePlus').disabled = codeSize >= CFS_MAX;
  }
  $('codeMinus').onclick = () => setCodeSize(-1);
  $('codePlus').onclick = () => setCodeSize(1);
  setCodeSize(0);

  // ---- toast ----
  let toastTimer = null;
  function toast(msg) {
    const b = $('logbar');
    b.textContent = msg;
    b.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => b.classList.remove('show'), 2600);
  }

  boot();

  // ---- 版本升级管理 ----
  let upd = null;
  function showProg2(pct) { const p = $('uProg'); p.classList.add('show'); $('uFill').style.width = (pct || 0) + '%'; $('uPct').textContent = Math.round(pct || 0) + '%'; }
  function openUpdate(u) {
    upd = u;
    $('updateMask').hidden = false;
    $('uCur').textContent = 'V' + (u.curVersion || '--');
    $('uNew').textContent = 'V' + u.latest;
    const typeMap = { major: '大版本（整包重装）', minor: '中版本（差分安装）', patch: '小版本（热更）' };
    $('uType').textContent = typeMap[u.type] || u.type;
    $('uLog').textContent = u.changelog || '（无更新说明）';
    $('uProg').classList.remove('show');
    $('uFill').style.width = '0%'; $('uPct').textContent = '0%';
    $('uGoBtn').disabled = false; $('uGoBtn').textContent = '开始更新';
  }
  function closeUpdate() { $('updateMask').hidden = true; upd = null; }
  async function checkUpdate() {
    try { const u = await api.updateCheck(); if (u && u.hasUpdate) { $('updateDot').hidden = false; window.__update = u; } } catch (e) {}
  }
  $('updateDot').onclick = () => { if (window.__update) openUpdate(window.__update); };
  $('uCloseBtn').onclick = closeUpdate;
  $('uCloseX').onclick = closeUpdate;
  $('uGoBtn').onclick = async () => {
    if (!upd) return;
    $('uGoBtn').disabled = true; $('uGoBtn').textContent = '更新中…';
    showProg2(0);
    try {
      if (upd.type === 'patch') {
        // 热更：仅进度条（模拟），完成后刷新
        let p = 0;
        await new Promise((res) => {
          const t = setInterval(() => { p += 5; showProg2(p); if (p >= 100) { clearInterval(t); res(); } }, 70);
        });
        api.updateApply('patch', null).catch(() => {});
        $('uLog').textContent = '热更新完成，界面已刷新（本地模拟）。'; toast('热更新完成');
        $('uGoBtn').disabled = true; $('uGoBtn').textContent = '已完成';
      } else {
        const d = await api.updateDownload(upd.downloadUrl);
        if (!d || !d.ok) { toast('下载失败：' + ((d && d.error) || '未知')); $('uGoBtn').disabled = false; $('uGoBtn').textContent = '开始更新'; return; }
        showProg2(100);
        await api.updateApply(upd.type, d.path);
        $('uLog').textContent = '正在拉起安装程序，随后软件将关闭…'; $('uGoBtn').textContent = '正在安装…';
      }
      window.__updDone = true;
    } catch (e) { toast('更新失败：' + e.message); $('uGoBtn').disabled = false; $('uGoBtn').textContent = '开始更新'; }
  };
  api.onUpdateProgress((p) => { if (!p || !p.total) return; showProg2((p.received / p.total) * 100); });
  checkUpdate();
})();
