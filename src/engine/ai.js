import { MAXF, MAXS, START_LP, sleep } from '../config.js';
import { G, P, alive, atk, attack, canAttack, canPlay, enemies, legalAttackTargets, opp, playSpell, summon, targetsFor } from './core.js';
import { W, weatherMod } from './weather.js';

/* ---------- Máy: chấm điểm từng hành động, làm hành động tốt nhất ---------- */
export function predictDmg(t, n, el){
  n = Math.max(0, n + weatherMod(el));
  if (el === 'storm' && t.st.wet) return n + 2;
  if (el === 'fire' && t.st.wet) return Math.max(0, n - 2);
  if (el === 'fire' && t.st.frozen) return n * 2;
  if (el === 'ice' && t.st.burn) return n + 1;
  return n;
}
export function unitValue(u){ return atk(u) + u.hp + (u.d.channel ? 2 : 0) + (u.d.guard ? 1 : 0); }
export function bonusFor(c){ return c.d.el === 'none' ? 0 : P(c.owner).fam.filter(f => f.d.channel && f.d.channel.el === c.d.el).reduce((n, f) => n + f.d.channel.bonus, 0); }
export function scoreTarget(c, t, base){
  const n = predictDmg(t, base + bonusFor(c), c.d.el);
  if (t.hero) return n >= P(t.owner).lp ? 100 : n * .9;
  return n >= t.hp ? 3 + unitValue(t) : n * .5;
}
export function aiPlan(c){
  const pi = c.owner, p = P(pi), o = opp(pi), d = c.d, id = c.id;
  if (!canPlay(c)) return null;
  const left = p.mana - d.cost;
  const fireInHand = p.hand.some(h => h !== c && h.d.el === 'fire' && h.d.cost <= left);
  const stormInHand = p.hand.some(h => h !== c && h.d.el === 'storm' && h.d.cost <= left);
  switch (id) {
    case 'incendio': case 'aguamenti': case 'fulmen': {
      const base = id === 'incendio' ? 2 : id === 'fulmen' ? 3 : 1;
      const ts = targetsFor(c).map(t => ({t, s:scoreTarget(c, t, base)})).sort((a, b) => b.s - a.s);
      if (id === 'aguamenti' && stormInHand) { const w = targetsFor(c).filter(t => !t.st.wet).sort((a, b) => (b.hero ? 3 : unitValue(b) * .5) - (a.hero ? 3 : unitValue(a) * .5))[0]; if (w) return {score:6, t:w}; }
      return ts.length ? {score:ts[0].s + (id === 'incendio' && !ts[0].t.st.burn ? 1 : 0), t:ts[0].t} : null; }
    case 'glacius': {
      const ts = targetsFor(c).map(t => ({t, s:(t.hero ? (fireInHand ? 5 : 1.5) : (fireInHand ? 3 : 1) + atk(t) * .6)})).sort((a, b) => b.s - a.s);
      return ts.length ? {score:ts[0].s, t:ts[0].t} : null; }
    case 'confringo': case 'stupefy': {
      const base = id === 'confringo' ? 5 : 2;
      const ts = targetsFor(c).map(t => ({t, s:scoreTarget(c, t, base) + (id === 'stupefy' ? atk(t) * .4 : 0)})).sort((a, b) => b.s - a.s);
      return ts.length && ts[0].s >= 2 ? {score:ts[0].s, t:ts[0].t} : null; }
    case 'reducto': { const ts = targetsFor(c).sort((a, b) => unitValue(b) - unitValue(a)); return ts.length ? {score:3 + unitValue(ts[0]), t:ts[0]} : null; }
    case 'ignis': case 'tempestas': case 'unda': {
      const s = enemies(pi).reduce((n, e) => n + (e.hero ? 2 : (e.hp <= 2 ? 3 + unitValue(e) : 1)), 0); return {score:s}; }
    case 'bombarda': { const ts = P(o).st.sort((a, b) => (b.set ? 1 : 0) - (a.set ? 1 : 0)); return ts.length ? {score:4, t:ts[0]} : null; }
    case 'callrain': case 'callsun': {
      const want = id === 'callrain' ? 'rain' : 'heat', mine = p.hand.filter(h => h !== c && (h.d.el === (id === 'callrain' ? 'storm' : 'fire'))).length;
      return W() !== want ? {score:2 + mine * .8 + (W() === (id === 'callrain' ? 'heat' : 'rain') ? 2 : 0)} : null; }
    case 'episkey': return p.lp <= START_LP - 6 ? {score:4} : null;
    case 'tempus': return p.hand.length <= 4 ? {score:3} : {score:1};
    case 'accio': return p.hand.filter(h => h.d.kind === 'creature').length < 2 ? {score:2.5} : null;
    case 'obliviate': return {score:2};
    case 'engorgio': { const us = p.fam.filter(u => canAttack(u)); return us.length ? {score:2, t:us.sort((a, b) => atk(b) - atk(a))[0]} : null; }
    case 'vincula': return P(o).fam.length >= 2 ? {score:3.5} : P(o).fam.length ? {score:2} : null;
    case 'fiantoduri': return {score:2};
    case 'avis': case 'expecto': return {score:id === 'expecto' ? 6 : 2.5};
    default:
      if (d.kind === 'counter') return {score:0.5};
      if (d.kind === 'creature') return {score:2 + atk(c) * .5 + d.hp * .4 + (d.channel && p.hand.some(h => h.d.el === d.channel.el) ? 1.5 : 0) + (d.guard && P(o).fam.length ? 1 : 0)};
      return {score:1};
  }
}
export async function aiTurn(){
  const pi = G.active, p = P(pi);
  await sleep(500);
  for (let step = 0; step < 14 && !G.over; step++) {
    let best = null;
    const b = p.bond.card;
    if (!p.fam.includes(b) && p.bond.cd === 0 && b.d.cost <= p.mana && p.fam.length < MAXF) best = {score:7, c:b, bond:true};
    for (const c of p.hand) {
      if (c.d.kind === 'counter') continue;
      const plan = aiPlan(c); if (!plan) continue;
      if (!best || plan.score > best.score) best = {...plan, c};
    }
    if (!best || best.score < 1) break;
    if (best.bond) await summon(best.c, true);
    else if (best.c.d.kind === 'creature') await summon(best.c, false);
    else if (!(await playSpell(best.c, best.t))) break;
    await sleep(300);
  }
  for (const c of p.hand.filter(c => c.d.kind === 'counter')) if (p.st.length < MAXS && !G.over) await playSpell(c);
  for (const u of [...p.fam]) {
    while (!G.over && alive(u) && canAttack(u)) {
      const ts = legalAttackTargets(u), a = atk(u);
      const kills = ts.filter(t => !t.hero && t.hp <= a && atk(t) < u.hp).sort((x, y) => unitValue(y) - unitValue(x));
      const face = ts.find(t => t.hero);
      let t = (face && P(face.owner).lp <= a ? face : null) || kills[0] || face || ts.find(t => !t.hero && t.hp <= a) || ts[0] || null;
      if (!t) break;
      await attack(u, t); await sleep(250);
    }
  }
}
