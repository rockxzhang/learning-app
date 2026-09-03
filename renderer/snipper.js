// renderer/snipper.js - 覆盖层区域截图：拖选 + 绿√确认 / 红✕取消
const { ipcRenderer } = require('electron');

const qs = new URLSearchParams(location.search);
const bg = document.getElementById('bg');
bg.src = decodeURIComponent(qs.get('data') || '');

const sel = document.getElementById('sel');
const actions = document.getElementById('actions');
const okBtn = document.getElementById('okBtn');
const cancelBtn = document.getElementById('cancelBtn');

const W = window.innerWidth, H = window.innerHeight;
let startX = 0, startY = 0, sx = 0, sy = 0, sw = 0, sh = 0, selecting = false;

window.addEventListener('mousedown', (e) => {
  if (e.target === okBtn || e.target === cancelBtn) return;
  selecting = true;
  startX = e.clientX; startY = e.clientY;
  sel.style.display = 'block';
  actions.style.display = 'none';
});
window.addEventListener('mousemove', (e) => {
  if (!selecting) return;
  sx = Math.min(startX, e.clientX);
  sy = Math.min(startY, e.clientY);
  sw = Math.abs(e.clientX - startX);
  sh = Math.abs(e.clientY - startY);
  sel.style.left = sx + 'px'; sel.style.top = sy + 'px';
  sel.style.width = sw + 'px'; sel.style.height = sh + 'px';
});
window.addEventListener('mouseup', () => {
  if (!selecting) return;
  selecting = false;
  if (sw < 12 || sh < 12) { sel.style.display = 'none'; return; }
  showActions();
});

function showActions() {
  actions.style.display = 'flex';
  let ax = sx + sw + 10, ay = sy;
  if (ax + 130 > W) ax = sx - 130 - 10;
  if (ay + 60 > H) ay = sy + sh - 60;
  if (ay < 0) ay = 0;
  actions.style.left = ax + 'px';
  actions.style.top = ay + 'px';
}

okBtn.addEventListener('click', () => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    const ratioX = img.naturalWidth / W;
    const ratioY = img.naturalHeight / H;
    const x = Math.max(0, Math.round(sx * ratioX));
    const y = Math.max(0, Math.round(sy * ratioY));
    const w = Math.min(img.naturalWidth - x, Math.round(sw * ratioX));
    const h = Math.min(img.naturalHeight - y, Math.round(sh * ratioY));
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    ipcRenderer.send('shot:crop', c.toDataURL('image/png'));
  };
  img.src = bg.src;
});
cancelBtn.addEventListener('click', () => ipcRenderer.send('shot:cancel'));
// 按 ESC 取消截屏
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') ipcRenderer.send('shot:cancel'); });
