/* ---------- Luật trận, thời tiết và độ khó ----------
   Nhân vật và phép nằm trong gói pháp sư public/mage (nạp ở src/duel/mages.js). */
export const DUEL_WEATHER = {
  clear:{name:'Trời quang', desc:'Không có hiệu ứng.', mod:{}},
  rain:{name:'Mưa giông', desc:'Sét, Nước +20% · Lửa −20%', mod:{storm:.2, water:.2, fire:-.2}},
  heat:{name:'Nắng gắt', desc:'Lửa +20% · Băng −20%', mod:{fire:.2, ice:-.2}},
  blizzard:{name:'Bão tuyết', desc:'Băng +20% · Lửa −20%', mod:{ice:.2, fire:-.2}},
};

// Độ khó của máy
export const DIFF = {
  // delay: phản xạ · block: tỉ lệ đỡ · mash: tốc độ bấm Đấu Đũa · gap: nghỉ tối thiểu giữa 2 phép · hoard: tỉ lệ nhịn để dồn phép lớn
  easy:{name:'Dễ', delay:.8, block:.45, mash:5, gap:1.1, hoard:.4},
  normal:{name:'Thường', delay:.5, block:.75, mash:7, gap:.45, hoard:.25},
  hard:{name:'Khó', delay:.3, block:.92, mash:9, gap:.15, hoard:.15},
};

export const RULES = {
  HP:150, MANA_START:4, MANA_MAX:10, REGEN:1.1,         // 1 ma lực mỗi 1,1 giây
  HAND:4,
  DRAW_TIME:.4, PICK_COST:1, PICK_TIME:5, REFRESH_COST:2, REFRESH_TIME:.8,   // rút 1 lá · xem 3 chọn 1 · thay cả tay
  LOADOUT_MIN:5, LOADOUT_MAX:8,                          // số phép được mang vào trận
  WET:6, BURN_TICK:1, BURN_DMG:2,                        // Ướt 6 giây · Cháy mất 2 máu mỗi giây
  WEATHER_EVERY:30, FRENZY_AT:120,                       // sau 2 phút: Cuồng phong, ma lực hồi gấp đôi
  CLASH:1.8, INTRO:1.8,                                  // thời gian dồn lực Đấu Đũa · màn "Sẵn sàng… Đấu!"
};
