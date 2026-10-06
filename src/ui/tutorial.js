import { attack, evolve, upkeep } from '../engine/core.js';
import { render } from './render.js';
import { UI } from './state.js';

/* ---------- Hướng dẫn theo tình huống ---------- */
export const TIPS = {
  start:'Mỗi lượt ma lực tối đa +1 (tới 10) và hồi đầy. Lá nào đủ ma lực sẽ có viền sáng. Thử triệu hồi Tiên Sấm (1 ma lực) trước.',
  upkeep:'Linh thú đầu tiên miễn phí, từ con thứ hai mỗi con khoá 1 viên ma lực ở các lượt sau (viên có gạch chéo). Đổi lại nó Kênh phép cùng hệ: Tiên Sấm làm phép Sét của bạn mạnh thêm 1.',
  combo:'Combo đầu tiên: Aguamenti làm mục tiêu Ướt, rồi Fulmen (Sét) vào mục tiêu đang Ướt sẽ kích Giật lan: thêm 2 sát thương và lan sang mọi kẻ địch khác đang Ướt.',
  react:'Phản ứng nguyên tố vừa kích hoạt. Bảng phản ứng nằm ở cột bên phải. Máy chơi Lửa + Băng: Đóng băng rồi Lửa thành Hơi nước gấp đôi sát thương, còn Nước sẽ Dập lửa của nó.',
  mark:'Mỗi lần linh thú kênh phép, nó nhận 1 dấu ấn ◆. Nhân Ngư đủ 2 dấu ấn sẽ tiến hoá thành Kraken Hồ Sâu ngay trên sân.',
  evolve:'Linh thú vừa tiến hoá! Dạng mới mạnh hơn, giữ nguyên chỗ và không tốn thêm ma lực.',
  attack:'Linh thú tấn công được từ lượt sau khi triệu hồi. Chạm linh thú có viền đỏ rồi chọn mục tiêu. Đối thủ có Hộ vệ thì phải đánh Hộ vệ trước.',
  bond:'Wyvern Bão là linh thú khế ước, nằm ngoài bộ bài. Chạm ô khế ước cạnh sinh lực của bạn để gọi nó (4 ma lực). Nếu bị hạ, nó nghỉ 2 lượt rồi gọi lại được.',
  weather:'Thời tiết vừa đổi! Nó đổi sau mỗi 3 vòng và luôn có dự báo ở dải giữa bàn. Mưa giông có lợi cho phép Sét của bạn, Nắng gắt có lợi cho Lửa của Máy. Lá Gọi Mưa đổi trời ngay lập tức.',
  counter:'Phản chú úp miễn phí nhưng trả ma lực khi kích hoạt trong lượt đối thủ. Muốn dùng thì nhớ chừa ma lực lúc kết thúc lượt.',
};
export function tip(key){
  if (UI.tutOff || UI.seen[key] || UI.tipQueue.includes(key)) return;
  UI.tipQueue.push(key);
}
export function dismissTip(){ const k = UI.tipQueue.shift(); if (k) UI.seen[k] = 1; try { localStorage.setItem('dp-tut', JSON.stringify(UI.seen)); } catch (e) {} render(); }
