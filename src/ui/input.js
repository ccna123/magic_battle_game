import { $ } from '../config.js';
import { G, P, allTargets, hero, resolvePick } from '../engine/core.js';
import { ART, applyArt, saveArt } from './art.js';
import { loadArt, renderLib } from './library.js';
import { canNewGame, closeDeckPick, openDeckPick, renderDeckPick, startWithDeck } from './deckpick.js';
import { canMenu, hideInfo, placeMenu, render, showInfo } from './render.js';
import { UI } from './state.js';
import { dismissTip } from './tutorial.js';

/* ---------- Thao tác chuột / bàn phím ---------- */
/* Góc nhìn sân: nghiêng 3D (mặc định) hoặc phẳng, nhớ theo trình duyệt */
function setView(tilt){
  document.body.classList.toggle('view-3d', tilt);
  const b = $('#viewBtn'); b.textContent = `Góc nhìn: ${tilt ? 'Nghiêng' : 'Phẳng'}`; b.setAttribute('aria-pressed', tilt);
  try { localStorage.setItem('dp-view', tilt ? '3d' : '2d'); } catch (e) {}
}
export function bindInput(){
  try { if (localStorage.getItem('dp-view') === '2d') setView(false); } catch (e) {}
  let press = null, pressed = false;
  document.addEventListener('click', e => {
    if (pressed) { pressed = false; if (e.target.closest('.card,[data-bond]')) return; }   // vừa giữ lâu để xem công dụng: không tính là chạm
    hideInfo();
    if (e.target.id === 'again') { startWithDeck(); return; }
    if (e.target.closest('[data-newgame]')) { if (canNewGame()) openDeckPick(); return; }
    const dp = e.target.closest('[data-deck],[data-dpai],[data-dp]');
    if (dp) {
      if (dp.dataset.deck) { UI.deck.me = dp.dataset.deck; renderDeckPick(); }
      else if (dp.dataset.dpai) { UI.deck.ai = dp.dataset.dpai; renderDeckPick(); }
      else if (dp.dataset.dp === 'start') startWithDeck();
      else if (dp.dataset.dp === 'close') closeDeckPick();
      return;
    }
    if (e.target.id === 'viewBtn') { setView(!document.body.classList.contains('view-3d')); render(); return; }
    if (e.target.id === 'openLib') { renderLib(); $('#lib').hidden = false; return; }
    const tp = e.target.closest('[data-tip]');
    if (tp) { if (tp.dataset.tip === 'off') { UI.tutOff = true; UI.seen.__off = 1; UI.tipQueue = []; try { localStorage.setItem('dp-tut', JSON.stringify(UI.seen)); } catch (er) {} render(); } else dismissTip(); return; }
    const lb = e.target.closest('[data-lib],[data-libf],[data-up],[data-reset]');
    if (lb) {
      if (lb.dataset.lib === 'close') $('#lib').hidden = true;
      else if (lb.dataset.libf) { UI.libFilter = lb.dataset.libf; renderLib(); }
      else if (lb.dataset.up) { UI.uploadFor = lb.dataset.up; $('#artFile').value = ''; $('#artFile').click(); }
      else if (lb.dataset.reset) { delete ART[lb.dataset.reset]; saveArt(); applyArt(); renderLib(); render(); }
      return;
    }
    const ac = e.target.closest('[data-act]');
    if (ac) { const f = ac.dataset.act === 'close' ? null : UI.acts[+ac.dataset.act]; UI.sel = null; if (f) f(); else render(); return; }
    if (e.target.closest('#cardmenu')) return;
    const b = e.target.closest('[data-btn]'); if (b) { const f = UI.btns[+b.dataset.btn]; if (f) f(); return; }
    const gv = e.target.closest('[data-grave]'); if (gv) { UI.insp = {grave:+gv.dataset.grave}; UI.sel = null; render(); return; }
    const bd = e.target.closest('[data-bond]');
    if (bd) {
      const bc = P(+bd.dataset.bond).bond.card; UI.insp = {card:bc};
      UI.sel = UI.sel !== bc && canMenu(bc) ? bc : null;
      render(); return;
    }
    const hz = e.target.closest('[data-hero]');
    if (hz && UI.pick) { const h = hero(+hz.dataset.hero); if (UI.pick.cands.has(h.uid)) resolvePick(h); return; }
    const el = e.target.closest('[data-uid]');
    const c = el && allTargets().find(x => String(x.uid) === el.dataset.uid);
    if (!c) { if (UI.sel) { UI.sel = null; render(); } return; }
    UI.insp = {card:c};
    if (UI.pick) { if (UI.pick.cands.has(c.uid)) resolvePick(c); else render(); return; }
    // Chạm lá: hiện nút hành động ngay cạnh lá (chạm lại để ẩn)
    UI.sel = UI.sel !== c && canMenu(c) ? c : null;
    render();
  });
  // Nhấp chuột phải: xem công dụng lá bài
  document.addEventListener('contextmenu', e => {
    const t = cardAt(e.target); if (!t) { hideInfo(); return; }
    e.preventDefault();
    if (UI.sel) { UI.sel = null; render(); }
    showInfo(t, e.clientX, e.clientY);
  });
  // Màn cảm ứng (iOS không có contextmenu): giữ lâu để xem công dụng
  document.addEventListener('touchstart', e => {
    pressed = false;
    const t = cardAt(e.target), p = e.touches[0]; if (!t || !p) return;
    clearTimeout(press); press = setTimeout(() => { press = null; pressed = true; showInfo(t, p.clientX, p.clientY); }, 500);
  }, {passive:true});
  for (const ev of ['touchend', 'touchmove', 'touchcancel']) document.addEventListener(ev, () => { clearTimeout(press); press = null; }, {passive:true});
  window.addEventListener('resize', () => { placeMenu(); hideInfo(); });
  document.addEventListener('scroll', () => { placeMenu(); hideInfo(); }, true);
  $('#artFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f && UI.uploadFor) loadArt(f, UI.uploadFor); });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-uid]')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape') {
      hideInfo();
      if (!$('#lib').hidden) $('#lib').hidden = true;
      else if (UI.sel) { UI.sel = null; render(); }
      else if (UI.deckPick && UI.started && !G.over) closeDeckPick();
    }
  });


}
function cardAt(target){
  const bd = target.closest('[data-bond]'); if (bd) return P(+bd.dataset.bond).bond.card;
  const el = target.closest('.card[data-uid]'); if (!el || !G) return null;
  return allTargets().find(x => String(x.uid) === el.dataset.uid) || null;
}
