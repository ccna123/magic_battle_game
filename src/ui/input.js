import { $, MAXF } from '../config.js';
import { G, P, allTargets, atk, attack, canAttack, hero, humanPick, legalAttackTargets, newGame, resolvePick, startTurn, summon } from '../engine/core.js';
import { ART, applyArt, saveArt } from './art.js';
import { loadArt, renderLib } from './library.js';
import { render, run } from './render.js';
import { UI } from './state.js';
import { dismissTip } from './tutorial.js';

/* ---------- Thao tác chuột / bàn phím ---------- */
export function bindInput(){
  document.addEventListener('click', e => {
    if (e.target.id === 'again') { newGame(); render(); run(startTurn); return; }
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
    const b = e.target.closest('[data-btn]'); if (b) { const f = UI.btns[+b.dataset.btn]; if (f) f(); return; }
    const gv = e.target.closest('[data-grave]'); if (gv) { UI.insp = {grave:+gv.dataset.grave}; render(); return; }
    const bd = e.target.closest('[data-bond]');
    if (bd) {
      const pi = +bd.dataset.bond, bc = P(pi).bond.card; UI.insp = {card:bc};
      const p = P(0);
      if (pi === 0 && !UI.pick && !UI.busy && !G.over && G.active === 0 && !p.fam.includes(bc) && p.bond.cd === 0 && bc.d.cost <= p.mana && p.fam.length < MAXF) run(() => summon(bc, true));
      else render();
      return;
    }
    const hz = e.target.closest('[data-hero]');
    if (hz && UI.pick) { const h = hero(+hz.dataset.hero); if (UI.pick.cands.has(h.uid)) resolvePick(h); return; }
    const el = e.target.closest('[data-uid]'); if (!el) return;
    const c = allTargets().find(x => String(x.uid) === el.dataset.uid); if (!c) return;
    UI.insp = {card:c};
    if (UI.pick) { if (UI.pick.cands.has(c.uid)) resolvePick(c); else render(); return; }
    if (UI.busy || G.over || G.active !== 0) { render(); return; }
    const me = P(0);
    if (me.hand.includes(c)) { UI.sel = UI.sel === c ? null : c; render(); return; }
    if (me.fam.includes(c) && canAttack(c)) {
      run(async () => {
        const ts = legalAttackTargets(c);
        const r = await humanPick(`${c.d.name} (⚔${atk(c)}): chọn mục tiêu${ts.length && !ts.some(t => t.hero) ? ' — phải đánh Hộ vệ trước' : ''}.`, ts, [{label:'Huỷ', v:null}]);
        if (r && r.uid) await attack(c, r);
      });
      return;
    }
    render();
  });
  $('#artFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f && UI.uploadFor) loadArt(f, UI.uploadFor); });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-uid]')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape' && !$('#lib').hidden) $('#lib').hidden = true;
  });


}
