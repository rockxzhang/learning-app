// renderer/avatar.js - 数字人老师
// 若传入 imageUrl（一张 PNG/图片），就以图片显示并随语音轻微浮动/缩放；
// 否则显示内置 SVG 卡通老师（口型/身形随振幅驱动）。
(function () {
  const SVG = `
<svg viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#27324d"/><stop offset="1" stop-color="#151d30"/>
    </linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe0c4"/><stop offset="1" stop-color="#f7c09a"/>
    </linearGradient>
  </defs>
  <rect x="10" y="10" width="220" height="280" rx="28" fill="url(#bg)"/>
  <ellipse cx="120" cy="262" rx="70" ry="12" fill="#000" opacity=".18"/>
  <g id="tBody">
    <path d="M62 296 Q62 214 96 196 L144 196 Q178 214 178 296 Z" fill="#3a5a9c"/>
    <path d="M96 196 L120 236 L144 196 Z" fill="#fff"/>
    <path d="M120 236 L120 292" stroke="#c9d4e8" stroke-width="3"/>
    <path d="M120 236 L114 262 L120 292 L126 262 Z" fill="#d64545"/>
    <circle cx="120" cy="276" r="3" fill="#5a3550"/>
    <circle cx="120" cy="288" r="3" fill="#5a3550"/>
  </g>
  <g id="tArmL"><rect x="56" y="196" width="22" height="70" rx="11" fill="#3a5a9c"/><circle cx="67" cy="198" r="13" fill="#3a5a9c"/><circle cx="67" cy="200" r="10" fill="#ffe0c4"/></g>
  <g id="tArmR"><rect x="162" y="196" width="22" height="70" rx="11" fill="#3a5a9c"/><circle cx="173" cy="198" r="13" fill="#3a5a9c"/><circle cx="173" cy="200" r="10" fill="#ffe0c4"/></g>
  <rect x="108" y="168" width="24" height="22" rx="6" fill="#f7c09a"/>
  <g id="tHead">
    <path d="M70 108 Q70 38 120 38 Q170 38 170 108 L170 128 Q170 158 120 158 Q70 158 70 128 Z" fill="url(#skin)"/>
    <path d="M68 108 Q68 34 120 34 Q172 34 172 108 Q172 78 168 74 Q150 52 120 52 Q90 52 72 74 Q68 78 68 108 Z" fill="#4a3b52"/>
    <path d="M70 108 Q70 82 88 74 L88 108 Z" fill="#4a3b52"/>
    <path d="M170 108 Q170 82 152 74 L152 108 Z" fill="#4a3b52"/>
    <ellipse id="tEyeL" cx="102" cy="104" rx="6" ry="7.5" fill="#3a2b2b"/>
    <ellipse id="tEyeR" cx="138" cy="104" rx="6" ry="7.5" fill="#3a2b2b"/>
    <circle id="tPupL" cx="103" cy="105" r="2.2" fill="#fff"/>
    <circle id="tPupR" cx="139" cy="105" r="2.2" fill="#fff"/>
    <path id="tBrowL" d="M92 90 Q102 84 112 90" stroke="#4a3b52" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path id="tBrowR" d="M128 90 Q138 84 148 90" stroke="#4a3b52" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M120 108 L116 118 Q120 122 124 118 Z" fill="#e9af87"/>
    <circle cx="88" cy="120" r="7" fill="#f2a8a8" opacity=".55"/>
    <circle cx="152" cy="120" r="7" fill="#f2a8a8" opacity=".55"/>
    <g id="tMouth">
      <ellipse id="tMouthOpen" cx="120" cy="130" rx="15" ry="2" fill="#7c2f35"/>
      <path d="M100 129 Q120 142 140 129" stroke="#b45a62" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>
    <circle cx="102" cy="104" r="10.5" fill="none" stroke="#4a3b52" stroke-width="2.5"/>
    <circle cx="138" cy="104" r="10.5" fill="none" stroke="#4a3b52" stroke-width="2.5"/>
    <path d="M112 104 L128 104" stroke="#4a3b52" stroke-width="2.5"/>
  </g>
</svg>`;

  function create(container, imageUrl) {
    let getter = () => 0;
    let running = false, time = 0, amp = 0, targetAmp = 0;
    let imgEl = null, refs = {};

    if (imageUrl) {
      // 用自定义图片展示（随声音轻微浮动/缩放）
      imgEl = document.createElement('img');
      imgEl.src = imageUrl;
      imgEl.alt = '张老师';
      imgEl.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;will-change:transform;';
      container.appendChild(imgEl);
    } else {
      container.innerHTML = SVG;
      const el = (id) => document.getElementById(id);
      refs = {
        head: el('tHead'), body: el('tBody'), armL: el('tArmL'), armR: el('tArmR'),
        mouth: el('tMouth'), mouthOpen: el('tMouthOpen'),
        browL: el('tBrowL'), browR: el('tBrowR'), eyeL: el('tEyeL'), eyeR: el('tEyeR'),
      };
    }

    function loop() {
      if (!running) return;
      time += 0.016;
      const raw = Math.max(0, Math.min(1, getter()));
      targetAmp = raw;
      amp += (targetAmp - amp) * 0.25;
      if (amp < 0.015) amp = 0;

      if (imgEl) {
        // 图片老师：随声音轻微点头 + 缩放呼吸感（不做口型）
        const bob = Math.sin(time * 2.2) * 3 + amp * 6;
        const scale = 1 + amp * 0.05;
        imgEl.style.transform = 'translateY(' + bob.toFixed(1) + 'px) scale(' + scale.toFixed(3) + ')';
      } else {
        const open = amp * 10;
        const bob = Math.sin(time * 2.2) * 2 + amp * 3;
        const breathe = Math.sin(time * 1.3) * 2;
        const armSwing = Math.sin(time * 5) * (6 + amp * 16);
        const browRaise = amp * 5;
        refs.head.setAttribute('transform', 'translate(0,' + bob.toFixed(1) + ')');
        refs.body.setAttribute('transform', 'translate(0,' + breathe.toFixed(1) + ')');
        refs.armL.setAttribute('transform', 'rotate(' + (-armSwing).toFixed(1) + ' 67 198)');
        refs.armR.setAttribute('transform', 'rotate(' + armSwing.toFixed(1) + ' 173 198)');
        refs.browL.setAttribute('transform', 'translate(0,' + (-browRaise).toFixed(1) + ')');
        refs.browR.setAttribute('transform', 'translate(0,' + (-browRaise).toFixed(1) + ')');
        refs.mouthOpen.setAttribute('ry', (2 + open).toFixed(1));
        refs.mouthOpen.setAttribute('cy', (128 + open * 0.4).toFixed(1));
        refs.mouthOpen.setAttribute('opacity', (amp > 0.03 ? Math.min(1, amp * 1.6) : 0).toFixed(2));
        refs.mouth.setAttribute('opacity', (amp > 0.03 ? 0.85 : 1).toFixed(2));
        // 眨眼
        let blink = 0; const bt = time % 4;
        if (bt > 3.85 && bt < 4.0) blink = 1;
        refs.eyeL.setAttribute('ry', (7.5 * (1 - blink)).toFixed(1));
        refs.eyeR.setAttribute('ry', (7.5 * (1 - blink)).toFixed(1));
      }
      requestAnimationFrame(loop);
    }

    return {
      start() { if (!running) { running = true; requestAnimationFrame(loop); } },
      stop() { running = false; },
      setAmpGetter(fn) { getter = fn; },
      setMouth(m) { if (m) this.start(); else { amp = 0; } },
      reset() { amp = 0; targetAmp = 0; },
    };
  }

  window.teacher = create;   // window.teacher(container, imageUrl?)
})();
