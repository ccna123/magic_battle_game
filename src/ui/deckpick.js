import { $, EL } from '../config.js';
import { DB, DECKS } from '../data/cards.js';
import { G, newGame, startTurn } from '../engine/core.js';
import { render, run } from './render.js';
import { UI } from './state.js';

/* ---------- Chọn bộ bài trước ván đấu ---------- */
const keys = () => Object.keys(DECKS);
const otherDeck = k => { const o = keys().filter(x => x !== k); return o[Math.random() * o.length | 0] || k; };   // 'auto': một bộ khác ngẫu nhiên
try { const s = JSON.parse(localStorage.getItem('dp-deck') || 'null'); if (s && DECKS[s.me]) UI.deck = {me:s.me, ai:DECKS[s.ai] || s.ai === 'auto' ? s.ai : 'auto'}; } catch (e) {}
if (!UI.deck) UI.deck = {me:keys()[0], ai:'auto'};

// Được đổi bộ bài khi không có hành động nào đang chạy (tránh để lửng một lượt của máy)
export const canNewGame = () => !UI.started || G.over || (!UI.busy && !UI.pick && G.active === 0);
const inGame = () => UI.started && !G.over;

export function openDeckPick(){ UI.deckPick = true; renderDeckPick(); }
export function closeDeckPick(){ UI.deckPick = false; $('#deckpick').hidden = true; }
export function renderDeckPick(){
  const el = $('#deckpick'), sel = UI.deck;
  const count = D => Object.values(D.list).reduce((a, b) => a + b, 0);
  const tile = k => { const D = DECKS[k], b = DB[D.bond];
    return `<button class="deck ${sel.me === k ? 'on' : ''}" data-deck="${k}" aria-pressed="${sel.me === k}">
      <span class="dart art art-${D.bond} k-creature"></span>
      <span class="dbody"><span class="dname">${D.name}</span>
        <span class="dels">${D.els.map(e => `<span style="color:${EL[e].c}">${EL[e].n}</span>`).join(' · ')} · ${count(D)} lá</span>
        <span class="ddesc">${D.desc}</span>
        <span class="meta">Khế ước: <b>${b.name}</b> (${b.cost} ma lực, ⚔${b.atk} ♥${b.hp})</span></span>
    </button>`; };
  const list = k => Object.entries(DECKS[k].list).map(([id, n]) => `${DB[id].name}${n > 1 ? ' ×' + n : ''}`).join(', ');
  const aiOpts = [['auto', 'Ngẫu nhiên'], ...keys().map(k => [k, DECKS[k].name])];
  el.innerHTML = `<div class="dp-in">
    <div class="lib-top"><h2>Chọn bộ bài</h2>${inGame() ? '<button class="btn" data-dp="close">Huỷ</button>' : ''}</div>
    <div class="deck-grid">${keys().map(tile).join('')}</div>
    <details class="panel"><summary>Danh sách lá của ${DECKS[sel.me].name}</summary><p>${list(sel.me)}</p></details>
    <div class="dp-ai"><span class="meta">Đối thủ (Máy):</span>${aiOpts.map(([k, l]) => `<button class="btn sm ${sel.ai === k ? 'on' : ''}" data-dpai="${k}">${l}</button>`).join('')}</div>
    ${sel.me === 'thuyloi' ? '<p class="meta">Bộ Thuỷ – Lôi có ván hướng dẫn: tay đầu được đưa sẵn combo Ướt → Sét.</p>' : ''}
    <div class="row"><button class="btn primary" data-dp="start">Bắt đầu đấu</button>${inGame() ? '<span class="meta">Ván đang chơi sẽ bị huỷ.</span>' : ''}</div>
  </div>`;
  el.hidden = false;
}
export function startWithDeck(){
  if (!canNewGame()) return;
  const {me, ai} = UI.deck;
  try { localStorage.setItem('dp-deck', JSON.stringify(UI.deck)); } catch (e) {}
  closeDeckPick(); UI.started = true;
  newGame(me, ai === 'auto' ? otherDeck(me) : ai);
  render(); run(startTurn);
}
