/* Hoạt ảnh đấu sĩ theo sprite sheet nhân vật của gói pháp sư (public/mage/anim/<id>-sheet.png + <id>.json).
   Mỗi hàng là một hoạt ảnh: idle, cast_start, cast_loop, release, guard, buff, hit, ko, release_sky, release_ground, release_spread. */
const SHEETS = {};
const COLS = 6;
const FALLBACK = {release_sky:'release', release_ground:'release', release_spread:'buff', guard:'release', buff:'release', cast_loop:'cast_start'};

// Đăng ký sheet của một nhân vật (gọi sau khi nạp gói pháp sư)
export function addSheet(id, meta, src){
  SHEETS[id] = {...meta, src, rows:Math.max(...Object.values(meta.anims).map(a => a.row)) + 1};
}
export const sheetOf = id => SHEETS[id];

// Tên hoạt ảnh có thật trong sheet (thiếu thì lấy hoạt ảnh gần giống)
function has(m, name){
  while (name && (!m.anims[name] || m.anims[name].missing || !m.anims[name].frames)) name = FALLBACK[name];
  return name || 'idle';
}
// CSS cho 1 khung của sheet, dùng làm nền cho phần tử vuông
export function frameStyle(m, name, k = 0){
  const a = m.anims[has(m, name)], col = Math.min(k, a.frames - 1);
  return `background-image:url(${m.src});background-size:${COLS * 100}% ${m.rows * 100}%;` +
    `background-position:${col / (COLS - 1) * 100}% ${a.row / (m.rows - 1) * 100}%`;
}

// Bộ điều khiển hoạt ảnh của một đấu sĩ
export function makeAnimator(m){
  return {m, name:'idle', t:0, once:null};
}
// Chạy một hoạt ảnh một lần (trúng đòn, phóng phép...) rồi quay về trạng thái nền
export function play(A, name){
  if (!A || A.name === 'ko') return;
  A.once = has(A.m, name); A.name = A.once; A.t = 0;
}
// base: hoạt ảnh nền theo trạng thái trận ('idle' | 'cast' | 'ko'); castT: thời gian đã niệm
export function tick(A, dt, base, castT = 0){
  const m = A.m;
  if (base === 'ko') { if (A.name !== 'ko') { A.name = 'ko'; A.t = 0; A.once = null; } }
  else if (A.once) {
    const a = m.anims[A.once];
    if (A.t + dt >= a.frames / a.fps + (a.hold ? .25 : 0)) { A.once = null; A.name = ''; }
  }
  if (base !== 'ko' && !A.once) {
    if (base === 'cast') {
      const s = m.anims[has(m, 'cast_start')], startDur = s.frames / s.fps;
      const name = castT < startDur ? 'cast_start' : 'cast_loop';
      if (A.name !== name) { A.name = name; A.t = name === 'cast_start' ? castT : castT - startDur; }
    } else if (A.name !== 'idle') { A.name = 'idle'; A.t = 0; }
  }
  A.t += dt;
  const a = m.anims[has(m, A.name)];
  let k = Math.floor(A.t * a.fps);
  k = a.loop ? k % a.frames : Math.min(k, a.frames - 1);
  return frameStyle(m, A.name, k);
}
