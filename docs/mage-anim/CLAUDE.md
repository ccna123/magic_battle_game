# Gói hoạt ảnh pháp sư + phép (dùng cho game 2D đấu phép)

Gói này có sprite sheet nhân vật, sprite sheet phép và dữ liệu phép, kèm một module phát hoạt ảnh tối giản trên canvas 2D.
Mở `demo.html` qua một web server tĩnh (ví dụ `npx serve .` hoặc `python3 -m http.server`) để xem chạy thử.

## Thư mục

```
assets/
  game-data.json          Tên, sát thương, ma lực, thời gian niệm, hiệu ứng, cơ chế của mọi phép (7 nhân vật × 12 phép)
  anim/<id>-sheet.png     Sheet nhân vật 1152×2112: 6 cột × 11 hàng, khung 192×192, nền trong suốt, nhân vật quay mặt sang PHẢI
  anim/<id>.json          Hàng / số khung / fps / loop của từng hoạt ảnh + "hand" (vị trí tay khi đẩy tay)
  spells/<id>-spells.png  Sheet phép 1536×2304: 8 cột × 12 hàng, khung 192×192
  spells/<id>-spells.json Thông số hiển thị từng phép (neo, khung gây sát thương, kiểu rơi...)
  summons/<id>.png        48 quái (dùng cho Triệu Thú Sư, chưa có hoạt ảnh riêng)
spell-player.js           Module ES: Assets, Mage, SpellFx, cast()
demo.html                 Ví dụ dùng module
reference/xuong-sprite.html  Bản đầy đủ của sân thử (mọi cơ chế đặc biệt), dùng để tham khảo cách làm
```

Nhân vật (id): `pyro` Hoả Pháp Sư, `storm_fox` Hồ Ly Lôi Sư, `tide` Thuỷ Tộc, `frost` Băng Nữ, `terra` Thạch Đạo Sĩ, `raven` Quạ Hắc Thuật, `beastmaster` Triệu Thú Sư (hình khung xương tạm).

## Quy ước toạ độ

- Khung 192×192. **Mặt đất / chân nhân vật ở y = 180 trong khung.** Vẽ khung tại `(x − 96, groundY − 180)`.
- Nhân vật quay phải; đối thủ lật ngang (`scale(-1, 1)` quanh `x`).
- `anim/<id>.json` → `hand.release = [hx, hy]`: toạ độ tay trong khung ở tư thế đẩy tay. Đạn / tia xuất phát tại `(x − 96 + hx, groundY − 180 + hy)`.

## Hoạt ảnh nhân vật (`anim/<id>.json` → `anims`)

`idle, cast_start, cast_loop, release, guard, buff, hit, ko, release_sky, release_ground, release_spread` — mỗi mục có `row, frames, fps, loop`, `hold` (giữ khung cuối).
Chuỗi niệm phép: `cast_start` → `cast_loop` giữ `castTime` giây → tư thế của phép (`pose`) → phép xuất hiện ở **khung 2** của tư thế đó.

| Tư thế | Loại phép (`type`) |
|---|---|
| `release` (đẩy tay) | `bolt` |
| `release_sky` (giơ tay lên trời) | `sky` |
| `release_ground` (đặt tay xuống đất) | `ground` |
| `release_spread` (dang tay) | `spread` |

## Phép (`spells/<id>-spells.json` → `spells[]`, khoá `bolt1..spread3`)

Hàng trong sheet = `row`. 8 khung, `fps`. Các trường quan trọng:

- `anchor`: `center` (tâm khung đặt ở điểm phép), `bottom` (đáy khung y=180 đặt trên mặt đất), `beam` (tia nối tay → địch).
- `at`: chỗ đặt — `target` (dưới chân địch), `caster` (quanh người niệm), `caster_front` (trước mặt người niệm), `hand_to_target`, `caster_to_target`.
- `hitFrame`: khung gây sát thương. `tickFrames` / `zapFrames`: nhiều nhịp sát thương. `healFrame`: khung hồi máu.
- `mode`: cơ chế đặc biệt (xem bảng dưới). Thông số kèm theo: `count`, `interval`, `spreadX`, `spreadY`, `knockUp`, `shake`, `zapTop`, `path`...
- Đạn `bolt`: khung 1–4 bay lặp (di chuyển ~620 px/s), khung 5–8 nổ khi chạm. `impactAnchor: "bottom"` → khung nổ đặt đáy trên mặt đất.
- Phép trời `sky`: `skyMode`
  - `fall` = vật rơi: bay thêm 0,32 s rồi rơi từ cao xuống; `dir` = độ chéo (>0 từ trái trên, <0 từ phải trên); gây sát thương ở `landFrame`.
  - `cloud` = mây / cột: nâng phần đỉnh (`top`, `band`) lên cao, kéo dãn khúc giữa, giữ chân.
  - `pour` = thác: vẽ nguyên, lặp dải trên cùng lên trời.
- Tia (`mode: beam`): `beamHead[f] = [L, split, R]` → kéo dãn `[L, split]` từ tay, vẽ đầu tia `[split, R]` nguyên kích thước ở cuối. Tia `chain`: các ô là đoạn ngang ghép nối được.
- `offsetX`: hình vẽ lệch tâm, cộng vào x khi vẽ.

`spell-player.js` đã xử lý: đạn bay, phép trời (fall / cloud / pour), tia, đặt theo `at`, sự kiện `onHit` / `onHeal`.
Các cơ chế sau chỉ có trong `reference/xuong-sprite.html` (tìm theo tên `mode`), cần chép sang nếu dùng:
`fan` / `volley` (nhiều đạn), `path` (bounce / swoop / zigzag), `barrage` (nhiều đòn giáng lần lượt), `line` / `sparkline` (hàng gai mọc nối tiếp),
`totem` / `tower` (trụ bắn tia sét vẽ bằng code), `quake` / `glacier` / `volcano` (rung sân + hất tung), `sheet` (trượt lùi), `shockfloor` (choáng),
`prison` / `cage` / `timefreeze` (địch đứng yên), `drain` (cầu hồn bay về), `wall` (chặn đạn), `empower` / `haste` / `armor` (cường hoá, giáp), `tempest`.

## Dữ liệu chơi (`game-data.json`)

`characters[id].spells[key]` → `name, kind, how, damage, hits (số nhịp), heal, shield, buff, mana, castTime, effect, mechanic`.
`animSpec` (đặc tả hoạt ảnh), `monsters` (tên, kiểu di chuyển của 48 quái).

## Dùng nhanh

```js
import { Assets, Mage, cast } from './spell-player.js';
const A = await new Assets('assets').load();
const me = new Mage(A, 'frost', 170, 300, 1), foe = new Mage(A, 'terra', 600, 300, -1), world = [];
cast(me, foe, 'bolt3', world, { onHit: s => foe.play('hit'), onHeal: s => {} });
// mỗi khung: me.update(dt); foe.update(dt); world.forEach(e => e.update(dt)); vẽ me, foe, rồi e.draw(ctx, e.caster.A.spellSheet)
```

Vẽ với `ctx.imageSmoothingEnabled = false` để giữ nét pixel.
