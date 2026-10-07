/* Vẽ phép từ sheet phép (8 cột × 12 hàng, khung 192×192) lên canvas phủ sân đấu.
   Toạ độ "gốc" theo quy ước của gói: chân nhân vật / mặt đất ở y = 180 trong khung, nhân vật quay phải.
   Mỗi hiệu ứng neo vào một đấu sĩ (i) và được phóng theo cỡ đấu sĩ trên màn hình (k = bề rộng hình / 192).
   Phép của bên phải (máy) được lật ngang. Logic bay chép từ spell-player.js / reference/xuong-sprite.html của gói. */
import { MAGES, MONS } from './mages.js';

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
    if (e.kind === 'mon') { e.t += dt; if (e.p.gone && e.goneAt == null) e.goneAt = e.t; if (e.goneAt != null && e.t - e.goneAt > .35) e.done = true; continue; }
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
    const M = MAGES[e.sp.mage], img = M && M.spellImg; if (!img && e.kind !== 'zap' && e.kind !== 'mon') continue;
    if (e.kind === 'zap') { drawZap(g, e, G); continue; }
    if (e.kind === 'mon') { drawMon(g, e, G); continue; }
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

// Quái triệu hồi: chạy theo tiến độ của đòn đánh p (trồi lên → lao tới / bổ nhào / phun lên → chạm đích khi p tới nơi)
const MON_H = [92, 124, 160];
function drawMon(g, e, G){
  const im = MONS[e.sp.summon]; if (!im) return;
  const c = G[e.from], t = G[e.to], k = c.k, face = c.face, u = e.p ? Math.min(1, e.p.k) : 1, after = e.p && e.p.gone ? e.t - e.goneAt : 0;
  const sc = MON_H[(e.sp.level || 1) - 1] / Math.max(im.width, im.height * 1.05) * k, w = im.width * sc, h = im.height * sc;
  const startX = c.x + 100 * k * face, hitX = t.x - (40 * k + w * .25) * face, mode = e.sp.mech;
  let x = startX, yb = c.g, a = 1, reveal = 1;
  if (mode === 'dive') { x = startX + (hitX - startX) * u * u; yb = (t.g - 160 * k) + 160 * k * u * u; a = Math.min(1, u * 5); }
  else if (mode === 'erupt') { x = hitX; reveal = Math.min(1, u * 1.4); }
  else { reveal = Math.min(1, u / .35); const v = Math.max(0, (u - .45) / .55); x = startX + (hitX - startX) * v * v; }
  if (after > 0) a = Math.max(0, 1 - after / .35);
  g.save(); g.globalAlpha = a;
  if (mode !== 'dive') { g.beginPath(); g.rect(0, 0, 1e5, yb); g.clip(); }
  g.translate(x, yb); if (face < 0) g.scale(-1, 1);
  g.drawImage(im, -w / 2, -h + (1 - reveal) * h, w, h);
  g.restore();
}
