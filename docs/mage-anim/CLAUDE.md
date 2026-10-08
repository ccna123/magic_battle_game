# Gói hoạt ảnh pháp sư + phép (dùng cho game 2D đấu phép)

> **14 nhân vật, 2 định dạng.** 6 pháp sư gốc dùng định dạng v1 (4 tư thế × 3 cấp, 12 phép). 8 nhân vật còn lại dùng định dạng v2
> (bộ phép riêng: 8 phép, mỗi phép một tư thế niệm riêng). `game-data.json → characters[id].format` cho biết là 1 hay 2.
> Phần v2 ở cuối file. Module tham chiếu: `spell-player.js` (v1 + Assets / Mage dùng chung) và `spell-player-v2.js` (v2).

Gói này có sprite sheet nhân vật, sprite sheet phép và dữ liệu phép, kèm một module phát hoạt ảnh tối giản trên canvas 2D.
Mở `demo.html` qua một web server tĩnh (ví dụ `npx serve .` hoặc `python3 -m http.server`) để xem chạy thử.

## Thư mục

```
assets/
  game-data.json          Tên, sát thương, ma lực, thời gian niệm, hiệu ứng, cơ chế của mọi phép (14 nhân vật, 136 phép)
  anim/<id>-sheet.png     Sheet nhân vật: 6 cột × 11 hàng (v1) hoặc 6 cột × 12 hàng (v2), khung 192×192, nền trong suốt, nhân vật quay mặt sang PHẢI
  anim/<id>.json          Hàng / số khung / fps / loop của từng hoạt ảnh + "hand" (vị trí tay khi đẩy tay)
  spells/<id>-spells.png  Sheet phép: 8 cột × 12 hàng (v1) hoặc 8 cột × 8–9 hàng (v2), khung 192×192
  spells/<id>-spells.json Thông số hiển thị từng phép (neo, khung gây sát thương, kiểu rơi...)
  summons/<id>.png        48 quái (để dành, chưa gán cho nhân vật nào)
spell-player.js           Module ES: Assets, Mage, SpellFx, cast() — phép v1
spell-player-v2.js        Module ES: castV2(), spawnV2(), FxV2, stepDash() — phép v2
demo.html                 Ví dụ dùng module
reference/xuong-sprite.html  Bản đầy đủ của sân thử (mọi cơ chế đặc biệt), dùng để tham khảo cách làm
```

Nhân vật v1: `pyro` Hoả Pháp Sư, `storm_fox` Hồ Ly Lôi Sư, `tide` Thuỷ Tộc (người cá), `frost` Băng Nữ, `terra` Thạch Đạo Sĩ, `raven` Quạ Hắc Thuật.
Nhân vật v2: `pharaoh` Tư Tế Sa Mạc, `swordsman` Kiếm Khách, `tarot` Bài Sư, `mech` Thợ Máy, `priest` Linh Mục, `chrono` Thời Gian Sư, `monk` Võ Tăng, `bard` Thi Sĩ.

## Quy ước toạ độ

- Khung 192×192. **Mặt đất / chân nhân vật ở y = 180 trong khung.** Vẽ khung tại `(x − 96, groundY − 180)`.
- Nhân vật quay phải; đối thủ lật ngang (`scale(-1, 1)` quanh `x`).
- `anim/<id>.json` → `hand.release = [hx, hy]`: toạ độ tay trong khung ở tư thế đẩy tay. Đạn / tia xuất phát tại `(x − 96 + hx, groundY − 180 + hy)`.

## Hoạt ảnh nhân vật v1 (`anim/<id>.json` → `anims`)

`idle, cast_start, cast_loop, release, guard, buff, hit, ko, release_sky, release_ground, release_spread` — mỗi mục có `row, frames, fps, loop`, `hold` (giữ khung cuối).
Chuỗi niệm phép: `cast_start` → `cast_loop` giữ `castTime` giây → tư thế của phép (`pose`) → phép xuất hiện ở **khung 2** của tư thế đó.

| Tư thế | Loại phép (`type`) |
|---|---|
| `release` (đẩy tay) | `bolt` |
| `release_sky` (giơ tay lên trời) | `sky` |
| `release_ground` (đặt tay xuống đất) | `ground` |
| `release_spread` (dang tay) | `spread` |

## Phép v1 (`spells/<id>-spells.json` → `spells[]`, khoá `bolt1..spread3`)

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

`characters[id]` → `name, element, format, look` (mô tả ngoại hình) và `spells[key]` → `name, how, damage, hits (số nhịp), heal, shield, mana, castTime, effect, mechanic`.
v1 có thêm `type, level, pose, kind, buff`; v2 có thêm `pose, release, mech` (bản sao của `mech` trong spells JSON).
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


---

# Định dạng v2: bộ phép riêng (8 nhân vật)

## Sheet nhân vật v2 (`anim/<id>.json`, có `"version": 2`)

Hàng: `idle` (lặp), `charge` (gồng phép, lặp), `hit`, `ko` (`hold`), rồi một hàng `sp_<key>` cho mỗi phép (6 khung, 12 fps, không lặp).
Một số hàng có ít hơn 6 khung: luôn đọc `frames` từ JSON. `head = [x, y]`: vị trí đầu trong khung (cho phép bắn từ đầu / hiện chữ trên đầu).

Chuỗi niệm: `charge` giữ `castTime` giây → tư thế `pose` (= `sp_<key>`) → **phép bật ra ở khung `release`** của tư thế đó (không phải khung 2 như v1) → về `idle`.

## Phép v2 (`spells/<id>-spells.json` → `spells[]`)

| Trường | Ý nghĩa |
|---|---|
| `key`, `name`, `how`, `effect` | khoá, tên, mô tả, hiệu ứng (tiếng Việt) |
| `dmg`, `hits`, `heal`, `mana`, `cast` | sát thương mỗi nhịp, số nhịp, hồi máu, ma lực, thời gian gồng (giây) |
| `row`, `frames` (=8), `fps` | hàng trong sheet phép |
| `row2` | hàng phụ (đạn của tháp pháo / thiên thần, con mắt Horus) |
| `pose`, `release` | hàng tư thế trong sheet nhân vật, khung bật phép |
| `hand = [x, y]` | điểm phép xuất phát trong khung tư thế ở khung `release` (đã dò sẵn từng phép) |
| `headPt` | điểm xuất phát với phép `origin: "head"` |
| `beamHead[f] = [L, split, R]` | chỉ với tia có đầu mũi: kéo dãn `[L, split]`, giữ nguyên `[split, R]` |
| `mech` | cơ chế (bảng dưới) |
| `vis`, `guide`, `pose_txt` | mô tả hình (để vẽ lại bằng AI), bỏ qua khi lập trình |

Quy ước hình trong ô 192: `bottom` = đáy hình chạm y 180 (đặt đáy khung trên mặt đất, tức tâm khung ở `groundY − 180 + 96`); còn lại hình nằm giữa ô (tâm khung đặt ở điểm phép).
Đạn / vật bay: khung 0–3 bay lặp, khung `mech.impact` (thường 4) tới 7 là vụ nổ khi chạm. Phép đứng yên chạy 8 khung một lần.

## `mech.type` — cơ chế

| type | Hành vi | Thông số |
|---|---|---|
| `projectile` | đạn bay thẳng từ `origin` tới địch | `origin` (hand / head / ground), `speed`, `impact`, `pull` (>0 kéo lại gần, <0 đẩy lùi), `shake` |
| `fan` | nhiều đạn, mỗi viên lệch độ cao `spreadY[i]`, cách nhau `interval` giây | `count`, `spreadY`, `interval`, `speed` |
| `wave` | đạn bay theo hình sóng sin | `amp`, `waves`, `speed` |
| `lob` | ném vòng cung (parabol) rồi nổ tại chỗ địch | `flight` (giây), `arc` (px), `impact` |
| `boomerang` | bay tới, trúng, quay về; lặp `passes` lượt | `passes`, `speed`, `controlled` (lật hình khi quay về) |
| `beam` | tia nối điểm xuất phát → địch, sát thương ở các khung `ticks`. Ô là đoạn tia ghép nối được (lặp ngang); có `beamHead` thì kéo dãn | `ticks`, `origin`, `root` |
| `drop` | vật giáng từ trời xuống chỗ địch (vẽ nâng cao dần hạ xuống trước khung `hit`) | `hit`, `shake`, `slow` |
| `multi_drop` | `count` vật giáng lần lượt quanh địch | `count`, `spread`, `interval`, `hit` |
| `erupt` | trồi lên tại chân địch, sát thương ở `hit` | `hit`, `root`, `freeze: true` (đứng yên tới hết hiệu ứng), `confuse` |
| `zone` | vùng di chuyển dọc sân (lặp 8 khung) gây sát thương theo nhịp khi ở gần địch | `move`, `speed`, `life`, `ticks` |
| `self` | hiệu ứng quanh người niệm | `at` (caster / caster_front / caster_back), `shield`, `heal` + `healAt`, `empower`, `rays` (khung bắn tia sét vẽ bằng code từ đĩa xuống địch), `label` |
| `dash` | người niệm lướt tới địch (để lại bóng mờ), chém ở `hit` (hoặc chuỗi `combo`), rồi lướt về | `stop` (front / behind), `hit`, `combo`, `freeze` (giây) |
| `clones` | 3 bóng người niệm (vẽ khung `pose` mờ, lật mặt nếu đứng phía sau) hiện quanh địch, mỗi bóng một nhát | `count`, `hits` (khung) |
| `strike` | vây quanh địch, sát thương ở các khung `hits` | `hits`, `freeze: true` |
| `random` | bánh xe số phận: tới khung `hit` bốc 1 trong `outcomes` | `dmg2` (đánh 2 lần), `heal` (hồi 20), `stun` (choáng 1,5 s) |
| `mark` | ấn treo trên đầu địch: khung 0–3 lặp trong `delay` giây rồi nổ khung 4–7 | `delay`, `hit` |
| `turret` | vật đứng trên sân (khung 0–3 bung ra, 4–7 lặp) tự bắn đạn hàng `row2` mỗi `every` giây trong `life` giây | `life`, `every`, `speed`, `float` (bay lơ lửng thay vì đứng đất) |
| `totem` | trụ cắm cạnh địch: khung 0–1 cắm, 2–7 lặp; sát thương `ticks` nhịp trong `life` giây | `life`, `ticks` |
| `sleep` | địch ngủ `dur` giây (khung lặp trên đầu), **tỉnh khi trúng đòn** | `dur` |
| `regen` | vật hồi máu sau lưng, hồi `heal` ở các khung `beats` | `heal`, `beats` |
| `encore` | lặp lại phép vừa niệm trước đó (trừ encore), không tốn ma lực | — |

Hiệu ứng khi trúng (đọc từ `mech`): `root` (giây trói chân), `freeze` (số giây đứng yên, hoặc `true` = tới hết phép), `slow` (tỉ lệ), `confuse` (giây), `pull` (px), `shake` (rung màn hình).
Một số hiệu ứng chỉ mô tả trong `effect` (phản đạn của Khiên Thánh, hồi sinh, Gia Tốc, Tua Ngược theo máu đã mất...): game tự cài theo câu chữ.

## Dùng nhanh v2

```js
import { Assets, Mage } from './spell-player.js';
import { castV2, stepDash } from './spell-player-v2.js';
const A = await new Assets('assets').load();
const me = new Mage(A, 'chrono', 170, 300, 1), foe = new Mage(A, 'monk', 600, 300, -1), world = [];
castV2(me, foe, 'timebomb', world, {
  onHit: (fx, h) => foe.play('hit'),          // h.damage, h.tick
  onHeal: (fx, n) => {}, onStatus: (fx, s) => {}, onShake: (fx, a) => {} });
// mỗi khung: stepDash(me, dt); me.update(dt); foe.update(dt); world.forEach(e => e.update(dt)); bỏ e.done; vẽ e.draw(ctx, e.caster.A.spellSheet)
```

## Chuyển sang Godot (gợi ý)

- Nạp sheet bằng `Texture2D` + `AtlasTexture` (vùng `Rect2(col*192, row*192, 192, 192)`), hoặc dựng `SpriteFrames` từ JSON cho `AnimatedSprite2D` (mỗi `anims` một animation, fps và loop theo JSON).
- Đặt `offset = Vector2(0, -84)` (= 96 − 180) cho sprite nhân vật để gốc toạ độ nằm ở chân. Tắt lọc ảnh: Project Settings → Rendering → Textures → Default Texture Filter = Nearest.
- Mỗi hiệu ứng phép = một `Node2D` có `Sprite2D` (region) và script chép logic `FxV2.update/onFrame` trong `spell-player-v2.js`. Đạn bay nên có `Area2D` để chặn bằng khiên / va đạn đối thủ.
- Tia (`beam`): một `Sprite2D` với `region_enabled`, `texture_repeat = enabled` và kéo `region_rect.size.x` theo khoảng cách.
- `game-data.json` đọc bằng `JSON.parse_string(FileAccess.get_file_as_string(...))`.
