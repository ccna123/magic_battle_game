# Đấu Trường Phép Thuật — hướng dẫn cho Claude

Game đấu phép **thời gian thực, 1 người vs máy**, góc nhìn ngang kiểu game đối kháng 2D pixel art.
Bản hiện tại chạy trên web (Vite + JS thuần + canvas 2D + three.js cho hạt). **Đang chuyển sang Godot 4.**
Bản web là **bản tham chiếu**: khi port, giữ đúng luật và số liệu trong file này; khi file này và code web khác nhau, code web (`src/duel/`) là đúng, rồi sửa lại file này.

Ngôn ngữ: toàn bộ chữ trong game, chú thích code và tài liệu viết **tiếng Việt có dấu**. Người dùng xưng "tao / mày", trả lời bằng tiếng Việt.

---

## 1. Bản đồ repo (bản web)

```
index.html                 Khung trang: HUD 2 bên, sân khấu (#fMe, #fOpp, canvas #dFx), tay 4 lá (#dHand), lớp phủ (#dOverlay)
src/duel/
  duel.js                  ★ Toàn bộ luật: tạo trận, niệm, rút phép, nhịp sát thương, trạng thái, Đấu Đũa, AI, HUD, điều khiển
  mages.js                 Nạp gói pháp sư, đổi dữ liệu phép (v1 + v2) thành "phép trận" (mục 4); ORIGIN_FIX
  spellfx.js               Vẽ phép lên canvas từ sheet phép (mục 6)
  anim.js                  Chạy sprite sheet nhân vật (idle / niệm / tư thế / trúng đòn / gục)
  data.js                  RULES, DIFF (độ khó), DUEL_WEATHER
  config.js                Hệ nguyên tố: tên + màu
  duel.css, base.css       Giao diện
src/fx/three-fx.js         Hạt, rung màn hình, hạt thời tiết, flipbook public/fx/*.png (chỉ là trang trí)
public/mage/               ★ Gói pháp sư: game-data.json, anim/<id>-sheet.png + .json, spells/<id>-spells.png + .json
public/fx/, public/ui/     Dải hiệu ứng 8 khung dùng chung, khung lá phép
docs/mage-anim/CLAUDE.md   ★ Định dạng gói pháp sư (v1, v2, toạ độ, mech). ĐỌC TRƯỚC khi đụng vào hoạt ảnh / phép
docs/LUAT-CHOI.md          Luật cho người chơi · docs/LO-TRINH.md: việc đã / sắp làm
```

Chạy bản web: `npm install && npm run dev`. Không có test tự động; kiểm tra bằng Playwright (Chromium ở `/opt/pw-browsers/chromium`).

---

## 2. Luật chơi và hằng số (`src/duel/data.js → RULES`)

| Hằng số | Giá trị | Ý nghĩa |
|---|---|---|
| `HP` | 150 | Sinh lực mỗi bên |
| `MANA_START / MANA_MAX` | 4 / 10 | Ma lực đầu trận / tối đa |
| `REGEN` | 1.1 s | Hồi 1 ma lực mỗi 1,1 giây (Đóng băng thì ngừng hồi; Cuồng phong hồi gấp đôi) |
| `HAND` | 4 | Số ô phép trên tay |
| `DRAW_TIME` | 0.4 s | Q: rút 1 lá vào ô trống |
| `PICK_COST / PICK_TIME` | 1 / 5 s | W: xem 3 lá trên cùng, chọn 1 (hết giờ lấy lá đầu; Esc huỷ, hoàn ma lực) |
| `REFRESH_COST / REFRESH_TIME` | 2 / 0.8 s | E: trả cả tay xuống đáy sách, rút 4 lá mới |
| `LOADOUT_MIN / MAX` | 5 / 8 | Số phép mang vào trận |
| `WET` | 6 s | Thời gian Ướt |
| `BURN_TICK / BURN_DMG` | 1 s / 2 | Cháy: mất 2 máu mỗi giây |
| `WEATHER_EVERY` | 30 s | Đổi thời tiết |
| `FRENZY_AT` | 120 s | "Cuồng phong": ma lực hồi gấp đôi |
| `CLASH` | 1.8 s | Thời gian dồn lực Đấu Đũa |
| `INTRO` | 1.8 s | "Sẵn sàng… Đấu!" (banner "Đấu!" lúc còn 0,7 s) |

### Luồng một trận
1. **Màn chọn:** chọn nhân vật (= "sách" phép), chọn 5–8 phép mang vào (lưu `localStorage['dp-duel']` = `{me, opp, diff, loadout:{[mage]: [spellId]}}`), chọn đối thủ (hoặc ngẫu nhiên) và độ khó.
2. **Sách (bộ bài):** mỗi phép được chọn cho vào sách **2 bản**, phép cấp 3 (v1) hoặc ≥ 6 ma lực (v2) **1 bản**. Xáo, rút 4 lá lên tay.
   Mặc định: v1 mang 8 phép cấp 1–2; v2 mang cả 8 phép. Máy chọn ngẫu nhiên 8 phép.
3. **Kiểu Asuka R♯:** niệm xong ô đó **để trống**, lá vừa dùng xuống đáy sách, phải tự rút (Q/W/E).
   **Không có hồi chiêu**: đủ ma lực + có lá trên tay là niệm được. **Rút và niệm chạy song song.**
4. Mỗi lúc chỉ niệm 1 phép. Bấm lá khi đang niệm dở hoặc thiếu ma lực → lá đó thành **"Tiếp theo"**, tự niệm ngay khi được (bấm lại để bỏ; ô bị thay lá thì bỏ).
5. Hết máu → K.O. → màn kết quả sau 1,7 s.

### Điều khiển
`1–4` / chạm lá: niệm · `Q / W / E`: rút 1 / xem 3 chọn 1 / thay tay · khi đang chọn: `1–3` chọn, `Esc` huỷ · `Space` / chạm luồng phép: dồn lực Đấu Đũa.

---

## 3. Gói pháp sư (`public/mage`) — tóm tắt

Chi tiết định dạng: **`docs/mage-anim/CLAUDE.md`** (bản gốc của người làm hình, có cả phần "Chuyển sang Godot").

- Khung **192×192**, chân / mặt đất ở **y = 180** trong khung, nhân vật quay **phải** (đối thủ lật ngang).
- **v1** (6 pháp sư: `pyro, storm_fox, tide, frost, terra, raven`): 12 phép `bolt1–3, sky1–3, ground1–3, spread1–3`.
  Niệm: `cast_start` → `cast_loop` (giữ thời gian niệm) → tư thế theo loại (`release` / `release_sky` / `release_ground` / `release_spread`) → **phép hiện ở khung 2** của tư thế.
  Chỉ số chơi ở `game-data.json → characters[id].spells[key]`; thông số hình ở `spells/<id>-spells.json`.
- **v2** (8 nhân vật: `pharaoh, swordsman, tarot, mech, priest, chrono, monk, bard`): 8 phép riêng, mỗi phép một hàng tư thế `sp_<key>`.
  Niệm: `charge` (lặp, giữ thời gian niệm) → `sp_<key>` → **phép bật ra ở khung `release`** của tư thế (fps của tư thế, thường 12).
  Chỉ số + hình + cơ chế (`mech`) đều ở `spells/<id>-spells.json`.
- Phân biệt: `game-data.json → characters[id].format` (1 / 2) hoặc `anim/<id>.json → version: 2`.
- Hệ nguyên tố của nhân vật → hệ trong game: `fire, storm, water, ice, earth`, `shadow→dark`, `sand→earth`, `steam→fire`, `holy→light`, `zen→light`, `qi→none`, `arcana/time/sound→mind`.

### Sửa dữ liệu dò sai (`ORIGIN_FIX` trong `mages.js`)
Một số điểm xuất phát trong gói bị dò sai; game ghi đè (toạ độ trong khung 192 của tư thế ra đòn):
- `monk.mantra` → `hand: [130, 45]` (gói ghi [120, 168], sát chân).
- `monk.roar` → `headPt: [128, 100]` (gói ghi [66, 134], sau lưng).
Khi port, giữ bảng này (hoặc sửa thẳng vào JSON).

---

## 4. "Phép trận": dữ liệu sau khi chuyển đổi (`mages.js`)

Mỗi phép có id `"<mage>.<key>"` và các trường:

| Trường | Ý nghĩa |
|---|---|
| `name, text, el, cost, cast, dmg, hits` | tên, mô tả, hệ, ma lực, giây niệm, sát thương **mỗi nhịp**, số nhịp |
| `v2, kind, pose, release, poseFps, meta, mech` | định dạng, loại (v1: bolt/sky/ground/spread; v2: `mech.type`), tư thế, khung bật phép, dữ liệu hình |
| `level` | v1 theo gói; v2 suy từ ma lực: ≤3 → 1, ≤5 → 2, còn lại 3 |
| `self, type` | `self` = không sát thương và không nhắm địch. `type`: `atk` · `counter` (giáp / tường / phản) · `support` |

**Hiệu ứng** được đọc từ câu `effect` tiếng Việt bằng regex (hàm `effects()`), cộng các trường của `mech` (v2). Danh sách trường hiệu ứng:

| Trường | Từ câu chữ / mech | Tác dụng khi trúng (mục 5) |
|---|---|---|
| `burn` | "Cháy N giây", "Thiêu đốt N", "Chảy máu N", "Cháy liên tục" (=2) | Cháy N giây |
| `stun` | "Choáng N giây", "đứng yên N giây", "mất thăng bằng N", `mech.freeze` (số) | Choáng N giây |
| `stunLast` | "Trúng đủ 3 nốt…", "Đòn cuối choáng…" | Choáng chỉ ở nhịp cuối |
| `slow` | "chậm N%", `mech.slow` | Chậm (tỉ lệ) |
| `root` | "Trói chân N", `mech.root` | Coi như chậm 40% trong N×2+1 giây |
| `wet` | "Ướt" (chỉ phép hệ nước) | Ướt |
| `freeze` | "Đóng băng N giây" | Đóng băng N giây |
| `interrupt` | "ngắt phép", "phép đang niệm bị ngắt" | Huỷ phép đang niệm |
| `drainHp` | "Hút N máu", hoặc v1 có `heal` + `damage` | Người niệm hồi N (nhịp cuối) |
| `selfHeal` | "hồi N máu cho người niệm" | Người niệm hồi N (nhịp cuối) |
| `lifePerHit` | "Mỗi … hồi N máu" | Người niệm hồi N mỗi nhịp trúng |
| `blind` | "Mù N" (không số = 2) | Mù: phép người bị Mù yếu 30% |
| `dispel` | "xoá / cướp 1 phép duy trì", "xoá 1 hiệu ứng tốt" | Xoá 1 buff (tường, giáp, cường hoá, niệm nhanh, bong bóng) |
| `armorOnHit` | "+N giáp" | Người niệm +N giáp 5 giây |
| `launch` | "Hất tung" | Choáng 0,35 s + nảy người lên |
| `pierce` | "xuyên qua khiên", "Xuyên giáp", đạn `wave` | Bỏ qua tường, khiên, giáp |
| `armorBreak` | "Phá N% giáp", "giảm N% giáp" | Giáp địch giảm N% |
| `mark` | "Đánh dấu con mồi" | +10% sát thương nhận 3 giây |
| `vuln` | "giảm N% kháng phép" | +N% sát thương nhận, cộng dồn tới 30%, 4 giây |
| `crit` | "N% chí mạng" | Tỉ lệ ×1,5 |
| `pctHp` | "bằng N% máu hiện tại" | Cộng thêm N% máu hiện tại của địch |
| `execute` | "dưới N% máu thì gây gấp đôi" | ×2 khi địch dưới N% máu |
| `smite` | "gấp đôi lên địch … bóng tối / nguyền" | ×2 khi địch bị Mù hoặc là con mồi |
| `early` | "nổ sớm hơn N giây" | Ấn hẹn giờ nổ sớm N giây nếu địch đang bị chậm |
| `healCut` | "giảm hồi máu" | Hồi máu của địch giảm 50% trong 3 giây |
| `confuse` | `mech.confuse` | Phép kế tiếp của địch trượt (trong N giây) |
| `sleep` | `mech.type = sleep` | Ngủ N giây, tỉnh khi trúng đòn |
| `random` | `mech.type = random` | Bốc 1: `dmg2` (×2 sát thương) / `heal` (người niệm +20) / `stun` (choáng 1,5 s) |
| Tự thân: `heal` | `heal` khi không sát thương, `mech.heal` | Hồi máu (v2: ở khung `healAt`) |
| `regenHeal` | `mech.type = regen` | Hồi N ở mỗi khung `beats` |
| `barrier` | `shield`, "Giáp N", "Giáp chặn N" | Giáp N trong `dur` giây (mặc định 4) |
| `guard` | "chặn N% sát thương trong T" | Giảm N% sát thương nhận |
| `wall` | "Chặn N / mọi đạn phép, đứng T giây" | Tường đá chặn N **đạn bay** (`rootOnFall`: khi sụp làm địch Trói chân) |
| `mirror` | "phản lại đạn phép đầu tiên" | Phản đạn bay đầu tiên trong N giây |
| `thorns` | "phản N% sát thương" | Phản N% sát thương nhận về người đánh |
| `immune` | "miễn choáng" | Miễn Choáng / Ngủ |
| `revive` | "Hồi sinh với N% máu" | Sống lại với N% máu, một lần mỗi trận |
| `rewind` | "Hồi lượng máu đã mất trong T giây trước (tối đa M)" | Hồi đúng lượng máu đã mất trong T giây (cần lưu lịch sử máu mỗi 0,2 s) |
| `empower` | "N phép tiếp theo / phép kế tiếp +X%", `mech.empower` | N phép sát thương tiếp theo ×(1+X%) |
| `haste` | "Thời gian niệm … −40% trong T" | Niệm nhanh (×0,6) T giây |
| `encore` | `mech.type = encore` | Niệm lại phép trước đó (không tốn ma lực, trễ 0,38 s) |
| `cleanse` | "giải hiệu ứng xấu" | Xoá Ướt, Cháy, Đóng băng, Choáng, Mù, Chậm, Con mồi |

> Đọc câu chữ bằng regex là cách tạm. Khi sang Godot nên **xuất một lần ra JSON / Resource có trường rõ ràng** (chạy `loadMages()` trên web rồi `JSON.stringify` các phép), rồi sửa tay chỗ sai, thay vì port lại regex.

---

## 5. Chiến đấu

### 5.1 Niệm phép
- `castTime = cast × (Đóng băng ? 2 : 1) × (1 + slow.f nếu Chậm) × (Niệm nhanh ? 0,6 : 1)`.
- Bắt đầu niệm: trừ ma lực ngay, lá rời tay. Đối thủ thấy vòng phép, tên phép và **thanh tiến độ dưới chân**.
- Bị Choáng / Ngủ / ngắt lúc đang niệm → phép bị huỷ (mất ma lực).
- Niệm xong (`finishCast`): chạy tư thế; nếu người niệm đang **Mê hoặc** → phép trượt; lấy hệ số **cường hoá** nếu phép có sát thương;
  ghi `lastSpell` (cho Bis!); sau **trễ tư thế** thì gọi `release()`:
  v1 = 2/14 s; v2 = `release / poseFps`.

### 5.2 Nhịp sát thương ("hit instance")
Mọi sát thương đi qua **một hàng đợi chung `S.proj`**: mỗi nhịp là một bản ghi `{from, to, sp, k, travel, mul, bolt, last, tick, warn, pierce, clashable, zap}`;
`k` tăng `dt / travel`, tới 1 thì gọi `land(p)`. Nhịp có hình bay (`ent`) thì hình đi theo `p.k`; nhịp khác chỉ là đồng hồ hẹn giờ ẩn.
`last` = nhịp cuối (để hồi máu / xoá buff một lần). `bolt` = đạn bay thật (tường chặn được, gương phản được).

Thời điểm các nhịp (tính từ lúc phép xuất hiện):

| Loại | Thời điểm |
|---|---|
| Đạn bay (v1 bolt, v2 projectile / fan / wave) | `travel = max(.3–.35, khoảng cách / tốc độ)`; tốc độ v1: 620 (đường nảy / vòng / zíc zắc 470, sóng lửa 340); v2: `mech.speed` |
| Loạt đạn (fan / volley) | Mỗi viên trễ thêm `interval` |
| Hồi toàn (boomerang) | `T = khoảng cách / speed`; nhịp ở `T, 3T, 5T…` (`passes` lượt) |
| Ném vòng (lob) | `mech.flight` |
| Tia (beam, chain) | Các khung `ticks` / `tickFrames` / `hitFrame`, chia `fps` |
| v1 giáng (`skyMode: fall`) | `0,32 + landFrame / fps` |
| v1 / v2 đặt tại chỗ | `hitFrame / fps` (mặc định sky 2, ground 3); nhiều nhịp theo `tickFrames` / `zapFrames` / `mech.hits` |
| Mưa đòn (barrage, multi_drop) | Mỗi vật trễ `interval`, cộng khung trúng |
| Hàng gai (v1 caster_to_target) | `(count−1)·interval + hitFrame/fps`, một nhịp |
| Ấn hẹn giờ (mark) | `delay` (trừ `early` nếu địch đang chậm) + `(hit − 3)/fps` |
| Vùng di chuyển (zone) | Tốc độ được nâng để tới địch trong 40% `life`; các nhịp rải đều trong 60% còn lại |
| Tháp pháo (turret) | Bắn đạn hàng `row2` mỗi `every` giây trong `life` giây, mỗi phát là một đạn bay |
| Trụ (totem) | `ticks` nhịp rải đều trong `life` |
| Lướt chém (dash) | Khung `hit` hoặc `combo`; người niệm lướt tới (0,12 s), đứng chém, lướt về (0,22 s) |

`khoảng cách` = khoảng cách giữa hai đấu sĩ tính theo px gốc của khung (bản web ≈ 550–600).

### 5.3 `land(p)`: thứ tự xử lý khi trúng
1. Đối thủ đang **Né** → trượt.
2. `p.bolt` và đối thủ có **tường đá** còn lượt, phép không `pierce` → tường chặn, trừ 1 lượt.
3. `p.bolt` có sát thương và đối thủ có **gương / Khiên Thánh** → phản: tạo nhịp mới bay ngược lại (hình đi theo).
4. Đối thủ có **khiên** (cũ, chặn 1 đòn) và không `pierce` → chặn.
5. **Bánh Xe Số Phận** bốc kết quả.
6. Tính sát thương:
   `n = max(1, round(dmg × mul + pctHp × máu_hiện_tại_địch))`, với `mul` =
   `p.mul (cường hoá, thắng Đấu Đũa ×1,3) × (1 + thời tiết) × (người niệm Mù ? 0,7) × phản ứng × (con mồi ? 1,1) × (1 + vuln) × (1 − guard) × (smite ? 2) × (execute ? 2) × (chí mạng ? 1,5)`.
7. `armorBreak` làm mỏng giáp địch → `damage()`:
   đang Ngủ thì tỉnh · `thorns` phản % về người đánh · giáp hút trước (trừ `pierce`) · trừ máu · `revive` nếu về 0 · hết máu → K.O.
8. Hồi máu cho người niệm (`lifePerHit` mỗi nhịp; `drainHp`, `selfHeal` ở nhịp cuối), `armorOnHit`.
9. Gắn trạng thái lên địch (bảng 5.4). **Ngắt phép** nếu địch đang niệm và (`interrupt` hoặc `stun ≥ 0,5` mà không miễn choáng).

### 5.4 Trạng thái
| Trạng thái | Thời gian | Tác dụng |
|---|---|---|
| Ướt | 6 s | Mở phản ứng |
| Cháy | theo phép | −2 máu / giây |
| Đóng băng | theo phép | Niệm ×2, ngừng hồi ma lực |
| Choáng | theo phép (miễn nếu `immune`) | Không niệm, không rút |
| Ngủ | theo phép | Như Choáng, tỉnh khi nhận sát thương |
| Chậm | 3 s, `f` lấy lớn nhất, tối đa 0,8 | Niệm ×(1 + f) |
| Trói chân | `root×2+1` s | Hiện là Chậm 40% (game chưa có di chuyển) |
| Mù (`weak`) | theo phép | Phép của người bị Mù ×0,7 |
| Con mồi | 3 s | Nhận ×1,1 |
| Giảm kháng phép | 4 s, cộng dồn ≤ 30% | Nhận ×(1 + v) |
| Mê hoặc | theo phép | Phép kế tiếp trượt |
| Bỏng hơi nóng | 3 s | Hồi máu ×0,5 |
| Giáp / Bong bóng / Tường / Phản đòn / Miễn choáng / Cường hoá / Niệm nhanh / Hồi sinh | theo phép | Xem mục 4 |

### 5.5 Phản ứng nguyên tố (theo hệ của phép trúng)
| Kết hợp | Kết quả |
|---|---|
| Sét trúng địch Ướt | ×1,3, xoá Ướt ("Giật lan") |
| Lửa trúng địch Ướt | ×0,7, không gây Cháy, xoá Ướt ("Dập lửa") |
| Lửa trúng địch Đóng băng | ×1,5, xoá Đóng băng ("Hơi nước") |
| Băng trúng địch đang Cháy | ×1,2, xoá Cháy ("Tan chảy") |

### 5.6 Thời tiết (`DUEL_WEATHER`), đổi mỗi 30 s sang loại khác
`clear` không có · `rain` Sét, Nước +20%, Lửa −20% · `heat` Lửa +20%, Băng −20% · `blizzard` Băng +20%, Lửa −20%.

### 5.7 Đấu Đũa (clash)
Chỉ **đạn đơn** (`clashable`: 1 viên, 1 nhịp, v1 bolt hoặc v2 projectile) bay ngược chiều nhau mới va.
Khi va: mọi thứ khác **dừng** (thời gian trận không chạy), 1,8 s để bấm. Người chơi: mỗi lần Space +1. Máy: `DIFF.mash × (0,75–1,25)` lần / giây.
Bên bấm nhiều hơn thắng (hoà thì ngẫu nhiên): đạn thua biến mất, đạn thắng bay tiếp từ giữa sân (`k = 0,5`) với ×1,3.

### 5.8 Cảm giác đánh
Trúng đòn: nhân vật chạy hoạt ảnh `hit` + nháy + giật lùi; đòn lớn: **khựng hình** 0,09 s (`S.stop`, cả trận dừng), rung màn hình, nháy sân.
> Lỗi biết trước: ngưỡng khựng hình đang là `n ≥ 5` (từ thang máu 30 cũ) nên gần như đòn nào cũng khựng; với máu 150 nên đổi thành khoảng `n ≥ 20`.

---

## 6. Hình ảnh

### Toạ độ và tỉ lệ
- Hai đấu sĩ đứng ở **20% và 80%** chiều ngang sân, đối thủ lật ngang. Bề rộng hình đấu sĩ: `clamp(110px, 21% sân, 230px)` (trên điện thoại 30%).
- Mọi hiệu ứng tính bằng **px gốc của khung 192**, nhân với `k = bề_rộng_hình / 192`, lật theo hướng mặt của **người niệm**.
- Điểm xuất phát: v1 dùng `anim/<id>.json → hand.release`; v2 dùng `meta.hand` (tay ở khung release), `headPt` / `anim.head` (đầu) hoặc `[70, −84]` so với chân (mặt đất).

### Các kiểu hình phép (`spellfx.js`)
- **v1:** đạn bay (khung 0–3 lặp, nổ 4–7 tại người trúng, hoặc tại chỗ nếu bị chặn giữa đường; `impactAnchor: bottom` → nổ sát đất), đường bay nảy / vòng / zíc zắc,
  vật rơi chéo (`fall`), mây / cột kéo dãn (`cloud`), thác lặp dải trên cùng (`pour`), tia kéo dãn thân + giữ đầu (`beamHead`), hàng gai mọc nối tiếp,
  tường đá giữ khung 3–5 tới khi hết hạn, tia sét vẽ bằng code (tháp lôi, bão cửu vĩ).
- **v2:** `shot` (đạn đi theo nhịp, khung nổ từ `mech.impact`), `boom` (bay đi về, lật hình khi `controlled`), `lob` (parabol `arc`), `beam` (+ con mắt hàng `row2` ở điểm xuất phát),
  `spot` (đứng một chỗ: giáng có nâng cao dần trước khung trúng, trồi, vây, ấn trên đầu, tháp pháo / thiên thần, trụ, vùng di chuyển, ru ngủ, bản thân).
  **Phân thân:** vẽ thêm 3 bóng người niệm (khung tư thế, mờ 60%) quanh địch ở lệch `−80, +80, −40`, bóng đứng sau lưng địch thì lật mặt.
- Vòng lặp khung khi "giữ": tường (3–5), ấn hẹn giờ (0–3 tới lúc nổ), tháp pháo (4–7), trụ (2–7), vùng (0–7), ngủ (0–7 tới khi tỉnh).
- Luôn vẽ pixel art **không lọc** (`imageSmoothingEnabled = false` / Godot: Nearest).

### Hoạt ảnh nhân vật (`anim.js`)
Nền: `idle`; đang niệm: v1 `cast_start` → `cast_loop`, v2 `charge`; bị K.O.: `ko` (giữ khung cuối).
Chạy một lần rồi về nền: tư thế phóng phép (`pose`), `hit`. Thiếu hoạt ảnh thì lùi theo chuỗi `release_* → release`, `cast_loop → cast_start → charge`.

---

## 7. Máy (AI) — `aiThink` mỗi 0,12–0,24 s

Độ khó (`DIFF`):

| | `delay` (phản xạ) | `block` (tỉ lệ đỡ) | `mash` (Đấu Đũa / s) | `gap` (nghỉ giữa 2 phép) | `hoard` (nhịn dồn phép lớn) |
|---|---|---|---|---|---|
| Dễ | 0,8 | 0,45 | 5 | 1,1 | 0,4 |
| Thường | 0,5 | 0,75 | 7 | 0,45 | 0,25 |
| Khó | 0,3 | 0,92 | 9 | 0,15 | 0,15 |

Thứ tự ưu tiên:
1. Đang niệm → tranh thủ rút nếu có ô trống.
2. **Đỡ đòn:** nhịp sát thương của người chơi bay tới, đã "thấy" sau `delay` giây, chưa có giáp / tường / bong bóng, qua xác suất `block`
   → niệm phép thủ kịp xong trước khi trúng (tường đá chỉ dùng khi là đạn bay).
3. **Ngắt phép:** người chơi đang niệm phép ≥ 3 ma lực hoặc niệm ≥ 1 s → dùng phép ngắt / choáng ≥ 0,5 s nếu kịp.
4. **Rút:** ô trống mà không còn phép dùng được, hoặc trống ≥ 2 ô → 35% "xem 3 chọn 1" (nếu ≥ 4 ma lực; chọn: phép thủ nếu tay chưa có > hồi máu nếu máu ≤ 45% > sát thương lớn / ngắt), còn lại rút 1.
   Tay không có phép tấn công → 50% thay cả tay.
5. Niệm (sau `gap` giây kể từ phép trước): hồi máu khi máu ≤ 40% → combo phản ứng (địch Ướt → Sét, địch Đóng băng → Lửa) → cường hoá / niệm nhanh / hồi máu khi máu ≤ 70%
   → mở combo → nhịn dồn phép ≥ 5 ma lực (xác suất `hoard`) → phép tấn công tổng sát thương lớn nhất → dọn phép hỗ trợ khi ≥ 6 ma lực.
6. Rảnh tay mà còn ô trống → rút.

---

## 8. Giao diện

- **HUD 2 bên** (đối xứng kiểu game đối kháng): ảnh đại diện (khung idle), tên, thanh máu có **vệt trễ**, 10 viên ma lực (viên đang hồi tô một phần), chip trạng thái, "Tay x/4 · Sách n · đang rút…".
- Giữa: đồng hồ trận (đổi màu khi Cuồng phong). Trên cùng: thời tiết + đếm ngược.
- **Sân:** nền trời / đồi / sàn lưới, hai đấu sĩ, bóng đổ, vòng phép dưới chân khi niệm, tên phép trên đầu, thanh tiến độ dưới chân (màu theo hệ; đang rút thì xanh), cảnh báo "⚠ Phép giáng!" khi có nhịp `warn` sắp trúng.
- **Tay:** 4 lá (giá, tên, hình phép, sát thương / loại, thời gian niệm, phím), ô trống "Q: rút phép", nút Q / W / E, "Sách còn n lá · trên cùng: …".
  Lá đủ ma lực sáng viền; thiếu ma lực thì tối và tô dần theo ma lực đang hồi; lá xếp hàng có nhãn "Tiếp theo".
- Chữ bay (−n, +n, "Chặn!", "Ngắt phép!"…), banner lớn ("Đấu Đũa!", "K.O.", tên phản ứng).
- Màn chọn: lưới nhân vật (hình idle + mô tả `TIP` trong `mages.js`), lưới phép mang vào (bật / tắt), đối thủ, độ khó.

---

## 9. Gợi ý kiến trúc Godot 4 (GDScript)

```
res://
  data/                     Chép nguyên public/mage (anim/, spells/, game-data.json) — Import: Filter Off / Nearest
  autoload/
    GameData.gd             Nạp JSON → Dictionary phép trận (mục 4); có thể sinh sẵn .tres
    Rules.gd                RULES, DIFF, WEATHER (mục 2, 5.6, 7)
  scenes/
    Menu.tscn               Chọn nhân vật / phép / đối thủ / độ khó (lưu bằng ConfigFile user://)
    Duel.tscn               Node2D: Stage, Fighter×2, FxLayer, HUD (CanvasLayer), Hand (Control)
    Fighter.tscn            AnimatedSprite2D (SpriteFrames dựng từ anim/<id>.json), offset (0, −84), flip_h cho đối thủ
    fx/SpellFx.tscn         Node2D + Sprite2D (region 192×192) + script theo mode (shot / boom / lob / beam / spot / sky…)
  scripts/
    Duel.gd                 Trạng thái trận, vòng _process(dt): giống step() của duel.js
    Side.gd                 Máu, ma lực, tay, sách, trạng thái, đang niệm, đang rút, xếp hàng
    HitQueue.gd             Hàng đợi nhịp sát thương (mục 5.2) + land() (mục 5.3)
    AI.gd                   Mục 7
```

Ánh xạ từ bản web:

| Web | Godot |
|---|---|
| `requestAnimationFrame` + `step(dt)` / `draw()` / `animate(dt)` | `_process(delta)` của `Duel.gd` (dừng khi khựng hình / Đấu Đũa như web) |
| `S.proj` + `p.k += dt / travel` | Mảng nhịp trong `HitQueue.gd`; đạn bay có thể thêm `Area2D` nhưng **giữ thời gian theo `travel`** để AI và luật giữ nguyên |
| `S.pending` (gọi hàm sau x giây) | Hàng đợi `{at, callable}` hoặc `get_tree().create_timer()` (cẩn thận: timer vẫn chạy khi khựng hình) |
| `frameStyle` (CSS background-position) | `AnimatedSprite2D` với `SpriteFrames` dựng từ JSON (fps, loop theo JSON) |
| Canvas `#dFx` + `spellfx.js` | Mỗi hiệu ứng một node con của `FxLayer`; tia: `Sprite2D` `region_enabled` + kéo `scale.x` / `texture_repeat` |
| `three-fx.js` (hạt, rung) | `GPUParticles2D` / `CPUParticles2D`, rung bằng `Camera2D.offset` |
| HTML HUD / tay bài | `Control` + `TextureProgressBar` (máu, vệt trễ), `HBoxContainer` 4 lá |
| `localStorage['dp-duel']` | `ConfigFile` ở `user://settings.cfg` |

Thứ tự port gợi ý: (1) nạp dữ liệu + hiển thị 2 nhân vật chạy `idle` → (2) niệm + thanh tiến độ + tư thế → (3) hàng đợi nhịp + `land()` + máu / K.O. →
(4) hình phép v1 rồi v2 → (5) tay bài, rút Q/W/E, chọn phép → (6) trạng thái, phản ứng, thời tiết → (7) AI → (8) Đấu Đũa → (9) HUD hoàn chỉnh, hạt, rung, âm thanh.

---

## 10. Chỗ đang làm gần đúng / việc còn lại
- Game **chưa có di chuyển**: đẩy lùi / kéo lại gần / trượt lùi / hất tung chỉ là hiệu ứng nhìn; Trói chân quy thành Chậm. Sang Godot có thể làm thật (tính khoảng cách mỗi khung).
- Tháp pháo chưa có máu để bị phá; lướt chém chưa có bóng mờ kéo theo; chưa có cầu hồn bay về khi hút máu.
- Ngưỡng khựng hình (mục 5.8). Cân bằng 14 nhân vật chưa làm; máy ở mức Khó còn dễ thắng.
- Chưa có âm thanh, chưa có chế độ nhiều trận.

## 11. Quy ước làm việc
- Đổi luật / số liệu thì sửa cả `docs/LUAT-CHOI.md` và file này.
- Hình mới từ người làm hình luôn theo `docs/mage-anim/CLAUDE.md`; dữ liệu dò sai thì ghi vào `ORIGIN_FIX` (hoặc bảng tương đương), không sửa ảnh.
- Kiểm tra bằng cách chạy trận thật (Playwright / Godot chạy cảnh) chứ không chỉ đọc code: xem phép ra đúng chỗ, đúng khung, không lỗi.
