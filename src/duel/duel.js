import '../styles.css';
import './duel.css';
import { $, EL } from '../config.js';
import { DB } from '../data/cards.js';
import { applyArt } from '../ui/art.js';
import { FX } from '../fx/three-fx.js';
import { BOOKS, DIFF, DUEL_DECKS, DUEL_WEATHER, ORB_KEYS, ORB_PASSIVE, RULES as R, SPELLS } from './data.js';

/* ---------- Đấu phép tốc độ (bản thử): không có lượt, ma lực hồi liên tục, phép có thời gian niệm ----------
   Hai lối chơi: Học giả (4 lá xoay vòng từ bộ phép) và Kết ấn sư (nạp 3 cầu nguyên tố rồi kết ấn thành phép). */
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.random() * a.length | 0];

// Sổ phép chung: phép bài (id lá) và phép Ấn thư ('chimera.QQE')
const SP = {};
for (const [id, s] of Object.entries(SPELLS))
  SP[id] = {...s, id, name:DB[id].name, art:id, type:s.self ? (s.shield || s.mirror ? 'counter' : 'support') : s.interrupt ? 'counter' : 'atk'};
for (const [bk, b] of Object.entries(BOOKS)) for (const [key, s] of Object.entries(b.spells)) SP[`${bk}.${key}`] = {...s, id:`${bk}.${key}`, key, book:bk};
const TYPE = {atk:'Tấn công', counter:'Phản chú', support:'Hỗ trợ'};
const isDef = sp => !!(sp.shield || sp.mirror || sp.evade || sp.nullify || sp.barrier);
const isHeal = sp => !!(sp.heal || sp.regen || sp.rebirth);

let S = null;
let cfg = {style:'invoke', book:'chimera', me:'thuyloi', opp:'random', diff:'normal'};
try { Object.assign(cfg, JSON.parse(localStorage.getItem('dp-duel') || '{}')); } catch (e) {}

/* ---------- Tạo trận ---------- */
function mkSide(i, o){
  const s = {i, mode:o.mode, name:i ? 'Máy' : 'Bạn', hp:R.HP, mana:R.MANA_START, regen:0, hpAcc:0, cast:null, st:{}, cd:{},
    shield:0, mirror:0, evade:0, barrier:null, pets:[], lastCast:-9, hand:[], queue:[], orbs:[], slots:[], invokeAt:0};
  if (o.mode === 'cards') {
    s.deckKey = o.deck; const D = DUEL_DECKS[o.deck];
    for (const [id, n] of Object.entries(D.list)) for (let k = 0; k < n; k++) s.queue.push(id);
    shuffle(s.queue); s.hand = s.queue.splice(0, R.HAND);
    s.portrait = D.portrait; s.label = D.name;
  } else {
    s.bookKey = o.book; const B = BOOKS[o.book];
    s.portrait = B.portrait; s.label = B.name; s.orbs = [0, 1, 2];
  }
  return s;
}
function oppChoice(){
  const style = cfg.opp === 'random' ? pick(['invoke', 'cards']) : cfg.opp;
  if (style === 'cards') return {mode:'cards', deck:pick(Object.keys(DUEL_DECKS).filter(k => cfg.style !== 'cards' || k !== cfg.me))};
  return {mode:'invoke', book:pick(Object.keys(BOOKS).filter(k => cfg.style !== 'invoke' || k !== cfg.book))};
}
function newDuel(){
  const me = cfg.style === 'cards' ? {mode:'cards', deck:cfg.me} : {mode:'invoke', book:cfg.book};
  S = {t:0, over:false, winner:null, side:[mkSide(0, me), mkSide(1, oppChoice())], proj:[], pending:[], clash:null,
    weather:'clear', wNext:R.WEATHER_EVERY, frenzy:false, aiNext:1.2, ai:{queue:[], next:0}, seen:new Set(), diff:DIFF[cfg.diff]};
  renderStatic(); renderControls(); renderBook();
}

/* ---------- Chỉ số thụ động từ cầu đang giữ (Kết ấn sư) ---------- */
const orbN = (s, el) => s.mode === 'invoke' ? s.orbs.filter(o => BOOKS[s.bookKey].orbs[o] === el).length : 0;
const castTime = (s, sp) => sp.cast * (s.st.frozen ? 2 : 1) * (s.st.slow ? 2 : 1) * (s.st.haste ? .5 : 1) * (1 - .1 * orbN(s, 'storm'));
const cdOf = (s, sp) => (sp.cd || 0) * (1 - .1 * orbN(s, 'mind'));

/* ---------- Niệm phép ---------- */
function canBegin(s, id){
  const sp = SP[id];
  return !!sp && !S.over && !S.clash && !s.cast && !s.st.stun && s.mana >= sp.cost && !(s.cd[id] > S.t);
}
function beginCast(s, id){
  const sp = SP[id];
  s.mana -= sp.cost; if (sp.cd) s.cd[id] = S.t + cdOf(s, sp);
  s.cast = {id, t:0, dur:castTime(s, sp), perfect:false, tried:false, started:S.t};
  s.lastCast = S.t;
  if (s.i === 1 && Math.random() < S.diff.perfect) s.cast.aiPerfect = R.PERFECT[0] + Math.random() * (R.PERFECT[1] - R.PERFECT[0]);
}
function castHand(s, hi){
  const id = s.hand[hi]; if (!id || !canBegin(s, id)) return false;
  s.hand.splice(hi, 1); s.queue.push(id); s.hand.push(s.queue.shift());   // lá vừa dùng xuống đáy bộ, rút lá kế
  beginCast(s, id); if (s.i === 0) renderControls();
  return true;
}
function castSlot(s, j){
  const id = s.slots[j]; if (!id || !canBegin(s, id)) return false;
  beginCast(s, id); return true;
}
// Kết ấn sư: nạp cầu (đẩy cầu cũ nhất ra), kết ấn thành phép vào ô D, phép cũ ở D lùi sang F
function pushOrb(s, o){ s.orbs.push(o); if (s.orbs.length > 3) s.orbs.shift(); }
const comboKey = orbs => [...orbs].sort((a, b) => a - b).map(o => ORB_KEYS[o]).join('');
function invoke(s){
  if (s.orbs.length < 3 || S.t < s.invokeAt || S.over) return false;
  const id = `${s.bookKey}.${comboKey(s.orbs)}`;
  s.invokeAt = S.t + R.INVOKE_CD;
  if (s.slots[0] === id) return true;
  s.slots = [id, ...s.slots.filter(x => x !== id)].slice(0, 2);
  if (s.i === 0) { float(0, `Kết ấn: ${SP[id].name}`, 'var(--brass)'); renderControls(); }
  return true;
}
function tryPerfect(s){
  const c = s.cast; if (!c || c.tried) return;
  c.tried = true; const k = c.t / c.dur;
  if (k >= R.PERFECT[0] && k <= R.PERFECT[1]) { c.perfect = true; float(s.i, 'Niệm chuẩn!', 'var(--brass)', true); }
  else float(s.i, 'Hụt nhịp', 'var(--mute)');
}
function finishCast(s){
  const c = s.cast; s.cast = null;
  const sp = SP[c.id], bonus = c.perfect ? 1 : 0;
  if (sp.self) { applySelf(s, sp, bonus); return; }
  launch(s, sp, bonus, true);
  if (sp.volley) for (let k = 1; k < sp.volley.n; k++) S.pending.push({at:S.t + k * sp.volley.gap, s, sp, bonus});
}
function launch(s, sp, bonus, fromCast){
  const o = S.side[1 - s.i];
  const p = {from:s.i, to:o.i, sp, bonus, k:0, travel:sp.travel || R.TRAVEL, reflected:false,
    clashable:fromCast && sp.dmg > 0 && !sp.noClash && !sp.volley, small:!fromCast || !!sp.volley};
  // Đấu Đũa: hai phép sát thương bay ngược chiều nhau thì va nhau giữa sân
  const rival = p.clashable && S.proj.find(q => q.from === o.i && q.clashable && !q.reflected);
  S.proj.push(p);
  if (rival && !S.clash) S.clash = {mine:s.i === 0 ? p : rival, theirs:s.i === 0 ? rival : p, t:0, press:[0, 0], aiAcc:0, push:.5};
}
function applySelf(s, sp, bonus){
  const o = S.side[1 - s.i];
  if (sp.shield) { s.shield = S.t + sp.shield + bonus; float(s.i, 'Khiên!', '#9fd0ff'); FX.ring(sel(s.i), [.6,.8,1], 80, .6); }
  if (sp.mirror) { s.mirror = S.t + sp.mirror + bonus; float(s.i, 'Gương!', '#d8f0ff'); FX.ring(sel(s.i), [.85,.95,1], 80, .6); }
  if (sp.evade) { s.evade = S.t + sp.evade + bonus * .5; float(s.i, 'Né!', '#cfe8ff'); }
  if (sp.barrier) { s.barrier = {hp:sp.barrier.hp + bonus * 2, until:S.t + sp.barrier.dur}; float(s.i, `Rào chắn ${s.barrier.hp}`, '#d9c08a'); FX.ring(sel(s.i), [.85,.7,.4], 90, .6); }
  if (sp.cleanse) { for (const k of ['wet', 'burn', 'frozen', 'stun', 'curse', 'weak', 'slow']) delete s.st[k]; float(s.i, 'Thanh tẩy', 'var(--good)'); }
  if (sp.heal) heal(s, sp.heal + bonus * 2);
  if (sp.regen) s.st.regen = {rate:sp.regen.rate, until:S.t + sp.regen.dur + bonus};
  if (sp.haste) { s.st.haste = S.t + sp.haste + bonus; float(s.i, 'Tăng tốc!', '#ffe9a0'); }
  if (sp.rebirth) { s.st.rebirth = S.t + sp.rebirth + bonus; float(s.i, 'Lửa tái sinh', '#ffb36b'); }
  if (sp.manaGain) s.mana = Math.min(R.MANA_MAX, s.mana + sp.manaGain);
  if (sp.weather) setWeather(sp.weather);
  if (sp.nullify) {
    const gone = S.proj.filter(p => p.to === s.i);
    S.proj = S.proj.filter(p => p.to !== s.i); S.pending = S.pending.filter(q => q.s === s);
    if (gone.length) float(s.i, `Xoá ${gone.length} phép!`, '#cfe8ff', true);
    if (o.cast) { float(o.i, `Ngắt phép ${SP[o.cast.id].name}!`, 'var(--bad)', true); o.cast = null; }
    FX.ring({center:true}, [.8,.9,1], 260, .7); FX.shake(5);
  }
  if (sp.pet) { s.pets.push({...sp.pet, until:S.t + sp.pet.dur + bonus, next:S.t + .4}); float(s.i, `${sp.pet.name} xuất hiện!`, '#ffd28a'); FX.rise(sel(s.i), [1,.8,.4], 50); }
}

/* ---------- Trúng đích ---------- */
function land(p){
  const sp = p.sp, t = S.side[p.to], c = S.side[p.from];
  if (t.evade > S.t) { float(t.i, 'Trượt!', '#cfe8ff'); return; }
  if (sp.dmg > 0 && t.mirror > S.t && !p.reflected) {
    t.mirror = 0; float(t.i, 'Phản!', '#d8f0ff', true);
    S.proj.push({...p, from:p.to, to:p.from, k:0, reflected:true, clashable:false}); return;
  }
  if (t.shield > S.t) { t.shield = 0; float(t.i, 'Chặn!', '#9fd0ff', true); FX.burst(sel(t.i), {color:[.6,.8,1], count:70, speed:180}); return; }
  const st = t.st;
  let n = 0, burn = sp.burn;
  if (sp.dmg) {
    n = (sp.dmg + p.bonus + (DUEL_WEATHER[S.weather].mod[sp.el] || 0)) * (1 + .12 * orbN(c, 'fire'));
    if (c.st.weak) n -= 2;
    if (sp.el === 'storm' && st.wet) { n += 3; delete st.wet; react(t, 'Giật lan', EL.storm.c); }
    else if (sp.el === 'fire' && st.wet) { n -= 2; delete st.wet; burn = false; react(t, 'Dập lửa', EL.water.c); }
    else if (sp.el === 'fire' && st.frozen) { n *= 2; delete st.frozen; react(t, 'Hơi nước', '#f2f2f2'); }
    else if (sp.el === 'ice' && st.burn) { n += 1; delete st.burn; react(t, 'Tan chảy', EL.ice.c); }
    if (st.curse) n *= 1.5;
    n = Math.max(0, Math.round(n * (1 - .08 * orbN(t, 'earth'))));
  }
  const dealt = n > 0 ? damage(t, n) : 0;
  const drain = (sp.drain || 0) + .05 * orbN(c, 'dark');
  if (dealt && drain) { const h = Math.round(dealt * drain); if (h) heal(c, h); }
  if (S.over) return;
  if (sp.wet) st.wet = S.t + R.WET;
  if (burn) st.burn = {until:S.t + R.BURN, next:S.t + R.BURN_TICK};
  if (sp.freeze) { const deep = !!st.wet; delete st.wet; st.frozen = Math.max(st.frozen || 0, S.t + sp.freeze + (deep ? 2 : 0)); if (deep) react(t, 'Đóng băng sâu', EL.ice.c); }
  if (sp.interrupt && t.cast) { float(t.i, `Ngắt phép ${SP[t.cast.id].name}!`, 'var(--bad)', true); t.cast = null; st.stun = Math.max(st.stun || 0, S.t + R.STUN); }
  if (sp.stun) st.stun = Math.max(st.stun || 0, S.t + sp.stun);
  if (sp.manaBurn) { const m = Math.min(t.mana, sp.manaBurn); t.mana -= m; if (m) float(t.i, `−${m} ma lực`, '#9ad2ff'); }
  if (sp.manaSteal) { const m = Math.min(t.mana, sp.manaSteal); t.mana -= m; c.mana = Math.min(R.MANA_MAX, c.mana + m); if (m) float(t.i, `Bị hút ${m} ma lực`, '#9ad2ff'); }
  if (sp.curse) { st.curse = S.t + sp.curse; float(t.i, 'Bị nguyền!', '#c58cf0'); }
  if (sp.weaken) st.weak = S.t + sp.weaken;
  if (sp.slow) st.slow = S.t + sp.slow;
  const col = {water:[.4,.7,1], storm:[1,.95,.4], fire:[1,.5,.1], ice:[.7,.9,1], earth:[.75,.55,.3], light:[1,.95,.6], dark:[.6,.35,.95], mind:[.9,.45,.8]}[sp.el] || [1,1,1];
  FX.burst(sel(t.i), {color:col, count:p.small ? 35 : 90, speed:p.small ? 140 : 220}); if (n >= 5) FX.shake(Math.min(12, n * 1.5));
}
function damage(t, n){
  if (t.barrier && t.barrier.until > S.t) {
    const a = Math.min(t.barrier.hp, n); t.barrier.hp -= a; n -= a;
    if (a) float(t.i, `Rào chắn −${a}`, '#d9c08a');
    if (t.barrier.hp <= 0) t.barrier = null;
  }
  if (n <= 0) return 0;
  t.hp = Math.max(0, t.hp - n); float(t.i, '−' + n, 'var(--bad)', n >= 5);
  if (t.hp <= 0 && t.st.rebirth > S.t) { t.hp = 8; delete t.st.rebirth; float(t.i, 'Tái sinh!', '#ffb36b', true); FX.rise(sel(t.i), [1,.6,.2], 90); return n; }
  if (t.hp <= 0 && !S.over) { S.over = true; S.winner = 1 - t.i; showEnd(); }
  return n;
}
function heal(s, n){
  n = Math.round(n * (1 + .15 * orbN(s, 'light'))); if (n <= 0) return;
  s.hp = Math.min(R.HP, s.hp + n); float(s.i, '+' + n, 'var(--good)'); FX.rise(sel(s.i), [.45,1,.6], 30);
}
function react(t, name, color){ float(t.i, name + '!', color, true); }
function setWeather(id){
  S.weather = id; S.wNext = R.WEATHER_EVERY; FX.setWeather(id);
  $('.duel').setAttribute('data-weather', id);
  float(null, `☁ ${DUEL_WEATHER[id].name}`, 'var(--brass)', true);
}

/* ---------- Vòng lặp ---------- */
function step(dt){
  if (!S || S.over) return;
  if (S.clash) { stepClash(dt); return; }       // Đấu Đũa: mọi thứ khác dừng lại chờ phân thắng bại
  S.t += dt;
  if (!S.frenzy && S.t >= R.FRENZY_AT) { S.frenzy = true; float(null, 'Cuồng phong! Ma lực hồi gấp đôi', 'var(--brass)', true); }
  if ((S.wNext -= dt) <= 0) { const ids = Object.keys(DUEL_WEATHER).filter(k => k !== S.weather); setWeather(pick(ids)); }
  for (const s of S.side) {
    const st = s.st;
    for (const k of ['wet', 'frozen', 'stun', 'curse', 'weak', 'slow', 'haste', 'rebirth']) if (st[k] && st[k] <= S.t) delete st[k];
    if (st.regen && st.regen.until <= S.t) delete st.regen;
    if (s.barrier && s.barrier.until <= S.t) s.barrier = null;
    s.hpAcc += dt * ((st.regen ? st.regen.rate : 0) + .2 * orbN(s, 'water'));
    if (s.hpAcc >= 1) { const h = Math.floor(s.hpAcc); s.hpAcc -= h; if (s.hp < R.HP) s.hp = Math.min(R.HP, s.hp + h); }
    if (st.burn) { if (S.t >= st.burn.next) { st.burn.next += R.BURN_TICK; damage(s, 1); } if (st.burn && S.t >= st.burn.until) delete st.burn; }
    if (!st.frozen && s.mana < R.MANA_MAX) {
      s.regen += dt * (S.frenzy ? 2 : 1) * (1 + .1 * orbN(s, 'ice'));
      while (s.regen >= R.REGEN) { s.regen -= R.REGEN; s.mana = Math.min(R.MANA_MAX, s.mana + 1); }
    }
    if (s.cast) {
      s.cast.t += dt;
      if (s.cast.aiPerfect !== undefined && !s.cast.tried && s.cast.t / s.cast.dur >= s.cast.aiPerfect) tryPerfect(s);
      if (s.cast.t >= s.cast.dur) finishCast(s);
    }
    for (const pet of s.pets) if (S.t >= pet.next) { pet.next += pet.every; launch(s, pet, 0, false); }
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
  float(null, win === 0 ? 'Bạn thắng Đấu Đũa! +2 sát thương' : 'Máy thắng Đấu Đũa!', win === 0 ? 'var(--good)' : 'var(--bad)', true);
  FX.shake(8); S.clash = null;
}

/* ---------- Máy: phản ứng có độ trễ, chọn phép theo loại (dùng chung cho cả hai lối chơi) ---------- */
function aiThink(dt){
  const me = S.side[1], you = S.side[0], D = S.diff, A = S.ai;
  // Kết ấn sư: thực hiện dần chuỗi bấm cầu + kết ấn đã lên kế hoạch
  if (A.queue.length && S.t >= A.next) { const a = A.queue.shift(); if (a === 'R') invoke(me); else pushOrb(me, a); A.next = S.t + D.step; }
  if ((S.aiNext -= dt) > 0 || me.cast || me.st.stun) return;
  S.aiNext = .15 + Math.random() * .15;
  const ready = me.mode === 'cards' ? me.hand.filter(id => canBegin(me, id)) : me.slots.filter(id => id && canBegin(me, id));
  const all = me.mode === 'cards' ? me.hand : Object.keys(BOOKS[me.bookKey].spells).map(k => `${me.bookKey}.${k}`);
  const cast = id => me.mode === 'cards' ? castHand(me, me.hand.indexOf(id)) : castSlot(me, me.slots.indexOf(id));
  const planInvoke = id => {
    if (A.queue.length || me.slots.includes(id)) return;
    const need = [...SP[id].key].map(ch => ORB_KEYS.indexOf(ch));
    A.queue = [...need, 'R']; A.next = Math.max(A.next, S.t);
  };
  const want = id => { if (ready.includes(id)) return cast(id); if (me.mode === 'invoke' && !(me.cd[id] > S.t + 1.5)) planInvoke(id); return false; };
  // 1. Phép của bạn đang bay tới: phòng thủ nếu kịp (chỉ "thấy" sau độ trễ phản xạ)
  for (const p of S.proj) {
    if (p.to !== 1 || !p.sp.dmg || p.small || S.seen.has(p)) continue;
    const age = p.k * p.travel, left = (1 - p.k) * p.travel;
    if (age < D.delay) continue;
    S.seen.add(p);
    if (me.shield > S.t || me.mirror > S.t || me.evade > S.t || Math.random() > D.block) continue;
    const def = ready.filter(id => isDef(SP[id]) && castTime(me, SP[id]) < left - .03)
      .sort((a, b) => (SP[b].mirror ? 2 : SP[b].evade || SP[b].nullify ? 1 : 0) - (SP[a].mirror ? 2 : SP[a].evade || SP[a].nullify ? 1 : 0));
    if (def.length) { cast(def[0]); return; }
  }
  // 2. Bạn đang niệm phép lớn: ngắt nếu kịp
  const yc = you.cast;
  if (yc && S.t - yc.started >= D.delay && (SP[yc.id].cost >= 3 || yc.dur >= 1)) {
    const intr = ready.filter(id => (SP[id].interrupt || SP[id].nullify) && castTime(me, SP[id]) + (SP[id].self ? 0 : SP[id].travel || R.TRAVEL) < yc.dur - yc.t - .05);
    if (intr.length) { cast(intr[0]); return; }
  }
  if (S.t - me.lastCast < .7) return;                // không xả phép liên tục
  const sp = id => SP[id], ok = id => me.mana >= sp(id).cost && !(me.cd[id] > S.t + 1.5);
  // 3. Kết ấn sư luôn giữ sẵn 1 phép phòng thủ trong ô
  if (me.mode === 'invoke' && !A.queue.length && !me.slots.some(id => id && isDef(sp(id)))) {
    const d = all.filter(id => isDef(sp(id)) && !(me.cd[id] > S.t)); if (d.length && Math.random() < .5) { planInvoke(pick(d)); return; }
  }
  // 4. Máu thấp: hồi
  if (me.hp <= 12) { const h = all.find(id => isHeal(sp(id)) && ok(id)); if (h && want(h)) return; if (h && A.queue.length) return; }
  // 5. Combo phản ứng: đối thủ Ướt → Sét, Đóng băng → Lửa
  const combo = all.filter(id => sp(id).dmg > 0 && ok(id) && ((you.st.wet && sp(id).el === 'storm') || (you.st.frozen && sp(id).el === 'fire')))
    .sort((a, b) => sp(b).dmg - sp(a).dmg)[0];
  if (combo) { if (want(combo)) return; if (A.queue.length) return; }
  // 6. Hỗ trợ: gọi linh thú, tăng tốc, đổi thời tiết, nguyền… khi dư ma lực
  if (me.mana >= 5 && Math.random() < .35) {
    const sup = all.filter(id => ok(id) && (sp(id).pet || sp(id).haste || sp(id).curse || sp(id).weather) && !(sp(id).pet && me.pets.length));
    if (sup.length) { const id = pick(sup); if (want(id) || A.queue.length) return; }
  }
  // 7. Mở combo (làm Ướt / Đóng băng) nếu có phép nối tiếp, không thì phép tấn công mạnh nhất
  const setup = all.find(id => ok(id) && !you.st.wet && !you.st.frozen && (sp(id).wet || sp(id).freeze >= 2)
    && all.some(f => f !== id && sp(f).dmg >= 2 && sp(f).el === (sp(id).wet ? 'storm' : 'fire')));
  if (setup && (want(setup) || A.queue.length)) return;
  const atk = all.filter(id => sp(id).dmg > 0 && !sp(id).interrupt && ok(id))
    .sort((a, b) => sp(b).dmg * (sp(b).volley ? sp(b).volley.n : 1) - sp(a).dmg * (sp(a).volley ? sp(a).volley.n : 1));
  if (!atk.length) return;
  if (me.mode === 'cards' && sp(atk[0]).cost >= 6 && Math.random() < .5) return;   // đôi khi nhịn để dồn phép lớn
  const r = atk.find(id => ready.includes(id));
  if (r && (me.mode === 'cards' || Math.random() < .6)) cast(r); else want(atk[0]);
}

/* ---------- Giao diện ---------- */
const sel = i => i === null ? {center:true} : {lp:i};
function float(i, text, color, big){
  const el = i === null ? $('.d-arena') : $(i === 0 ? '#myInfo .lp' : '#oppInfo .lp'); if (!el) return;
  const r = el.getBoundingClientRect(), f = document.createElement('div');
  f.className = 'fly' + (big ? ' big' : ''); f.textContent = text; f.style.color = color;
  f.style.left = (r.left + r.width / 2 + (Math.random() - .5) * 40) + 'px'; f.style.top = (r.top + r.height / 2) + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 1300);
}
const orbDot = (s, o) => { const el = BOOKS[s.bookKey].orbs[o]; return `<i class="od" style="--c:${EL[el].c}" title="${EL[el].n}"></i>`; };
function renderStatic(){
  for (const s of S.side) {
    const root = $(s.i === 0 ? '#myInfo' : '#oppInfo');
    root.innerHTML = `<div class="d-portrait art art-${s.portrait} k-creature"></div>
      <div class="d-stats"><div class="d-name"><b>${s.name}</b> <span class="meta">${s.mode === 'invoke' ? 'Kết ấn sư · ' : 'Học giả · '}${s.label}</span></div>
        <div class="d-bar hp"><i></i><em class="bar-b"></em><span class="lp">${s.hp}</span></div>
        <div class="d-bar mana"><i></i><span class="d-mtxt"></span></div>
        <div class="d-st"></div>${s.mode === 'invoke' && s.i === 1 ? '<div class="d-oinv"></div>' : ''}</div>
      <div class="d-pets"></div>
      <div class="d-cast"><i></i>${s.i === 0 ? `<em class="zone" style="left:${R.PERFECT[0] * 100}%;width:${(R.PERFECT[1] - R.PERFECT[0]) * 100}%"></em>` : ''}<span></span></div>`;
  }
  $('.duel').setAttribute('data-weather', S.weather); FX.setWeather(S.weather);
}
function cardHTML(id, attrs, key){
  const sp = SP[id];
  return `<button class="dcard card face k-${sp.type === 'counter' ? 'counter' : sp.type === 'support' ? 'enchant' : 'charm'}" ${attrs} title="${sp.name}: ${sp.text}">
    <span class="cost">${sp.cost}</span><div class="cname">${sp.name}</div><div class="cart art art-${sp.art}"></div>
    <div class="cstats"><span>${TYPE[sp.type]} · ${sp.cast}s</span></div><span class="dkey">${key}</span><span class="dfill"></span><span class="dcd"></span></button>`;
}
function renderControls(){
  const s = S.side[0], el = $('#dHand');
  if (s.mode === 'cards') {
    el.className = 'd-hand';
    el.innerHTML = s.hand.map((id, i) => cardHTML(id, `data-hi="${i}"`, i + 1)).join('')
      + `<div class="d-next"><span class="meta">Kế tiếp</span><div class="cart art art-${s.queue[0]}"></div><span class="meta">${SP[s.queue[0]].name}</span></div>`;
    return;
  }
  const B = BOOKS[s.bookKey];
  el.className = 'd-hand inv';
  el.innerHTML = `<div class="inv-orbs">${B.orbs.map((e, o) => `<button class="orbbtn" data-orb="${o}" style="--c:${EL[e].c}" title="${EL[e].n}: ${ORB_PASSIVE[e].text}">
      <b>${ORB_KEYS[o]}</b><span>${EL[e].n}</span></button>`).join('')}</div>
    <div class="inv-mid"><div class="inv-cur"></div><button class="btn primary inv-r" data-invoke="1">Kết ấn <b>R</b></button><div class="inv-prev meta"></div></div>
    <div class="inv-slots">${[0, 1].map(j => s.slots[j] ? cardHTML(s.slots[j], `data-slot="${j}"`, j ? 'F' : 'D') : `<div class="dslot-empty"><b>${j ? 'F' : 'D'}</b><span class="meta">Ô phép trống</span></div>`).join('')}</div>`;
  S.slotSig = s.slots.join('|');
}
function renderBook(){
  const s = S.side[0], el = $('#dBook');
  if (s.mode !== 'invoke') { el.hidden = true; return; }
  const B = BOOKS[s.bookKey];
  el.hidden = false;
  el.innerHTML = `<h2>${B.name}</h2><p class="meta">${B.desc}</p>
    <p class="meta">Cầu đang giữ cho chỉ số thụ động: ${B.orbs.map(e => `<span style="color:${EL[e].c}">${EL[e].n}</span> ${ORB_PASSIVE[e].text}`).join(' · ')}.</p>
    <ol class="bk">${Object.entries(B.spells).map(([k, sp]) => `<li class="t-${sp.type}" data-key="${k}"><span class="bk-k">${[...k].map(ch => orbDot(s, ORB_KEYS.indexOf(ch))).join('')}</span>
      <span class="bk-b"><b>${sp.name}</b> <span class="tchip t-${sp.type}">${TYPE[sp.type]}</span> <span class="meta">${sp.cost} ma lực · ${sp.cd}s hồi</span><br><span class="bk-t">${sp.text}</span></span></li>`).join('')}</ol>`;
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
function draw(){
  if (!S) return;
  const incoming = [0, 1].map(i => S.proj.some(p => p.to === i && p.travel > 1.2));   // phép giáng chậm sắp rơi: cảnh báo
  for (const s of S.side) {
    const root = $(s.i === 0 ? '#myInfo' : '#oppInfo');
    root.querySelector('.hp i').style.width = (100 * s.hp / R.HP) + '%';
    root.querySelector('.bar-b').style.width = s.barrier ? (100 * Math.min(R.HP, s.barrier.hp) / R.HP) + '%' : '0';
    root.querySelector('.lp').textContent = s.hp;
    root.querySelector('.mana i').style.width = (100 * (s.mana + (s.mana < R.MANA_MAX ? s.regen / R.REGEN : 0)) / R.MANA_MAX) + '%';
    root.querySelector('.d-mtxt').textContent = `${s.mana} / ${R.MANA_MAX} ma lực`;
    setHTML(root.querySelector('.d-st'), chips(s));
    setHTML(root.querySelector('.d-pets'), s.pets.map(p => `<span class="pet"><i class="art art-${p.art} k-creature"></i><b>${Math.ceil(p.until - S.t)}</b></span>`).join(''));
    if (s.mode === 'invoke' && s.i === 1) setHTML(root.querySelector('.d-oinv'), `<span class="meta">Cầu:</span> ${s.orbs.map(o => orbDot(s, o)).join('')} <span class="meta">· Ô phép:</span> ${s.slots.map(id => `<span class="oslot">${SP[id].name}</span>`).join('') || '<span class="meta">trống</span>'}`);
    root.classList.toggle('shielded', s.shield > S.t); root.classList.toggle('mirrored', s.mirror > S.t || s.evade > S.t);
    root.classList.toggle('warned', incoming[s.i]);
    const cb = root.querySelector('.d-cast'), c = s.cast;
    cb.classList.toggle('on', !!c); cb.classList.toggle('perfect', !!(c && c.perfect));
    cb.querySelector('i').style.width = c ? (100 * c.t / c.dur) + '%' : '0';
    cb.querySelector('span').textContent = c ? `Đang niệm ${SP[c.id].name}${s.i === 0 && !c.tried ? ' · bấm Space ở vạch vàng' : ''}` : s.st.stun ? 'Choáng!' : incoming[s.i] ? '⚠ Phép giáng xuống sắp rơi!' : '';
  }
  const me = S.side[0];
  if (me.mode === 'invoke') {
    if (S.slotSig !== me.slots.join('|')) renderControls();
    setHTML($('.inv-cur'), [0, 1, 2].map(k => me.orbs[k] !== undefined ? orbDot(me, me.orbs[k]) : '<i class="od empty"></i>').join(''));
    const key = me.orbs.length === 3 ? `${me.bookKey}.${comboKey(me.orbs)}` : null;
    setHTML($('.inv-prev'), key ? `→ ${SP[key].name}` : 'Nạp đủ 3 cầu');
    document.querySelectorAll('#dBook .bk li').forEach(li => li.classList.toggle('cur', key === `${me.bookKey}.${li.dataset.key}`));
  }
  document.querySelectorAll('#dHand .dcard').forEach(b => {
    const id = me.mode === 'cards' ? me.hand[+b.dataset.hi] : me.slots[+b.dataset.slot]; if (!id) return;
    const sp = SP[id], cdLeft = Math.max(0, (me.cd[id] || 0) - S.t);
    b.classList.toggle('playable', canBegin(me, id)); b.classList.toggle('poor', me.mana < sp.cost || cdLeft > 0);
    b.querySelector('.dfill').style.height = me.mana < sp.cost ? (100 * (1 - (me.mana + me.regen / R.REGEN) / sp.cost)) + '%' : '0';
    b.querySelector('.dcd').textContent = cdLeft > 0 ? cdLeft.toFixed(1) : '';
  });
  // Quả cầu phép bay giữa hai pháp sư
  setHTML($('#dProj'), S.proj.map(p => {
    let k = p.k;
    if (S.clash && (p === S.clash.mine || p === S.clash.theirs)) k = p === S.clash.mine ? S.clash.push : 1 - S.clash.push;
    const y = p.from === 0 ? 1 - k : k, size = p.small ? 10 + p.sp.dmg * 2 : 12 + (p.sp.dmg + p.bonus) * 3;
    return `<i class="orb el-${p.sp.el}${p.reflected ? ' refl' : ''}${p.travel > 1.2 ? ' slow' : ''}" style="top:${(6 + y * 88).toFixed(1)}%;left:${p.from === 0 ? 46 : 54}%;--s:${size}px"></i>`;
  }).join(''));
  const cl = $('#dClash');
  if (S.clash) { cl.hidden = false; cl.querySelector('.d-push i').style.width = (S.clash.push * 100) + '%'; $('#dClashT').textContent = Math.max(0, R.CLASH - S.clash.t).toFixed(1); }
  else cl.hidden = true;
  const w = DUEL_WEATHER[S.weather];
  setHTML($('#dWeather'), `<span class="wdot w-${S.weather}"></span><b>${w.name}</b><span class="meta">${w.desc} · đổi sau ${Math.ceil(S.wNext)}s</span>`);
  const mm = Math.floor(S.t / 60), ss = String(Math.floor(S.t % 60)).padStart(2, '0');
  $('#dTime').textContent = `${mm}:${ss}${S.frenzy ? ' · Cuồng phong' : ''}`;
}
function showStart(){
  const btn = (attr, k, label, on, sm) => `<button class="btn ${sm ? 'sm' : ''} ${on ? 'on' : ''}" ${attr}="${k}">${label}</button>`;
  const inv = cfg.style === 'invoke';
  const choice = inv
    ? `<div class="d-books">${Object.entries(BOOKS).map(([k, b]) => `<button class="d-bookbtn ${cfg.book === k ? 'on' : ''}" data-dbook="${k}">
        <span class="art art-${b.portrait} k-creature"></span><span><b>${b.name}</b><br><span class="meta">${b.orbs.map(e => `<span style="color:${EL[e].c}">${EL[e].n}</span>`).join(' · ')}</span><br><span class="meta">${b.desc}</span></span></button>`).join('')}</div>`
    : `<div class="row d-choice"><span class="meta">Trường phái:</span>${Object.keys(DUEL_DECKS).map(k => btn('data-dme', k, DUEL_DECKS[k].name, cfg.me === k)).join('')}</div><p class="meta">${DUEL_DECKS[cfg.me].tip}</p>`;
  const how = inv ? `
      <li><b>Q W E</b>: nạp cầu nguyên tố (giữ tối đa 3, cầu mới đẩy cầu cũ ra). Mỗi cầu đang giữ cho một chỉ số thụ động.</li>
      <li><b>R</b>: kết ấn 3 cầu hiện tại thành phép, vào ô <b>D</b> (phép cũ lùi sang <b>F</b>). Bảng Ấn thư bên cạnh ghi đủ 10 công thức.</li>
      <li><b>D / F</b>: niệm phép trong ô. Mỗi phép có hồi chiêu riêng. Được nạp cầu và kết ấn ngay cả khi đang niệm.</li>`
    : `<li><b>1–4</b> hoặc chạm lá: niệm phép. Dùng xong lá được rút lá kế tiếp.</li>`;
  $('#dOverlay').innerHTML = `<div class="over"><div class="box d-box">
    <h2>Đấu phép tốc độ</h2><p class="meta">Bản thử: không có lượt. Ma lực tự hồi, mỗi phép có thời gian niệm mà đối thủ nhìn thấy được.</p>
    <div class="row d-choice"><span class="meta">Lối chơi:</span>${btn('data-dstyle', 'invoke', 'Kết ấn sư', inv)}${btn('data-dstyle', 'cards', 'Học giả (bài)', !inv)}</div>
    ${choice}
    <div class="row d-choice"><span class="meta">Đối thủ:</span>${btn('data-dopp', 'random', 'Ngẫu nhiên', cfg.opp === 'random', 1)}${btn('data-dopp', 'invoke', 'Kết ấn sư', cfg.opp === 'invoke', 1)}${btn('data-dopp', 'cards', 'Học giả', cfg.opp === 'cards', 1)}
      <span class="meta" style="margin-left:8px">Độ khó:</span>${Object.keys(DIFF).map(k => btn('data-ddiff', k, DIFF[k].name, cfg.diff === k, 1)).join('')}</div>
    <ul class="d-how">${how}
      <li><b>Space</b> (hoặc chạm thanh niệm) đúng lúc thanh chạy qua <span style="color:var(--brass)">vạch vàng</span>: Niệm chuẩn, phép mạnh hơn.</li>
      <li>Phản chú: khiên, gương, né, xoá phép… phải dựng <b>trước khi</b> phép đối thủ bay tới. Phép ngắt trúng lúc đối thủ đang niệm thì huỷ phép của họ.</li>
      <li>Hai phép sát thương va nhau: <b>Đấu Đũa</b>, bấm Space thật nhanh để đẩy tia về phía đối thủ.</li>
    </ul>
    <button class="btn primary" data-dstart="1">Bắt đầu</button></div></div>`;
}
function showEnd(){
  $('#dOverlay').innerHTML = `<div class="over"><div class="box"><h2>${S.winner === 0 ? 'Chiến thắng' : 'Thất bại'}</h2>
    <p>${S.winner === 0 ? 'Pháp sư đối thủ đã gục.' : 'Bạn đã cạn sinh lực.'} Đối thủ: ${S.side[1].mode === 'invoke' ? 'Kết ấn sư' : 'Học giả'} · ${S.side[1].label}. Thời gian: ${Math.floor(S.t)} giây.</p>
    <div class="row" style="justify-content:center"><button class="btn primary" data-dstart="1">Đấu lại</button><button class="btn" data-dmenu="1">Đổi lối chơi / độ khó</button></div></div></div>`;
}

/* ---------- Điều khiển ---------- */
function press(){
  if (!S || S.over) return;
  if (S.clash) { S.clash.press[0]++; FX.burst({center:true}, {color:[1,.85,.45], count:14, speed:160, life:.3}); return; }
  tryPerfect(S.side[0]);
}
const playing = () => S && !S.over && !$('#dOverlay').innerHTML;
document.addEventListener('click', e => {
  const set = (attr, key) => { const b = e.target.closest(`[${attr}]`); if (!b) return false; cfg[key] = b.getAttribute(attr); showStart(); return true; };
  if (set('data-dstyle', 'style') || set('data-dbook', 'book') || set('data-dme', 'me') || set('data-dopp', 'opp') || set('data-ddiff', 'diff')) return;
  if (e.target.closest('[data-dmenu]')) { showStart(); return; }
  if (e.target.closest('[data-dstart]')) { try { localStorage.setItem('dp-duel', JSON.stringify(cfg)); } catch (er) {} $('#dOverlay').innerHTML = ''; newDuel(); return; }
  if (!playing()) return;
  const me = S.side[0];
  const c = e.target.closest('.dcard');
  if (c) { if (c.dataset.hi !== undefined) castHand(me, +c.dataset.hi); else castSlot(me, +c.dataset.slot); return; }
  const o = e.target.closest('[data-orb]'); if (o) { pushOrb(me, +o.dataset.orb); return; }
  if (e.target.closest('[data-invoke]')) { invoke(me); return; }
  if (e.target.closest('#myInfo .d-cast, #dClash')) press();
});
document.addEventListener('keydown', e => {
  if (!playing()) return;
  const me = S.side[0], k = e.key.toLowerCase();
  if (e.code === 'Space') { if (!e.repeat) press(); e.preventDefault(); return; }
  if (me.mode === 'cards') { if (k >= '1' && k <= '4') { castHand(me, +k - 1); e.preventDefault(); } return; }
  if (e.repeat) return;
  const oi = ['q', 'w', 'e'].indexOf(k);
  if (oi >= 0) pushOrb(me, oi);
  else if (k === 'r') invoke(me);
  else if (k === 'd') castSlot(me, 0);
  else if (k === 'f') castSlot(me, 1);
  else return;
  e.preventDefault();
});

let last = performance.now();
function frame(now){
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  step(dt); draw();
  requestAnimationFrame(frame);
}
applyArt();
showStart();
requestAnimationFrame(frame);
