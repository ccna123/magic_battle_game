import { $, EL, EVOLVE_AT, HAND_MAX, MAXF, MAXMANA, MAXS, START_LP, STN, sleep } from '../config.js';
import { DB, DECKS, TUTORIAL_HAND } from '../data/cards.js';
import { WEATHER_ROUNDS } from '../data/weather.js';
import { aiTurn } from './ai.js';
import { W, changeWeather, dryAll, weatherMod } from './weather.js';
import { FXS, IMPACT } from '../fx/card-fx.js';
import { FX } from '../fx/three-fx.js';
import { render } from '../ui/render.js';
import { UI } from '../ui/state.js';
import { tip } from '../ui/tutorial.js';

/* ---------- Helper cho script lá bài ---------- */
export const opp = i => 1 - i;
export const P = i => G.p[i];
export const hero = i => G.heroes[i];
export const enemies = pi => [hero(opp(pi)), ...P(opp(pi)).fam];
export const enemyUnits = pi => P(opp(pi)).fam;
export const allyUnits = pi => P(pi).fam;
export const hasUp = (pi, flag) => P(pi).st.some(e => !e.set && e.d[flag]);
export const amt = (L, n) => n + (L.bonus || 0);
export function tag(t){ return t.hero ? (t.owner === 0 ? 'Bạn' : 'Máy') : t.d.name; }

/* ---------- Trạng thái trận ---------- */
export let G;
export let uid = 0;
export function mk(id, owner){ const d = DB[id]; return {uid:++uid, id, d, owner, hp:d.hp || 0, tmp:0, st:{}, marks:0, atkCount:0, summonTurn:0, set:false, setTurn:0, ttl:d.ttl || 0}; }
export function shuffle(a){ for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function mkPlayer(name, idx, ai, deckKey){
  const D = DECKS[deckKey], deck = [];
  for (const [id, n] of Object.entries(D.list)) for (let k = 0; k < n; k++) deck.push(mk(id, idx));
  shuffle(deck);
  return {name, idx, ai, deckName:D.name, lp:START_LP, maxMana:0, mana:0, deck, hand:[], fam:[], st:[], grave:[], fatigue:0,
    bond:{card:mk(D.bond, idx), cd:0}};
}
export function newGame(myDeck = 'thuyloi', aiDeck = 'hoabang'){
  uid = 0;
  G = {p:[mkPlayer('Bạn', 0, false, myDeck), mkPlayer('Máy', 1, true, aiDeck)], heroes:[], active:0, turnNo:0, chain:[], log:[], trig:[], over:false, attackNegated:false};
  G.weather = {id:'clear', left:WEATHER_ROUNDS}; G.forecast = 'rain';
  G.heroes = [0, 1].map(i => ({uid:'h' + i, hero:true, owner:i, st:{}, d:{name:i ? 'Máy' : 'Bạn', kind:'hero'}}));
  // Ván hướng dẫn (chỉ với bộ Thuỷ – Lôi): đưa sẵn combo Ướt → Sét lên tay; bộ khác rút 4 lá như thường
  const me = P(0);
  if (myDeck !== 'thuyloi') for (let i = 0; i < 4; i++) me.hand.push(me.deck.pop());
  else for (const id of TUTORIAL_HAND) { const i = me.deck.findIndex(c => c.id === id); if (i >= 0) me.hand.push(me.deck.splice(i, 1)[0]); }
  for (let i = 0; i < 5; i++) P(1).hand.push(P(1).deck.pop());   // người đi sau thêm 1 lá
  FX.setWeather('clear'); document.querySelector('.board')?.setAttribute('data-weather', 'clear');
  UI.pick = null; UI.sel = null; UI.graveView = null;
  log('Ván đấu bắt đầu. Bạn đi trước, Máy được thêm 1 lá và 1 ma lực tạm ở lượt đầu.', 'turnl');
}

/* ---------- Tiện ích ---------- */
export function log(t, cls = ''){ G.log.unshift({t, cls}); if (G.log.length > 150) G.log.pop(); }
export function onField(c){ return !!c && !c.hero && (P(c.owner).fam.includes(c) || P(c.owner).st.includes(c)); }
export function alive(t){ return t && (t.hero || P(t.owner).fam.includes(t)); }
export function remove(c){ for (const p of G.p) for (const z of ['hand','fam','st','grave','deck']) { const i = p[z].indexOf(c); if (i >= 0) { p[z].splice(i, 1); return z; } } }
export function atk(c){ let v = c.d.atk + (c.tmp || 0) + (W() === 'moon' ? (c.id === 'werewolf' ? 2 : 1) : 0); for (const s of [0, 1]) for (const e of P(s).st) if (!e.set && e.d.aura) v += e.d.aura(e, c); return Math.max(0, v); }
export function upkeep(pi){ return Math.max(0, P(pi).fam.filter(f => !f.d.token).length - 1); }   // linh thú đầu tiên miễn phí
export function allTargets(){ return [...G.heroes, ...G.p.flatMap(p => [...p.hand, ...p.fam, ...p.st, ...p.grave]), P(0).bond.card, P(1).bond.card]; }
export function floatText(t, text, color, big){
  const el = t.hero ? document.querySelector(`#hero${t.owner} .lp`) : document.querySelector(`[data-uid="${t.uid}"]`);
  if (!el) return; const r = el.getBoundingClientRect();
  const f = document.createElement('div'); f.className = 'fly' + (big ? ' big' : ''); f.textContent = text; f.style.color = color || 'var(--bad)';
  f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + r.height / 2) + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 1300);
}

/* ---------- Trạng thái nguyên tố & phản ứng ---------- */
export function stLen(t){ return t.owner === G.active ? 2 : 1; }   // hiệu lực đến hết lượt kế tiếp của chủ thể
export function addSt(t, k, src){
  if (!alive(t)) return;
  if (k === 'wet') { if (t.st.burn) { delete t.st.burn; reaction(t, 'Dập lửa', EL.water.c); return; } t.st.wet = 2 + (W() === 'rain' ? 1 : 0); }
  else if (k === 'burn') { if (t.st.frozen) { delete t.st.frozen; reaction(t, 'Tan băng', EL.fire.c); return; } t.st.burn = 2; }
  else if (k === 'frozen') { const deep = !!t.st.wet; delete t.st.wet; t.st.frozen = stLen(t) + (deep ? 1 : 0) + (W() === 'blizzard' ? 1 : 0); if (deep) reaction(t, 'Đóng băng sâu', EL.ice.c); }
  else if (k === 'stun') t.st.stun = stLen(t);
  log(`${tag(t)} bị ${STN[k]}`);
}
export function reaction(t, name, color){
  floatText(t, name + '!', color, true);
  log(`✦ Phản ứng <b>${name}</b> trên ${tag(t)}`, 'react');
  tip('react');
}
export function hit(t, n, src, el = 'none', o = {}){
  if (G.over || !alive(t)) return o;
  const s = t.st;
  if (src && !src.hero && src.d.kind !== 'creature' && el !== 'none') { const m = weatherMod(el); if (m) n = Math.max(0, n + m); }
  if (el === 'storm' && s.wet) {
    n += 2; delete s.wet; reaction(t, 'Giật lan', EL.storm.c);
    if (!o.noChain) for (const e of enemies(src.owner)) if (e !== t && e.st.wet) { delete e.st.wet; hit(e, 2, src, 'storm', {noChain:true}); }
  } else if (el === 'fire' && s.wet) { n = Math.max(0, n - 2); delete s.wet; o.noBurn = true; reaction(t, 'Dập lửa', EL.water.c); }
  else if (el === 'fire' && s.frozen) { n *= 2; delete s.frozen; o.noBurn = true; reaction(t, 'Hơi nước', '#f2f2f2'); }
  else if (el === 'ice' && s.burn) { n += 1; delete s.burn; reaction(t, 'Tan chảy', EL.ice.c); }
  if (t.hero) damageHero(t.owner, n);
  else {
    t.hp -= n; floatText(t, '−' + n); log(`${t.d.name} mất ${n} máu`, 'dmg');
    if (t.hp <= 0) kill(t);
  }
  return o;
}
export function damageHero(pi, n){
  if (G.over) return;
  if (hasUp(pi, 'ward') && n > 0) n -= 1;
  if (n <= 0) return;
  const p = P(pi); p.lp = Math.max(0, p.lp - n); FX.hit(pi, n * 150); floatText(hero(pi), '−' + n);
  log(`${p.name} mất ${n} sinh lực (còn ${p.lp})`, 'dmg');
  if (p.lp <= 0) gameOver(opp(pi));
}
export function heal(pi, n){ const p = P(pi); p.lp = Math.min(START_LP + 10, p.lp + n); FX.heal(pi); floatText(hero(pi), '+' + n, 'var(--good)'); log(`${p.name} hồi ${n} sinh lực (${p.lp})`, 'good'); }
export function gameOver(w){ if (G.over) return; G.over = true; G.winner = w; render(); }

/* ---------- Vào/ra sân ---------- */
export function toHand(c, pi){ c.owner = pi; c.hp = c.d.hp || 0; c.st = {}; c.marks = 0; c.tmp = 0; c.set = false; P(pi).hand.push(c); }
export function drawCard(pi){
  const p = P(pi);
  if (!p.deck.length) { p.fatigue++; log(`${p.name} hết bài, kiệt sức: mất ${p.fatigue} sinh lực`, 'dmg'); damageHero(pi, p.fatigue); return; }
  const c = p.deck.pop();
  if (p.hand.length >= HAND_MAX) { p.grave.push(c); log(`${p.name} đầy tay, ${c.d.name} cháy mất`); return; }
  p.hand.push(c); log(p.ai ? 'Máy rút 1 lá' : `Bạn rút ${c.d.name}`);
}
export function place(c, pi){ remove(c); c.owner = pi; c.hp = c.d.hp; c.st = {}; c.marks = c.marks || 0; c.tmp = 0; c.atkCount = 0; c.summonTurn = G.turnNo; P(pi).fam.push(c); }
export function spawnToken(id, pi){ if (P(pi).fam.length >= MAXF) return; const t = mk(id, pi); place(t, pi); t.ttl = t.d.ttl; log(`${P(pi).name} gọi ${t.d.name}`); render(); FX.summon(t); }
export function kill(u){
  if (!P(u.owner).fam.includes(u)) return;
  FX.shatter(u); log(`${u.d.name} bị hạ`, 'dmg');
  remove(u);
  const p = P(u.owner);
  if (u === p.bond.card) { p.bond.cd = 2; u.marks = 0; log(`${u.d.name} trở về ô khế ước, nghỉ 2 lượt`); }
  else if (!u.d.token) p.grave.push(u);
  if (u.d.onDeath) G.trig.push({card:u, fn:u.d.onDeath});
}
export function destroySpell(c){ FX.shatter(c); remove(c); c.set = false; P(c.owner).grave.push(c); log(`${c.d.name} bị phá huỷ`, 'dmg'); }
export function evolve(u){
  const to = u.d.evolve; if (!to) return;
  const nd = DB[to]; const old = u.d.name;
  u.id = to; u.d = nd; u.hp = nd.hp; u.marks = 0; u.st = {};
  log(`✦ ${old} tiến hoá thành <b>${nd.name}</b>!`, 'react'); render(); FX.summon(u); floatText(u, 'Tiến hoá!', 'var(--brass)', true);
  if (nd.onEvolve) nd.onEvolve(u);
  tip('evolve');
}

/* ---------- Lựa chọn (người hoặc máy) ---------- */
export function humanPick(text, cands, buttons){ return new Promise(res => { UI.pick = {text, cands:new Set(cands.map(c => c.uid)), buttons, res}; render(); }); }
export function resolvePick(v){ const p = UI.pick; if (!p) return; UI.pick = null; p.res(v); render(); }
export function targetsFor(c){
  const d = c.d, pi = c.owner;
  let ts = d.target === 'enemy' ? enemies(pi) : d.target === 'enemyUnit' ? enemyUnits(pi) : d.target === 'allyUnit' ? allyUnits(pi) : d.target === 'oppSpell' ? P(opp(pi)).st : [];
  if (d.targetFilter) ts = ts.filter(d.targetFilter);
  return ts;
}
export function canPlay(c){
  const p = P(c.owner), d = c.d;
  if (d.kind === 'counter') return p.st.length < MAXS;   // úp miễn phí, trả ma lực lúc kích hoạt
  if (d.cost > p.mana) return false;
  if (d.kind === 'creature') return p.fam.length < MAXF;
  if (p.st.length >= MAXS) return false;
  if (d.cond && !d.cond(c)) return false;
  if (d.target && !targetsFor(c).length) return false;
  return true;
}

/* ---------- Chuỗi phản ứng (stack) ---------- */
export async function pushLink(L){
  G.chain.push(L); L.n = G.chain.length;
  log(`Chuỗi ${L.n}: ${P(L.player).name} niệm ${L.card.d.name}`, 'chain');
  render(); FX.cast(L.card); await sleep(500);
}
export async function responseWindow(ctx, actor){
  let p = opp(actor), passes = 0;
  while (passes < 2 && !G.over) {
    const opts = P(p).st.filter(c => c.set && c.d.kind === 'counter' && c.setTurn < G.turnNo && c.d.cost <= P(p).mana && c.d.cond(c, ctx));
    let pick = null;
    if (opts.length) {
      if (P(p).ai) { pick = opts[0]; await sleep(300); }
      else {
        const r = await humanPick(`${describe(ctx)} Đáp trả bằng phản chú? (còn ${P(p).mana} ma lực)`, opts,
          [...opts.map(c => ({label:`${c.d.name} · ${c.d.cost} ma lực`, v:c, primary:true})), {label:'Bỏ qua', v:null}]);
        pick = r && r.uid ? r : null;
      }
    }
    if (pick) {
      pick.set = false; pick.flipAt = Date.now(); P(p).mana -= pick.d.cost;   // flipAt: giao diện chạy hiệu ứng lật lá
      render(); await sleep(650);
      const L = {card:pick, eff:pick.d, player:p, ctx};
      await pushLink(L); ctx = {type:'activate', link:L}; passes = 0;
    } else passes++;
    p = opp(p);
  }
}
export function describe(x){
  if (x.type === 'attack') return `${x.attacker.d.name} của Máy tấn công ${x.target ? tag(x.target) : ''}.`;
  if (x.type === 'summon') return `Máy vừa triệu hồi ${x.card.d.name}.`;
  return `Máy vừa niệm ${x.link.card.d.name}.`;
}
export async function resolveChain(){
  while (G.chain.length && !G.over) {
    const L = G.chain[G.chain.length - 1]; L.res = true; render(); await sleep(500);
    if (L.negated) { FX.fizzle(L.card); log(`✕ ${L.card.d.name} bị vô hiệu`, 'chain'); }
    else {
      const d = L.card.d, chs = d.kind === 'creature' || d.el === 'none' ? [] : P(L.player).fam.filter(f => f.d.channel && f.d.channel.el === d.el);
      L.bonus = chs.reduce((n, f) => n + f.d.channel.bonus, 0);
      if (chs.length) { for (const f of chs) FX.ring(f, [1, .85, .4], 55, .5); log(`${chs.map(f => f.d.name).join(', ')} kênh phép: +${L.bonus}`); }
      if (L.t && !alive(L.t) && !onField(L.t)) log(`${L.card.d.name} mất mục tiêu`);
      else { if (FXS[L.card.id]) await FXS[L.card.id](L.card, L); await d.op(L.card, L); }
      for (const f of chs) if (alive(f)) {
        f.marks++; floatText(f, '◆ ' + f.marks + '/' + EVOLVE_AT, 'var(--brass)'); tip('mark');
        if (f.d.evolve && f.marks >= EVOLVE_AT) evolve(f);
      }
    }
    G.chain.pop();
    const k = L.card.d.kind;
    if ((k === 'charm' || k === 'counter' || (k === 'enchant' && L.negated)) && onField(L.card)) { remove(L.card); P(L.card.owner).grave.push(L.card); }
    render();
  }
}
export async function startChain(L){ await pushLink(L); await responseWindow({type:'activate', link:L}, L.player); await resolveChain(); await processTriggers(); }
export async function processTriggers(){
  while (G.trig.length && !G.over) { const t = G.trig.shift(); await t.fn(t.card); render(); await sleep(200); }
}

/* ---------- Hành động ---------- */
export async function summon(c, fromBond){
  const p = P(c.owner);
  p.mana -= c.d.cost;
  if (fromBond) p.bond.cd = 0;
  place(c, c.owner);
  log(`${p.name} triệu hồi ${c.d.name}${fromBond ? ' (khế ước)' : ''}`);
  render(); FX.summon(c); await sleep(400);
  if (c.owner === 0) tip('upkeep');
  await responseWindow({type:'summon', card:c}, c.owner); await resolveChain();
  if (c.d.onSummon && alive(c)) { c.d.onSummon(c); render(); }
  await processTriggers();
}
export async function playSpell(c, presetTarget){
  const p = P(c.owner);
  if (!canPlay(c)) return false;
  if (c.d.kind === 'counter') { remove(c); c.set = true; c.setTurn = G.turnNo; p.st.push(c); log(`${p.name} úp 1 phản chú`); render(); return true; }
  const L = {card:c, eff:c.d, player:c.owner};
  if (c.d.target) {
    const ts = targetsFor(c);
    L.t = presetTarget || (p.ai ? ts[0] : await humanPick(`${c.d.name}: chọn mục tiêu.`, ts, [{label:'Huỷ', v:null}]));
    if (!L.t || !L.t.uid) return false;
  }
  p.mana -= c.d.cost; remove(c); c.set = false; p.st.push(c); render();
  await startChain(L);
  return true;
}
export function legalAttackTargets(u){
  const o = opp(u.owner), guards = P(o).fam.filter(f => f.d.guard);
  const ts = guards.length ? guards : [hero(o), ...P(o).fam];
  return W() === 'fog' ? ts.filter(t => !t.hero) : ts;
}
export function canAttack(u){
  return u.owner === G.active && P(u.owner).fam.includes(u) && atk(u) > 0 && !u.st.frozen && !u.st.stun &&
    u.atkCount < (u.d.multi || 1) && (u.summonTurn < G.turnNo || u.d.rush);
}
export async function attack(u, t){
  u.atkCount++; G.attackNegated = false;
  log(`${u.d.name} tấn công ${tag(t)}`); render(); await sleep(250);
  await responseWindow({type:'attack', attacker:u, target:t}, u.owner); await resolveChain();
  if (G.over || G.attackNegated || !alive(u) || !alive(t)) { await processTriggers(); return; }
  if (u.d.onAttack) u.d.onAttack(u, t);
  await FX.bolt(u, t.hero ? FX.lp(t.owner) : t, {color:[1,.62,.25], size:16, dur:.3});
  FX.anim(t.hero ? FX.lp(t.owner) : t, 'bolt', IMPACT);
  const a = atk(u);
  if (t.hero) hit(t, a, u, 'none');
  else { const b = atk(t); hit(t, a, u, 'none'); if (alive(u) && b > 0) hit(u, b, t, 'none'); }
  render(); await processTriggers();
}

/* ---------- Lượt ---------- */
export function tickStart(pi){
  for (const t of [hero(pi), ...P(pi).fam]) {
    if (!alive(t)) continue;
    if (t.st.burn) { log(`${tag(t)} đang Cháy`); hit(t, 1, t, 'none'); if (alive(t)) { t.st.burn--; if (!t.st.burn) delete t.st.burn; } }
    if (alive(t) && t.st.wet) { t.st.wet--; if (!t.st.wet) delete t.st.wet; }
  }
  for (const u of [...P(pi).fam]) if (u.d.token) { u.ttl--; if (u.ttl <= 0) { log(`${u.d.name} tan biến`); FX.fizzle(u); remove(u); } }
}
export function tickEnd(pi){
  for (const t of [hero(pi), ...P(pi).fam]) for (const k of ['frozen','stun']) if (t.st[k]) { t.st[k]--; if (!t.st[k]) delete t.st[k]; }
  for (const q of G.p) for (const u of q.fam) u.tmp = 0;
}
export async function startTurn(){
  if (G.over) return;
  G.turnNo++; const pi = G.active, p = P(pi);
  if (pi === 0 && G.turnNo > 1 && --G.weather.left <= 0) changeWeather(G.forecast);
  if (W() === 'heat') dryAll();
  p.maxMana = Math.min(MAXMANA, p.maxMana + 1);
  p.mana = Math.max(0, p.maxMana - upkeep(pi));
  if (hero(pi).st.frozen) { p.mana = Math.max(0, p.mana - 1); log(`${p.name} bị Đóng băng: mất 1 ma lực`); }
  if (W() === 'ley') { p.mana += 1; log('Mạch ma lực: +1 ma lực'); }
  if (G.turnNo === 2) { p.mana += 1; log('Máy dùng ma lực tạm (+1) của người đi sau'); }
  if (p.bond.cd > 0) p.bond.cd--;
  p.fam.forEach(u => u.atkCount = 0);
  log(`Lượt ${G.turnNo} · ${p.name} · ${p.mana}/${p.maxMana} ma lực${upkeep(pi) ? ` (${upkeep(pi)} khoá cho linh thú)` : ''}`, 'turnl');
  tickStart(pi);
  if (G.turnNo > 1) drawCard(pi);
  render(); await processTriggers();
  if (G.over) return;
  if (pi === 0) { tip('start'); if (G.turnNo >= 3) tip('attack'); if (p.maxMana >= 4) tip('bond'); if (p.hand.some(c => c.d.kind === 'counter')) tip('counter'); }
  if (p.ai) { await aiTurn(); if (!G.over) await endTurn(); }
}
export async function endTurn(){
  if (G.over) return;
  UI.sel = null; tickEnd(G.active); render(); await sleep(200);
  G.active = opp(G.active); await startTurn();
}
