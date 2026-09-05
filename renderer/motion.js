// renderer/motion.js - Apple 风格动效：Aurora 背景 / 磁力按钮 / 主题(浅色/深色/自动22点-7点)
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);

  // ---- 主题管理器：light / dark / auto(22点夜, 7点日) ----
  const THEME_KEY = 'zsj_theme';
  function isNight() { const h = new Date().getHours(); return h >= 22 || h < 7; }
  function applyTheme() {
    const mode = localStorage.getItem(THEME_KEY) || 'auto';
    const dark = mode === 'dark' || (mode === 'auto' && isNight());
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const btn = $('#themeBtn');
    if (btn) {
      const icon = mode === 'auto' ? '🕐' : (dark ? '🌙' : '☀️');
      btn.textContent = icon;
      btn.title = '主题：' + ({ light: '浅色', dark: '深色', auto: '自动(22点夜/7点日)' }[mode] || 'auto') + '（点击切换）';
    }
  }
  function cycleTheme() {
    const cur = localStorage.getItem(THEME_KEY) || 'auto';
    const next = cur === 'auto' ? 'light' : (cur === 'light' ? 'dark' : 'auto');
    localStorage.setItem(THEME_KEY, next);
    applyTheme();
  }
  document.addEventListener('DOMContentLoaded', function () {
    const btn = $('#themeBtn');
    if (btn) btn.addEventListener('click', cycleTheme);
    applyTheme();
    setInterval(applyTheme, 60000);   // 自动模式每分钟检查一次，跨 22:00 / 7:00 自动切换
  });

  // ---- Aurora 背景画布（多色模糊光斑缓慢漂移，夜/日亮度自适应） ----
  const canvas = document.getElementById('aura');
  if (canvas && !reduce) {
    const ctx = canvas.getContext('2d');
    let w, h;
    function size() { w = canvas.width = canvas.offsetWidth * devicePixelRatio; h = canvas.height = canvas.offsetHeight * devicePixelRatio; }
    size(); window.addEventListener('resize', size);
    const blobs = [
      { c: 'rgba(0,122,255,.18)', x: .2, y: .22, r: .55, vx: .00012, vy: .00009 },
      { c: 'rgba(94,92,230,.15)', x: .8, y: .18, r: .5, vx: -.00010, vy: .00008 },
      { c: 'rgba(52,199,89,.11)', x: .5, y: .9, r: .6, vx: .00008, vy: -.00012 },
      { c: 'rgba(255,149,0,.09)', x: .1, y: .7, r: .45, vx: .00011, vy: -.00007 },
    ];
    let frame = 0;
    (function loop() {
      frame++;
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
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

  // ---- 磁力按钮：按钮被光标轻微吸引并回弹 ----
  if (!reduce) {
    document.addEventListener('DOMContentLoaded', function () {
      document.querySelectorAll('.btn').forEach(function (btn) {
        btn.addEventListener('mousemove', function (e) {
          const r = btn.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          btn.style.transform = 'translate(' + (dx * 0.18) + 'px,' + (dy * 0.18 + -2) + 'px) scale(1.05)';
        });
        btn.addEventListener('mouseleave', function () { btn.style.transform = ''; });
      });
    });
  }
})();
