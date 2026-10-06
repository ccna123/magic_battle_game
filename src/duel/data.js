/* ---------- Bản thử "Đấu phép tốc độ": dữ liệu phép theo thời gian thực ----------
   cost: ma lực · cast: giây niệm · el: hệ · dmg: sát thương · self: phép lên bản thân
   wet/burn/freeze: gây trạng thái · interrupt: trúng lúc đối thủ đang niệm thì huỷ phép + Choáng
   shield/mirror: số giây khiên/gương · heal · weather
   Tên và hình lấy theo id trong src/data/cards.js. */
export const SPELLS = {
  aguamenti:{cost:1, cast:.5, el:'water', dmg:1, wet:true, text:'1 sát thương Nước, làm Ướt 6 giây.'},
  fulmen:{cost:3, cast:1.1, el:'storm', dmg:3, text:'3 sát thương Sét. Trúng mục tiêu đang Ướt: Giật lan +3.'},
  stupefy:{cost:2, cast:.6, el:'storm', dmg:1, interrupt:true, text:'1 sát thương Sét. Trúng lúc đối thủ đang niệm: huỷ phép và Choáng 1,5 giây.'},
  tempestas:{cost:6, cast:2.4, el:'storm', dmg:7, text:'7 sát thương Sét. Niệm rất lâu, dễ bị ngắt.'},
  incendio:{cost:2, cast:.7, el:'fire', dmg:2, burn:true, text:'2 sát thương Lửa và gây Cháy (1 sát thương mỗi 1,5 giây trong 4,5 giây).'},
  glacius:{cost:2, cast:.7, el:'ice', dmg:1, freeze:3, text:'1 sát thương Băng, Đóng băng 3 giây: niệm chậm gấp đôi, ngừng hồi ma lực.'},
  confringo:{cost:4, cast:1.4, el:'fire', dmg:5, text:'5 sát thương Lửa.'},
  ignis:{cost:6, cast:2.4, el:'fire', dmg:5, burn:true, text:'5 sát thương Lửa và gây Cháy. Niệm rất lâu, dễ bị ngắt.'},
  petrificus:{cost:2, cast:.5, el:'ice', dmg:0, freeze:2, interrupt:true, text:'Đóng băng 2 giây. Trúng lúc đối thủ đang niệm: huỷ phép và Choáng 1,5 giây.'},
  protego:{cost:2, cast:.25, self:true, shield:2, kind:'counter', text:'Khiên 2 giây: chặn phép kế tiếp bay tới.'},
  speculum:{cost:3, cast:.35, self:true, mirror:2, kind:'counter', text:'Gương 2 giây: phản phép gây sát thương kế tiếp về người niệm.'},
  episkey:{cost:3, cast:1.5, self:true, heal:5, kind:'enchant', text:'Hồi 5 sinh lực.'},
  callrain:{cost:2, cast:.8, self:true, weather:'rain', kind:'enchant', text:'Đổi thời tiết thành Mưa giông: phép Sét +1, phép Lửa −1.'},
  callsun:{cost:2, cast:.8, self:true, weather:'heat', kind:'enchant', text:'Đổi thời tiết thành Nắng gắt: phép Lửa +1, phép Băng −1.'},
};

export const DUEL_DECKS = {
  thuyloi:{name:'Thuỷ – Lôi', portrait:'wyvern', list:{aguamenti:3, fulmen:2, stupefy:2, tempestas:1, protego:2, speculum:1, episkey:1, callrain:1},
    tip:'Aguamenti làm Ướt rồi nối Fulmen để Giật lan. Stupefy ngắt phép lớn của đối thủ.'},
  hoabang:{name:'Hoả – Băng', portrait:'phoenix', list:{incendio:3, glacius:2, confringo:2, ignis:1, petrificus:2, protego:2, episkey:1, callsun:1},
    tip:'Glacius Đóng băng rồi nối phép Lửa để ra Hơi nước gấp đôi. Petrificus ngắt phép lớn.'},
};

export const DUEL_WEATHER = {
  clear:{name:'Trời quang', desc:'Không có hiệu ứng.', mod:{}},
  rain:{name:'Mưa giông', desc:'Sét +1, Lửa −1', mod:{storm:1, fire:-1}},
  heat:{name:'Nắng gắt', desc:'Lửa +1, Băng −1', mod:{fire:1, ice:-1}},
  blizzard:{name:'Bão tuyết', desc:'Băng +1, Lửa −1', mod:{ice:1, fire:-1}},
};

// Độ khó của máy: độ trễ phản xạ (giây), tỉ lệ dựng khiên kịp, tỉ lệ niệm chuẩn, tốc độ dồn lực khi Đấu Đũa (lần/giây)
export const DIFF = {
  easy:{name:'Dễ', delay:.9, block:.4, perfect:.2, mash:4.5},
  normal:{name:'Thường', delay:.6, block:.7, perfect:.45, mash:6.5},
  hard:{name:'Khó', delay:.35, block:.92, perfect:.7, mash:8.5},
};

export const RULES = {
  HP:30, MANA_START:3, MANA_MAX:10, REGEN:1.4,          // 1 ma lực mỗi 1,4 giây
  HAND:4, TRAVEL:.75,                                    // thời gian bay của phép
  PERFECT:[.62, .84],                                    // vùng "niệm chuẩn" trên thanh niệm
  WET:6, BURN:4.5, BURN_TICK:1.5, STUN:1.5,
  WEATHER_EVERY:30, FRENZY_AT:120,                       // sau 2 phút: Cuồng phong, ma lực hồi gấp đôi
  CLASH:1.8,                                             // thời gian dồn lực Đấu Đũa
};
