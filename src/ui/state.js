/* Trạng thái giao diện (không phải luật chơi) */
export const UI = {busy:false, pick:null, sel:null, btns:[], acts:[], deck:null, deckPick:false, started:false, tipQueue:[], seen:{}, tutOff:false, libFilter:'all', uploadFor:null};
try { UI.seen = JSON.parse(localStorage.getItem('dp-tut') || '{}') || {}; UI.tutOff = !!UI.seen.__off; } catch (e) {}
