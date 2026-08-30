// renderer/avatar.js - 2D 数字教师：SVG 形象 + WebAudio 振幅驱动口型/身形
(function () {
  const SVG = `
<svg viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#23304d"/><stop offset="1" stop-color="#151d30"/>
    </linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd9b8"/><stop offset="1" stop-color="#f7c09a"/>
    </linearGradient>
  </defs>
  <rect x="10" y="10" width="220" height="280" rx="26" fill="url(#bg)"/>
  <ellipse cx="120" cy="262" rx="70" ry="12" fill="#000" opacity=".18"/>

  <!-- BODY -->
  <g id="tBody">
    <path d="M62 296 Q62 214 96 196 L144 196 Q178 214 178 296 Z" fill="#3a5a9c"/>
    <path d="M96 196 L120 236 L144 196 Z" fill="#fff"/>
    <path d="M120 236 L120 292" stroke="#c9d4e8" stroke-width="3"/>
    <path d="M120 236 L114 262 L120 292 L126 262 Z" fill="#d64545"/>
    <circle cx="120" cy="276" r="3" fill="#5a3550"/>
    <circle cx="120" cy="288" r="3" fill="#5a3550"/>
  </g>

  <!-- ARMS -->
  <g id="tArmL"><rect x="56" y="196" width="22" height="70" rx="11" fill="#3a5a9c"/><circle cx="67" cy="198" r="13" fill="#3a5a9c"/><circle cx="67" cy="200" r="10" fill="#ffd9b8"/></g>
  <g id="tArmR"><rect x="162" y="196" width="22" height="70" rx="11" fill="#3a5a9c"/><circle cx="173" cy="198" r="13" fill="#3a5a9c"/><circle cx="173" cy="200" r="10" fill="#ffd9b8"/></g>

  <!-- NECK -->
  <rect x="108" y="168" width="24" height="22" rx="6" fill="#f7c09a"/>

  <!-- HEAD -->
  <g id="tHead">
    <path d="M70 108 Q70 38 120 38 Q170 38 170 108 L170 128 Q170 158 120 158 Q70 158 70 128 Z" fill="url(#skin)"/>
    <path d="M68 108 Q68 34 120 34 Q172 34 172 108 Q172 78 168 74 Q150 52 120 52 Q90 52 72 74 Q68 78 68 108 Z" fill="#2b2b3a"/>
    <path d="M70 108 Q70 82 88 74 L88 108 Z" fill="#2b2b3a"/>
    <path d="M170 108 Q170 82 152 74 L152 108 Z" fill="#2b2b3a"/>
    <!-- eyes -->
    <ellipse id="tEyeL" cx="102" cy="104" rx="6" ry="7.5" fill="#3a2b2b"/>
    <ellipse id="tEyeR" cx="138" cy="104" rx="6" ry="7.5" fill="#3a2b2b"/>
    <circle id="tPupL" cx="103" cy="105" r="2.2" fill="#fff"/>
    <circle id="tPupR" cx="139" cy="105" r="2.2" fill="#fff"/>
    <!-- brows -->
    <path id="tBrowL" d="M92 90 Q102 84 112 90" stroke="#2b2b3a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path id="tBrowR" d="M128 90 Q138 84 148 90" stroke="#2b2b3a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <!-- nose -->
    <path d="M120 108 L116 118 Q120 122 124 118 Z" fill="#e9af87"/>
    <!-- cheeks -->
    <circle cx="88" cy="120" r="7" fill="#f0a0a0" opacity=".5"/>
    <circle cx="152" cy="120" r="7" fill="#f0a0a0" opacity=".5"/>
    <!-- mouth -->
    <g id="tMouth">
      <ellipse id="tMouthOpen" cx="120" cy="130" rx="15" ry="2" fill="#7c2f35"/>
      <path d="M102 128 Q120 140 138 128" stroke="#a84a52" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>
    <!-- glasses -->
    <circle cx="102" cy="104" r="10.5" fill="none" stroke="#2b2b3a" stroke-width="2.5"/>
    <circle cx="138" cy="104" r="10.5" fill="none" stroke="#2b2b3a" stroke-width="2.5"/>
    <path d="M112 104 L128 104" stroke="#2b2b3a" stroke-width="2.5"/>
  </g>
</svg>`;

  function create(container) {
    container.innerHTML = SVG;
    const el = (id) => document.getElementById(id);
    const head = el('tHead'), body = el('tBody'), armL = el('tArmL'), armR = el('tArmR');
    const mouth = el('tMouth'), mouthOpen = el('tMouthOpen');
    const browL = el('tBrowL'), browR = el('tBrowR'), eyeL = el('tEyeL'), eyeR = el('tEyeR');

    let amp = 0;        // 平滑后的振幅 [0,1]
    let targetAmp = 0;
    let time = 0;
    let running = false;
    let getter = () => 0;
    let blinkTimer = 0, blink = 0;

    function loop() {
      if (!running) return;
      time += 0.016;
      // 平滑振幅
      const raw = Math.max(0, Math.min(1, getter()));
      targetAmp = raw;
      amp += (targetAmp - amp) * 0.25;
      if (amp < 0.015) amp = 0;

      const open = amp * 10;      // 口张合
      const bob = Math.sin(time * 2.2) * 2 + amp * 3;
      const breathe = Math.sin(time * 1.3) * 2;
      const armSwing = Math.sin(time * 5) * (6 + amp * 16);
      const browRaise = amp * 5;

      head.setAttribute('transform', 'translate(0,' + bob.toFixed(1) + ')');
      body.setAttribute('transform', 'translate(0,' + breathe.toFixed(1) + ')');
      armL.setAttribute('transform', 'rotate(' + (-armSwing).toFixed(1) + ' 67 198)');
      armR.setAttribute('transform', 'rotate(' + armSwing.toFixed(1) + ' 173 198)');
      browL.setAttribute('transform', 'translate(0,' + (-browRaise).toFixed(1) + ')');
      browR.setAttribute('transform', 'translate(0,' + (-browRaise).toFixed(1) + ')');

      // 口型：闭合微笑始终可见；开口椭圆随音量升高
      mouthOpen.setAttribute('ry', (2 + open).toFixed(1));
      mouthOpen.setAttribute('cy', (128 + open * 0.4).toFixed(1));
      mouthOpen.setAttribute('opacity', (amp > 0.03 ? Math.min(1, amp * 1.6) : 0).toFixed(2));
      mouth.setAttribute('opacity', (amp > 0.03 ? 0.85 : 1).toFixed(2));

      // 眨眼
      blinkTimer += 0.016;
      if (blinkTimer > 4) { blink = 1; if (blinkTimer > 4.18) { blink = 0; blinkTimer = 0; } }
      const eyeRy = 7.5 * (1 - blink);
      eyeL.setAttribute('ry', eyeRy.toFixed(1));
      eyeR.setAttribute('ry', eyeRy.toFixed(1));

      requestAnimationFrame(loop);
    }

    return {
      start() { if (!running) { running = true; requestAnimationFrame(loop); } },
      stop() { running = false; },
      setAmpGetter(fn) { getter = fn; },
      setMouth(m) { if (m) this.start(); else { amp = 0; } },  // 交互辅助
      reset() { amp = 0; targetAmp = 0; },
    };
  }

  window.teacher = create;   // window.teacher(container) 返回实例
})();
