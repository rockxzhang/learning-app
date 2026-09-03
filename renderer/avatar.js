// renderer/avatar.js - 张老师（静态一张图，站在讲台后，不做动画）
(function () {
  function asset(p) { return new URL('../build/teacher/' + p, location.href).href; }

  const SVG = `<svg viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="220" height="280" rx="26" fill="#27324d"/><ellipse cx="120" cy="92" rx="50" ry="54" fill="#ffe0c4"/><path d="M68 100 Q68 36 120 36 Q172 36 172 100 Q172 74 160 70 Q140 52 120 52 Q100 52 80 70 Q68 74 68 100 Z" fill="#4a3b52"/><ellipse cx="102" cy="100" rx="6" ry="7" fill="#2b2b2b"/><ellipse cx="138" cy="100" rx="6" ry="7" fill="#2b2b2b"/><path d="M104 128 Q120 140 136 128" stroke="#b45a62" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;

  function create(container, imageUrl) {
    container.classList.add('t-box');
    container.innerHTML =
      '<img class="t-pose" src="' + asset('pose_base.png') + '" alt="张老师">' +
      '<div class="t-podium"><span class="leg l"></span><span class="leg r"></span></div>';
    const poseEl = container.querySelector('.t-pose');
    const onErr = () => { container.innerHTML = SVG; };
    poseEl.addEventListener('error', onErr);
    // 静态：无动画接口/循环；兼容原 API 形态
    return { start() {}, stop() {}, setAmpGetter() {}, setMouth() {}, reset() {} };
  }

  window.teacher = create;
})();
