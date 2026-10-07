import './base.css';
import './duel.css';
import { $, EL } from './config.js';
import { addSheet, frameStyle, makeAnimator, play, sheetOf, tick } from './anim.js';
import { FX } from '../fx/three-fx.js';
import { DIFF, DUEL_WEATHER, RULES as R } from './data.js';
import { MAGES, loadMages, spellIcon } from './mages.js';
import { BASE, FW, SKY_PRE, fxAdd, fxClear, fxDraw, fxUpdate } from './spellfx.js';

/* ---------- Đấu Trường Phép Thuật: đấu phép thời gian thực ----------
   Lối chơi kiểu Asuka: 4 lá xoay vòng từ sách phép, ma lực hồi liên tục, mỗi phép có thời gian niệm mà đối thủ nhìn thấy.
   Nhân vật và phép lấy từ gói pháp sư (public/mage): niệm → tư thế theo loại phép → phép hiện ra ở khung 2 của tư thế → trúng đích theo khung của phép. */
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.random() * a.length | 0];

// Sổ phép và các "sách" (mỗi pháp sư là một sách 12 phép: cấp 1–2 có 2 bản, cấp 3 có 1 bản). Điền sau khi nạp gói pháp sư.
const SP = {}, DECKS = {};
function buildDecks(){
  for (const [id, M] of Object.entries(MAGES)) {
    for (const sp of Object.values(M.spells)) SP[sp.id] = sp;
    DECKS[id] = {name:M.name, tip:M.tip, list:Object.fromEntries(Object.values(M.spells).map(sp => [sp.id, sp.level >= 3 ? 1 : 2]))};
    addSheet(id, M.anim, M.sheetSrc);
  }
}
const TYPE = {atk:'Tấn công', counter:'Phản chú', support:'Hỗ trợ'};
const KIND = {bolt:'Bắn thẳng', sky:'Giáng từ trời', ground:'Dưới đất', spread:'Dang tay'};
const COL = {water:[.4,.7,1], storm:[1,.95,.4], fire:[1,.5,.1], ice:[.7,.9,1], earth:[.75,.55,.3], light:[1,.95,.6], dark:[.6,.35,.95], mind:[.95,.45,.8]};
const isDef = sp => !!(sp.barrier || sp.wall || sp.guard);
const isHeal = sp => !!(sp.heal || sp.drainHp);
const total = sp => (sp.dmg || 0) * (sp.hits || 1);
const POSE_DELAY = 2 / 14;                               // phép hiện ra ở khung 2 của tư thế phóng phép

let S = null;
let cfg = {me:'pyro', opp:'random', diff:'normal', loadout:{}};
try { Object.assign(cfg, JSON.parse(localStorage.getItem('dp-duel') || '{}')); } catch (e) {}
if (!cfg.loadout || typeof cfg.loadout !== 'object') cfg.loadout = {};
function fixCfg(){
  if (!DECKS[cfg.me]) cfg.me = 'pyro';
  if (cfg.opp !== 'random' && !DECKS[cfg.opp]) cfg.opp = 'random';
}

/* ---------- Phép mang vào trận: chọn 5–8 phép trong sách ---------- */
const poolOf = deck => Object.keys(DECKS[deck].list);
// Mặc định: các phép cấp 1–2 (8 phép), phép cấp 3 để người chơi tự đổi vào
const defaultLoadout = deck => poolOf(deck).filter(id => SP[id].level <= 2).slice(0, R.LOADOUT_MAX);
function loadoutOf(deck){
  const pool = poolOf(deck), l = (cfg.loadout[deck] || []).filter(id => pool.includes(id));
  return l.length >= Math.min(R.LOADOUT_MIN, pool.length) && l.length <= R.LOADOUT_MAX ? l : defaultLoadout(deck);
}
const aiLoadout = deck => shuffle(poolOf(deck)).slice(0, R.LOADOUT_MAX);

/* ---------- Tạo trận ---------- */
function mkSide(i, deck, chosen){
  const D = DECKS[deck], s = {i, deck, name:i ? 'Máy' : 'Bạn', label:D.name, hp:R.HP, mana:R.MANA_START, regen:0, hpAcc:0,
    cast:null, next:null, drawing:null, pick:null, st:{}, shield:0, mirror:0, evade:0, barrier:null, wall:null, pets:[], lastCast:-9, hand:[], queue:[]};
  for (const id of chosen) for (let k = 0; k < D.list[id]; k++) s.queue.push(id);
  shuffle(s.queue); s.hand = s.queue.splice(0, R.HAND);
  s.anim = sheetOf(deck) ? makeAnimator(sheetOf(deck)) : null;
  return s;
}
function newDuel(){
  const opp = cfg.opp === 'random' ? pick(Object.keys(DECKS).filter(k => k !== cfg.me)) : cfg.opp;
  S = {t:0, over:false, winner:null, side:[mkSide(0, cfg.me, loadoutOf(cfg.me)), mkSide(1, opp, aiLoadout(opp))], proj:[], pending:[], clash:null, stop:0, intro:R.INTRO,
    weather:'clear', wNext:R.WEATHER_EVERY, frenzy:false, aiNext:1.2, seen:new Set(), diff:DIFF[cfg.diff]};
  fxClear(); renderStatic(); renderHand();
  banner('Sẵn sàng…', 'var(--ink)');
}

/* ---------- Niệm phép ---------- */
const castTime = (s, sp) => sp.cast * (s.st.frozen ? 2 : 1) * (s.st.slow ? 1 + s.st.slow.f : 1) * (s.st.haste ? .6 : 1);
function canBegin(s, id){
  const sp = SP[id];
  return !!sp && active(s) && !s.cast && s.mana >= sp.cost;
}
// Còn hành động được: trận đang diễn ra và không bị Choáng. Niệm và rút phép chạy song song, chỉ cần đủ ma lực và có phép trên tay
const active = s => !S.over && !S.clash && S.intro <= 0 && !s.st.stun;
const free = s => active(s) && !s.drawing && !s.pick;   // rảnh tay để rút phép
const emptySlot = s => s.hand.indexOf(null);

/* ---------- Rút phép kiểu Asuka: niệm xong ô để trống, tự chọn cách rút ---------- */
const canDraw = s => free(s) && emptySlot(s) >= 0 && s.queue.length > 0;
const canPick = s => canDraw(s) && s.mana >= R.PICK_COST;
const canRefresh = s => free(s) && s.mana >= R.REFRESH_COST && s.queue.length > 0;
function drawOne(s){ if (!canDraw(s)) return false; s.drawing = {kind:'one', t:0, dur:R.DRAW_TIME * (s.st.frozen ? 2 : 1)}; if (s.i === 0) renderHand(); return true; }
function refreshHand(s){ if (!canRefresh(s)) return false; s.next = null; s.mana -= R.REFRESH_COST; s.drawing = {kind:'refresh', t:0, dur:R.REFRESH_TIME * (s.st.frozen ? 2 : 1)}; if (s.i === 0) renderHand(); return true; }
function startPick(s){
  if (!canPick(s)) return false;
  s.mana -= R.PICK_COST; s.pick = {opts:s.queue.splice(0, 3), until:S.t + R.PICK_TIME};
  if (s.i === 0) renderHand();
  return true;
}
function choosePick(s, k){
  const P = s.pick; if (!P || !P.opts[k]) return;
  s.hand[emptySlot(s)] = P.opts[k];
  s.queue.push(...P.opts.filter((_, j) => j !== k));     // lá không chọn xuống đáy sách
  s.pick = null; if (s.i === 0) renderHand();
}
function cancelPick(s){ const P = s.pick; if (!P) return; s.queue.unshift(...P.opts); s.mana = Math.min(R.MANA_MAX, s.mana + R.PICK_COST); s.pick = null; renderHand(); }
function finishDraw(s){
  const d = s.drawing; s.drawing = null;
  if (d.kind === 'one') { const k = emptySlot(s); if (k >= 0 && s.queue.length) s.hand[k] = s.queue.shift(); }
  else { s.queue.push(...s.hand.filter(Boolean)); s.hand = s.queue.splice(0, R.HAND); while (s.hand.length < R.HAND) s.hand.push(null); }
  if (s.i === 0) renderHand();
}
function castHand(s, hi){
  const id = s.hand[hi]; if (!id) return false;
  // Đang niệm dở hoặc chưa đủ ma lực: xếp lá đó làm phép tiếp theo, niệm ngay khi được (bấm lại để bỏ)
  if (!canBegin(s, id)) { if (s.i === 0 && active(s)) s.next = s.next === hi ? null : hi; return false; }
  const sp = SP[id];
  s.hand[hi] = null; s.queue.push(id);                  // lá vừa dùng xuống đáy sách, ô để trống chờ tự rút
  s.mana -= sp.cost; s.next = null;
  s.cast = {id, t:0, dur:castTime(s, sp), started:S.t};
  s.lastCast = S.t;
  if (s.i === 0) renderHand();
  return true;
}
function finishCast(s){
  const c = s.cast; s.cast = null;
  const sp = SP[c.id];
  play(s.anim, sp.pose || 'buff');
  // Hoả Thân: các phép sát thương tiếp theo mạnh hơn
  let mul = 1;
  if (sp.dmg && s.st.empower) { mul = s.st.empower.mul; if (--s.st.empower.n <= 0) delete s.st.empower; }
  S.pending.push({at:S.t + POSE_DELAY, fn:() => release(s, sp, mul)});
}
// Một nhịp sát thương: đi theo hệ thống "phép đang bay" để khiên / tường / Đấu Đũa xử lý chung
function hitP(s, sp, delay, o = {}){
  const p = {from:s.i, to:1 - s.i, sp, k:0, travel:Math.max(.05, delay), mul:1, ...o};
  S.proj.push(p);
  return p;
}
// Khoảng cách giữa hai đấu sĩ tính theo px gốc của sheet (để ước thời gian đạn bay)
function gapRef(){ const G = geo(); return G ? Math.abs(G[1].x - G[0].x) / G[0].k : 600; }
// Phép xuất hiện: dựng hình theo sheet phép và lên lịch các nhịp sát thương theo khung gây sát thương của phép
function release(s, sp, mul){
  if (S.over) return;
  const o = S.side[1 - s.i], m = sp.meta || {}, fps = m.fps || 14, base = {from:s.i, to:o.i, sp, mul}, gap = gapRef();
  if (sp.self) applySelf(s, sp);
  // Phép tự thân: hình quanh người niệm (tường đá đứng trước mặt, giữ tới khi hết hạn)
  if (sp.self) {
    if (m.mode === 'wall') fxAdd({...base, i:s.i, dx:108, fps:5, hold:{from:3, to:5, until:() => s.wall ? s.wall.until : 0}});
    else fxAdd({...base, i:s.i, center:true, cy:92, fps});
    return;
  }
  const last = n => (p, j) => { p.last = j === n - 1; return p; };
  // Triệu thú: vòng triệu hồi, quái trồi ra rồi lao / bổ nhào / phun lên trúng mục tiêu
  if (sp.summon) {
    const atTarget = sp.mech === 'dive' || sp.mech === 'erupt';
    fxAdd({...base, i:atTarget ? o.i : s.i, dx:atTarget ? 0 : 100, fps:12});
    const T = {charge:.7 + gap / (380 + 160 * sp.level), dive:.85, erupt:.5, guard:1.2}[sp.mech] || .8;
    const p = hitP(s, sp, T, {mul, last:!sp.extra, warn:true});
    fxAdd({kind:'mon', ...base, p, delay:.25});
    for (let j = 1; j <= (sp.extra || 0); j++) hitP(s, sp, T + .3 * j, {mul:mul * .4, last:j === sp.extra});
    return;
  }
  // Tia nối tay → địch (tia băng, xích sét)
  if (m.mode === 'beam' || m.mode === 'chain') {
    fxAdd({...base, beam:true, fps});
    const fr = m.tickFrames || [m.hitFrame ?? 1];
    fr.forEach((f, j) => hitP(s, sp, f / fps, {mul, last:j === fr.length - 1}));
    return;
  }
  // Đạn bay (kể cả loạt đạn quạt / liên thanh và đường bay nảy / vòng / zíc zắc); sóng lửa lăn sát đất
  if (sp.kind === 'bolt' || m.mode === 'wave') {
    const n = m.count || 1, speed = m.mode === 'wave' ? 340 : m.path ? 470 : 620, travel = Math.max(.35, gap / speed);
    for (let j = 0; j < n; j++) S.pending.push({at:S.t + j * (m.interval || 0), fn:() => {
      const p = hitP(s, sp, travel, {mul, bolt:m.mode !== 'wave', last:j === n - 1, clashable:n === 1 && sp.hits === 1 && m.mode !== 'wave'});
      p.ent = fxAdd({kind:'bolt', ...base, p, fps, dy:(m.spreadY || [])[j] || 0, phase:'fly', ground:m.mode === 'wave'});
      const rival = p.clashable && S.proj.find(q => q.from === o.i && q.clashable && !q.reflected && !q.gone);
      if (rival && !S.clash) { S.clash = {mine:s.i === 0 ? p : rival, theirs:s.i === 0 ? rival : p, t:0, press:[0, 0], aiAcc:0, push:.5}; banner('Đấu Đũa!', 'var(--brass)'); }
    }});
    return;
  }
  // Phép giáng / dưới đất / dang tay: đặt ở chỗ địch (hoặc trước mặt / quanh người niệm), sát thương ở khung gây sát thương
  const fall = sp.kind === 'sky' && m.skyMode === 'fall', pre = fall ? SKY_PRE : 0;
  const hitAt = fall ? (m.landFrame || 2) : (m.hitFrame ?? (sp.kind === 'sky' ? 2 : 3));
  const ent = {...base, i:o.i, fps, sky:sp.kind === 'sky' ? m.skyMode : null};
  if (m.at === 'caster_front') Object.assign(ent, {i:s.i, dx:m.zapFrames ? 96 : 100});
  else if (m.at === 'caster') Object.assign(ent, {i:s.i, center:true, cy:92});
  else if (m.mode === 'drain' || m.mode === 'timefreeze') Object.assign(ent, {center:true, cy:100, tint:m.mode === 'timefreeze'});
  if (m.mode === 'barrage' || m.mode === 'barrage9' || (m.count && sp.kind === 'sky')) {
    const xs = m.spreadX || [-40, 0, 40];
    xs.forEach((dx, j) => { fxAdd({...ent, ddx:dx, delay:j * (m.interval || .15)}); hitP(s, sp, j * (m.interval || .15) + pre + hitAt / fps, {mul, last:j === xs.length - 1, warn:true}); });
    return;
  }
  if (m.at === 'caster_to_target' && m.count) {                 // hàng gai / mạch điện mọc nối tiếp từ chân người niệm tới địch
    const n = m.count, x0 = 64, x1 = gap - 6;
    for (let j = 0; j < n; j++) fxAdd({...ent, i:s.i, dx:x0 + (x1 - x0) * j / (n - 1), delay:j * (m.interval || .07)});
    hitP(s, sp, (n - 1) * (m.interval || .07) + hitAt / fps, {mul, last:true});
    return;
  }
  fxAdd(ent);
  const ticks = m.tickFrames || m.zapFrames;
  if (ticks) ticks.forEach((f, j) => hitP(s, sp, f / fps, {mul, last:j === ticks.length - 1, warn:true,
    zap:m.zapFrames ? {from:s.i, dx:96, top:m.zapTop || 100} : m.mode === 'tempest' ? {sky:true} : null}));
  else hitP(s, sp, pre + hitAt / fps, {mul, last:true, warn:true});
  if (m.shake) S.pending.push({at:S.t + pre + hitAt / fps, fn:() => FX.shake(m.shake)});
}
function applySelf(s, sp){
  if (sp.barrier) { s.barrier = {hp:sp.barrier.hp, until:S.t + sp.barrier.dur}; float(s.i, `Giáp ${s.barrier.hp}`, '#9fe8ff'); }
  if (sp.wall) { s.wall = {n:sp.wall.n, until:S.t + sp.wall.dur, root:sp.wall.rootOnFall}; float(s.i, sp.wall.n >= 99 ? 'Thành luỹ!' : `Tường đá chặn ${sp.wall.n} đạn`, '#c8f06a'); }
  if (sp.guard) s.st.guard = {pct:sp.guard.pct, until:S.t + sp.guard.dur};
  if (sp.cleanse) { for (const k of ['wet', 'burn', 'frozen', 'stun', 'weak', 'slow', 'mark']) delete s.st[k]; float(s.i, 'Giải hiệu ứng', 'var(--good)'); }
  if (sp.heal) heal(s, sp.heal);
  if (sp.empower) { s.st.empower = {...sp.empower}; float(s.i, `${sp.empower.n} phép tới +${Math.round((sp.empower.mul - 1) * 100)}%`, '#ffb36b'); }
  if (sp.haste) { s.st.haste = S.t + sp.haste; float(s.i, 'Niệm nhanh!', '#ffe9a0'); }
}
function interrupt(t){
  banner('Ngắt phép!', 'var(--bad)'); float(t.i, SP[t.cast.id].name + ' bị huỷ', 'var(--bad)');
  FX.anim(at(t.i, .5), 'fizzle', {fps:15}); t.cast = null; t.next = null;
}

/* ---------- Trúng đích ---------- */
function land(p){
  const sp = p.sp, t = S.side[p.to], c = S.side[p.from], st = t.st;
  if (t.evade > S.t) { p.gone = true; float(t.i, 'Trượt!', '#cfe8ff'); return; }
  if (p.bolt && t.wall && t.wall.until > S.t && t.wall.n > 0 && !sp.pierce) {
    p.gone = true; t.wall.n--; float(t.i, 'Tường chặn!', '#c8f06a'); FX.burst(at(t.i, .6), {color:[.8,.95,.5], count:40, speed:160});
    if (t.wall.n <= 0) t.wall.until = S.t;
    return;
  }
  if (p.bolt && sp.dmg > 0 && t.mirror > S.t && !p.reflected) {
    t.mirror = 0; banner('Phản!', '#d8f0ff');
    const q = {...p, from:p.to, to:p.from, k:0, reflected:true, clashable:false}; if (p.ent) p.ent.p = q;
    S.proj.push(q); return;
  }
  p.gone = true;
  if (t.shield > S.t && !sp.pierce) { t.shield = 0; float(t.i, 'Chặn!', '#9fd0ff', true); return; }
  p.hitTarget = true;
  let n = 0, burn = sp.burn;
  if (sp.dmg) {
    let mul = (p.mul || 1) * (1 + (DUEL_WEATHER[S.weather].mod[sp.el] || 0));
    if (c.st.weak) mul *= .7;                                          // người niệm bị Mù: phép yếu đi
    if (sp.el === 'storm' && st.wet) { mul *= 1.3; delete st.wet; react('Giật lan', EL.storm.c); }
    else if (sp.el === 'fire' && st.wet) { mul *= .7; delete st.wet; burn = 0; react('Dập lửa', EL.water.c); }
    else if (sp.el === 'fire' && st.frozen) { mul *= 1.5; delete st.frozen; react('Hơi nước', '#f2f2f2'); }
    else if (sp.el === 'ice' && st.burn) { mul *= 1.2; delete st.burn; react('Tan chảy', EL.ice.c); }
    if (st.mark) mul *= 1.1;                                           // bị đánh dấu con mồi
    if (st.guard) mul *= 1 - st.guard.pct;                             // bong bóng hộ thân
    n = Math.max(1, Math.round(sp.dmg * mul));
  }
  const dealt = n > 0 ? damage(t, n) : 0;
  if (p.last && sp.drainHp && dealt) heal(c, sp.drainHp);
  if (p.last && sp.selfHeal) heal(c, sp.selfHeal);
  if (p.last && sp.armorOnHit) c.barrier = {hp:(c.barrier ? c.barrier.hp : 0) + sp.armorOnHit, until:S.t + 5};
  if (S.over) return;
  if (sp.wet) st.wet = S.t + R.WET;
  if (burn) st.burn = {until:Math.max(st.burn ? st.burn.until : 0, S.t + burn), next:st.burn ? st.burn.next : S.t + R.BURN_TICK};
  if (sp.freeze) st.frozen = Math.max(st.frozen || 0, S.t + sp.freeze);
  if (sp.slow) st.slow = {until:S.t + 3, f:Math.min(.8, Math.max(st.slow ? st.slow.f : 0, sp.slow))};
  if (sp.root) { st.slow = {until:S.t + sp.root * 2 + 1, f:Math.max(st.slow ? st.slow.f : 0, .4)}; st.root = S.t + sp.root * 2 + 1; }
  if (sp.launch) { st.stun = Math.max(st.stun || 0, S.t + .35); const f = fighter(t.i); f.classList.remove('launch'); void f.offsetWidth; f.classList.add('launch'); }
  if (sp.stun) st.stun = Math.max(st.stun || 0, S.t + sp.stun);
  if (t.cast && (sp.interrupt || sp.stun >= .5)) interrupt(t);
  if (sp.blind) st.weak = Math.max(st.weak || 0, S.t + sp.blind);
  if (sp.mark) st.mark = S.t + sp.mark;
  if (sp.dispel && p.last) {
    const drop = [['wall', () => t.wall = null], ['barrier', () => t.barrier = null], ['empower', () => delete st.empower], ['haste', () => delete st.haste], ['guard', () => delete st.guard]]
      .find(([k]) => k === 'wall' || k === 'barrier' ? t[k] : st[k]);
    if (drop) { drop[1](); float(t.i, 'Bị xoá phép duy trì', '#c58cf0'); }
  }
  if (p.zap) fxAdd({kind:'zap', from:p.from, to:p.to, sp, color:EL[sp.el] ? EL[sp.el].c : '#fff',
    x0:G => p.zap.sky ? G[p.to].x + (Math.random() - .5) * 80 * G[p.to].k : G[p.zap.from].x + p.zap.dx * G[p.zap.from].k * G[p.zap.from].face,
    y0:G => p.zap.sky ? 0 : G[p.zap.from].g - p.zap.top * G[p.zap.from].k});
  FX.burst(at(t.i), {color:COL[sp.el] || [1,1,1], count:24, speed:150});
}
function damage(t, n){
  if (t.barrier && t.barrier.until > S.t) {
    const a = Math.min(t.barrier.hp, n); t.barrier.hp -= a; n -= a;
    if (a) float(t.i, `Giáp −${a}`, '#9fe8ff');
    if (t.barrier.hp <= 0) t.barrier = null;
  }
  if (n <= 0) return 0;
  t.hp = Math.max(0, t.hp - n); float(t.i, '−' + n, 'var(--bad)', n >= 20);
  hitFx(t.i, n);
  if (t.hp <= 0 && !S.over) {
    S.over = true; S.winner = 1 - t.i; S.stop = 0;
    fighter(t.i).classList.add('ko'); banner('K.O.', 'var(--bad)', true); FX.shake(14);
    setTimeout(showEnd, 1700);
  }
  return n;
}
function heal(s, n){
  if (n <= 0) return;
  s.hp = Math.min(R.HP, s.hp + n); float(s.i, '+' + n, 'var(--good)'); FX.rise(at(s.i), [.45,1,.6], 30);
}
function react(name, color){ banner(name + '!', color); }
function setWeather(id){
  S.weather = id; S.wNext = R.WEATHER_EVERY; FX.setWeather(id);
  $('.d-stage').setAttribute('data-weather', id);
  float(null, `☁ ${DUEL_WEATHER[id].name}`, 'var(--brass)', true);
}

/* ---------- Vòng lặp ---------- */
function step(dt){
  if (!S || S.over) return;
  if (S.intro > 0) { const was = S.intro; S.intro -= dt; if (was > .7 && S.intro <= .7) banner('Đấu!', 'var(--brass)', true); return; }
  if (S.stop > 0) { S.stop -= dt; return; }        // khựng hình khi trúng đòn nặng
  if (S.clash) { stepClash(dt); return; }         // Đấu Đũa: mọi thứ khác dừng lại chờ phân thắng bại
  S.t += dt;
  if (!S.frenzy && S.t >= R.FRENZY_AT) { S.frenzy = true; banner('Cuồng phong!', 'var(--brass)'); }
  if ((S.wNext -= dt) <= 0) setWeather(pick(Object.keys(DUEL_WEATHER).filter(k => k !== S.weather)));
  for (const s of S.side) {
    const st = s.st;
    for (const k of ['wet', 'frozen', 'stun', 'weak', 'haste', 'mark', 'root']) if (st[k] && st[k] <= S.t) delete st[k];
    for (const k of ['slow', 'guard']) if (st[k] && st[k].until <= S.t) delete st[k];
    if (s.barrier && s.barrier.until <= S.t) s.barrier = null;
    // Tường đá hết hạn: Thành Luỹ Cổ Thụ sụp xuống làm đối thủ bị Trói chân
    if (s.wall && s.wall.until <= S.t) { const o = S.side[1 - s.i]; if (s.wall.root) { o.st.slow = {until:S.t + 3, f:.4}; o.st.root = S.t + 3; } s.wall = null; }
    if (st.burn) { if (S.t >= st.burn.next) { st.burn.next += R.BURN_TICK; damage(s, R.BURN_DMG); } if (st.burn && S.t >= st.burn.until) delete st.burn; }
    if (!st.frozen && s.mana < R.MANA_MAX) {
      s.regen += dt * (S.frenzy ? 2 : 1);
      while (s.regen >= R.REGEN) { s.regen -= R.REGEN; s.mana = Math.min(R.MANA_MAX, s.mana + 1); }
    }
    if (s.drawing && (s.drawing.t += dt) >= s.drawing.dur) finishDraw(s);
    if (s.pick && S.t >= s.pick.until) choosePick(s, 0);   // hết giờ chọn: lấy lá đầu
    if (s.cast) {
      s.cast.t += dt;
      if (s.cast.t >= s.cast.dur) finishCast(s);
    }
    // Phép đã xếp hàng: niệm ngay khi rảnh và đủ ma lực; ô đó bị thay lá thì bỏ
    if (s.next != null) { if (!s.hand[s.next]) s.next = null; else if (!s.cast && canBegin(s, s.hand[s.next])) castHand(s, s.next); }
    if (S.over) return;
  }
  for (const q of [...S.pending]) if (S.t >= q.at) { S.pending.splice(S.pending.indexOf(q), 1); q.fn(); if (S.over) return; }
  for (const p of [...S.proj]) {
    p.k += dt / p.travel;
    if (p.k >= 1 && S.proj.includes(p)) { S.proj.splice(S.proj.indexOf(p), 1); land(p); if (S.over) return; }
  }
  aiThink(dt);
}
function stepClash(dt){
  const C = S.clash; C.t += dt;
  C.aiAcc += dt * S.diff.mash * (.75 + Math.random() * .5);
  while (C.aiAcc >= 1) { C.aiAcc -= 1; C.press[1]++; }
  const tot = C.press[0] + C.press[1];
  C.push = tot ? C.press[0] / tot : .5;            // 1 = bạn đẩy hẳn về phía máy
  if (C.t < R.CLASH) return;
  const win = C.press[0] === C.press[1] ? (Math.random() < .5 ? 0 : 1) : C.press[0] > C.press[1] ? 0 : 1;
  const w = win === 0 ? C.mine : C.theirs, l = win === 0 ? C.theirs : C.mine;
  S.proj.splice(S.proj.indexOf(l), 1); l.gone = true;
  w.mul = (w.mul || 1) * 1.3; w.k = .5; w.clashable = false;      // phép thắng bay tiếp từ giữa sân, mạnh thêm 30%
  banner(win === 0 ? 'Bạn thắng Đấu Đũa!' : 'Máy thắng Đấu Đũa!', win === 0 ? 'var(--good)' : 'var(--bad)');
  FX.shake(8); S.clash = null;
}

/* ---------- Máy: phản ứng có độ trễ, chọn phép theo loại ---------- */
function aiThink(dt){
  const me = S.side[1], you = S.side[0], D = S.diff;
  if ((S.aiNext -= dt) > 0 || me.st.stun) return;
  S.aiNext = .12 + Math.random() * .12;
  // Đang niệm thì tranh thủ rút cho đầy tay
  if (me.cast || me.drawing || me.pick) { if (me.cast && emptySlot(me) >= 0) drawOne(me); return; }
  const ready = me.hand.filter(id => id && canBegin(me, id));
  const cast = id => castHand(me, me.hand.indexOf(id));
  const sp = id => SP[id];
  // 1. Phép của bạn đang bay tới: phòng thủ nếu kịp (chỉ "thấy" sau độ trễ phản xạ)
  for (const p of S.proj) {
    if (p.to !== 1 || !p.sp.dmg || S.seen.has(p)) continue;
    const age = p.k * p.travel, left = (1 - p.k) * p.travel;
    if (age < D.delay) continue;
    S.seen.add(p);
    if ((me.wall && me.wall.until > S.t) || me.barrier || me.st.guard || Math.random() > D.block) continue;
    // Tường đá chỉ chặn đạn bay; giáp và bong bóng đỡ được mọi đòn
    const def = ready.filter(id => isDef(sp(id)) && (p.bolt || !sp(id).wall) && castTime(me, sp(id)) + POSE_DELAY < left - .03);
    if (def.length) { cast(def[0]); return; }
  }
  // 2. Bạn đang niệm phép lớn: ngắt nếu kịp
  const yc = you.cast;
  if (yc && S.t - yc.started >= D.delay && (sp(yc.id).cost >= 3 || yc.dur >= 1)) {
    const intr = ready.filter(id => (sp(id).interrupt || sp(id).stun >= .5) && castTime(me, sp(id)) + POSE_DELAY + (sp(id).kind === 'bolt' ? .8 : .3) < yc.dur - yc.t - .05);
    if (intr.length) { cast(intr[0]); return; }
  }
  // Tự rút phép: ô trống mà không còn phép niệm được, hoặc trống từ 2 ô
  const empties = me.hand.filter(id => !id).length, held = me.hand.filter(Boolean);
  if (empties && (!ready.length || empties >= 2)) {
    if (me.mana >= 4 && Math.random() < .35 && startPick(me)) { aiChoose(me, held); return; }
    if (drawOne(me)) return;
  }
  // Tay toàn phép thủ/hỗ trợ không dùng được: thay cả tay để tìm phép tấn công
  const atkHeld = held.some(id => sp(id).dmg > 0);
  if (!empties && !atkHeld && me.mana >= R.REFRESH_COST + 2 && Math.random() < .5 && refreshHand(me)) return;
  if (!ready.length && !empties && me.mana >= 7 && Math.random() < .25 && refreshHand(me)) return;
  aiCast(me, you, ready, cast, sp);
  // Không niệm gì mà còn ô trống thì tranh thủ rút cho đầy tay
  if (free(me) && emptySlot(me) >= 0) drawOne(me);
}
function aiCast(me, you, ready, cast, sp){
  if (S.t - me.lastCast < S.diff.gap) return;        // nghỉ giữa 2 phép theo độ khó
  // 3. Máu thấp: hồi
  if (me.hp <= R.HP * .4) { const h = ready.find(id => isHeal(sp(id))); if (h) { cast(h); return; } }
  // 4. Combo phản ứng: đối thủ Ướt → Sét, Đóng băng → Lửa
  const combo = ready.filter(id => sp(id).dmg > 0 && ((you.st.wet && sp(id).el === 'storm') || (you.st.frozen && sp(id).el === 'fire')))
    .sort((a, b) => sp(b).dmg - sp(a).dmg)[0];
  if (combo) { cast(combo); return; }
  // 5. Hỗ trợ: Hoả Thân / Lôi Tốc khi chưa có, hồi máu khi đã mất máu
  const sup = ready.filter(id => (sp(id).empower && !me.st.empower) || (sp(id).haste && !me.st.haste) || (sp(id).heal && me.hp <= R.HP * .7));
  if (sup.length && (me.mana >= 5 || Math.random() < .5)) { cast(pick(sup)); return; }
  // 6. Mở combo (Ướt / Đóng băng) nếu có phép nối, không thì phép tấn công mạnh nhất (đôi khi nhịn để dồn phép lớn)
  const setup = ready.find(id => !you.st.wet && !you.st.frozen && (sp(id).wet || sp(id).freeze >= 2)
    && me.hand.some(f => f && f !== id && sp(f).dmg >= 2 && sp(f).el === (sp(id).wet ? 'storm' : 'fire')));
  if (setup) { cast(setup); return; }
  const big = me.hand.find(id => id && sp(id).cost >= 5 && sp(id).dmg);
  if (big && me.mana < sp(big).cost && me.mana >= sp(big).cost - 2 && Math.random() < S.diff.hoard) return;
  const atk = ready.filter(id => sp(id).dmg > 0)
    .sort((a, b) => total(sp(b)) - total(sp(a)));
  if (atk.length) { cast(atk[0]); return; }
  // Không có phép tấn công: giải phóng ô bằng phép hỗ trợ còn lại (giữ lại 1 phép thủ để đỡ đòn)
  const spare = ready.filter(id => sp(id).self && !isDef(sp(id)));
  if (spare.length && me.mana >= 6) cast(spare[0]);
}

// Máy chọn 1 trong 3 lá: thiếu phòng thủ thì lấy phòng thủ, máu thấp thì lấy hồi máu, còn lại lấy phép mạnh nhất
function aiChoose(me, held){
  const o = me.pick.opts, score = id => {
    const p = SP[id];
    if (isDef(p) && !held.some(h => isDef(SP[h]))) return 50;
    if (p.heal && me.hp <= R.HP * .45) return 40;
    return total(p) / 2 + (p.interrupt || p.stun >= .5 ? 6 : 0);
  };
  let best = 0; o.forEach((id, k) => { if (score(id) > score(o[best])) best = k; });
  choosePick(me, best);
}

/* ---------- Giao diện: sân khấu, đấu sĩ, HUD ---------- */
const fighter = i => $(i === 0 ? '#fMe' : '#fOpp');
// Toạ độ màn hình của đấu sĩ (dy: 0 = đỉnh đầu, 1 = chân)
function at(i, dy = .45){
  const r = fighter(i).querySelector('.f-sprite').getBoundingClientRect();
  return {x:r.left + r.width / 2, y:r.top + r.height * dy, w:r.width * .8, h:r.height * .8};
}
function float(i, text, color, big){
  let x, y;
  if (i === null) { const r = $('.d-stage').getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height * .3; }
  else { const p = at(i, .1); x = p.x + (Math.random() - .5) * 50; y = p.y; }
  const f = document.createElement('div');
  f.className = 'fly' + (big ? ' big' : ''); f.textContent = text; f.style.color = color;
  f.style.left = x + 'px'; f.style.top = y + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 1300);
}
function banner(text, color, huge){
  const b = $('#dBanner'); b.textContent = text; b.style.color = color;
  b.className = 'd-banner'; void b.offsetWidth; b.className = 'd-banner show' + (huge ? ' huge' : '');
}
function hitFx(i, n){
  play(S.side[i].anim, 'hit');
  const f = fighter(i); f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit');
  if (n >= 5) { S.stop = .09; FX.shake(Math.min(14, n * 1.6)); $('.d-stage').classList.remove('flash'); void $('.d-stage').offsetWidth; $('.d-stage').classList.add('flash'); }
}
function hudHTML(s){
  const pic = `<span class="h-pic sheet" style="${frameStyle(s.anim.m, 'idle')}"></span>`;
  return `<div class="h-top">${pic}
      <div class="h-id"><b>${s.name}</b><span class="meta">${s.label}</span></div></div>
    <div class="h-hp"><i class="trail"></i><i class="fill"></i><span class="lp">${s.hp}</span></div>
    <div class="h-mana">${[...Array(R.MANA_MAX)].map(() => '<i></i>').join('')}<b></b></div>
    <div class="h-st"></div><div class="h-hand meta"></div>`;
}
function fighterHTML(s){
  return `<div class="f-pets"></div><div class="f-spell"></div>
    <div class="f-circle"><i></i><i></i></div><div class="f-bubble"></div>
    <div class="f-sprite sheet" style="${frameStyle(s.anim.m, 'idle')}"></div><div class="f-shadow"></div>
    <div class="f-cast"><i></i></div>`;
}
function renderStatic(){
  for (const s of S.side) { $(s.i === 0 ? '#hMe' : '#hOpp').innerHTML = hudHTML(s); fighter(s.i).innerHTML = fighterHTML(s); fighter(s.i).className = 'fighter ' + (s.i ? 'opp' : 'me'); }
  $('.d-stage').setAttribute('data-weather', S.weather); FX.setWeather(S.weather);
}
const kindCls = sp => sp.type === 'counter' ? 'counter' : sp.type === 'support' ? 'enchant' : 'charm';
function miniCard(id, attrs, key){
  const sp = SP[id];
  return `<button class="dcard card face k-${kindCls(sp)}" ${attrs} title="${sp.name}: ${sp.text}">
    <span class="cost">${sp.cost}</span><div class="cname">${sp.name}</div><div class="cart spic" style="${spellIcon(sp)}"></div>
    <div class="cstats"><span>${sp.dmg ? `${sp.dmg}${sp.hits > 1 ? '×' + sp.hits : ''} st` : TYPE[sp.type]} · ${sp.cast}s</span></div><span class="dkey">${key}</span><span class="dfill"></span></button>`;
}
function renderHand(){
  const s = S.side[0];
  // Đang xem 3 chọn 1: thay tay bài bằng 3 lá để chọn
  if (s.pick) {
    $('#dHand').innerHTML = `<div class="d-pick"><div class="meta">Chọn 1 lá đưa lên tay (phím 1–3) · <b class="d-pickt"></b>s · Esc huỷ (hoàn ma lực)</div>
      <div class="row">${s.pick.opts.map((id, k) => miniCard(id, `data-pk="${k}"`, k + 1)).join('')}</div></div>`;
    return;
  }
  $('#dHand').innerHTML = s.hand.map((id, i) => id ? miniCard(id, `data-hi="${i}"`, i + 1)
      : `<button class="dslot-empty" data-draw="one"><b>Ô trống</b><span class="meta">Q: rút phép</span></button>`).join('')
    + `<div class="d-draw">
      <button class="btn sm" data-draw="one"><b>Q</b> Rút 1 lá <span class="meta">· ${R.DRAW_TIME}s</span></button>
      <button class="btn sm" data-draw="pick"><b>W</b> Xem 3 chọn 1 <span class="meta">· ${R.PICK_COST} ma lực</span></button>
      <button class="btn sm" data-draw="refresh"><b>E</b> Thay cả tay <span class="meta">· ${R.REFRESH_COST} ma lực</span></button>
      <span class="meta d-left">Sách còn ${s.queue.length} lá · trên cùng: ${s.queue[0] ? SP[s.queue[0]].name : '—'}</span></div>`;
}
function chips(s){
  const out = [], st = s.st, left = x => Math.max(0, x - S.t).toFixed(1);
  const c = (cls, txt) => out.push(`<span class="chip ${cls}">${txt}</span>`);
  if (st.wet) c('st-wet', `Ướt ${left(st.wet)}`);
  if (st.burn) c('st-burn', `Cháy ${left(st.burn.until)}`);
  if (st.frozen) c('st-frozen', `Đóng băng ${left(st.frozen)}`);
  if (st.stun) c('st-stun', `Choáng ${left(st.stun)}`);
  if (st.weak) c('d-cu', `Mù ${left(st.weak)}`);
  if (st.root) c('d-cu', `Trói chân ${left(st.root)}`);
  else if (st.slow) c('d-cu', `Chậm ${Math.round(st.slow.f * 100)}% ${left(st.slow.until)}`);
  if (st.mark) c('d-cu', `Con mồi ${left(st.mark)}`);
  if (st.haste) c('d-good', `Niệm nhanh ${left(st.haste)}`);
  if (st.empower) c('d-good', `Hoả Thân ×${st.empower.n}`);
  if (st.guard) c('d-sh', `Bong bóng −${Math.round(st.guard.pct * 100)}% ${left(st.guard.until)}`);
  if (s.wall && s.wall.until > S.t) c('d-ba', `Tường đá ${s.wall.n >= 99 ? '∞' : s.wall.n} · ${left(s.wall.until)}`);
  if (s.shield > S.t) c('d-sh', `Khiên ${left(s.shield)}`);
  if (s.mirror > S.t) c('d-mi', `Gương ${left(s.mirror)}`);
  if (s.evade > S.t) c('d-mi', `Né ${left(s.evade)}`);
  if (s.barrier) c('d-ba', `Giáp ${s.barrier.hp}`);
  return out.join('');
}
function setHTML(el, html){ if (el && el.innerHTML !== html) el.innerHTML = html; }
// Vị trí các đấu sĩ trên canvas phép (px trong sân khấu): tâm ngang, mặt đất (y = 180 của khung), tỉ lệ so với khung 192, hướng mặt
function geo(){
  const st = $('.d-stage'); if (!st || !S) return null;
  const r0 = st.getBoundingClientRect(), G = [];
  for (const s of S.side) {
    const el = fighter(s.i).querySelector('.f-sprite'); if (!el) return null;
    const r = el.getBoundingClientRect(), k = r.width / FW; if (!k) return null;
    G.push({x:r.left - r0.left + r.width / 2, g:r.top - r0.top + BASE * k, k, face:s.i ? -1 : 1, mage:s.deck});
  }
  return G;
}
function draw(){
  if (!S) return;
  const warned = [0, 1].map(i => S.proj.some(p => p.to === i && p.warn && (1 - p.k) * p.travel > .15));
  for (const s of S.side) {
    const h = $(s.i === 0 ? '#hMe' : '#hOpp'), f = fighter(s.i), st = s.st;
    const pct = (100 * s.hp / R.HP) + '%';
    h.querySelector('.fill').style.width = pct; h.querySelector('.trail').style.width = pct;
    h.querySelector('.lp').textContent = s.hp;
    const part = s.mana < R.MANA_MAX ? s.regen / R.REGEN : 0;
    h.querySelectorAll('.h-mana i').forEach((g, k) => { g.className = k < s.mana ? 'on' : ''; g.style.setProperty('--f', k === s.mana ? part : 0); });
    h.querySelector('.h-mana b').textContent = s.mana;
    h.querySelector('.h-hand').textContent = `Tay ${s.hand.filter(Boolean).length}/${R.HAND} · Sách ${s.queue.length}${s.drawing ? ' · đang rút…' : s.pick ? ' · đang chọn phép…' : ''}`;
    setHTML(h.querySelector('.h-st'), chips(s));
    // Đấu sĩ: trạng thái hiển thị bằng class
    const cls = {casting:!!s.cast, stun:!!st.stun, frozen:!!st.frozen, burn:!!st.burn, wet:!!st.wet, curse:!!(st.curse || st.weak),
      shield:s.shield > S.t, mirror:s.mirror > S.t || s.evade > S.t, barrier:!!s.barrier, warned:warned[s.i], haste:!!st.haste};
    for (const [k, v] of Object.entries(cls)) f.classList.toggle(k, v);
    const c = s.cast;
    if (c) {
      const sp = SP[c.id];
      f.style.setProperty('--ec', EL[sp.el] ? EL[sp.el].c : sp.type === 'counter' ? '#7fb3ff' : '#7cc49b');
      f.style.setProperty('--p', (c.t / c.dur).toFixed(3));
      setHTML(f.querySelector('.f-spell'), sp.name);
    } else setHTML(f.querySelector('.f-spell'), st.stun ? 'Choáng!' : warned[s.i] ? '⚠ Phép giáng!' : '');
    // Thanh tiến độ dưới chân: niệm phép (màu theo hệ), không niệm thì hiện tiến độ rút phép
    const dr = s.drawing, bar = c ? c.t / c.dur : dr ? dr.t / dr.dur : 0;
    f.classList.toggle('drawing', !c && !!dr);
    f.querySelector('.f-cast i').style.width = (100 * bar) + '%';
  }
  const me = S.side[0];
  if (me.pick) { const t = $('.d-pickt'); if (t) t.textContent = Math.max(0, me.pick.until - S.t).toFixed(1); }
  const dbtn = {one:canDraw(me), pick:canPick(me), refresh:canRefresh(me)};
  document.querySelectorAll('#dHand [data-draw]').forEach(b => b.classList.toggle('off', !dbtn[b.dataset.draw]));
  document.querySelectorAll('#dHand .dcard').forEach(b => {
    if (b.dataset.hi === undefined) return;
    const id = me.hand[+b.dataset.hi]; if (!id) return;
    const sp = SP[id];
    b.classList.toggle('playable', canBegin(me, id)); b.classList.toggle('poor', me.mana < sp.cost);
    b.classList.toggle('queued', me.next === +b.dataset.hi);
    b.querySelector('.dfill').style.height = me.mana < sp.cost ? (100 * (1 - (me.mana + me.regen / R.REGEN) / sp.cost)) + '%' : '0';
  });
  // Phép vẽ từ sheet phép lên canvas phủ sân
  const stage = $('.d-stage'), r = stage.getBoundingClientRect(), W = r.width, H = r.height;
  const cv = $('#dFx'), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const G = geo(); if (G) fxDraw(g, G);
  // Đấu Đũa: hai luồng phép giằng co giữa sân
  const cl = $('#dClash');
  if (S.clash) {
    cl.hidden = false; const m = .15 + .7 * S.clash.push;
    cl.style.setProperty('--m', (20 + 60 * m) + '%');
    cl.querySelector('.d-push i').style.width = (S.clash.push * 100) + '%';
    $('#dClashT').textContent = Math.max(0, R.CLASH - S.clash.t).toFixed(1);
  } else cl.hidden = true;
  const w = DUEL_WEATHER[S.weather];
  setHTML($('#dWeather'), `<span class="wdot w-${S.weather}"></span><b>${w.name}</b><span class="meta">${w.desc} · ${Math.ceil(S.wNext)}s</span>`);
  const mm = Math.floor(S.t / 60), ss = String(Math.floor(S.t % 60)).padStart(2, '0');
  $('#dTime').textContent = `${mm}:${ss}`; $('#dTime').classList.toggle('frenzy', S.frenzy);
}
function showStart(){
  const tile = (k, attr, on) => { const D = DECKS[k];
    const pic = `<span class="art sheet" style="${frameStyle(sheetOf(k), 'idle')}"></span>`;
    return `<button class="d-bookbtn ${on ? 'on' : ''}" ${attr}="${k}">${pic}<span><b>${D.name}</b><span class="meta">${D.tip}</span></span></button>`; };
  const btn = (attr, k, label, on) => `<button class="btn sm ${on ? 'on' : ''}" ${attr}="${k}">${label}</button>`;
  $('#dOverlay').innerHTML = `<div class="over"><div class="box d-box">
    <h2>Đấu Trường Phép Thuật</h2><p class="meta">Đấu phép thời gian thực, không có lượt. Ma lực tự hồi, có 4 ô phép, không có hồi chiêu: đủ ma lực là niệm được. Niệm xong phải tự rút phép mới. Mỗi phép có thời gian niệm mà đối thủ nhìn thấy được.</p>
    <p class="meta d-lbl">Chọn sách phép:</p>
    <div class="d-books">${Object.keys(DECKS).map(k => tile(k, 'data-dme', cfg.me === k)).join('')}</div>
    ${loadoutHTML()}
    <div class="row d-choice"><span class="meta">Đối thủ:</span>${btn('data-dopp', 'random', 'Ngẫu nhiên', cfg.opp === 'random')}${Object.keys(DECKS).map(k => btn('data-dopp', k, DECKS[k].name, cfg.opp === k)).join('')}</div>
    <div class="row d-choice"><span class="meta">Độ khó:</span>${Object.keys(DIFF).map(k => btn('data-ddiff', k, DIFF[k].name, cfg.diff === k)).join('')}</div>
    <ul class="d-how">
      <li><b>1–4</b> hoặc chạm lá: niệm phép. Niệm xong ô đó <b>để trống</b>, phải tự rút: <b>Q</b> rút 1 lá (${R.DRAW_TIME} giây), <b>W</b> xem 3 lá trên cùng chọn 1 (${R.PICK_COST} ma lực), <b>E</b> thay cả tay (${R.REFRESH_COST} ma lực). Rút và niệm cùng lúc được; bấm lá khi đang niệm hoặc thiếu ma lực để xếp làm phép tiếp theo, đủ điều kiện là tự niệm.</li>
      <li>Đang niệm thì dưới chân nhân vật hiện thanh tiến độ, đầy thanh là phép bay ra.</li>
      <li>Nhìn vòng phép dưới chân đối thủ để biết họ đang niệm gì. Phản chú (khiên, gương, né…) phải dựng <b>trước khi</b> phép bay tới; phép ngắt trúng lúc đối thủ đang niệm thì huỷ phép của họ.</li>
      <li>Hai phép sát thương va nhau: <b>Đấu Đũa</b>, bấm Space (hoặc chạm vào luồng phép) thật nhanh để đẩy luồng phép về phía đối thủ.</li>
    </ul>
    <button class="btn primary" data-dstart="1" ${loadoutOk() ? '' : 'disabled'}>Bắt đầu</button></div></div>`;
}
// Chọn phép mang vào trận (lưu theo từng sách)
const curLoadout = () => cfg.loadout[cfg.me] || (cfg.loadout[cfg.me] = loadoutOf(cfg.me));
const loadoutOk = () => { const n = curLoadout().length; return n >= Math.min(R.LOADOUT_MIN, poolOf(cfg.me).length) && n <= R.LOADOUT_MAX; };
function loadoutHTML(){
  const pool = poolOf(cfg.me), cur = curLoadout();
  return `<p class="meta d-lbl">Phép mang vào trận: <b>${cur.length}</b> / tối đa ${R.LOADOUT_MAX} (ít nhất ${Math.min(R.LOADOUT_MIN, pool.length)}) · bấm để bật/tắt</p>
    <div class="d-load">${pool.map(id => { const sp = SP[id], on = cur.includes(id);
      return `<button class="d-lo t-${sp.type} ${on ? 'on' : ''}" data-lo="${id}" title="${sp.text}"><span class="art spic" style="${spellIcon(sp)}"></span>
        <span><b>${sp.name}</b><span class="meta">${KIND[sp.kind]} · ${sp.dmg ? `${sp.dmg}${sp.hits > 1 ? '×' + sp.hits : ''} st · ` : ''}${sp.cost} ma lực · ×${DECKS[cfg.me].list[id]}</span></span></button>`; }).join('')}</div>`;
}
function toggleLoadout(id){
  const cur = curLoadout(), k = cur.indexOf(id);
  if (k >= 0) cur.splice(k, 1); else if (cur.length < R.LOADOUT_MAX) cur.push(id);
  showStart();
}
function showEnd(){
  $('#dOverlay').innerHTML = `<div class="over"><div class="box"><h2>${S.winner === 0 ? 'Chiến thắng' : 'Thất bại'}</h2>
    <p>${S.winner === 0 ? 'Pháp sư đối thủ đã gục.' : 'Bạn đã cạn sinh lực.'} Đối thủ dùng ${S.side[1].label}. Thời gian: ${Math.floor(S.t)} giây.</p>
    <div class="row" style="justify-content:center"><button class="btn primary" data-dstart="1">Đấu lại</button><button class="btn" data-dmenu="1">Đổi sách / độ khó</button></div></div></div>`;
}

/* ---------- Điều khiển ---------- */
function press(){
  if (!S || S.over) return;
  if (S.clash) { S.clash.press[0]++; const r = $('#dClash').getBoundingClientRect(); FX.burst({x:r.left + r.width * parseFloat(getComputedStyle($('#dClash')).getPropertyValue('--m')) / 100, y:r.top + r.height * .45}, {color:[1,.85,.45], count:16, speed:180, life:.3}); }
}
const playing = () => S && !S.over && !$('#dOverlay').innerHTML;
document.addEventListener('click', e => {
  const set = (attr, key) => { const b = e.target.closest(`[${attr}]`); if (!b) return false; cfg[key] = b.getAttribute(attr); showStart(); return true; };
  if (set('data-dme', 'me') || set('data-dopp', 'opp') || set('data-ddiff', 'diff')) return;
  const lo = e.target.closest('[data-lo]'); if (lo) { toggleLoadout(lo.dataset.lo); return; }
  if (e.target.closest('[data-dmenu]')) { showStart(); return; }
  if (e.target.closest('[data-dstart]')) { try { localStorage.setItem('dp-duel', JSON.stringify(cfg)); } catch (er) {} $('#dOverlay').innerHTML = ''; newDuel(); return; }
  if (!playing()) return;
  const me = S.side[0];
  const pk = e.target.closest('[data-pk]'); if (pk) { choosePick(me, +pk.dataset.pk); return; }
  const dw = e.target.closest('[data-draw]'); if (dw) { ({one:drawOne, pick:startPick, refresh:refreshHand})[dw.dataset.draw](me); return; }
  const c = e.target.closest('.dcard'); if (c) { castHand(me, +c.dataset.hi); return; }
  if (e.target.closest('#dClash')) press();
});
document.addEventListener('keydown', e => {
  if (!playing()) return;
  if (e.code === 'Space') { if (!e.repeat) press(); e.preventDefault(); return; }
  const me = S.side[0], k = e.key.toLowerCase();
  if (me.pick) { if (k >= '1' && k <= '3') choosePick(me, +k - 1); else if (k === 'escape') cancelPick(me); else return; e.preventDefault(); return; }
  if (k >= '1' && k <= '4') castHand(me, +k - 1);
  else if (k === 'q') drawOne(me);
  else if (k === 'w') startPick(me);
  else if (k === 'e') refreshHand(me);
  else return;
  e.preventDefault();
});

// Chạy sprite sheet của đấu sĩ; khựng hình khi trúng đòn nặng thì hoạt ảnh cũng khựng theo
function animate(dt){
  if (!S || S.stop > 0) return;
  fxUpdate(S.over || S.intro > 0 ? dt : S.clash ? dt * .5 : dt, () => S.t);
  for (const s of S.side) {
    if (!s.anim) continue;
    const base = S.over && S.winner !== s.i ? 'ko' : s.cast ? 'cast' : 'idle';
    const css = tick(s.anim, dt, base, s.cast ? s.cast.t : 0), el = fighter(s.i).querySelector('.f-sprite');
    if (el && el.dataset.f !== css) { el.style.cssText = css; el.dataset.f = css; }
  }
}
let last = performance.now();
function frame(now){
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  step(dt); draw(); animate(dt);
  requestAnimationFrame(frame);
}
// Nạp gói pháp sư (nhân vật, sheet phép, dữ liệu phép) rồi mới mở màn chọn sách
$('#dOverlay').innerHTML = '<div class="over"><div class="box"><h2>Đang tải…</h2><p class="meta">Đang nạp pháp sư và phép.</p></div></div>';
loadMages().then(() => { buildDecks(); fixCfg(); showStart(); requestAnimationFrame(frame); })
  .catch(e => { $('#dOverlay').innerHTML = `<div class="over"><div class="box"><h2>Lỗi tải</h2><p class="meta">${e.message}</p></div></div>`; });
