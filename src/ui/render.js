import { $, EL, EVOLVE_AT, KIND, MAXF, MAXMANA, MAXS, STN } from '../config.js';
import { WEATHER } from '../data/weather.js';
import { G, P, atk, canAttack, canPlay, endTurn, hero, playSpell, resolvePick, summon, tag, uid, upkeep } from '../engine/core.js';
import { W } from '../engine/weather.js';
import { UI } from './state.js';
import { TIPS, tip } from './tutorial.js';

/* ---------- Giao diện ---------- */
export function run(fn){ if (UI.busy) return; UI.busy = true; UI.sel = null; render(); Promise.resolve(fn()).finally(() => { UI.busy = false; render(); }); }
export function chips(t){ return Object.keys(t.st).map(k => `<span class="chip st-${k}">${STN[k]}</span>`).join(''); }
export function cardHTML(c, zone){
  const hidden = c.owner === 1 && (c.set || P(1).hand.includes(c));
  const pick = UI.pick && UI.pick.cands.has(c.uid);
  if (hidden) return `<div class="card back ${c.set ? 'set' : ''} ${pick ? 'pick' : ''}" data-uid="${c.uid}" tabindex="0" aria-label="Lá úp"></div>`;
  const d = c.d, onF = P(c.owner).fam.includes(c), myTurn = G.active === 0 && !UI.busy && !G.over;
  const cls = ['card', 'face', 'k-' + d.kind];
  if (pick) cls.push('pick');
  else if (myTurn && c.owner === 0 && onF && canAttack(c)) cls.push('can-atk');
  else if (myTurn && zone === 'hand' && canPlay(c)) cls.push('playable');
  if (UI.sel === c) cls.push('sel');
  if (c.st.frozen) cls.push('frozen');
  if (onF && c.atkCount && !canAttack(c)) cls.push('used');
  let stats;
  if (d.kind === 'creature') {
    const a = atk(c), da = a - d.atk;
    stats = `<div class="cstats"><span class="a"><b class="${da > 0 ? 'up' : da < 0 ? 'down' : ''}">⚔${a}</b></span><span class="h ${onF && c.hp < d.hp ? 'down' : ''}">♥${onF ? c.hp : d.hp}</span></div>`;
  } else stats = `<div class="cstats"><span style="color:${EL[d.el].c}">${EL[d.el].n}</span></div>`;
  const marks = onF && d.evolve ? `<span class="marks">${'◆'.repeat(c.marks)}${'◇'.repeat(Math.max(0, EVOLVE_AT - c.marks))}</span>` : '';
  const tagT = c.set ? '<span class="tag">ÚP</span>' : d.guard ? '<span class="tag">HỘ VỆ</span>' : d.token ? `<span class="tag">${c.ttl}L</span>` : '';
  return `<div class="${cls.join(' ')}" data-uid="${c.uid}" tabindex="0" aria-label="${d.name}" style="--elc:${EL[d.el].c}">
    <span class="cost">${d.cost}</span>${tagT}<div class="cname">${d.name}</div><div class="cart art art-${c.id}"></div>${stats}
    <div class="stchips">${chips(c)}${marks}</div></div>`;
}
export function rowHTML(arr, n){ return [...Array(n)].map((_, i) => arr[i] ? cardHTML(arr[i], 'field') : '<div class="slot"></div>').join(''); }
export function manaHTML(p){
  const up = upkeep(p.idx); let s = '';
  for (let i = 0; i < MAXMANA; i++) {
    const cls = i < p.mana ? 'full' : i < p.maxMana && i >= p.maxMana - up && G.active === p.idx ? 'lock' : i < p.maxMana ? 'empty' : 'none';
    s += `<i class="gem ${cls}"></i>`;
  }
  return `<span class="mana" title="Ma lực">${s}<b>${p.mana}/${p.maxMana}</b></span>`;
}
export function heroHTML(pi){
  const p = P(pi), h = hero(pi), pick = UI.pick && UI.pick.cands.has(h.uid), b = p.bond;
  const bOn = p.fam.includes(b.card), canBond = pi === 0 && G.active === 0 && !UI.busy && !G.over && !bOn && b.cd === 0 && b.card.d.cost <= p.mana && p.fam.length < MAXF;
  return `<div class="hero ${pick ? 'pick' : ''}" data-hero="${pi}" id="hero${pi}">
      <div class="hname"><span class="who">${p.name}</span><span class="deckname">${p.deckName}</span></div>
      <span class="lp ${pick ? 'target' : ''}" data-uid="${h.uid}"><small>SINH LỰC</small>${p.lp}</span>
      <div class="stchips">${chips(h)}</div>
    </div>
    ${manaHTML(p)}
    <button class="bond ${canBond ? 'ready' : ''}" data-bond="${pi}" title="Linh thú khế ước">
      <span class="bart art art-${b.card.id} k-creature"></span>
      <span class="btxt"><b>${b.card.d.name}</b><br>${bOn ? 'Đang trên sân' : b.cd ? `Nghỉ ${b.cd} lượt` : `Khế ước · ${b.card.d.cost} ma lực`}</span>
    </button>
    <span class="meta">Bài ${p.deck.length} · Tay ${p.hand.length}</span>
    <button class="grave" data-grave="${pi}">Mộ · ${p.grave.length}</button>`;
}
export function render(){
  const me = P(0), ai = P(1);
  $('#oppInfo').innerHTML = heroHTML(1);
  $('#oppHand').innerHTML = ai.hand.map(() => '<div class="card back mini"></div>').join('');
  $('#oppST').innerHTML = rowHTML(ai.st, MAXS); $('#oppFam').innerHTML = rowHTML(ai.fam, MAXF);
  $('#myFam').innerHTML = rowHTML(me.fam, MAXF); $('#myST').innerHTML = rowHTML(me.st, MAXS);
  $('#myHand').innerHTML = me.hand.map(c => cardHTML(c, 'hand')).join('');
  $('#myInfo').innerHTML = heroHTML(0);
  const wd = WEATHER[W()];
  $('#turnline').innerHTML = `<button class="weather" data-weather-info="1"><span class="wdot w-${W()}"></span><b>${wd.name}</b><span class="wdesc">${wd.desc}</span>
    <span class="meta">còn ${G.weather.left} vòng · kế tiếp: <span class="wnext"><span class="wdot w-${G.forecast}"></span>${WEATHER[G.forecast].name}</span></span></button>
    <span class="turn">Lượt ${G.turnNo} · ${P(G.active).name}</span>`;
  $('#chain').innerHTML = G.chain.length ? `<span class="lbl">Chuỗi</span>` + G.chain.map((L, i) => `<span class="link ${i === G.chain.length - 1 ? 'top' : ''} ${L.negated ? 'neg' : ''} ${L.res ? 'res' : ''}" style="--k:var(--${L.card.d.kind})">${L.n}. ${L.card.d.name}</span>`).join('<span class="meta">→</span>') : '';
  renderTip(); renderPrompt(); renderInsp();
  $('#log').innerHTML = G.log.map(l => `<div class="${l.cls}">${l.t}</div>`).join('');
  $('#overlay').innerHTML = G.over ? `<div class="over"><div class="box"><h2>${G.winner === 0 ? 'Chiến thắng' : 'Thất bại'}</h2><p>${G.winner === 0 ? 'Pháp sư đối thủ đã gục.' : 'Bạn đã cạn sinh lực.'}</p><button class="btn primary" id="again">Đấu lại</button></div></div>` : '';
}
export function renderTip(){
  // gợi ý combo khi trên tay có đủ Aguamenti + Fulmen và đủ 3 ma lực
  const me = P(0);
  if (G.active === 0 && me.mana >= 3 && me.hand.some(c => c.id === 'aguamenti') && me.hand.some(c => c.id === 'fulmen')) tip('combo');
  const k = UI.tipQueue[0];
  $('#tip').innerHTML = k ? `<div class="tipbox"><span class="tiplbl">Hướng dẫn</span><p>${TIPS[k]}</p><div class="row"><button class="btn sm primary" data-tip="ok">Đã hiểu</button><button class="btn sm" data-tip="off">Tắt hướng dẫn</button></div></div>` : '';
}
export function renderPrompt(){
  let text = '', btns = [];
  const me = P(0);
  if (UI.pick) { text = UI.pick.text; btns = UI.pick.buttons.map(b => ({label:b.label, primary:b.primary, fn:() => resolvePick(b.v)})); }
  else if (G.over) text = 'Ván đấu đã kết thúc.';
  else if (G.active === 0 && !UI.busy && UI.sel && me.hand.includes(UI.sel)) {
    const c = UI.sel, d = c.d, ok = canPlay(c);
    text = `${d.name} · ${d.cost} ma lực: ${d.text}`;
    const label = d.kind === 'creature' ? 'Triệu hồi' : d.kind === 'counter' ? 'Úp xuống' : 'Niệm phép';
    btns.push({label, primary:true, dis:!ok, fn:() => run(async () => { if (d.kind === 'creature') await summon(c, false); else await playSpell(c); })});
    if (!ok) text += d.cost > me.mana ? ` (Thiếu ma lực: còn ${me.mana}.)` : d.kind === 'creature' && me.fam.length >= MAXF ? ' (Đã đủ 3 linh thú.)' : ' (Chưa có mục tiêu hợp lệ.)';
    btns.push({label:'Đóng', fn:() => { UI.sel = null; render(); }});
  } else if (G.active === 0 && !UI.busy) {
    text = `Còn ${me.mana} ma lực. Chạm lá trên tay để dùng, chạm linh thú viền đỏ để tấn công.`;
    btns.push({label:'Kết thúc lượt', primary:true, fn:() => run(endTurn)});
  } else text = G.active === 0 ? 'Đang xử lý…' : 'Máy đang niệm phép…';
  UI.btns = btns.map(b => b.fn);
  $('#prompt').innerHTML = `<p>${text}</p>` + btns.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}" data-btn="${i}" ${b.dis ? 'disabled' : ''}>${b.label}</button>`).join('');
}
export function renderInsp(){
  const el = $('#insp'), x = UI.insp;
  if (x && x.grave !== undefined) {
    const g = P(x.grave).grave; el.className = 'panel insp empty';
    el.innerHTML = `<h2>Mộ của ${P(x.grave).name}</h2>` + (g.length ? `<p>${g.map(c => c.d.name).join(', ')}</p>` : '<p class="meta">Chưa có lá nào.</p>');
    return;
  }
  const c = x && x.card;
  if (!c || c.hero || (c.owner === 1 && (c.set || P(1).hand.includes(c)))) {
    el.className = 'panel insp empty';
    el.innerHTML = `<h2>Xem lá bài</h2><p class="meta">Chạm vào một lá để đọc hiệu ứng. Lá úp của đối thủ thì không xem được.</p>`;
    return;
  }
  const d = c.d, onF = P(c.owner).fam.includes(c);
  el.className = 'panel insp';
  const st = d.kind === 'creature' ? `<div class="istats">⚔ ${atk(c)} · ♥ ${onF ? c.hp : d.hp}/${d.hp}${d.evolve ? ` · Dấu ấn ${c.marks}/${EVOLVE_AT}` : ''}</div>` : '';
  el.innerHTML = `<div class="iart art art-${c.id} k-${d.kind}"></div><div><div class="iname">${d.name}</div>
    <div class="itype">${KIND[d.kind]} · <span style="color:${EL[d.el].c}">${EL[d.el].n}</span> · ${d.cost} ma lực</div>${st}<p>${d.text}</p>
    ${Object.keys(c.st).length ? `<p class="meta">Đang: ${Object.keys(c.st).map(k => STN[k]).join(', ')}</p>` : ''}</div>`;
}
