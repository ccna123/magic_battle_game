import { $ } from './config.js';
import { BUILTIN } from './sprites.js';

/* ---------- Sprite: mỗi hình trong public/sprites có class .art-<tên> ----------
   Đường dẫn tuyệt đối theo trang, vì url() trong biến CSS được tính theo file CSS chứ không theo trang. */
const assetUrl = p => new URL(p, document.baseURI).href;
export function applyArt(){
  $('#artcss').textContent = [...BUILTIN].map(n => `.art-${n}{--art:url(${assetUrl('sprites/' + n + '.png')});--fit:contain;image-rendering:auto}`).join('');
}
