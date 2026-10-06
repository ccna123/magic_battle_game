import { $, EL, EVOLVE_AT, KIND, MAXF, MAXMANA, MAXS, STN } from '../config.js';
import { WEATHER } from '../data/weather.js';
import { G, P, atk, attack, canAttack, canPlay, endTurn, hero, humanPick, legalAttackTargets, playSpell, resolvePick, summon, upkeep } from '../engine/core.js';
import { W } from '../engine/weather.js';
import { UI } from './state.js';
import { TIPS, tip } from './tutorial.js';

/* ---------- Giao diện ---------- */
export function run(fn){ if (UI.busy) return; UI.busy = true; UI.sel = null; render(); Promise.resolve(fn()).finally(() => { UI.busy = false; render(); }); }
export function chips(t){ return Object.keys(t.st).map(k => `<span class="chip st-${k}">${STN[k]}</span>`).join(''); }
export const FLIP_MS = 650;
export function cardHTML(c, zone){
  // Lá úp (của cả hai bên) và bài trên tay đối thủ hiện mặt sau; lá úp của bạn vẫn xem được bằng chuột phải
  const hidden = c.set || (c.owner === 1 && P(1).hand.includes(c));
  const pick = UI.pick && UI.pick.cands.has(c.uid);
  if (hidden) return `<div class="card back ${c.set ? 'set' : ''} ${pick ? 'pick' : ''}" data-uid="${c.uid}" tabindex="0" aria-label="${c.owner === 0 ? 'Lá úp: ' + c.d.name : 'Lá úp'}"></div>`;
  const d = c.d, onF = P(c.owner).fam.includes(c), myTurn = G.active === 0 && !UI.busy && !G.over;
  const cls = ['card', 'face', 'k-' + d.kind];
  // Vừa lật ngửa: chạy hiệu ứng lật, giữ đúng tiến độ qua các lần vẽ lại
  const flipT = c.flipAt ? Date.now() - c.flipAt : Infinity, flip = flipT < FLIP_MS;
  if (flip) cls.push('flip');
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
  const tagT = d.guard ? '<span class="tag">HỘ VỆ</span>' : d.token ? `<span class="tag">${c.ttl}L</span>` : '';
  return `<div class="${cls.join(' ')}" data-uid="${c.uid}" tabindex="0" aria-label="${d.name}" style="--elc:${EL[d.el].c}${flip ? `;animation-delay:-${flipT}ms` : ''}">
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
export function graveHTML(pi){
  const g = P(pi).grave, top = g[g.length - 1];
  return `<button class="gy" data-grave="${pi}" aria-label="Mộ của ${P(pi).name}: ${g.length} lá">
    ${top ? `<span class="gytop art art-${top.id} k-${top.d.kind}"></span>` : ''}<span class="gylbl">MỘ</span><b class="gyn">${g.length}</b></button>`;
}
export function render(){
  const me = P(0), ai = P(1);
  $('#oppInfo').innerHTML = heroHTML(1);
  $('#oppHand').innerHTML = ai.hand.map(() => '<div class="card back mini"></div>').join('');
  $('#oppST').innerHTML = rowHTML(ai.st, MAXS); $('#oppFam').innerHTML = rowHTML(ai.fam, MAXF);
  $('#myFam').innerHTML = rowHTML(me.fam, MAXF); $('#myST').innerHTML = rowHTML(me.st, MAXS);
  $('#oppGY').innerHTML = graveHTML(1); $('#myGY').innerHTML = graveHTML(0);
  if (UI.graveView !== null) renderGraveView();
  // Bài trên tay xoè hình quạt: --i là vị trí so với giữa, --ov là độ chồng (càng nhiều lá càng chồng)
  const n = me.hand.length, mid = (n - 1) / 2, ov = n <= 4 ? .08 : n <= 6 ? .28 : .42;
  $('#myHand').innerHTML = me.hand.map((c, i) => cardHTML(c, 'hand').replace('style="', `style="--i:${i - mid};--a:${Math.abs(i - mid)};--ov:${ov};`)).join('');
  $('#myInfo').innerHTML = heroHTML(0);
  const wd = WEATHER[W()];
  $('#turnline').innerHTML = `<button class="weather" data-weather-info="1"><span class="wdot w-${W()}"></span><b>${wd.name}</b><span class="wdesc">${wd.desc}</span>
    <span class="meta">còn ${G.weather.left} vòng · kế tiếp: <span class="wnext"><span class="wdot w-${G.forecast}"></span>${WEATHER[G.forecast].name}</span></span></button>
    <span class="turn">Lượt ${G.turnNo} · ${P(G.active).name}</span>`;
  $('#chain').innerHTML = G.chain.length ? `<span class="lbl">Chuỗi</span>` + G.chain.map((L, i) => `<span class="link ${i === G.chain.length - 1 ? 'top' : ''} ${L.negated ? 'neg' : ''} ${L.res ? 'res' : ''}" style="--k:var(--${L.card.d.kind})">${L.n}. ${L.card.d.name}</span>`).join('<span class="meta">→</span>') : '';
  renderTip(); renderPrompt(); renderMenu(); fitField();
  $('#overlay').innerHTML = G.over ? `<div class="over"><div class="box"><h2>${G.winner === 0 ? 'Chiến thắng' : 'Thất bại'}</h2><p>${G.winner === 0 ? 'Pháp sư đối thủ đã gục.' : 'Bạn đã cạn sinh lực.'}</p><div class="row" style="justify-content:center"><button class="btn primary" id="again">Đấu lại</button><button class="btn" data-newgame="1">Đổi bộ bài</button></div></div></div>` : '';
}
export function renderTip(){
  // gợi ý combo khi trên tay có đủ Aguamenti + Fulmen và đủ 3 ma lực
  const me = P(0);
  if (G.active === 0 && me.mana >= 3 && me.hand.some(c => c.id === 'aguamenti') && me.hand.some(c => c.id === 'fulmen')) tip('combo');
  const k = UI.tipQueue[0];
  const t = k && TIPS[k];
  $('#tip').innerHTML = k ? `<div class="tipbox"><span class="tiplbl">Hướng dẫn</span><p>${typeof t === 'function' ? t() : t}</p><div class="row"><button class="btn sm primary" data-tip="ok">Đã hiểu</button><button class="btn sm" data-tip="off">Tắt hướng dẫn</button></div></div>` : '';
}
export function renderPrompt(){
  let text = '', btns = [];
  const me = P(0);
  if (UI.pick) { text = UI.pick.text; btns = UI.pick.buttons.map(b => ({label:b.label, primary:b.primary, fn:() => resolvePick(b.v)})); }
  else if (G.over) text = 'Ván đấu đã kết thúc.';
  else if (G.active === 0 && !UI.busy) {
    text = `Còn <b>${me.mana}</b> ma lực.<br><span class="meta">Chạm lá để chọn hành động · chuột phải / giữ lâu để xem công dụng.</span>`;
    btns.push({label:'Kết thúc lượt', primary:true, fn:() => run(endTurn)});
  } else text = G.active === 0 ? 'Đang xử lý…' : 'Máy đang niệm phép…';
  UI.btns = btns.map(b => b.fn);
  $('#prompt').innerHTML = `<p>${text}</p>` + btns.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}" data-btn="${i}" ${b.dis ? 'disabled' : ''}>${b.label}</button>`).join('');
}
/* Nội dung chi tiết một lá: dùng cho khung "Xem lá bài" và bảng công dụng khi nhấp chuột phải */
export function cardDetailHTML(c){
  const d = c.d, onF = P(c.owner).fam.includes(c);
  const st = d.kind === 'creature' ? `<div class="istats">⚔ ${atk(c)} · ♥ ${onF ? c.hp : d.hp}/${d.hp}${d.evolve ? ` · Dấu ấn ${c.marks}/${EVOLVE_AT}` : ''}</div>` : '';
  return `<div class="iart art art-${c.id} k-${d.kind}"></div><div><div class="iname">${d.name}</div>
    <div class="itype">${KIND[d.kind]} · <span style="color:${EL[d.el].c}">${EL[d.el].n}</span> · ${d.cost} ma lực</div>${st}<p>${d.text}</p>
    ${Object.keys(c.st).length ? `<p class="meta">Đang: ${Object.keys(c.st).map(k => STN[k]).join(', ')}</p>` : ''}</div>`;
}
export function isHidden(c){ return !c || c.hero || (c.owner === 1 && (c.set || P(1).hand.includes(c))); }

/* Mặt sân nghiêng chừa khoảng trống phía trên khung bao: kéo sân lên sát HUD đối thủ (chừa chỗ cho lá đứng ở hàng xa) */
export function fitField(){
  const f = document.querySelector('.field3d'); if (!f || !f.querySelector) return;   // sim: DOM giả không có querySelector
  const pl = f.querySelector('.plane'); if (!pl) return;
  if (!document.body.classList.contains('view-3d')) { f.style.marginTop = ''; return; }
  const cw = pl.querySelector('.slot,.card')?.getBoundingClientRect().width || 80;
  const gap = pl.getBoundingClientRect().top - f.getBoundingClientRect().top;
  f.style.marginTop = Math.min(0, -(gap - cw * .45)) + 'px';
}

/* ---------- Nút hành động hiện ngay cạnh lá được chọn ---------- */
export function menuFor(c){
  const me = P(0), d = c.d, acts = [];
  let note = '';
  if (me.hand.includes(c)) {
    const ok = canPlay(c);
    acts.push({label:d.kind === 'creature' ? 'Triệu hồi' : d.kind === 'counter' ? 'Úp xuống' : 'Niệm phép', primary:true, dis:!ok,
      fn:() => run(async () => { if (d.kind === 'creature') await summon(c, false); else await playSpell(c); })});
    if (!ok) note = d.cost > me.mana ? `Thiếu ma lực: còn ${me.mana}.` : d.kind === 'creature' && me.fam.length >= MAXF ? 'Đã đủ 3 linh thú.' : 'Chưa có mục tiêu hợp lệ.';
  } else if (c === me.bond.card && !me.fam.includes(c)) {
    const ok = me.bond.cd === 0 && d.cost <= me.mana && me.fam.length < MAXF;
    acts.push({label:'Gọi khế ước', primary:true, dis:!ok, fn:() => run(() => summon(c, true))});
    if (!ok) note = me.bond.cd ? `Đang nghỉ ${me.bond.cd} lượt.` : d.cost > me.mana ? `Thiếu ma lực: còn ${me.mana}.` : 'Đã đủ 3 linh thú.';
  } else if (me.fam.includes(c) && canAttack(c)) {
    acts.push({label:`Tấn công · ⚔${atk(c)}`, primary:true, fn:() => run(async () => {
      const ts = legalAttackTargets(c);
      const r = await humanPick(`${c.d.name} (⚔${atk(c)}): chọn mục tiêu${ts.length && !ts.some(t => t.hero) ? ' — phải đánh Hộ vệ trước' : ''}.`, ts, [{label:'Huỷ', v:null}]);
      if (r && r.uid) await attack(c, r);
    })});
  }
  return {acts, note};
}
export function canMenu(c){ return G.active === 0 && !UI.busy && !UI.pick && !G.over && menuFor(c).acts.length > 0; }
export function renderMenu(){
  const el = $('#cardmenu'), c = UI.sel;
  if (!c || !canMenu(c)) { el.hidden = true; el.innerHTML = ''; UI.acts = []; return; }
  const {acts, note} = menuFor(c);
  UI.acts = acts.map(a => a.fn);
  el.innerHTML = `<div class="cm-name">${c.d.name} <span class="meta">· ${c.d.cost} ma lực</span></div>${note ? `<div class="cm-note">${note}</div>` : ''}
    <div class="row">${acts.map((a, i) => `<button class="btn sm ${a.primary ? 'primary' : ''}" data-act="${i}" ${a.dis ? 'disabled' : ''}>${a.label}</button>`).join('')}
    <button class="btn sm" data-act="close">Đóng</button></div>`;
  el.hidden = false;
  placeMenu();
}
export function anchorOf(c){ return c === P(0).bond.card && !P(0).fam.includes(c) ? document.querySelector('[data-bond="0"]') : document.querySelector(`[data-uid="${c.uid}"]`); }
export function placeMenu(){
  const el = $('#cardmenu'); if (el.hidden || !UI.sel) return;
  const a = anchorOf(UI.sel); if (!a) { el.hidden = true; return; }
  const r = a.getBoundingClientRect(), m = el.getBoundingClientRect(), vw = document.documentElement.clientWidth;
  let top = r.top - m.height - 8;
  if (top < 8) top = r.bottom + 8;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - m.width / 2), vw - m.width - 8);
  el.style.top = top + 'px'; el.style.left = left + 'px';
}

/* ---------- Bảng công dụng khi nhấp chuột phải / giữ lâu ---------- */
export function showInfo(c, x, y){
  const el = $('#cardinfo');
  el.className = 'cardinfo insp';
  el.innerHTML = isHidden(c) ? '<div><div class="iname">Lá úp</div><p class="meta">Không xem được lá úp của đối thủ.</p></div>' : cardDetailHTML(c);
  el.hidden = false;
  const m = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  el.style.left = Math.min(Math.max(8, x + 12), vw - m.width - 8) + 'px';
  el.style.top = Math.min(Math.max(8, y + 12), vh - m.height - 8) + 'px';
}
/* ---------- Xem mộ: danh sách lá trong mộ, mới nhất trước ---------- */
export function openGrave(pi){ UI.graveView = pi; UI.sel = null; render(); }
export function closeGrave(){ UI.graveView = null; $('#gravebox').hidden = true; }
export function renderGraveView(){
  const pi = UI.graveView, g = [...P(pi).grave].reverse(), el = $('#gravebox');
  el.innerHTML = `<div class="dp-in">
    <div class="lib-top"><h2>Mộ của ${P(pi).name} · ${g.length} lá</h2>
      <button class="btn sm" data-gv="${1 - pi}">Xem mộ ${P(1 - pi).name}</button><button class="btn" data-gv="close">Đóng</button></div>
    ${g.length ? `<div class="gv-grid">${g.map(c => cardHTML(c, 'grave')).join('')}</div>` : '<p class="meta">Chưa có lá nào.</p>'}
    <p class="meta">Nhấp chuột phải (hoặc giữ lâu) vào một lá để xem công dụng.</p>
  </div>`;
  el.hidden = false;
}
export function hideInfo(){ const el = $('#cardinfo'); if (el && !el.hidden) el.hidden = true; }
