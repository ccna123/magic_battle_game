import { $, EL, KIND } from '../config.js';
import { DB, DECKS } from '../data/cards.js';
import { ART, applyArt, saveArt } from './art.js';
import { render } from './render.js';
import { UI } from './state.js';

/* ---------- Kho lá bài & sprite ---------- */
export function renderLib(){
  const f = UI.libFilter;
  const ids = Object.keys(DB).filter(id => f === 'all' || DB[id].kind === f);
  const fl = [['all','Tất cả'], ['creature','Linh thú'], ['charm','Bùa chú'], ['enchant','Phép duy trì'], ['counter','Phản chú']];
  $('#lib').innerHTML = `<div class="lib-in">
    <div class="lib-top"><h2>Kho lá bài</h2><button class="btn" data-lib="close">Đóng</button></div>
    <p class="lib-note">Các bộ bài: ${Object.values(DECKS).map(D => `${D.name} (khế ước ${DB[D.bond].name})`).join(', ')}. Chọn bộ bài bằng nút “Chọn bộ bài”. Bấm “Đổi hình” để thay sprite bằng ảnh của bạn.</p>
    <details class="panel"><summary>Phản ứng nguyên tố</summary>
      <table class="react-table"><tbody>
        <tr><td><span class="st-wet">Ướt</span> + <span class="st-stun">Sét</span></td><td>Giật lan: +2 sát thương, lan 2 sang mọi kẻ địch khác đang Ướt</td></tr>
        <tr><td><span class="st-frozen">Đóng băng</span> + <span class="st-burn">Lửa</span></td><td>Hơi nước: sát thương ×2</td></tr>
        <tr><td><span class="st-wet">Ướt</span> + <span class="st-burn">Lửa</span></td><td>Dập lửa: −2 sát thương, không gây Cháy</td></tr>
        <tr><td><span class="st-burn">Cháy</span> + <span class="st-frozen">Băng</span></td><td>Tan chảy: +1 sát thương</td></tr>
        <tr><td><span class="st-wet">Ướt</span> + <span class="st-frozen">Đóng băng</span></td><td>Đóng băng sâu: kéo dài thêm 1 lượt</td></tr>
      </tbody></table>
    </details>
    <div class="lib-filter">${fl.map(([k, l]) => `<button class="btn sm ${f === k ? 'on' : ''}" data-libf="${k}">${l}</button>`).join('')}</div>
    <div class="lib-grid">${ids.map(id => { const d = DB[id];
      return `<div class="entry"><div class="iart art art-${id} k-${d.kind}"></div><div style="min-width:0"><h3>${d.name}</h3>
        <div class="meta">${KIND[d.kind]} · <span style="color:${EL[d.el].c}">${EL[d.el].n}</span> · ${d.cost} ma lực${d.kind === 'creature' ? ` · ⚔${d.atk} ♥${d.hp}` : ''}</div>
        <p>${d.text}</p><div class="row"><button class="btn sm" data-up="${id}">Đổi hình</button>${ART[id] ? `<button class="btn sm" data-reset="${id}">Về sprite gốc</button>` : ''}</div></div></div>`; }).join('')}</div>
  </div>`;
}
export function loadArt(file, id){
  const fr = new FileReader();
  fr.onload = () => { const img = new Image(); img.onload = () => {
    const s = Math.min(1, 256 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.width * s)); cv.height = Math.max(1, Math.round(img.height * s));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    ART[id] = cv.toDataURL('image/png'); saveArt(); applyArt(); renderLib(); render(); }; img.src = fr.result; };
  fr.readAsDataURL(file);
}
