/* ---------- Thời tiết sân đấu ---------- */
export const WEATHER_ROUNDS = 3;
export const WEATHER = {
  clear:   {name:'Trời quang', desc:'Không có hiệu ứng.'},
  rain:    {name:'Mưa giông', desc:'Phép Sét +1 sát thương, phép Lửa −1. Ướt kéo dài thêm 1 lượt.', mod:{storm:1, fire:-1}},
  heat:    {name:'Nắng gắt', desc:'Phép Lửa +1 sát thương, phép Băng −1. Ướt khô hết ngay đầu mỗi lượt.', mod:{fire:1, ice:-1}},
  blizzard:{name:'Bão tuyết', desc:'Phép Băng +1 sát thương, phép Lửa −1. Đóng băng kéo dài thêm 1 lượt.', mod:{ice:1, fire:-1}},
  moon:    {name:'Trăng tròn', desc:'Mọi linh thú +1 công. Người Sói +2 công.'},
  fog:     {name:'Sương mù', desc:'Linh thú không thể tấn công pháp sư.'},
  ley:     {name:'Mạch ma lực', desc:'Mỗi người +1 ma lực đầu lượt.'},
};
