import { sleep } from '../config.js';
import { enemies, enemyUnits, opp } from '../engine/core.js';
import { FX } from './three-fx.js';

/* ---------- Hiệu ứng hình ảnh từng lá ---------- */
export const IMPACT = {from: 5, to: 7, fps: 12};
export const FXS = {
  aguamenti: async (c, L) => { await FX.bolt(c, L.t, {color:[.4,.7,1], size:14}); FX.rise(L.t, [.4,.7,1], 40); },
  unda: async c => { for (const e of enemies(c.owner)) FX.rise(e, [.4,.7,1], 50); await sleep(450); },
  fulmen: async (c, L) => { await FX.bolt(c, L.t, {color:[1,.95,.4], size:18, dur:.3}); FX.anim(L.t, 'bolt', IMPACT); FX.shake(5); },
  stupefy: async (c, L) => { await FX.bolt(c, L.t, {color:[1,.2,.2]}); FX.anim(L.t, 'bolt', IMPACT); },
  tempestas: async c => { for (const e of enemies(c.owner)) FX.anim(e, 'bolt', IMPACT); FX.shake(9); await sleep(500); },
  expecto: async () => { FX.swirl({center:true}, [.85,.93,1], 1400, 130); await FX.anim({center:true}, 'patronus', {size:280, fps:11}); },
  avis: async c => { FX.rise(c, [.95,.95,1], 80); await sleep(350); },
  fiantoduri: async c => { await FX.anim(FX.lp(c.owner), 'shield', {from:2, to:5, size:120}); },
  speculum: async c => { await FX.anim(c, 'mirror', {to:4, fps:12}); await FX.bolt(c, FX.lp(opp(c.owner)), {color:[.85,.95,1], size:18}); },
  incendio: async (c, L) => { await FX.bolt(c, L.t, {fire:true, color:[1,.5,.1], size:16}); FX.anim(L.t, 'fire', {from:1, to:5}); },
  confringo: async (c, L) => { await FX.bolt(c, L.t, {fire:true, color:[1,.35,.1], size:18}); FX.anim(L.t, 'fire', {from:2, to:6}); },
  ignis: async c => { for (const e of enemies(c.owner)) FX.anim(e, 'fire', {from:1, to:5}); await sleep(600); },
  bombarda: async (c, L) => { await FX.bolt(c, L.t, {color:[1,.7,.25], size:20}); FX.anim(L.t, 'bolt', IMPACT); FX.shake(7); },
  glacius: async (c, L) => { await FX.bolt(c, L.t, {color:[.6,.9,1], size:16}); FX.burst(L.t, {color:[.7,.9,1], count:70, speed:120}); },
  petrificus: async (c, L) => { await FX.bolt(c, L.ctx.card, {color:[.7,.9,1]}); },
  vincula: async c => { for (const m of enemyUnits(c.owner)) FX.burst(m, {color:[.45,.62,.2], count:60, speed:70, gravity:-50, life:1}); await sleep(400); },
  engorgio: async (c, L) => { FX.rise(L.t, [1,.7,.3], 70); await sleep(350); },
  episkey: async () => { await sleep(150); },
  accio: c => FX.bolt(c, {hand:c.owner}, {color:[1,.85,.45]}),
  reducto: async (c, L) => { await FX.bolt(c, L.t, {color:[.6,.8,1], size:18}); FX.anim(L.t, 'bolt', IMPACT); },
  obliviate: async c => { FX.swirl({hand:opp(c.owner)}, [.75,.78,.85], 800, 60); await sleep(500); },
  tempus: async () => { await FX.anim({center:true}, 'patronus', {to:4, size:200, fps:10}); },
  protego: async (c, L) => { FX.anim(L.ctx.link.card, 'shield', {fps:13}); await FX.anim(c, 'shield', {to:5, fps:13}); },
  expelliarmus: async (c, L) => { await FX.bolt(c, L.ctx.attacker, {color:[1,.2,.2], size:16}); FX.anim(L.ctx.attacker, 'bolt', IMPACT); },
};
