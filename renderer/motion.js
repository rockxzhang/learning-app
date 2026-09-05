// renderer/motion.js - Apple 风格动效：Aurora 背景 / 磁力按钮
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Aurora 背景画布（reactbits Aurora 思想：多色模糊光斑缓慢漂移） ----
  const canvas = document.getElementById('aura');
  if (canvas && !reduce) {
    const ctx = canvas.getContext('2d');
    let w, h;
    function size() { w = canvas.width = canvas.offsetWidth * devicePixelRatio; h = canvas.height = canvas.offsetHeight * devicePixelRatio; }
    size(); window.addEventListener('resize', size);
    const blobs = [
      { c: 'rgba(0,122,255,.16)', x: .2, y: .22, r: .55, vx: .00012, vy: .00009 },
      { c: 'rgba(94,92,230,.13)', x: .8, y: .18, r: .5, vx: -.00010, vy: .00008 },
      { c: 'rgba(52,199,89,.10)', x: .5, y: .9, r: .6, vx: .00008, vy: -.00012 },
      { c: 'rgba(255,149,0,.08)', x: .1, y: .7, r: .45, vx: .00011, vy: -.00007 },
    ];
    const g = () => ctx.createRadialGradient;
    let frame = 0;
    (function loop() {
      frame++;
      ctx.clearRect(0, 0, w, h);
      for (const b of blobs) {
        b.x += b.vx; b.y += b.vy;
        if (b.x < -0.2) b.x = 1.2; if (b.x > 1.2) b.x = -0.2;
        if (b.y < -0.2) b.y = 1.2; if (b.y > 1.2) b.y = -0.2;
        const cx = (b.x + Math.sin(frame * 0.001 + b.r * 10) * 0.03) * w;
        const cy = (b.y + Math.cos(frame * 0.0013 + b.r * 7) * 0.03) * h;
        const rad = b.r * Math.max(w, h);
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        rg.addColorStop(0, b.c);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }
      requestAnimationFrame(loop);
    })();
  }

  // ---- 卡片入场 ----
  if (!reduce) {
    document.addEventListener('DOMContentLoaded', function () {
      const panel = document.querySelector('.panel');
      if (panel) { panel.style.setProperty('animation-delay', '0s'); }
    });
  }
})();
