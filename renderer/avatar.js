// renderer/avatar.js - 张老师动画：教室讲台场景 + 姿态切换(肢体语言) + 脸部小口型(随声音开合)
(function () {
  const POSES = ['base', 'holding_book', 'reading_book', 'speaking_gesture', 'welcoming', 'writing_board', 'pointing_right'];
  const LIPS = ['closed', 'mm', 'oo', 'ee', 'ah'];   // 由闭到张

  function asset(p) { return new URL('../build/teacher/' + p, location.href).href; }

  // 兜底：若无动画素材，显示内置 SVG 卡通
  const SVG = `<svg viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="220" height="280" rx="26" fill="#27324d"/><g id="tHead"><ellipse cx="120" cy="92" rx="50" ry="54" fill="#ffe0c4"/><path d="M68 100 Q68 36 120 36 Q172 36 172 100 Q172 74 160 70 Q140 52 120 52 Q100 52 80 70 Q68 74 68 100 Z" fill="#4a3b52"/><ellipse cx="102" cy="100" rx="6" ry="7" fill="#2b2b2b"/><ellipse cx="138" cy="100" rx="6" ry="7" fill="#2b2b2b"/><path d="M104 128 Q120 140 136 128" stroke="#b45a62" stroke-width="5" fill="none" stroke-linecap="round"/></g><rect x="95" y="150" width="50" height="130" rx="16" fill="#3a5a9c"/></svg>`;

  function create(container, imageUrl) {
    let getter = () => 0, running = false, time = 0, amp = 0, targetAmp = 0;
    let poseEl = null, mouthEl = null, poseIdx = 0, poseTimer = 0, usingAnim = false;

    container.classList.add('t-box');
    container.innerHTML =
      '<img class="t-pose" src="' + asset('pose_base.png') + '" alt="张老师">' +
      '<svg class="t-mouth" width="30" height="16" viewBox="0 0 30 16"><ellipse cx="15" cy="8" rx="9" ry="1.8" fill="#a04350"/></svg>' +
      '<div class="t-podium"><span class="leg l"></span><span class="leg r"></span></div>';
    poseEl = container.querySelector('.t-pose');
    mouthEl = container.querySelector('.t-mouth ellipse');

    const onErr = () => { container.innerHTML = SVG; usingAnim = false; };
    poseEl.addEventListener('error', onErr);
    poseEl.addEventListener('load', () => { usingAnim = true; });

    function loop() {
      if (!running) return;
      time += 0.016;
      const raw = Math.max(0, Math.min(1, getter()));
      targetAmp = raw; amp += (targetAmp - amp) * 0.25; if (amp < 0.015) amp = 0;

      if (usingAnim) {
        // 口型：音量越大嘴越张（椭圆 ry 增大）
        mouthEl.setAttribute('ry', (1.8 + amp * 4.6).toFixed(1));
        mouthEl.setAttribute('opacity', amp > 0.03 ? '1' : '0.6');
        // 肢体语言：讲课时每隔不久切换一个姿态
        poseTimer += 0.016;
        if (poseTimer > 3.4 && amp > 0.04) { poseTimer = 0; poseIdx = (poseIdx + 1) % POSES.length; poseEl.src = asset('pose_' + POSES[poseIdx] + '.png'); }
        // 轻微点头（保留水平居中）
        poseEl.style.transform = 'translateX(-50%) translateY(' + (Math.sin(time * 2.2) * 3 + amp * 4).toFixed(1) + 'px)';
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

  window.teacher = create;   // window.teacher(container)
})();
