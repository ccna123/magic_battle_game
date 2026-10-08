/* Vẽ phép từ sheet phép (8 cột × 12 hàng, khung 192×192) lên canvas phủ sân đấu.
   Toạ độ "gốc" theo quy ước của gói: chân nhân vật / mặt đất ở y = 180 trong khung, nhân vật quay phải.
   Mỗi hiệu ứng neo vào một đấu sĩ (i) và được phóng theo cỡ đấu sĩ trên màn hình (k = bề rộng hình / 192).
   Phép của bên phải (máy) được lật ngang. Logic bay chép từ spell-player.js, spell-player-v2.js và reference/xuong-sprite.html của gói. */
import { MAGES } from './mages.js';

export const FW = 192, BASE = 180, SKY_TOP = 285, SKY_PRE = .32;
let ents = [];
export const fxClear = () => { ents = []; };
export const fxAdd = e => { ents.push(Object.assign({f:0, t:0, delay:0, done:false}, e)); return ents[ents.length - 1]; };

// Đường bay riêng của đạn (u: 0 → 1 từ tay tới mục tiêu), trả về độ lệch y (px gốc, âm là lên trên)
function pathDy(m, u, handY){
  if (m.path === 'bounce') return (BASE - 28 - Math.abs(Math.sin(u * Math.PI * (m.hops || 2.5))) * 70 * (1 - u * .4)) - handY;
  if (m.path === 'swoop') return -Math.sin(u * Math.PI) * (m.arc || 110) + u * 30;
  if (m.path === 'zigzag') return Math.sin(u * Math.PI * 2 * (m.waves || 3)) * (m.amp || 40) * (1 - u * .5);
  return 0;
}

export function fxUpdate(dt, now){
  for (const e of ents) {
    if (e.delay > 0) { e.delay -= dt; continue; }
    if (e.kind === 'bolt') {
      if (e.phase === 'fly') { e.t += dt; if (e.p.gone) { e.phase = 'impact'; e.f = 4; e.t = 0; } continue; }
      e.t += dt; const step = 1 / e.fps;
      while (e.t >= step) { e.t -= step; if (++e.f > 7) { e.done = true; break; } }
      continue;
    }
    if (e.kind === 'zap') { e.t += dt; if (e.t > .16) e.done = true; continue; }
    if (e.kind === 'v2') { updateV2(e, dt, now); continue; }
    const m = e.sp.meta;
    if (m.skyMode === 'fall' && (e.pre || 0) < SKY_PRE && e.sp.kind === 'sky' && !e.sp.summon) { e.pre = (e.pre || 0) + dt; continue; }
    e.t += dt; const step = 1 / e.fps;
    while (e.t >= step) {
      e.t -= step; e.f++;
      // Đứng giữ (tường đá, giáp): lặp các khung giữa cho tới khi hết hạn
      if (e.hold && e.f > e.hold.to && now() < e.hold.until()) e.f = e.hold.from;
      if (e.f > 7) { e.done = true; break; }
    }
  }
  ents = ents.filter(e => !e.done);
}

// G[i] = {x, g, k, face}: tâm ngang, mặt đất, tỉ lệ, hướng mặt (1 phải, -1 trái) của đấu sĩ i trên canvas
export function fxDraw(g, G){
  g.imageSmoothingEnabled = false;
  for (const e of ents) {
    if (e.delay > 0) continue;
    const M = MAGES[e.sp.mage], img = M && M.spellImg; if (!img && e.kind !== 'zap') continue;
    if (e.kind === 'zap') { drawZap(g, e, G); continue; }
    if (e.kind === 'v2') { drawV2(g, e, G, img, M); continue; }
    if (e.kind === 'bolt') { drawBolt(g, e, G, img, M); continue; }
    if (e.beam) { drawBeam(g, e, G, img, M); continue; }
    drawArea(g, e, G, img);
  }
}

function handOf(i, G){
  const s = G[i], M = MAGES[s.mage], [hx, hy] = M ? M.hand : [150, 104];
  return {x:s.x + (hx - FW / 2) * s.k * s.face, y:s.g + (hy - BASE) * s.k, hy};
}

function drawBolt(g, e, G, img){
  const m = e.sp.meta, k = G[e.p.from].k, row = m.row * FW;
  let x, y, face;
  if (e.phase === 'fly' || !e.p.hitTarget) {
    const p = e.p, a = handOf(p.from, G), tgt = G[p.to], f = G[p.from].face;
    const x0 = a.x + 26 * k * f, x1 = tgt.x - 30 * k * f, u = Math.min(1, p.k);
    x = x0 + (x1 - x0) * u; y = a.y + ((e.dy || 0) + pathDy(m, u, a.hy)) * k; face = f;
    const fi = e.phase === 'fly' ? Math.floor(e.t * e.fps) % 4 : Math.min(e.f, 7);   // bị chặn giữa đường thì nổ tại chỗ
    blit(g, img, fi * FW, row, x, y - FW / 2 * k, k, face, 'center');
  } else {                                                                             // trúng đích: nổ ở người trúng
    const f = G[e.p.from].face, tgt = G[e.p.to], bottom = m.impactAnchor === 'bottom';
    x = tgt.x - 10 * k * f;
    if (bottom) blit(g, img, Math.min(e.f, 7) * FW, row, x, tgt.g, k, f, 'bottom');
    else { const a = handOf(e.p.from, G); blit(g, img, Math.min(e.f, 7) * FW, row, x, a.y - FW / 2 * k, k, f, 'center'); }
  }
}
// Vẽ 1 khung: anchor 'bottom' → (x, y) là điểm giữa đáy (y = mặt đất); 'center' → (x, y) là đỉnh trên của khung căn giữa
function blit(g, img, sx, sy, x, y, k, face, anchor, ox = 0){
  g.save(); g.translate(x, anchor === 'bottom' ? y : y + FW / 2 * k); g.scale(k * face, k);
  g.drawImage(img, sx, sy, FW, FW, -FW / 2 + ox, anchor === 'bottom' ? -BASE : -FW / 2, FW, FW);
  g.restore();
}

function drawBeam(g, e, G, img){
  const m = e.sp.meta, a = handOf(e.from, G), s = G[e.from], tgt = G[e.to], k = s.k, face = s.face;
  const fi = Math.min(e.f, 7), sx = fi * FW, sy = m.row * FW, len = Math.abs((tgt.x - 14 * k * face) - a.x) / k;
  g.save(); g.translate(a.x - 4 * k * face, a.y); g.scale(k * face, k);
  const bh = (m.beamHead || [])[fi];
  if (bh) {
    const [L, S2, R] = bh, head = R - S2, body = Math.max(1, len - head);
    g.drawImage(img, sx + L, sy, S2 - L, FW, 0, -FW / 2, body, FW);
    g.drawImage(img, sx + S2, sy, head, FW, body, -FW / 2, head, FW);
  } else for (let x = 0; x < len; x += FW) { const w = Math.min(FW, len - x); g.drawImage(img, sx, sy, w, FW, x, -FW / 2, w, FW); }
  g.restore();
}

function drawArea(g, e, G, img){
  const m = e.sp.meta, a = G[e.i], c = G[e.from], k = a.k, face = c.face;
  const fi = Math.min(e.f, 7), sx = fi * FW, sy = m.row * FW, ox = m.offsetX || 0;
  const x = a.x + (e.dx || 0) * k * face + (e.ddx || 0) * k, ground = a.g;
  g.save(); g.translate(x, ground); g.scale(k * face, k);
  // Toạ độ gốc: x = 0 là điểm neo, y = 0 là mặt đất. Khung neo đáy: đỉnh khung ở y = −180; neo giữa: tâm khung cao e.cy
  const X = -FW / 2 + ox, Y0 = e.center ? -(e.cy || 92) - FW / 2 : -BASE;
  if (e.tint) { g.globalAlpha = .85; }
  if (e.sky === 'pour') {
    const top = m.top || 0, need = Math.max(0, SKY_TOP - (180 - top)), strip = 24;
    g.drawImage(img, sx, sy, FW, FW, X, Y0, FW, FW);
    for (let d = 0; d < need; d += strip) { const h = Math.min(strip, need - d); g.globalAlpha = 1 - .55 * d / need; g.drawImage(img, sx, sy + top + strip - h, FW, h, X, Y0 + top - d - h, FW, h); }
  } else if (e.sky === 'cloud') {
    const top = Math.max(0, m.top || 0), H = 180 - top, lift = Math.max(40, SKY_TOP - H), band = m.band || Math.round(H * .5), foot = Math.max(150, top + band + 4);
    g.drawImage(img, sx, sy + top, FW, band, X, Y0 + top - lift, FW, band);
    const m0 = top + band, mh = Math.max(1, foot - m0);
    g.drawImage(img, sx, sy + m0, FW, mh, X, Y0 + m0 - lift, FW, mh + lift);
    g.drawImage(img, sx, sy + foot, FW, FW - foot, X, Y0 + foot, FW, FW - foot);
  } else {
    let lift = 0;
    if (e.sky === 'fall') {
      const lift0 = Math.max(70, SKY_TOP - (180 - (m.top || 0))), land = (m.landFrame || 2) / e.fps;
      const p = Math.min(1, ((e.pre || 0) + (e.f + e.t * e.fps) / e.fps) / (SKY_PRE + land));
      lift = lift0 * Math.pow(1 - p, 1.5);
    }
    g.drawImage(img, sx, sy, FW, FW, X - lift * (m.dir || 0), Y0 - lift, FW, FW);
  }
  g.restore();
}

function drawZap(g, e, G){
  const k = G[e.from].k, x0 = e.x0(G), y0 = e.y0(G), x1 = G[e.to].x, y1 = G[e.to].g - 90 * k;
  g.save(); g.strokeStyle = e.color; g.lineWidth = 3 * k; g.shadowColor = e.color; g.shadowBlur = 12; g.globalAlpha = 1 - e.t / .16;
  g.beginPath(); g.moveTo(x0, y0);
  for (let i = 1; i < 7; i++) { const u = i / 7; g.lineTo(x0 + (x1 - x0) * u + (Math.random() - .5) * 18 * k, y0 + (y1 - y0) * u + (Math.random() - .5) * 18 * k); }
  g.lineTo(x1, y1); g.stroke(); g.restore();
}

/* ---------- Định dạng v2: bộ phép riêng (chép logic FxV2 của spell-player-v2.js) ----------
   e.mode: shot (đạn đi theo nhịp sát thương p) · boom (hồi toàn) · lob (ném vòng cung) · beam (tia) · spot (đứng một chỗ: giáng, trồi,
   ấn, tháp, vùng, bản thân...). Vị trí tính theo px gốc so với chân đấu sĩ, nhân hướng mặt của người niệm. */
// Điểm xuất phát của phép v2 so với chân người niệm: tay ở khung release, đầu, hoặc mặt đất trước mặt
export function originV2(sp){
  const m = sp.mech, M = MAGES[sp.mage];
  if (m.origin === 'head') { const h = sp.meta.headPt || M.head; return [h[0] - FW / 2, h[1] - BASE]; }
  if (m.origin === 'ground') return [70, -84];
  const h = sp.meta.hand || [150, 104]; return [h[0] - FW / 2, h[1] - BASE];
}
const ptOf = (G, i, cf, dx, dy) => ({x:G[i].x + dx * G[i].k * cf, y:G[i].g + dy * G[i].k});
function center(g, img, sx, sy, x, y, k, face, alpha = 1){
  if (sy < 0) return;
  g.save(); g.globalAlpha = alpha; g.translate(x, y); g.scale(k * face, k); g.drawImage(img, sx, sy, FW, FW, -FW / 2, -FW / 2, FW, FW); g.restore();
}
function updateV2(e, dt, now){
  if (e.delay > 0) { e.delay -= dt; return; }
  e.age = (e.age || 0) + dt; e.t += dt;
  const step = 1 / e.fps, loop4 = () => { while (e.t >= step) { e.t -= step; e.f = (e.f + 1) % 4; } };
  const play = (to = 7) => { while (e.t >= step) { e.t -= step; e.f++;
    if (e.hold && e.f > e.hold.to && now() < e.hold.until()) e.f = e.hold.from;
    if (e.f > to) { e.done = true; break; } } };
  if (e.mode === 'shot') { if (e.phase === 'fly') { loop4(); if (e.p.gone) { e.phase = 'impact'; e.f = e.sp.mech.impact || 4; e.t = 0; } } else play(); return; }
  if (e.mode === 'boom') { loop4(); if (e.age >= 2 * e.T * e.passes) e.done = true; return; }
  if (e.mode === 'lob') { if (e.phase === 'fly') { loop4(); if (e.age >= e.flight) { e.phase = 'impact'; e.f = e.sp.mech.impact || 4; e.t = 0; } } else play(); return; }
  play();
}
function drawV2(g, e, G, img, M){
  if (e.delay > 0) return;
  const c = G[e.from], t = G[e.to], k = c.k, cf = c.face, fi = Math.min(e.f, 7), sx = fi * FW, sy = (e.row ?? e.sp.meta.row) * FW, m = e.sp.mech;
  const O = e.o ? ptOf(G, e.o.i, cf, e.o.dx, e.o.dy) : null;
  if (e.mode === 'shot') {
    const x0 = O.x + 26 * k * cf, x1 = t.x - 30 * k * cf, u = Math.min(1, e.p.k);
    if (e.phase === 'impact' && e.p.hitTarget) return center(g, img, sx, sy, t.x - 10 * k * cf, O.y + (e.dy || 0) * k, k, cf);
    let y = O.y + (e.dy || 0) * k;
    if (m.type === 'wave') y += Math.sin(u * Math.PI * 2 * (m.waves || 2)) * (m.amp || 30) * k;
    return center(g, img, sx, sy, x0 + (x1 - x0) * u, y, k, cf);
  }
  if (e.mode === 'boom') {
    const x0 = O.x + 20 * k * cf, x1 = t.x - 20 * k * cf, cyc = e.age / e.T, back = Math.floor(cyc) % 2 === 1, u = back ? 1 - (cyc % 1) : cyc % 1;
    return center(g, img, sx, sy, x0 + (x1 - x0) * u, O.y, k, back && m.controlled ? -cf : cf);
  }
  if (e.mode === 'lob') {
    const u = Math.min(1, e.age / e.flight), x1 = t.x - 6 * k * cf, y1 = t.g - 70 * k;
    return center(g, img, sx, sy, O.x + (x1 - O.x) * u, O.y + (y1 - O.y) * u - Math.sin(u * Math.PI) * (m.arc || 140) * k, k, cf);
  }
  if (e.mode === 'beam') {
    const x0 = O.x + (m.origin === 'head' ? 8 : -4) * k * cf, len = Math.abs((t.x - 14 * k * cf) - x0) / k, bh = (e.sp.meta.beamHead || [])[fi];
    g.save(); g.translate(x0, O.y); g.scale(k * cf, k);
    if (bh) { const [L, S2, R] = bh, head = R - S2, body = Math.max(1, len - head);
      g.drawImage(img, sx + L, sy, S2 - L, FW, 0, -FW / 2, body, FW); g.drawImage(img, sx + S2, sy, head, FW, body, -FW / 2, head, FW); }
    else for (let x = 0; x < len; x += FW) { const w = Math.min(FW, len - x); g.drawImage(img, sx, sy, w, FW, x, -FW / 2, w, FW); }
    g.restore();
    if (e.sp.meta.row2 != null) center(g, img, sx, e.sp.meta.row2 * FW, O.x, O.y, k, cf);     // con mắt Horus ở điểm xuất phát
    return;
  }
  // spot: neo vào đấu sĩ e.i, lệch e.dx theo hướng người niệm, cao e.dy so với mặt đất
  let dx = e.dx || 0;
  if (e.move) dx = Math.min(Math.abs(t.x - c.x) / k - 10, 90 + e.speed * (e.age || 0));      // lốc cát tiến dần về phía địch
  const p = ptOf(G, e.i, cf, dx, e.dy || 0);
  let lift = 0;
  if (m.type === 'drop' || m.type === 'multi_drop') { const hf = m.hit ?? 3; lift = fi < hf ? (1 - (e.f + e.t * e.fps) / hf) * 160 : 0; }
  if (e.clones) {                                                                                // bóng người niệm (khung tư thế) quanh địch
    const a = M.anim.anims[e.sp.pose] || M.anim.anims.idle;
    e.clones.forEach((cx, j) => { if (fi >= j + 1 && fi < 7) center(g, M.sheet, Math.min(e.sp.release, a.frames - 1) * FW, a.row * FW,
      t.x + cx * k * cf, t.g - 84 * k, k, cx > 0 ? -cf : cf, .6); });
  }
  center(g, img, sx, sy, p.x, p.y - Math.max(0, lift) * k, k, cf);
}
