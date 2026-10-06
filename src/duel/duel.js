import '../styles.css';
import './duel.css';
import { $, EL } from '../config.js';
import { DB } from '../data/cards.js';
import { applyArt } from '../ui/art.js';
import { FX } from '../fx/three-fx.js';
import { DIFF, DUEL_DECKS, DUEL_WEATHER, RULES as R, SPELLS } from './data.js';

/* ---------- Đấu phép tốc độ (bản thử): không có lượt, ma lực hồi liên tục, phép có thời gian niệm ---------- */
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const kindOf = id => SPELLS[id].kind || 'charm';
const nameOf = id => DB[id].name;
let S = null;                              // trạng thái trận
let cfg = {me:'thuyloi', diff:'normal'};
try { Object.assign(cfg, JSON.parse(localStorage.getItem('dp-duel') || '{}')); } catch (e) {}

function mkSide(i, deckKey){
  const D = DUEL_DECKS[deckKey], q = [];
  for (const [id, n] of Object.entries(D.list)) for (let k = 0; k < n; k++) q.push(id);
  shuffle(q);
  return {i, deckKey, name:i ? 'Máy' : 'Bạn', hp:R.HP, mana:R.MANA_START, regen:0, hand:q.splice(0, R.HAND), queue:q,
    cast:null, st:{}, shield:0, mirror:0, lastCast:-9};
}
function newDuel(){
  const ai = cfg.me === 'thuyloi' ? 'hoabang' : 'thuyloi';
  S = {t:0, over:false, winner:null, side:[mkSide(0, cfg.me), mkSide(1, ai)], proj:[], clash:null,
    weather:'clear', wNext:R.WEATHER_EVERY, frenzy:false, aiNext:1.2, seen:new Set(), diff:DIFF[cfg.diff]};
  renderStatic(); renderHand();
}

/* ---------- Niệm phép ---------- */
const castTime = (s, id) => SPELLS[id].cast * (s.st.frozen ? 2 : 1);
function canCast(s, hi){
  const id = s.hand[hi];
  return !S.over && !S.clash && id && !s.cast && !s.st.stun && s.mana >= SPELLS[id].cost;
}
function startCast(s, hi){
  if (!canCast(s, hi)) return false;
  const id = s.hand[hi], sp = SPELLS[id];
  s.mana -= sp.cost;
  s.hand.splice(hi, 1); s.queue.push(id); s.hand.push(s.queue.shift());   // lá vừa dùng xuống đáy bộ, rút lá kế
  s.cast = {id, t:0, dur:castTime(s, id), perfect:false, tried:false, started:S.t};
  s.lastCast = S.t;
  if (s.i === 1 && Math.random() < S.diff.perfect) s.cast.aiPerfect = R.PERFECT[0] + Math.random() * (R.PERFECT[1] - R.PERFECT[0]);
  if (s.i === 0) renderHand();
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
  const sp = SPELLS[c.id], bonus = c.perfect ? 1 : 0, o = S.side[1 - s.i];
  if (sp.self) {
    if (sp.shield) { s.shield = S.t + sp.shield + bonus; float(s.i, 'Khiên!', '#9fd0ff'); FX.ring(sel(s.i), [.6,.8,1], 80, .6); }
    if (sp.mirror) { s.mirror = S.t + sp.mirror + bonus; float(s.i, 'Gương!', '#d8f0ff'); FX.ring(sel(s.i), [.85,.95,1], 80, .6); }
    if (sp.heal) { const n = sp.heal + bonus * 2; s.hp = Math.min(R.HP, s.hp + n); float(s.i, '+' + n, 'var(--good)'); FX.rise(sel(s.i), [.45,1,.6], 50); }
    if (sp.weather) setWeather(sp.weather);
    return;
  }
  const p = {from:s.i, to:o.i, id:c.id, bonus, k:0, reflected:false};
  // Đấu Đũa: hai phép gây sát thương bay ngược chiều nhau thì va nhau giữa sân
  const rival = S.proj.find(q => q.from === o.i && SPELLS[q.id].dmg > 0 && !q.reflected);
  S.proj.push(p);
  if (rival && sp.dmg > 0 && !S.clash) S.clash = {mine:s.i === 0 ? p : rival, theirs:s.i === 0 ? rival : p, t:0, press:[0, 0], aiAcc:0, push:.5};
}

/* ---------- Trúng đích ---------- */
function land(p){
  const sp = SPELLS[p.id], t = S.side[p.to];
  if (sp.dmg > 0 && t.mirror > S.t && !p.reflected) {
    t.mirror = 0; float(t.i, 'Phản!', '#d8f0ff', true);
    S.proj.push({...p, from:p.to, to:p.from, k:0, reflected:true}); return;
  }
  if (t.shield > S.t) { t.shield = 0; float(t.i, 'Chặn!', '#9fd0ff', true); FX.burst(sel(t.i), {color:[.6,.8,1], count:70, speed:180}); return; }
  let n = sp.dmg ? sp.dmg + p.bonus + (DUEL_WEATHER[S.weather].mod[sp.el] || 0) : 0, burn = sp.burn;
  const st = t.st;
  if (sp.el === 'storm' && st.wet && n) { n += 3; delete st.wet; react(t, 'Giật lan', EL.storm.c); }
  else if (sp.el === 'fire' && st.wet && n) { n = Math.max(0, n - 2); delete st.wet; burn = false; react(t, 'Dập lửa', EL.water.c); }
  else if (sp.el === 'fire' && st.frozen && n) { n *= 2; delete st.frozen; react(t, 'Hơi nước', '#f2f2f2'); }
  else if (sp.el === 'ice' && st.burn) { n += 1; delete st.burn; react(t, 'Tan chảy', EL.ice.c); }
  if (n > 0) damage(t, n, sp.el);
  if (sp.wet) st.wet = S.t + R.WET;
  if (burn) st.burn = {until:S.t + R.BURN, next:S.t + R.BURN_TICK};
  if (sp.freeze) { const deep = !!st.wet; delete st.wet; st.frozen = S.t + sp.freeze + (deep ? 2 : 0); if (deep) react(t, 'Đóng băng sâu', EL.ice.c); }
  if (sp.interrupt && t.cast) { float(t.i, `Ngắt phép ${nameOf(t.cast.id)}!`, 'var(--bad)', true); t.cast = null; st.stun = S.t + R.STUN; }
  const col = {water:[.4,.7,1], storm:[1,.95,.4], fire:[1,.5,.1], ice:[.7,.9,1]}[sp.el] || [1,1,1];
  FX.burst(sel(t.i), {color:col, count:90, speed:220}); if (n >= 5) FX.shake(Math.min(12, n * 1.5));
}
function damage(t, n){
  t.hp = Math.max(0, t.hp - n); float(t.i, '−' + n, 'var(--bad)', n >= 5);
  if (t.hp <= 0 && !S.over) { S.over = true; S.winner = 1 - t.i; showEnd(); }
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
  if ((S.wNext -= dt) <= 0) { const ids = Object.keys(DUEL_WEATHER).filter(k => k !== S.weather); setWeather(ids[Math.random() * ids.length | 0]); }
  for (const s of S.side) {
    const st = s.st;
    for (const k of ['wet', 'frozen', 'stun']) if (st[k] && st[k] <= S.t) delete st[k];
    if (st.burn) { if (S.t >= st.burn.next) { st.burn.next += R.BURN_TICK; damage(s, 1); } if (st.burn && S.t >= st.burn.until) delete st.burn; }
    if (!st.frozen && s.mana < R.MANA_MAX) { s.regen += dt * (S.frenzy ? 2 : 1); while (s.regen >= R.REGEN) { s.regen -= R.REGEN; s.mana = Math.min(R.MANA_MAX, s.mana + 1); } }
    if (s.cast) {
      s.cast.t += dt;
      if (s.cast.aiPerfect !== undefined && !s.cast.tried && s.cast.t / s.cast.dur >= s.cast.aiPerfect) tryPerfect(s);
      if (s.cast.t >= s.cast.dur) finishCast(s);
    }
    if (S.over) return;
  }
  for (const p of [...S.proj]) {
    p.k += dt / R.TRAVEL;
    if (p.k >= 1) { S.proj.splice(S.proj.indexOf(p), 1); land(p); if (S.over) return; }
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
  w.bonus += 2; w.k = .5;                           // phép thắng bay tiếp từ giữa sân, mạnh thêm 2
  float(null, win === 0 ? 'Bạn thắng Đấu Đũa! +2 sát thương' : 'Máy thắng Đấu Đũa!', win === 0 ? 'var(--good)' : 'var(--bad)', true);
  FX.shake(8); S.clash = null;
}

/* ---------- Máy: phản ứng có độ trễ theo độ khó ---------- */
function aiThink(dt){
  const me = S.side[1], you = S.side[0], D = S.diff;
  if ((S.aiNext -= dt) > 0 || me.cast || me.st.stun) return;
  S.aiNext = .2 + Math.random() * .2;
  const has = id => me.hand.findIndex(h => h === id && me.mana >= SPELLS[h].cost);
  const go = id => { const i = has(id); return i >= 0 && startCast(me, i); };
  // 1. Phép của bạn đang bay tới: dựng khiên/gương nếu kịp (chỉ "thấy" sau độ trễ phản xạ)
  for (const p of S.proj) {
    if (p.to !== 1 || !SPELLS[p.id].dmg || S.seen.has(p)) continue;
    const age = p.k * R.TRAVEL, left = (1 - p.k) * R.TRAVEL;
    if (age < D.delay) continue;
    S.seen.add(p);
    if (me.shield > S.t || me.mirror > S.t || Math.random() > D.block) continue;
    for (const id of (SPELLS[p.id].dmg + p.bonus >= 3 ? ['speculum', 'protego'] : ['protego', 'speculum']))
      if (has(id) >= 0 && castTime(me, id) < left - .03) { go(id); return; }
  }
  // 2. Bạn đang niệm phép lớn: ngắt bằng Stupefy/Petrificus nếu kịp
  const yc = you.cast;
  if (yc && S.t - yc.started >= D.delay && SPELLS[yc.id].cost >= 3) {
    for (const id of ['stupefy', 'petrificus']) if (has(id) >= 0 && castTime(me, id) + R.TRAVEL < yc.dur - yc.t - .05) { go(id); return; }
  }
  if (S.t - me.lastCast < .7) return;                // không xả phép liên tục
  // 3. Máu thấp: hồi
  if (me.hp <= 12 && go('episkey')) return;
  // 4. Thời tiết bất lợi thì đổi
  const myEl = me.deckKey === 'thuyloi' ? 'storm' : 'fire';
  if ((DUEL_WEATHER[S.weather].mod[myEl] || 0) <= 0 && (go('callrain') || go('callsun'))) return;
  // 5. Combo: đối thủ đang Ướt → Sét; đang Đóng băng → Lửa
  if (you.st.wet && (go('fulmen') || go('tempestas'))) return;
  if (you.st.frozen && (go('confringo') || go('ignis') || go('incendio'))) return;
  // 6. Phép lớn: đủ ma lực thì niệm, chưa đủ thì đôi khi nhịn để dồn
  const big = me.hand.find(h => SPELLS[h].cost >= 6);
  if (big && me.mana >= 6 && !you.st.stun && go(big)) return;
  if (big && me.mana >= 3 && Math.random() < .6) return;
  // 7. Mở combo hoặc đánh phép mạnh nhất đủ ma lực
  for (const id of ['aguamenti', 'glacius']) if (!you.st.wet && !you.st.frozen && go(id)) return;
  const dmg = me.hand.map((h, i) => ({h, i})).filter(x => SPELLS[x.h].dmg > 0 && !SPELLS[x.h].interrupt && me.mana >= SPELLS[x.h].cost)
    .sort((a, b) => SPELLS[b.h].dmg - SPELLS[a.h].dmg);
  if (dmg.length) startCast(me, dmg[0].i);
}

/* ---------- Giao diện ---------- */
const sel = i => i === null ? {center:true} : {lp:i};
function float(i, text, color, big){
  const el = i === null ? $('.d-arena') : $(i === 0 ? '#myInfo .lp' : '#oppInfo .lp'); if (!el) return;
  const r = el.getBoundingClientRect(), f = document.createElement('div');
  f.className = 'fly' + (big ? ' big' : ''); f.textContent = text; f.style.color = color;
  f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + r.height / 2) + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 1300);
}
function renderStatic(){
  for (const s of S.side) {
    const root = $(s.i === 0 ? '#myInfo' : '#oppInfo'), D = DUEL_DECKS[s.deckKey];
    root.innerHTML = `<div class="d-portrait art art-${D.portrait} k-creature"></div>
      <div class="d-stats"><div class="d-name"><b>${s.name}</b> <span class="meta">${D.name}</span></div>
        <div class="d-bar hp"><i></i><span class="lp">${s.hp}</span></div>
        <div class="d-bar mana"><i></i><span class="d-mtxt"></span></div>
        <div class="d-st"></div></div>
      <div class="d-cast"><i></i>${s.i === 0 ? `<em class="zone" style="left:${R.PERFECT[0] * 100}%;width:${(R.PERFECT[1] - R.PERFECT[0]) * 100}%"></em>` : ''}<span></span></div>`;
  }
  $('.duel').setAttribute('data-weather', S.weather); FX.setWeather(S.weather);
}
function renderHand(){
  const s = S.side[0];
  $('#dHand').innerHTML = s.hand.map((id, i) => { const sp = SPELLS[id];
    return `<button class="dcard card face k-${kindOf(id)}" data-hi="${i}" title="${nameOf(id)}: ${sp.text}" style="--elc:${(EL[sp.el] || EL.none).c}">
      <span class="cost">${sp.cost}</span><div class="cname">${nameOf(id)}</div><div class="cart art art-${id}"></div>
      <div class="cstats"><span>${sp.cast}s${sp.el ? ' · ' + EL[sp.el].n : ''}</span></div><span class="dkey">${i + 1}</span><span class="dfill"></span></button>`; }).join('')
    + `<div class="d-next"><span class="meta">Kế tiếp</span><div class="cart art art-${s.queue[0]}"></div><span class="meta">${nameOf(s.queue[0])}</span></div>`;
}
function chips(s){
  const out = [], st = s.st, left = x => Math.max(0, x - S.t).toFixed(1);
  if (st.wet) out.push(`<span class="chip st-wet">Ướt ${left(st.wet)}</span>`);
  if (st.burn) out.push(`<span class="chip st-burn">Cháy ${left(st.burn.until)}</span>`);
  if (st.frozen) out.push(`<span class="chip st-frozen">Đóng băng ${left(st.frozen)}</span>`);
  if (st.stun) out.push(`<span class="chip st-stun">Choáng ${left(st.stun)}</span>`);
  if (s.shield > S.t) out.push(`<span class="chip d-sh">Khiên ${left(s.shield)}</span>`);
  if (s.mirror > S.t) out.push(`<span class="chip d-mi">Gương ${left(s.mirror)}</span>`);
  return out.join('');
}
function draw(){
  if (!S) return;
  for (const s of S.side) {
    const root = $(s.i === 0 ? '#myInfo' : '#oppInfo');
    root.querySelector('.hp i').style.width = (100 * s.hp / R.HP) + '%';
    root.querySelector('.lp').textContent = s.hp;
    root.querySelector('.mana i').style.width = (100 * (s.mana + (s.mana < R.MANA_MAX ? s.regen / R.REGEN : 0)) / R.MANA_MAX) + '%';
    root.querySelector('.d-mtxt').textContent = `${s.mana} / ${R.MANA_MAX} ma lực`;
    const stEl = root.querySelector('.d-st'), html = chips(s); if (stEl.innerHTML !== html) stEl.innerHTML = html;
    root.classList.toggle('shielded', s.shield > S.t); root.classList.toggle('mirrored', s.mirror > S.t);
    const cb = root.querySelector('.d-cast'), c = s.cast;
    cb.classList.toggle('on', !!c); cb.classList.toggle('perfect', !!(c && c.perfect));
    cb.querySelector('i').style.width = c ? (100 * c.t / c.dur) + '%' : '0';
    cb.querySelector('span').textContent = c ? `Đang niệm ${nameOf(c.id)}${s.i === 0 && !c.tried ? ' · bấm Space ở vạch vàng' : ''}` : s.st.stun ? 'Choáng!' : '';
  }
  const me = S.side[0];
  document.querySelectorAll('#dHand .dcard').forEach(b => {
    const id = me.hand[+b.dataset.hi], ok = canCast(me, +b.dataset.hi);
    b.classList.toggle('playable', ok); b.classList.toggle('poor', me.mana < SPELLS[id].cost);
    b.querySelector('.dfill').style.height = me.mana < SPELLS[id].cost ? (100 * (1 - (me.mana + me.regen / R.REGEN) / SPELLS[id].cost)) + '%' : '0';
  });
  // Quả cầu phép bay giữa hai pháp sư
  const layer = $('#dProj');
  const pts = S.proj.map(p => {
    let k = p.k;
    if (S.clash && (p === S.clash.mine || p === S.clash.theirs)) k = p === S.clash.mine ? S.clash.push : 1 - S.clash.push;
    const y = p.from === 0 ? 1 - k : k, sp = SPELLS[p.id];
    return `<i class="orb el-${sp.el}${p.reflected ? ' refl' : ''}" style="top:${(6 + y * 88).toFixed(1)}%;left:${p.from === 0 ? 46 : 54}%;--s:${12 + (sp.dmg + p.bonus) * 3}px"></i>`;
  });
  layer.innerHTML = pts.join('');
  const cl = $('#dClash');
  if (S.clash) { cl.hidden = false; cl.querySelector('.d-push i').style.width = (S.clash.push * 100) + '%'; $('#dClashT').textContent = Math.max(0, R.CLASH - S.clash.t).toFixed(1); }
  else cl.hidden = true;
  const w = DUEL_WEATHER[S.weather];
  $('#dWeather').innerHTML = `<span class="wdot w-${S.weather}"></span><b>${w.name}</b><span class="meta">${w.desc} · đổi sau ${Math.ceil(S.wNext)}s</span>`;
  const mm = Math.floor(S.t / 60), ss = String(Math.floor(S.t % 60)).padStart(2, '0');
  $('#dTime').textContent = `${mm}:${ss}${S.frenzy ? ' · Cuồng phong' : ''}`;
}
function showStart(){
  const deckBtn = k => `<button class="btn ${cfg.me === k ? 'on' : ''}" data-dme="${k}">${DUEL_DECKS[k].name}</button>`;
  const diffBtn = k => `<button class="btn sm ${cfg.diff === k ? 'on' : ''}" data-ddiff="${k}">${DIFF[k].name}</button>`;
  $('#dOverlay').innerHTML = `<div class="over"><div class="box d-box">
    <h2>Đấu phép tốc độ</h2><p class="meta">Bản thử: không có lượt. Ma lực tự hồi, mỗi phép có thời gian niệm mà đối thủ nhìn thấy được.</p>
    <div class="row d-choice"><span class="meta">Trường phái:</span>${Object.keys(DUEL_DECKS).map(deckBtn).join('')}</div>
    <p class="meta">${DUEL_DECKS[cfg.me].tip}</p>
    <div class="row d-choice"><span class="meta">Độ khó:</span>${Object.keys(DIFF).map(diffBtn).join('')}</div>
    <ul class="d-how">
      <li><b>1–4</b> hoặc chạm lá: niệm phép. Phép bay khoảng 0,75 giây mới trúng.</li>
      <li><b>Space</b> (hoặc chạm thanh niệm) đúng lúc thanh chạy qua <span style="color:var(--brass)">vạch vàng</span>: Niệm chuẩn, phép +1.</li>
      <li>Thấy phép của đối thủ bay tới: dựng <b>Protego</b> để chặn, <b>Speculum</b> để phản lại.</li>
      <li>Đối thủ niệm phép lớn: ngắt bằng <b>Stupefy / Petrificus</b>.</li>
      <li>Hai phép sát thương va nhau: <b>Đấu Đũa</b>, bấm Space thật nhanh để đẩy tia về phía đối thủ.</li>
    </ul>
    <button class="btn primary" data-dstart="1">Bắt đầu</button></div></div>`;
}
function showEnd(){
  $('#dOverlay').innerHTML = `<div class="over"><div class="box"><h2>${S.winner === 0 ? 'Chiến thắng' : 'Thất bại'}</h2>
    <p>${S.winner === 0 ? 'Pháp sư đối thủ đã gục.' : 'Bạn đã cạn sinh lực.'} Thời gian: ${Math.floor(S.t)} giây.</p>
    <div class="row" style="justify-content:center"><button class="btn primary" data-dstart="1">Đấu lại</button><button class="btn" data-dmenu="1">Đổi trường phái / độ khó</button></div></div></div>`;
}

/* ---------- Điều khiển ---------- */
function press(){
  if (!S || S.over) return;
  if (S.clash) { S.clash.press[0]++; FX.burst({center:true}, {color:[1,.85,.45], count:14, speed:160, life:.3}); return; }
  tryPerfect(S.side[0]);
}
document.addEventListener('click', e => {
  const m = e.target.closest('[data-dme]'); if (m) { cfg.me = m.dataset.dme; showStart(); return; }
  const d = e.target.closest('[data-ddiff]'); if (d) { cfg.diff = d.dataset.ddiff; showStart(); return; }
  if (e.target.closest('[data-dmenu]')) { showStart(); return; }
  if (e.target.closest('[data-dstart]')) { try { localStorage.setItem('dp-duel', JSON.stringify(cfg)); } catch (er) {} $('#dOverlay').innerHTML = ''; newDuel(); return; }
  const c = e.target.closest('.dcard'); if (c && S) { startCast(S.side[0], +c.dataset.hi); return; }
  if (e.target.closest('#myInfo .d-cast, #dClash')) press();
});
document.addEventListener('keydown', e => {
  if (!S || S.over || $('#dOverlay').innerHTML) return;
  if (e.key >= '1' && e.key <= '4') { startCast(S.side[0], +e.key - 1); e.preventDefault(); }
  if (e.code === 'Space') { if (!e.repeat) press(); e.preventDefault(); }
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
