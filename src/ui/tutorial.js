import { P } from '../engine/core.js';
import { render } from './render.js';
import { UI } from './state.js';

/* ---------- Hướng dẫn theo tình huống ---------- */
export const TIPS = {
  start:() => 'Mỗi lượt ma lực tối đa +1 (tới 10) và hồi đầy. Lá nào đủ ma lực sẽ có viền sáng. Chạm một lá để hiện nút hành động, nhấp chuột phải (hoặc giữ lâu) để xem công dụng.' + (P(0).deckName === 'Thuỷ – Lôi' ? ' Thử triệu hồi Tiên Sấm (1 ma lực) trước.' : ''),
  upkeep:'Linh thú đầu tiên miễn phí, từ con thứ hai mỗi con khoá 1 viên ma lực ở các lượt sau (viên có gạch chéo). Đổi lại linh thú có Kênh phép làm phép cùng hệ của bạn mạnh thêm.',
  combo:'Combo đầu tiên: Aguamenti làm mục tiêu Ướt, rồi Fulmen (Sét) vào mục tiêu đang Ướt sẽ kích Giật lan: thêm 2 sát thương và lan sang mọi kẻ địch khác đang Ướt.',
  react:'Phản ứng nguyên tố vừa kích hoạt! Ướt + Sét = Giật lan · Đóng băng + Lửa = Hơi nước (×2) · Ướt + Lửa = Dập lửa · Cháy + Băng = Tan chảy · Ướt + Đóng băng = Đóng băng sâu. Bảng đầy đủ ở Kho lá bài.',
  mark:'Mỗi lần linh thú kênh phép, nó nhận 1 dấu ấn ◆. Linh thú có dạng tiến hoá đủ 2 dấu ấn sẽ tiến hoá ngay trên sân.',
  evolve:'Linh thú vừa tiến hoá! Dạng mới mạnh hơn, giữ nguyên chỗ và không tốn thêm ma lực.',
  attack:'Linh thú tấn công được từ lượt sau khi triệu hồi. Chạm linh thú có viền đỏ, bấm Tấn công rồi chọn mục tiêu. Đối thủ có Hộ vệ thì phải đánh Hộ vệ trước.',
  bond:() => { const b = P(0).bond.card.d; return `${b.name} là linh thú khế ước, nằm ngoài bộ bài. Chạm ô khế ước cạnh sinh lực của bạn rồi bấm Gọi khế ước (${b.cost} ma lực). Nếu bị hạ, nó nghỉ 2 lượt rồi gọi lại được.`; },
  weather:'Thời tiết vừa đổi! Nó đổi sau mỗi 3 vòng và luôn có dự báo ở dải giữa bàn. Mưa giông có lợi cho phép Sét, Nắng gắt có lợi cho phép Lửa. Các lá gọi thời tiết đổi trời ngay lập tức.',
  counter:'Phản chú úp miễn phí nhưng trả ma lực khi kích hoạt trong lượt đối thủ. Muốn dùng thì nhớ chừa ma lực lúc kết thúc lượt.',
};
export function tip(key){
  if (UI.tutOff || UI.seen[key] || UI.tipQueue.includes(key)) return;
  UI.tipQueue.push(key);
}
export function dismissTip(){ const k = UI.tipQueue.shift(); if (k) UI.seen[k] = 1; try { localStorage.setItem('dp-tut', JSON.stringify(UI.seen)); } catch (e) {} render(); }
