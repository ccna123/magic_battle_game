import { $ } from '../config.js';
import { DB } from '../data/cards.js';
import { BUILTIN } from '../data/sprites.js';
import { SPRITE } from '../fx/sprite.js';

/* ---------- Ảnh tải lên (ghi đè sprite) ---------- */
export let ART = {};
try { ART = JSON.parse(localStorage.getItem('dp-art') || '{}') || {}; } catch (e) { ART = {}; }
export function saveArt(){ try { localStorage.setItem('dp-art', JSON.stringify(ART)); return true; } catch (e) { return false; } }
// Đường dẫn tuyệt đối theo trang, vì url() trong biến CSS được tính theo file CSS chứ không theo trang
export const assetUrl = p => new URL(p, document.baseURI).href;
export function applyArt(){
  let css = '';
  for (const [id, d] of Object.entries(DB)) {
    const a = d.art || id;
    css += ART[id] ? `.art-${id}{--art:url(${ART[id]});--fit:cover;image-rendering:auto}`
      : BUILTIN.has(a) ? `.art-${id}{--art:url(${assetUrl('sprites/' + a + '.png')});--fit:contain;image-rendering:auto}`
      : `.art-${id}{--art:url(${SPRITE.gen(id, {...d, shape:'beast', pal:['#888','#333','#ccc','#ff0'], icon:'star'})})}`;
  }
  $('#artcss').textContent = css;
}
