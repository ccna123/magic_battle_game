/* ---------- Bản thử "Đấu phép tốc độ": dữ liệu phép theo thời gian thực ----------
   cost: ma lực · cast: giây niệm · el: hệ · dmg: sát thương · self: phép lên bản thân
   wet/burn/freeze: gây trạng thái · interrupt: trúng lúc đối thủ đang niệm thì huỷ phép + Choáng
   shield/mirror: số giây khiên/gương · heal · weather
   name: tên hiển thị · art: tên sprite trong public/sprites. */
export const SPELLS = {
  aguamenti:{name:'Aguamenti', art:'aguamenti', cost:1, cast:.5, el:'water', dmg:1, wet:true, text:'1 sát thương Nước, làm Ướt 6 giây.'},
  fulmen:{name:'Fulmen', art:'fulmen', cost:3, cast:1.1, el:'storm', dmg:3, text:'3 sát thương Sét. Trúng mục tiêu đang Ướt: Giật lan +3.'},
  stupefy:{name:'Stupefy', art:'stupefy', cost:2, cast:.6, el:'storm', dmg:1, interrupt:true, text:'1 sát thương Sét. Trúng lúc đối thủ đang niệm: huỷ phép và Choáng 1,5 giây.'},
  tempestas:{name:'Mưa Giông', art:'reducto', cost:6, cast:2.4, el:'storm', dmg:7, text:'7 sát thương Sét. Niệm rất lâu, dễ bị ngắt.'},
  incendio:{name:'Incendio', art:'incendio', cost:2, cast:.7, el:'fire', dmg:2, burn:true, text:'2 sát thương Lửa và gây Cháy (1 sát thương mỗi 1,5 giây trong 4,5 giây).'},
  glacius:{name:'Glacius', art:'finite', cost:2, cast:.7, el:'ice', dmg:1, freeze:3, text:'1 sát thương Băng, Đóng băng 3 giây: niệm chậm gấp đôi, ngừng hồi ma lực.'},
  confringo:{name:'Confringo', art:'confringo', cost:4, cast:1.4, el:'fire', dmg:5, text:'5 sát thương Lửa.'},
  ignis:{name:'Ignis Serpens', art:'ignis', cost:6, cast:2.4, el:'fire', dmg:5, burn:true, text:'5 sát thương Lửa và gây Cháy. Niệm rất lâu, dễ bị ngắt.'},
  petrificus:{name:'Petrificus Totalus', art:'petrificus', cost:2, cast:.5, el:'ice', dmg:0, freeze:2, interrupt:true, text:'Đóng băng 2 giây. Trúng lúc đối thủ đang niệm: huỷ phép và Choáng 1,5 giây.'},
  protego:{name:'Protego', art:'protego', cost:2, cast:.25, self:true, shield:2, kind:'counter', text:'Khiên 2 giây: chặn phép kế tiếp bay tới.'},
  speculum:{name:'Speculum Reverto', art:'speculum', cost:3, cast:.35, self:true, mirror:2, kind:'counter', text:'Gương 2 giây: phản phép gây sát thương kế tiếp về người niệm.'},
  episkey:{name:'Episkey', art:'episkey', cost:3, cast:1.5, self:true, heal:5, kind:'enchant', text:'Hồi 5 sinh lực.'},
  callrain:{name:'Gọi Mưa', art:'muffliato', cost:2, cast:.8, self:true, weather:'rain', kind:'enchant', text:'Đổi thời tiết thành Mưa giông: phép Sét +1, phép Lửa −1.'},
  callsun:{name:'Mặt Trời Thiêu', art:'rennervate', cost:2, cast:.8, self:true, weather:'heat', kind:'enchant', text:'Đổi thời tiết thành Nắng gắt: phép Lửa +1, phép Băng −1.'},
};

export const DUEL_DECKS = {
  thuyloi:{name:'Thuỷ – Lôi', portrait:'kraken', list:{aguamenti:3, fulmen:2, stupefy:2, tempestas:1, protego:2, speculum:1, episkey:1, callrain:1},
    tip:'Aguamenti làm Ướt rồi nối Fulmen để Giật lan. Stupefy ngắt phép lớn của đối thủ.'},
  hoabang:{name:'Hoả – Băng', portrait:'banshee', list:{incendio:3, glacius:2, confringo:2, ignis:1, petrificus:2, protego:2, episkey:1, callsun:1},
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
  // delay: phản xạ · block: tỉ lệ đỡ · perfect: niệm chuẩn · mash: tốc độ bấm Đấu Đũa · gap: nghỉ tối thiểu giữa 2 phép · hoard: tỉ lệ nhịn để dồn phép lớn
  easy:{name:'Dễ', delay:.8, block:.45, perfect:.25, mash:5, gap:1.1, hoard:.4},
  normal:{name:'Thường', delay:.5, block:.75, perfect:.5, mash:7, gap:.45, hoard:.25},
  hard:{name:'Khó', delay:.3, block:.92, perfect:.75, mash:9, gap:.15, hoard:.15},
};

export const RULES = {
  HP:30, MANA_START:4, MANA_MAX:10, REGEN:1.1,          // 1 ma lực mỗi 1,1 giây
  HAND:4, TRAVEL:.75,
  DRAW_TIME:.4, PICK_COST:1, PICK_TIME:5, REFRESH_COST:2, REFRESH_TIME:.8,   // rút 1 lá · xem 3 chọn 1 · thay cả tay
  LOADOUT_MIN:5, LOADOUT_MAX:8,                          // số phép được mang vào trận                                    // thời gian bay của phép
  PERFECT:[.62, .84],                                    // vùng "niệm chuẩn" trên thanh niệm
  WET:6, BURN:4.5, BURN_TICK:1.5, STUN:1.5,
  WEATHER_EVERY:30, FRENZY_AT:120,                       // sau 2 phút: Cuồng phong, ma lực hồi gấp đôi
  CLASH:1.8, INTRO:1.8,                                  // thời gian dồn lực Đấu Đũa · màn "Sẵn sàng… Đấu!"
};

/* ---------- Sách phép theo linh thú (lối chơi kiểu Asuka: 4 lá xoay vòng từ sách) ----------
   Mỗi sách gồm 10 phép: type 'atk' tấn công · 'counter' phản chú · 'support' hỗ trợ.  Không có hồi chiêu: chỉ cần đủ ma lực và có phép trên tay.
   Trường hiệu ứng mới (ngoài các trường của SPELLS):
     travel: thời gian bay riêng (phép giáng từ trời có cảnh báo) · noClash: không gây Đấu Đũa · volley {n, gap}: loạt n quả
     stun: Choáng (giây) · manaBurn: đốt ma lực · manaSteal: đốt và hút ma lực · drain: hồi máu theo tỉ lệ sát thương gây ra
     curse: đối thủ nhận thêm 50% sát thương (giây) · weaken: phép đối thủ −2 sát thương (giây) · slow: đối thủ niệm chậm gấp đôi
     evade: né mọi phép bay tới (giây) · nullify: xoá phép đang bay tới + ngắt phép đối thủ đang niệm
     barrier {hp, dur}: rào chắn hút sát thương · regen {rate, dur}: hồi máu theo giây · haste: niệm nhanh gấp đôi (giây)
     cleanse: xoá trạng thái xấu · rebirth: trong thời gian này nếu gục thì sống lại với 8 sinh lực
     pet {art, name, every, dur, dmg, el, …}: linh thú bay cạnh bạn, tự bắn phép theo nhịp */
export const BOOKS = {
  chimera:{name:'Sách Chimera', beast:'Chimera Tam Đầu', portrait:'cerberus',
    desc:'Ba cái đầu Băng, Sét, Lửa. Đóng băng rồi giáng Thiên Hoả để nổ Hơi nước.', spells:{
    QQQ:{name:'Băng Giá', type:'atk', art:'finite', cost:2, cast:.35, el:'ice', dmg:1, freeze:3, travel:.5, text:'1 sát thương Băng, Đóng băng 3 giây.'},
    QQW:{name:'Lốc Xoáy', type:'counter', art:'reducto', cost:2, cast:.3, el:'storm', dmg:0, interrupt:true, stun:1.8, travel:.5, text:'Nhấc bổng đối thủ: ngắt phép đang niệm, Choáng 1,8 giây.'},
    QQE:{name:'Tường Băng', type:'support', art:'protego', self:true, cost:3, cast:.3, barrier:{hp:6, dur:6}, text:'Rào chắn hút 6 sát thương trong 6 giây.'},
    QWW:{name:'Ẩn Thân', type:'counter', art:'obliviate', self:true, cost:3, cast:.2, evade:2.2, text:'Tàng hình 2,2 giây: mọi phép bay tới đều trượt.'},
    QWE:{name:'Sóng Âm', type:'counter', art:'bombarda', self:true, cost:3, cast:.3, nullify:true, text:'Xoá mọi phép đang bay tới và ngắt phép đối thủ đang niệm.'},
    QEE:{name:'Hoả Linh', type:'support', art:'ignis', self:true, cost:4, cast:.6, pet:{art:'phoenix', name:'Hoả Linh', every:1.5, dur:9, el:'fire', dmg:1}, text:'Gọi Hoả Linh 9 giây, cứ 1,5 giây bắn 1 sát thương Lửa.'},
    WWW:{name:'Xung Điện', type:'atk', art:'fulmen', cost:3, cast:.5, el:'storm', dmg:2, manaBurn:3, text:'2 sát thương Sét, đốt 3 ma lực của đối thủ.'},
    WWE:{name:'Tăng Tốc', type:'support', art:'engorgio', self:true, cost:2, cast:.2, haste:6, text:'Niệm nhanh gấp đôi trong 6 giây.'},
    WEE:{name:'Thiên Thạch', type:'atk', art:'confringo', cost:4, cast:.7, el:'fire', dmg:1, burn:true, volley:{n:3, gap:.35}, text:'Loạt 3 thiên thạch, mỗi quả 1 sát thương Lửa và gây Cháy.'},
    EEE:{name:'Thiên Hoả', type:'atk', art:'incendio', cost:4, cast:.3, el:'fire', dmg:7, travel:1.7, noClash:true, text:'Báo trước 1,7 giây rồi giáng 7 sát thương Lửa. Kịp dựng khiên thì chặn được.'},
  }},
  wyvern:{name:'Sách Wyvern', beast:'Wyvern Bão', portrait:'wyvern',
    desc:'Bão tố trên biển: làm Ướt rồi giật Sét lan, gọi Wyvern lao xuống.', spells:{
    QQQ:{name:'Sóng Thần', type:'atk', art:'aguamenti', cost:2, cast:.5, el:'water', dmg:2, wet:true, text:'2 sát thương Nước, làm Ướt 6 giây.'},
    QQW:{name:'Mưa Giông', type:'support', art:'muffliato', self:true, cost:1, cast:.4, weather:'rain', manaGain:2, text:'Đổi thời tiết thành Mưa giông (Sét +1) và nhận 2 ma lực.'},
    QQE:{name:'Màn Sương', type:'counter', art:'avis', self:true, cost:2, cast:.2, evade:1.8, text:'Màn sương 1,8 giây: mọi phép bay tới đều trượt.'},
    QWW:{name:'Xích Điện', type:'counter', art:'stupefy', cost:2, cast:.3, el:'storm', dmg:1, interrupt:true, stun:1.5, travel:.45, text:'Tia chớp nhanh: 1 sát thương, ngắt phép đang niệm, Choáng 1,5 giây.'},
    QWE:{name:'Bão Tố', type:'atk', art:'reducto', cost:5, cast:1.6, el:'storm', dmg:6, text:'6 sát thương Sét. Niệm lâu, dễ bị ngắt.'},
    QEE:{name:'Gương Băng', type:'counter', art:'speculum', self:true, cost:2, cast:.25, mirror:2.5, text:'Gương 2,5 giây: phản phép gây sát thương kế tiếp.'},
    WWW:{name:'Sấm Truyền', type:'atk', art:'fulmen', cost:3, cast:.9, el:'storm', dmg:4, text:'4 sát thương Sét. Trúng mục tiêu Ướt: Giật lan +3.'},
    WWE:{name:'Wyvern Lao Xuống', type:'support', art:'wyvern', self:true, cost:4, cast:.6, pet:{art:'wyvern', name:'Wyvern', every:1.3, dur:8, el:'storm', dmg:1}, text:'Gọi Wyvern 8 giây, cứ 1,3 giây bổ xuống 1 sát thương Sét.'},
    WEE:{name:'Băng Tiễn', type:'atk', art:'finite', cost:3, cast:.5, el:'ice', dmg:1, freeze:1, volley:{n:3, gap:.3}, text:'Loạt 3 mũi băng, mỗi mũi 1 sát thương và Đóng băng 1 giây.'},
    EEE:{name:'Băng Hồn', type:'support', art:'episkey', self:true, cost:3, cast:.6, regen:{rate:1, dur:6}, cleanse:true, text:'Xoá trạng thái xấu, hồi 1 sinh lực mỗi giây trong 6 giây.'},
  }},
  phoenix:{name:'Sách Phượng Hoàng', beast:'Phượng Hoàng Lửa', portrait:'phoenix',
    desc:'Lửa thiêng và ánh sáng hồi sinh: thiêu đốt, chống chịu, gục rồi vẫn tái sinh.', spells:{
    QQQ:{name:'Hoả Long Quyển', type:'atk', art:'ignis', cost:4, cast:1.2, el:'fire', dmg:5, burn:true, text:'5 sát thương Lửa và gây Cháy.'},
    QQW:{name:'Phượng Hoàng Con', type:'support', art:'phoenix', self:true, cost:4, cast:.6, pet:{art:'phoenix', name:'Phượng Hoàng Con', every:1.6, dur:9, el:'fire', dmg:1, burn:true}, text:'Gọi Phượng Hoàng Con 9 giây, cứ 1,6 giây phun lửa gây Cháy.'},
    QQE:{name:'Núi Lửa', type:'atk', art:'bombarda', cost:3, cast:.8, el:'fire', dmg:3, interrupt:true, stun:1, text:'3 sát thương Lửa. Trúng lúc đối thủ đang niệm thì ngắt phép.'},
    QWW:{name:'Tái Sinh', type:'support', art:'phoenix', self:true, cost:4, cast:.5, rebirth:10, text:'Trong 10 giây, nếu gục thì tái sinh với 8 sinh lực.'},
    QWE:{name:'Nhật Viêm', type:'atk', art:'rennervate', cost:3, cast:.7, el:'light', dmg:3, weaken:5, text:'3 sát thương Ánh sáng, làm chói mắt: phép đối thủ −2 sát thương trong 5 giây.'},
    QEE:{name:'Giáp Dung Nham', type:'counter', art:'vincula', self:true, cost:3, cast:.3, barrier:{hp:7, dur:7}, text:'Rào chắn đá nóng hút 7 sát thương trong 7 giây.'},
    WWW:{name:'Thánh Quang', type:'support', art:'expecto', self:true, cost:4, cast:1, heal:6, cleanse:true, text:'Hồi 6 sinh lực và xoá trạng thái xấu.'},
    WWE:{name:'Lồng Ánh Sáng', type:'counter', art:'petrificus', cost:2, cast:.3, el:'light', dmg:0, interrupt:true, stun:2, travel:.45, text:'Nhốt đối thủ: ngắt phép đang niệm, Choáng 2 giây.'},
    WEE:{name:'Thánh Thuẫn', type:'counter', art:'fiantoduri', self:true, cost:2, cast:.25, mirror:2.5, text:'Thuẫn 2,5 giây: phản phép gây sát thương kế tiếp.'},
    EEE:{name:'Thiên Thạch Đá', type:'atk', art:'bombarda', cost:4, cast:.4, el:'earth', dmg:7, travel:1.6, noClash:true, text:'Báo trước 1,6 giây rồi giáng 7 sát thương Đất.'},
  }},
  vampire:{name:'Sách Ma Cà Rồng', beast:'Bá Tước Ma Cà Rồng', portrait:'vampire',
    desc:'Đêm lạnh và máu: hút máu để sống dai, nguyền rủa rồi kết liễu.', spells:{
    QQQ:{name:'Huyết Thương', type:'atk', art:'vampire', cost:4, cast:.9, el:'dark', dmg:4, drain:1, text:'4 sát thương Bóng tối, hồi máu bằng sát thương gây ra.'},
    QQW:{name:'Hồn Ma Đêm', type:'support', art:'ghost', self:true, cost:4, cast:.6, pet:{art:'ghost', name:'Hồn Ma Đêm', every:1.1, dur:8, el:'dark', dmg:1, drain:1}, text:'Gọi hồn ma 8 giây, cứ 1,1 giây cắn 1 sát thương và hút máu.'},
    QQE:{name:'Lời Nguyền', type:'atk', art:'reducio', cost:2, cast:.5, el:'dark', dmg:1, curse:6, text:'1 sát thương, nguyền 6 giây: đối thủ nhận thêm 50% sát thương.'},
    QWW:{name:'Ảo Ảnh', type:'counter', art:'obliviate', self:true, cost:2, cast:.2, evade:2, text:'Hoá ảo ảnh 2 giây: mọi phép bay tới đều trượt.'},
    QWE:{name:'Bóng Tối Nuốt Chửng', type:'atk', art:'nebula', cost:5, cast:1.6, el:'dark', dmg:6, drain:.5, text:'6 sát thương Bóng tối, hồi máu bằng nửa sát thương gây ra. Niệm lâu.'},
    QEE:{name:'Hút Hồn Băng', type:'support', art:'obliviate', cost:2, cast:.4, el:'ice', dmg:0, manaSteal:3, text:'Hút 3 ma lực của đối thủ về cho bạn.'},
    WWW:{name:'Tâm Loạn', type:'counter', art:'leviosa', cost:2, cast:.3, el:'mind', dmg:0, interrupt:true, stun:1.5, slow:4, travel:.45, text:'Ngắt phép đang niệm, Choáng 1,5 giây rồi niệm chậm gấp đôi 4 giây.'},
    WWE:{name:'Phản Tâm', type:'counter', art:'speculum', self:true, cost:2, cast:.25, mirror:2.5, text:'Gương tâm trí 2,5 giây: phản phép gây sát thương kế tiếp.'},
    WEE:{name:'Màn Đêm', type:'support', art:'nebula', self:true, cost:3, cast:.6, regen:{rate:1, dur:6}, cleanse:true, text:'Xoá trạng thái xấu, hồi 1 sinh lực mỗi giây trong 6 giây.'},
    EEE:{name:'Đêm Băng Giá', type:'atk', art:'finite', cost:3, cast:.6, el:'ice', dmg:2, freeze:3, text:'2 sát thương Băng, Đóng băng 3 giây.'},
  }},
};
