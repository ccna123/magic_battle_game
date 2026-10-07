# Prompt tạo sprite sheet hoạt ảnh nhân vật

Dán toàn bộ phần dưới vào session tạo sprite, **kèm 6 ảnh gốc** trong `public/sprites/`:
`phoenix.png`, `wyvern.png`, `kraken.png`, `cerberus.png`, `vampire.png`, `banshee.png`.

---

Mình đang làm game đấu phép real-time 2D trên trình duyệt (phong cách game đối kháng, 2 nhân vật đứng 2 bên sân và bắn phép vào nhau). Hiện mỗi nhân vật chỉ có 1 ảnh tĩnh (đính kèm). Hãy tạo **sprite sheet hoạt ảnh** cho 6 nhân vật, giữ đúng thiết kế và phong cách của ảnh gốc.

## Phong cách
- Pixel art giống ảnh gốc: viền tối 1px, bảng màu giới hạn, đổ bóng kiểu cel, **không** khử răng cưa mờ, không blur.
- Giữ nguyên tạo hình, màu sắc, tỉ lệ của nhân vật trong ảnh gốc. Mọi khung hình phải nhìn ra là cùng một nhân vật.
- Nhân vật **quay mặt sang phải** (game tự lật ngang cho bên đối thủ).
- **Không** vẽ: nền, bóng đổ dưới chân, chữ, viên đạn phép bay ra, vòng phép dưới chân (game tự vẽ những thứ này). Được phép có tia sáng/hạt nhỏ dính trên người nhân vật (ví dụ tay/miệng phát sáng, lông lửa toả quanh người).

## Thông số kỹ thuật (bắt buộc)
- Mỗi khung **192×192 px**, nền **trong suốt** (PNG RGBA).
- Nhân vật căn **giữa theo chiều ngang**, điểm thấp nhất (chân/đuôi) nằm trên **cùng một đường đáy ở y = 180** trong mọi khung, trừ các động tác bay/nhảy có chủ ý. Chiều cao nhân vật khi đứng khoảng 150–170 px, **giữ cùng tỉ lệ** giữa các khung (không phóng to/thu nhỏ để "zoom").
- Động tác lao tới được dịch tối đa ±24 px theo chiều ngang, không được tràn khỏi khung.
- Mỗi nhân vật **1 file PNG**: mỗi hàng là 1 hoạt ảnh, mỗi cột là 1 khung, xếp từ trái sang phải. Ô thừa để trong suốt. Sheet rộng 6 cột × 192 = **1152 px**, cao 8 hàng × 192 = **1536 px**.
- Thứ tự hàng **cố định** như bảng dưới:

| Hàng | Tên | Số khung | fps | Lặp | Mô tả chung |
|---|---|---|---|---|---|
| 0 | `idle` | 6 | 8 | lặp | Thở/lơ lửng nhẹ, khung cuối nối mượt về khung đầu |
| 1 | `cast_start` | 4 | 12 | không | Bắt đầu niệm: gồng người, thu năng lượng |
| 2 | `cast_loop` | 4 | 10 | lặp | Giữ tư thế niệm, năng lượng rung/nhấp nháy (thời gian niệm thay đổi 0,4–1,5 s nên phải lặp được) |
| 3 | `release` | 6 | 14 | không | Phóng phép: động tác mạnh, dứt khoát hướng sang phải, 2 khung cuối thu về gần tư thế idle |
| 4 | `guard` | 4 | 12 | không, giữ khung cuối | Thủ thế/phản chú: co người, che chắn |
| 5 | `buff` | 5 | 10 | không | Phép hỗ trợ: ngẩng lên, toả sáng từ người |
| 6 | `hit` | 3 | 14 | không | Trúng đòn: giật ngửa ra sau (sang trái), nhăn mặt |
| 7 | `ko` | 6 | 10 | không, giữ khung cuối | Gục ngã: khung cuối nằm/rơi xuống đất |

## Động tác riêng cho từng nhân vật
1. **phoenix** – Phượng Hoàng Lửa. idle: vỗ cánh chậm, lửa đuôi bập bùng. cast: cánh khép trước ngực rồi bay vút lên, lửa cháy mạnh dần. release: bung cánh, lao chúi sang phải, toé lông lửa. guard: cánh bọc kín thân. buff: dang cánh ngẩng đầu, lửa vàng sáng. ko: lửa tắt dần, rơi xuống thành đống tro/lông.
2. **wyvern** – Wyvern Bão. idle: đập cánh, đuôi quất nhẹ. cast: cúp cánh, hạ thấp người, tia điện nhỏ chạy dọc thân. release: bổ nhào sang phải, há miệng, điện lóe ở miệng. guard: cánh che trước mặt. buff: ngửa cổ gầm lên trời. ko: cánh gãy gập, rơi xuống.
3. **kraken** – Kraken. idle: xúc tu uốn lượn như dưới nước. cast: xúc tu cuộn lên cao, có bong bóng nổi quanh người. release: dập mạnh xúc tu sang phải, nước bắn ra. guard: xúc tu đan lại thành tấm chắn trước thân. buff: xúc tu dang rộng, mắt sáng. ko: xúc tu rũ xuống, chìm/xẹp xuống đất.
4. **cerberus** – Chimera Tam Đầu (chó 3 đầu). idle: 3 đầu lắc lư lệch nhịp nhau, thở phì khói. cast: gồng người, 3 đầu gầm, lửa le lói trong miệng. release: lao cắn sang phải, lửa phụt ra từ 3 miệng. guard: chùng chân, hạ đầu thủ thế. buff: 3 đầu cùng hú lên trời. ko: khuỵu chân, nằm vật ra.
5. **vampire** – Bá Tước Ma Cà Rồng. idle: áo choàng phất nhẹ, mắt đỏ chớp. cast: giơ một tay lên, áo choàng tung ra, vài con dơi nhỏ bay quanh người. release: hất tay sang phải, áo choàng quét theo. guard: kéo áo choàng che mặt. buff: dang hai tay, hào quang đỏ tím. ko: tan dần thành đàn dơi/khói (khung cuối gần như biến mất, chỉ còn áo choàng rơi trên đất).
6. **banshee** – Banshee (hồn ma nữ). idle: lơ lửng lên xuống, tóc và váy phất phơ. cast: hai tay ôm đầu, tóc dựng ngược. release: há miệng thét sang phải, ngả người tới trước. guard: co người lại, tay che mặt. buff: ngửa mặt lên, toả sáng xanh nhạt. ko: tan biến thành khói mờ.

## Đầu ra
Cho mỗi nhân vật:
- `public/sprites/anim/<id>-sheet.png` (ví dụ `phoenix-sheet.png`) đúng kích thước 1152×1536.
- `public/sprites/anim/<id>.json` theo mẫu:

```json
{
  "id": "phoenix",
  "frame": { "w": 192, "h": 192 },
  "baseline": 180,
  "anims": {
    "idle":       { "row": 0, "frames": 6, "fps": 8,  "loop": true },
    "cast_start": { "row": 1, "frames": 4, "fps": 12, "loop": false },
    "cast_loop":  { "row": 2, "frames": 4, "fps": 10, "loop": true },
    "release":    { "row": 3, "frames": 6, "fps": 14, "loop": false },
    "guard":      { "row": 4, "frames": 4, "fps": 12, "loop": false, "hold": true },
    "buff":       { "row": 5, "frames": 5, "fps": 10, "loop": false },
    "hit":        { "row": 6, "frames": 3, "fps": 14, "loop": false },
    "ko":         { "row": 7, "frames": 6, "fps": 10, "loop": false, "hold": true }
  }
}
```

Nếu đổi số khung hay fps thì cập nhật JSON cho khớp (tối đa 6 khung mỗi hàng).

## Kiểm tra trước khi giao
- Làm 1 artifact xem trước: chọn nhân vật và hoạt ảnh, chạy đúng fps, nền ca-rô để thấy độ trong suốt, có vạch ngang ở y = 180 để kiểm tra đường đáy, có nút xem ở dạng lật ngang.
- Đảm bảo không có khung nào bị lệch đáy, nhảy kích thước hay tràn khỏi ô 192×192, và `idle` / `cast_loop` lặp mượt không giật.
- Làm **phoenix trước** cho mình duyệt phong cách, rồi mới làm 5 nhân vật còn lại.

---

## Lắp sheet vào game
1. Thả `<id>-sheet.png` và `<id>.json` vào `public/sprites/anim/` (`<id>` là `portrait` của sách trong `src/duel/data.js`, ví dụ `phoenix`).
2. Thêm `<id>` vào mảng `IDS` trong `src/duel/anim.js`.
3. Hàng thiếu thì ghi `"missing": true` trong JSON: game tự lấy hoạt ảnh gần giống (`power`/`guard`/`buff` → `release`). Có thể thêm hàng `power` (tụ lực) cho phép tấn công từ 5 ma lực.

Game chọn động tác như sau: đứng yên → `idle`; đang niệm → `cast_start` rồi lặp `cast_loop`; niệm xong phép tấn công → `release` (hoặc `power`), phép khiên/gương/né/rào chắn/xoá phép → `guard`, phép hỗ trợ khác → `buff`; trúng đòn → `hit`; hết máu → `ko`.

### Dàn nhân vật hiện tại
| Sách | Nhân vật (`hero`) |
|---|---|
| Thuỷ – Lôi | `fox` – cáo pháp sư sét |
| Hoả – Băng | `icewitch` – phù thuỷ băng |
| Sách Wyvern | `stag` – hươu pháp sư sét xanh |
| Sách Phượng Hoàng | `firemage` – pháp sư lửa |
| Sách Ma Cà Rồng | `crow` – quạ pháp sư bóng tối |
| Sách Chimera | chưa có, dùng ảnh tĩnh |

Gắn nhân vật cho sách bằng trường `hero` trong `src/duel/data.js`. Ngoài 8 hàng chuẩn, sheet có thể có thêm `summon` (gọi linh thú), `power` (phép tấn công từ 5 ma lực) và `aura` (khiên, rào chắn, xoá phép).
