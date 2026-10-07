import './base.css';
import './duel.css';
import { $, EL } from './config.js';
import { applyArt } from './art.js';
import { frameStyle, loadSheets, makeAnimator, play, sheetOf, tick } from './anim.js';
import { FX } from '../fx/three-fx.js';
import { BOOKS, DIFF, DUEL_DECKS, DUEL_WEATHER, RULES as R, SPELLS } from './data.js';

/* ---------- Đấu Trường Phép Thuật: đấu phép thời gian thực ----------
   Lối chơi kiểu Asuka: 4 lá xoay vòng từ sách phép, ma lực hồi liên tục, mỗi phép có thời gian niệm mà đối thủ nhìn thấy.
   Hiển thị kiểu game đối kháng: hai đấu sĩ trên sân khấu ngang, HUD đối xứng, phép có hình theo hệ và vệt hạt. */
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.random() * a.length | 0];

// Sổ phép chung: phép bài (id lá) và phép sách ('chimera.QQE')
const SP = {};
for (const [id, s] of Object.entries(SPELLS))
  SP[id] = {...s, id, type:s.self ? (s.shield || s.mirror ? 'counter' : 'support') : s.interrupt ? 'counter' : 'atk'};
for (const [bk, b] of Object.entries(BOOKS)) for (const [key, s] of Object.entries(b.spells)) SP[`${bk}.${key}`] = {...s, id:`${bk}.${key}`};
// 6 bộ: 2 trường phái gốc + 4 sách theo linh thú (mỗi phép 2 bản, phép từ 5 ma lực 1 bản)
const DECKS = {...DUEL_DECKS};
for (const [bk, b] of Object.entries(BOOKS))
  DECKS[bk] = {name:b.name, portrait:b.portrait, hero:b.hero, tip:b.desc, list:Object.fromEntries(Object.entries(b.spells).map(([k, s]) => [`${bk}.${k}`, s.cost >= 5 ? 1 : 2]))};
const TYPE = {atk:'Tấn công', counter:'Phản chú', support:'Hỗ trợ'};
const COL = {water:[.4,.7,1], storm:[1,.95,.4], fire:[1,.5,.1], ice:[.7,.9,1], earth:[.75,.55,.3], light:[1,.95,.6], dark:[.6,.35,.95], mind:[.95,.45,.8]};
const IMPACT = {fire:'fire', storm:'bolt', ice:'petrify', earth:'shatter'};
const isDef = sp => !!(sp.shield || sp.mirror || sp.evade || sp.nullify || sp.barrier);
const isHeal = sp => !!(sp.heal || sp.regen || sp.rebirth);

let S = null;
let cfg = {me:'chimera', opp:'random', diff:'normal', loadout:{}};
try { Object.assign(cfg, JSON.parse(localStorage.getItem('dp-duel') || '{}')); } catch (e) {}
if (!cfg.loadout || typeof cfg.loadout !== 'object') cfg.loadout = {};
if (!DECKS[cfg.me]) cfg.me = 'chimera';
if (cfg.opp !== 'random' && !DECKS[cfg.opp]) cfg.opp = 'random';

/* ---------- Phép mang vào trận: chọn 5–8 phép trong sách ---------- */
const poolOf = deck => Object.keys(DECKS[deck].list);
function defaultLoadout(deck){
  // Mặc định: cả sách; sách nhiều hơn 8 phép thì bớt phép hỗ trợ ở cuối
  const pool = poolOf(deck), drop = new Set();
  for (const id of [...pool].reverse()) if (pool.length - drop.size > R.LOADOUT_MAX && SP[id].type === 'support') drop.add(id);
  return pool.filter(id => !drop.has(id)).slice(0, R.LOADOUT_MAX);
}
function loadoutOf(deck){
  const pool = poolOf(deck), l = (cfg.loadout[deck] || []).filter(id => pool.includes(id));
  return l.length >= Math.min(R.LOADOUT_MIN, pool.length) && l.length <= R.LOADOUT_MAX ? l : defaultLoadout(deck);
}
const aiLoadout = deck => shuffle(poolOf(deck)).slice(0, R.LOADOUT_MAX);

/* ---------- Tạo trận ---------- */
function mkSide(i, deck, chosen){
  const D = DECKS[deck], s = {i, deck, name:i ? 'Máy' : 'Bạn', label:D.name, portrait:D.portrait, hp:R.HP, mana:R.MANA_START, regen:0, hpAcc:0,
    cast:null, next:null, drawing:null, pick:null, st:{}, shield:0, mirror:0, evade:0, barrier:null, pets:[], lastCast:-9, hand:[], queue:[]};
  for (const id of chosen) for (let k = 0; k < D.list[id]; k++) s.queue.push(id);
  shuffle(s.queue); s.hand = s.queue.splice(0, R.HAND);
  s.anim = sheetOf(D.hero) ? makeAnimator(sheetOf(D.hero)) : null;   // nhân vật có hoạt ảnh của sách
  return s;
}
function newDuel(){
  const opp = cfg.opp === 'random' ? pick(Object.keys(DECKS).filter(k => k !== cfg.me)) : cfg.opp;
  S = {t:0, over:false, winner:null, side:[mkSide(0, cfg.me, loadoutOf(cfg.me)), mkSide(1, opp, aiLoadout(opp))], proj:[], pending:[], clash:null, stop:0, intro:R.INTRO,
    weather:'clear', wNext:R.WEATHER_EVERY, frenzy:false, aiNext:1.2, seen:new Set(), diff:DIFF[cfg.diff]};
  renderStatic(); renderHand();
  banner('Sẵn sàng…', 'var(--ink)');
}

/* ---------- Niệm phép ---------- */
const castTime = (s, sp) => sp.cast * (s.st.frozen ? 2 : 1) * (s.st.slow ? 2 : 1) * (s.st.haste ? .5 : 1);
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
  const sp = SP[c.id], bonus = 0;
  play(s.anim, castAnim(sp));
  if (sp.self) applySelf(s, sp, bonus);
  else {
    launch(s, sp, bonus, true);
    if (sp.volley) for (let k = 1; k < sp.volley.n; k++) S.pending.push({at:S.t + k * sp.volley.gap, s, sp, bonus});
  }
}
// Động tác khi phóng phép: tấn công lớn → tụ lực, khiên/rào chắn/xoá phép → hào quang, gương/né → thủ thế, gọi linh thú → triệu hồi, còn lại → toả sáng
const castAnim = sp => !sp.self ? (sp.cost >= 5 ? 'power' : 'release')
  : sp.shield || sp.barrier || sp.nullify ? 'aura' : sp.mirror || sp.evade ? 'guard' : sp.pet ? 'summon' : 'buff';
function launch(s, sp, bonus, fromCast, fromPet){
  const o = S.side[1 - s.i];
  const p = {from:s.i, to:o.i, sp, bonus, k:0, travel:sp.travel || R.TRAVEL, reflected:false, pet:!!fromPet,
    clashable:fromCast && sp.dmg > 0 && !sp.noClash && !sp.volley, small:!fromCast || !!sp.volley};
  // Đấu Đũa: hai phép sát thương bay ngược chiều nhau thì va nhau giữa sân
  const rival = p.clashable && S.proj.find(q => q.from === o.i && q.clashable && !q.reflected);
  S.proj.push(p);
  if (rival && !S.clash) { S.clash = {mine:s.i === 0 ? p : rival, theirs:s.i === 0 ? rival : p, t:0, press:[0, 0], aiAcc:0, push:.5}; banner('Đấu Đũa!', 'var(--brass)'); }
}
function applySelf(s, sp, bonus){
  const o = S.side[1 - s.i];
  if (sp.shield) { s.shield = S.t + sp.shield + bonus; float(s.i, 'Khiên!', '#9fd0ff'); FX.anim(at(s.i), 'shield', {to:5, fps:14}); }
  if (sp.mirror) { s.mirror = S.t + sp.mirror + bonus; float(s.i, 'Gương!', '#d8f0ff'); FX.anim(at(s.i), 'mirror', {to:4, fps:12}); }
  if (sp.evade) { s.evade = S.t + sp.evade + bonus * .5; float(s.i, 'Né!', '#cfe8ff'); }
  if (sp.barrier) { s.barrier = {hp:sp.barrier.hp + bonus * 2, until:S.t + sp.barrier.dur}; float(s.i, `Rào chắn ${s.barrier.hp}`, '#d9c08a'); FX.anim(at(s.i), 'shield', {to:5, fps:14}); }
  if (sp.cleanse) { for (const k of ['wet', 'burn', 'frozen', 'stun', 'curse', 'weak', 'slow']) delete s.st[k]; float(s.i, 'Thanh tẩy', 'var(--good)'); }
  if (sp.heal) { heal(s, sp.heal + bonus * 2); FX.anim(at(s.i), 'heal', {from:2, fps:12}); }
  if (sp.regen) { s.st.regen = {rate:sp.regen.rate, until:S.t + sp.regen.dur + bonus}; FX.anim(at(s.i), 'heal', {from:2, fps:12}); }
  if (sp.haste) { s.st.haste = S.t + sp.haste + bonus; float(s.i, 'Tăng tốc!', '#ffe9a0'); FX.rise(at(s.i), [1,.9,.5], 50); }
  if (sp.rebirth) { s.st.rebirth = S.t + sp.rebirth + bonus; float(s.i, 'Lửa tái sinh', '#ffb36b'); FX.anim(at(s.i), 'fire', {from:1, to:5}); }
  if (sp.manaGain) s.mana = Math.min(R.MANA_MAX, s.mana + sp.manaGain);
  if (sp.weather) setWeather(sp.weather);
  if (sp.nullify) {
    const gone = S.proj.filter(p => p.to === s.i);
    S.proj = S.proj.filter(p => p.to !== s.i); S.pending = S.pending.filter(q => q.s === s);
    if (gone.length) float(s.i, `Xoá ${gone.length} phép!`, '#cfe8ff', true);
    if (o.cast) { interrupt(o); }
    FX.anim(at(s.i), 'patronus', {to:5, size:260, fps:13}); FX.shake(6);
  }
  if (sp.pet) { s.pets.push({...sp.pet, until:S.t + sp.pet.dur + bonus, next:S.t + .4}); float(s.i, `${sp.pet.name} xuất hiện!`, '#ffd28a'); FX.anim(at(s.i), 'summon', {fps:16}); }
}
function interrupt(t){
  banner('Ngắt phép!', 'var(--bad)'); float(t.i, SP[t.cast.id].name + ' bị huỷ', 'var(--bad)');
  FX.anim(at(t.i, .5), 'fizzle', {fps:15}); t.cast = null; t.next = null;
}

/* ---------- Trúng đích ---------- */
function land(p){
  const sp = p.sp, t = S.side[p.to], c = S.side[p.from];
  if (t.evade > S.t) { float(t.i, 'Trượt!', '#cfe8ff'); return; }
  if (sp.dmg > 0 && t.mirror > S.t && !p.reflected) {
    t.mirror = 0; banner('Phản!', '#d8f0ff'); FX.anim(at(t.i), 'mirror', {to:4, fps:14});
    S.proj.push({...p, from:p.to, to:p.from, k:0, reflected:true, clashable:false}); return;
  }
  if (t.shield > S.t) { t.shield = 0; float(t.i, 'Chặn!', '#9fd0ff', true); FX.anim(at(t.i), 'shield', {from:3, fps:14}); FX.burst(at(t.i), {color:[.6,.8,1], count:70, speed:180}); return; }
  const st = t.st;
  let n = 0, burn = sp.burn;
  if (sp.dmg) {
    n = sp.dmg + p.bonus + (DUEL_WEATHER[S.weather].mod[sp.el] || 0);
    if (c.st.weak) n -= 2;
    if (sp.el === 'storm' && st.wet) { n += 3; delete st.wet; react('Giật lan', EL.storm.c); }
    else if (sp.el === 'fire' && st.wet) { n -= 2; delete st.wet; burn = false; react('Dập lửa', EL.water.c); }
    else if (sp.el === 'fire' && st.frozen) { n *= 2; delete st.frozen; react('Hơi nước', '#f2f2f2'); }
    else if (sp.el === 'ice' && st.burn) { n += 1; delete st.burn; react('Tan chảy', EL.ice.c); }
    if (st.curse) n *= 1.5;
    n = Math.max(0, Math.round(n));
  }
  const dealt = n > 0 ? damage(t, n) : 0;
  if (dealt && sp.drain) { const h = Math.round(dealt * sp.drain); if (h) heal(c, h); }
  if (S.over) return;
  if (sp.wet) st.wet = S.t + R.WET;
  if (burn) st.burn = {until:S.t + R.BURN, next:S.t + R.BURN_TICK};
  if (sp.freeze) { const deep = !!st.wet; delete st.wet; st.frozen = Math.max(st.frozen || 0, S.t + sp.freeze + (deep ? 2 : 0)); if (deep) react('Đóng băng sâu', EL.ice.c); }
  if (sp.interrupt && t.cast) { interrupt(t); st.stun = Math.max(st.stun || 0, S.t + R.STUN); }
  if (sp.stun) st.stun = Math.max(st.stun || 0, S.t + sp.stun);
  if (sp.manaBurn) { const m = Math.min(t.mana, sp.manaBurn); t.mana -= m; if (m) float(t.i, `−${m} ma lực`, '#9ad2ff'); }
  if (sp.manaSteal) { const m = Math.min(t.mana, sp.manaSteal); t.mana -= m; c.mana = Math.min(R.MANA_MAX, c.mana + m); if (m) float(t.i, `Bị hút ${m} ma lực`, '#9ad2ff'); }
  if (sp.curse) { st.curse = S.t + sp.curse; float(t.i, 'Bị nguyền!', '#c58cf0'); }
  if (sp.weaken) st.weak = S.t + sp.weaken;
  if (sp.slow) st.slow = S.t + sp.slow;
  const col = COL[sp.el] || [1,1,1];
  FX.burst(at(t.i), {color:col, count:p.small ? 30 : 90, speed:p.small ? 140 : 230});
  if (!p.small && IMPACT[sp.el]) FX.anim(at(t.i), IMPACT[sp.el], {fps:16});
  if (!p.small) FX.ring(at(t.i), col, 90, .45);
}
function damage(t, n){
  if (t.barrier && t.barrier.until > S.t) {
    const a = Math.min(t.barrier.hp, n); t.barrier.hp -= a; n -= a;
    if (a) float(t.i, `Rào chắn −${a}`, '#d9c08a');
    if (t.barrier.hp <= 0) t.barrier = null;
  }
  if (n <= 0) return 0;
  t.hp = Math.max(0, t.hp - n); float(t.i, '−' + n, 'var(--bad)', n >= 5);
  hitFx(t.i, n);
  if (t.hp <= 0 && t.st.rebirth > S.t) { t.hp = 8; delete t.st.rebirth; banner('Tái sinh!', '#ffb36b'); FX.anim(at(t.i), 'fire', {from:1, to:6}); return n; }
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
    for (const k of ['wet', 'frozen', 'stun', 'curse', 'weak', 'slow', 'haste', 'rebirth']) if (st[k] && st[k] <= S.t) delete st[k];
    if (st.regen && st.regen.until <= S.t) delete st.regen;
    if (s.barrier && s.barrier.until <= S.t) s.barrier = null;
    if (st.regen) { s.hpAcc += dt * st.regen.rate; if (s.hpAcc >= 1) { const h = Math.floor(s.hpAcc); s.hpAcc -= h; s.hp = Math.min(R.HP, s.hp + h); } }
    if (st.burn) { if (S.t >= st.burn.next) { st.burn.next += R.BURN_TICK; damage(s, 1); } if (st.burn && S.t >= st.burn.until) delete st.burn; }
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
    for (const pet of s.pets) if (S.t >= pet.next) { pet.next += pet.every; launch(s, pet, 0, false, true); }
    s.pets = s.pets.filter(pet => pet.until > S.t);
    if (S.over) return;
  }
  for (const q of [...S.pending]) if (S.t >= q.at) { S.pending.splice(S.pending.indexOf(q), 1); launch(q.s, q.sp, q.bonus, false); }
  for (const p of [...S.proj]) {
    p.k += dt / p.travel;
    if (p.k >= 1) { const i = S.proj.indexOf(p); if (i >= 0) S.proj.splice(i, 1); land(p); if (S.over) return; }
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
  S.proj.splice(S.proj.indexOf(l), 1);
  w.bonus += 2; w.k = .5; w.clashable = false;      // phép thắng bay tiếp từ giữa sân, mạnh thêm 2
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
    if (p.to !== 1 || !p.sp.dmg || p.small || S.seen.has(p)) continue;
    const age = p.k * p.travel, left = (1 - p.k) * p.travel;
    if (age < D.delay) continue;
    S.seen.add(p);
    if (me.shield > S.t || me.mirror > S.t || me.evade > S.t || Math.random() > D.block) continue;
    const rank = id => sp(id).mirror ? 2 : sp(id).evade || sp(id).nullify ? 1 : 0;
    const def = ready.filter(id => isDef(sp(id)) && castTime(me, sp(id)) < left - .03).sort((a, b) => rank(b) - rank(a));
    if (def.length) { cast(def[0]); return; }
  }
  // 2. Bạn đang niệm phép lớn: ngắt nếu kịp
  const yc = you.cast;
  if (yc && S.t - yc.started >= D.delay && (sp(yc.id).cost >= 3 || yc.dur >= 1)) {
    const intr = ready.filter(id => (sp(id).interrupt || sp(id).nullify) && castTime(me, sp(id)) + (sp(id).self ? 0 : sp(id).travel || R.TRAVEL) < yc.dur - yc.t - .05);
    if (intr.length) { cast(intr[0]); return; }
  }
  // Tự rút phép: ô trống mà không còn phép niệm được, hoặc trống từ 2 ô
  const empties = me.hand.filter(id => !id).length, held = me.hand.filter(Boolean);
  if (empties && (!ready.length || empties >= 2)) {
    if (me.mana >= 4 && Math.random() < .35 && startPick(me)) { aiChoose(me, held); return; }
    if (drawOne(me)) return;
  }
  // Tay toàn phép thủ/hỗ trợ không dùng được: thay cả tay để tìm phép tấn công
  const atkHeld = held.some(id => sp(id).dmg > 0 && !sp(id).interrupt);
  if (!empties && !atkHeld && me.mana >= R.REFRESH_COST + 2 && Math.random() < .5 && refreshHand(me)) return;
  if (!ready.length && !empties && me.mana >= 7 && Math.random() < .25 && refreshHand(me)) return;
  aiCast(me, you, ready, cast, sp);
  // Không niệm gì mà còn ô trống thì tranh thủ rút cho đầy tay
  if (free(me) && emptySlot(me) >= 0) drawOne(me);
}
function aiCast(me, you, ready, cast, sp){
  if (S.t - me.lastCast < S.diff.gap) return;        // nghỉ giữa 2 phép theo độ khó
  // 3. Máu thấp: hồi
  if (me.hp <= 12) { const h = ready.find(id => isHeal(sp(id))); if (h) { cast(h); return; } }
  // 4. Combo phản ứng: đối thủ Ướt → Sét, Đóng băng → Lửa
  const combo = ready.filter(id => sp(id).dmg > 0 && ((you.st.wet && sp(id).el === 'storm') || (you.st.frozen && sp(id).el === 'fire')))
    .sort((a, b) => sp(b).dmg - sp(a).dmg)[0];
  if (combo) { cast(combo); return; }
  // 5. Hỗ trợ khi dư ma lực: linh thú, tăng tốc, thời tiết, nguyền
  const sup = ready.filter(id => (sp(id).pet && !me.pets.length) || (sp(id).haste && !me.st.haste) || (sp(id).curse && !you.st.curse)
    || (sp(id).weather && sp(id).weather !== S.weather) || (sp(id).manaSteal && you.mana >= 3) || (sp(id).regen && me.hp <= 24)
    || (sp(id).rebirth && me.hp <= 14));
  if (sup.length && (me.mana >= 5 || Math.random() < .5)) { cast(pick(sup)); return; }
  // 6. Mở combo (Ướt / Đóng băng) nếu có phép nối, không thì phép tấn công mạnh nhất (đôi khi nhịn để dồn phép lớn)
  const setup = ready.find(id => !you.st.wet && !you.st.frozen && (sp(id).wet || sp(id).freeze >= 2)
    && me.hand.some(f => f && f !== id && sp(f).dmg >= 2 && sp(f).el === (sp(id).wet ? 'storm' : 'fire')));
  if (setup) { cast(setup); return; }
  const big = me.hand.find(id => id && sp(id).cost >= 5 && sp(id).dmg);
  if (big && me.mana < sp(big).cost && me.mana >= sp(big).cost - 2 && Math.random() < S.diff.hoard) return;
  const atk = ready.filter(id => sp(id).dmg > 0 && !sp(id).interrupt)
    .sort((a, b) => sp(b).dmg * (sp(b).volley ? sp(b).volley.n : 1) - sp(a).dmg * (sp(a).volley ? sp(a).volley.n : 1));
  if (atk.length) { cast(atk[0]); return; }
  // Không có phép tấn công: giải phóng ô bằng phép hỗ trợ còn lại (giữ lại 1 phép thủ để đỡ đòn)
  const spare = ready.filter(id => sp(id).self && !isDef(sp(id)) && !sp(id).weather);
  if (spare.length && me.mana >= 6) cast(spare[0]);
}

// Máy chọn 1 trong 3 lá: thiếu phòng thủ thì lấy phòng thủ, máu thấp thì lấy hồi máu, còn lại lấy phép mạnh nhất
function aiChoose(me, held){
  const o = me.pick.opts, score = id => {
    const p = SP[id];
    if (isDef(p) && !held.some(h => isDef(SP[h]))) return 50;
    if (isHeal(p) && me.hp <= 14) return 40;
    return (p.dmg || 0) * (p.volley ? p.volley.n : 1) + (p.pet ? 4 : 0) + (p.interrupt ? 3 : 0);
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
  const pic = s.anim ? `<span class="h-pic sheet" style="${frameStyle(s.anim.m, 'idle')}"></span>` : `<span class="h-pic art art-${s.portrait} k-creature"></span>`;
  return `<div class="h-top">${pic}
      <div class="h-id"><b>${s.name}</b><span class="meta">${s.label}</span></div></div>
    <div class="h-hp"><i class="trail"></i><i class="fill"></i><span class="lp">${s.hp}</span></div>
    <div class="h-mana">${[...Array(R.MANA_MAX)].map(() => '<i></i>').join('')}<b></b></div>
    <div class="h-st"></div><div class="h-hand meta"></div>`;
}
function fighterHTML(s){
  return `<div class="f-pets"></div><div class="f-spell"></div>
    <div class="f-circle"><i></i><i></i></div><div class="f-bubble"></div>
    ${s.anim ? `<div class="f-sprite sheet" style="${frameStyle(s.anim.m, 'idle')}"></div>` : `<div class="f-sprite art art-${s.portrait} k-creature"></div>`}<div class="f-shadow"></div>
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
    <span class="cost">${sp.cost}</span><div class="cname">${sp.name}</div><div class="cart art art-${sp.art}"></div>
    <div class="cstats"><span>${TYPE[sp.type]} · ${sp.cast}s</span></div><span class="dkey">${key}</span><span class="dfill"></span></button>`;
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
  if (st.curse) c('d-cu', `Bị nguyền ${left(st.curse)}`);
  if (st.weak) c('d-cu', `Chói mắt ${left(st.weak)}`);
  if (st.slow) c('d-cu', `Chậm ${left(st.slow)}`);
  if (st.haste) c('d-good', `Tăng tốc ${left(st.haste)}`);
  if (st.regen) c('d-good', `Hồi máu ${left(st.regen.until)}`);
  if (st.rebirth) c('d-good', `Tái sinh ${left(st.rebirth)}`);
  if (s.shield > S.t) c('d-sh', `Khiên ${left(s.shield)}`);
  if (s.mirror > S.t) c('d-mi', `Gương ${left(s.mirror)}`);
  if (s.evade > S.t) c('d-mi', `Né ${left(s.evade)}`);
  if (s.barrier) c('d-ba', `Rào chắn ${s.barrier.hp}`);
  return out.join('');
}
function setHTML(el, html){ if (el && el.innerHTML !== html) el.innerHTML = html; }
// Vị trí phép trên sân (px trong sân khấu): bay vòng cung giữa hai đấu sĩ, phép giáng thì rơi thẳng từ trời
function projPos(p, W, H){
  const xa = p.from === 0 ? .2 : .8, xb = p.from === 0 ? .8 : .2, y0 = .5;
  let k = p.k;
  if (S.clash && (p === S.clash.mine || p === S.clash.theirs)) { const m = .2 + .6 * (.15 + .7 * S.clash.push); return {x:m * W, y:y0 * H, a:0}; }
  if (p.travel > 1.2) return {x:xb * W, y:(-.1 + (y0 + .1) * k) * H, a:90};
  const x = (xa + (xb - xa) * k) * W, y = (y0 - Math.sin(Math.PI * k) * (p.small ? .08 : .16)) * H;
  const a = Math.atan2(-Math.cos(Math.PI * k) * (p.small ? .08 : .16) * Math.PI * H, (xb - xa) * W) * 180 / Math.PI;
  return {x, y, a};
}
let trailTick = 0;
function draw(){
  if (!S) return;
  const warned = [0, 1].map(i => S.proj.some(p => p.to === i && p.travel > 1.2));
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
    setHTML(f.querySelector('.f-pets'), s.pets.map((p, k) => `<span class="pet" style="--k:${k}"><i class="art art-${p.art} k-creature"></i><b>${Math.ceil(p.until - S.t)}</b></span>`).join(''));
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
  // Phép bay: hình theo hệ + vệt hạt three.js
  const stage = $('.d-stage'), r = stage.getBoundingClientRect(), W = r.width, H = r.height;
  trailTick++;
  setHTML($('#dProj'), S.proj.map(p => {
    const q = projPos(p, W, H), size = p.small ? 12 + p.sp.dmg * 3 : 18 + (p.sp.dmg + p.bonus) * 4;
    if (trailTick % 2 === 0 && !S.stop) FX.burst({x:r.left + q.x, y:r.top + q.y}, {color:COL[p.sp.el] || [1,1,1], count:p.small ? 1 : 3, speed:30, life:.4, size:p.small ? 7 : 12, spread:3});
    return `<i class="pj el-${p.sp.el || 'none'}${p.reflected ? ' refl' : ''}${p.travel > 1.2 ? ' fall' : ''}" style="left:${q.x.toFixed(1)}px;top:${q.y.toFixed(1)}px;--s:${size}px;--a:${q.a.toFixed(0)}deg"></i>`;
  }).join(''));
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
    const pic = sheetOf(D.hero) ? `<span class="art sheet" style="${frameStyle(sheetOf(D.hero), 'idle')}"></span>` : `<span class="art art-${D.portrait} k-creature"></span>`;
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
      return `<button class="d-lo t-${sp.type} ${on ? 'on' : ''}" data-lo="${id}" title="${sp.text}"><span class="art art-${sp.art}"></span>
        <span><b>${sp.name}</b><span class="meta">${TYPE[sp.type]} · ${sp.cost} ma lực · ×${DECKS[cfg.me].list[id]}</span></span></button>`; }).join('')}</div>`;
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
applyArt();
loadSheets().then(() => { if (!S) showStart(); });   // có hoạt ảnh thì vẽ lại màn chọn sách với hình nhân vật
showStart();
requestAnimationFrame(frame);
