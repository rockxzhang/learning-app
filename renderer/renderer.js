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
    audioEl.src = fileUrl(seg.path);
    audioEl.playbackRate = Number($('rate').value || 1);
    renderCaption(seg);
    highlightTranscript();
    if (doPlay) audioEl.play().catch(() => {});
  }

  // ---- 字幕 ----
  let spans = [];
  function buildSpans(seg) {
    spans = [];
    if (seg.boundaries && seg.boundaries.length) {
      spans = seg.boundaries.map((b) => ({ t: b.text, s: b.start, d: b.dur }));
    } else {
      spans = [{ t: seg.text || '', s: 0, d: 100000 }];
    }
    if (!spans.length) spans = [{ t: seg.text || '', s: 0, d: 100000 }];
  }
  function renderCaption(seg) {
    buildSpans(seg);
    const cap = $('caption');
    cap.textContent = '';
    spans.forEach((w, i) => {
      const el = document.createElement('span');
      el.className = 'word';
      el.dataset.i = i;
      el.textContent = (i === 0 ? '' : '') + w.t;
      cap.appendChild(el);
    });
  }
  function updateSpans() {
    const t = audioEl.currentTime * 1000;
    const words = $('caption').children;
    for (let i = 0; i < spans.length; i++) {
      const w = spans[i];
      const on = t >= w.s && t < (w.s + w.d);
      if (words[i]) words[i].classList.toggle('on', on);
    }
  }

  // ---- 讲稿 ----
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

  // ---- 渲染代码（简单高亮）----
  function hl(code) {
    const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/\/(\/[^\n]*)|(\/\*[\s\S]*?\*\/)/g, '<span class="cm">$1$2</span>')
      .replace(/(&quot;|")([^"\n]*)\1/g, '<span class="st">$1$2$1</span>')
      .replace(/\b(include|using|namespace|int|long|short|char|bool|float|double|void|return|if|else|for|while|do|break|continue|cin|cout|endl|const|struct|class|public|private|typedef|auto|string|vector|map|sort|max|min|abs|size|begin|end|define)\b/g, '<span class="kw">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="nu">$1</span>')
      .replace(/\b([A-Za-z_]\w*)(?=\s*\()/g, '<span class="fn">$1</span>');
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

  // ---- 薄弱点 ----
  function renderWeak(kps) {
    const box = $('weakbox');
    box.innerHTML = '<span class="hint">标记你这次没弄懂的知识点（点击切换），下次讲解会重点复习：</span>';
    (Array.isArray(kps) ? kps : []).forEach((k) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = k;
      chip.onclick = () => {
        chip.classList.toggle('active');
        const weak = Array.from(box.querySelectorAll('.chip.active')).map((c) => c.textContent);
        if (current) api.markWeak(current.title, weak);
      };
      box.appendChild(chip);
    });
  }

  // ---- 主流程 ----
  async function boot() {
    cfg = await api.cfgLoad();
    const cur = await api.versionCurrent();
    $('curVer').textContent = 'V1.0.' + (cur || cfg.baseVersion || 1000);
    const av = window.teacher($('avatar'));
    av.start();
    initAudio();
    av.setAmpGetter(ampGetter);
    window.__teacher = av;
  }

  $('pickBtn').onclick = async () => {
    const p = await api.pickFile();
    if (!p) return;
    filePath = p;
    $('fname').textContent = p.split(/[\\/]/).pop();
    $('runBtn').disabled = false;
  };

  $('runBtn').onclick = async () => {
    if (!filePath) return;
    $('runBtn').disabled = true;
    $('runBtn').innerHTML = '<span class="spin"></span> 讲解中…';
    $('caption').textContent = '正在读取题目并生成讲解…';
    try {
      const res = await api.runTeach(cfg, filePath);
      if (!res || !res.ok) { toast('讲解失败：' + (res && res.error || '未知错误')); return; }
      await applyResult(res);
    } catch (e) {
      toast('讲解失败：' + e.message);
    } finally {
      $('runBtn').disabled = false;
      $('runBtn').textContent = '开始讲解';
    }
  };

  async function applyResult(res) {
    current = res;
    $('title1').textContent = res.title || '';
    $('kpoint').textContent = (res.knowledgePoints || []).slice(0, 2).map((k) => k).join('、') || '知识点';
    $('code').innerHTML = hl(stripFence(res.code)) || '<span class="empty">未生成代码</span>';
    $('solution').innerHTML = mdToHtml(res.solution) || '<span class="empty">未生成思路</span>';
    playlist = res.audio || [];
    renderTranscript();
    renderWeak(res.knowledgePoints || []);
    if (playlist.length) {
      loadSegment(0, true);
      toast('已生成 ' + res.teaching.length + ' 句讲解，共 ' + playlist.length + ' 段语音');
    } else {
      $('caption').textContent = res.teaching && res.teaching.join('\n') || '（未生成语音）';
      toast('已生成讲解，但没有语音');
    }
  }

  // ---- 播放控制 ----
  $('playBtn').onclick = () => audioEl.play().catch(() => toast('无法播放，请检查网络'));
  $('pauseBtn').onclick = () => audioEl.pause();
  $('prevBtn').onclick = () => loadSegment(index - 1, true);
  $('nextBtn').onclick = () => loadSegment(index + 1, true);
  $('rate').onchange = () => { audioEl.playbackRate = Number($('rate').value || 1); };

  audioEl.addEventListener('timeupdate', updateSpans);
  audioEl.addEventListener('ended', () => { if (autoSpeak && index < playlist.length - 1) loadSegment(index + 1, true); });

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
})();
