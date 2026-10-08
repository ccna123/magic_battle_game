# Prompt: thêm hoạt ảnh di chuyển cho 14 nhân vật

Dán toàn bộ phần dưới vào session tạo sprite. Session đó đã có gói `mage-anim` (14 nhân vật, sheet `anim/<id>-sheet.png` + `anim/<id>.json`).

---

Game đấu phép trong gói `mage-anim` sắp chuyển sang lối chơi **nhịp nhanh kiểu game đối kháng**: hai nhân vật **tự di chuyển** trên sân (áp sát, giữ khoảng cách, lùi lại, nhảy lùi né đạn), bị đẩy lùi / kéo / hất tung thật sự. Người chơi chỉ chọn chiêu.
Hiện sheet nhân vật chỉ có đứng yên, gồng phép, trúng đòn, gục và các tư thế ra chiêu, **chưa có hoạt ảnh di chuyển**. Hãy vẽ thêm cho **cả 14 nhân vật**.

## Hàng cần thêm (theo đúng thứ tự, nối vào DƯỚI CÙNG của sheet hiện có)

| Tên | Số khung | fps | Lặp | Mô tả |
|---|---|---|---|---|
| `walk` | 6 | 10 | lặp | Đi **tới** (về phía phải, về phía đối thủ) với tư thế sẵn sàng chiến đấu, không phải đi dạo. Chu kỳ bước nối mượt khung cuối về khung đầu |
| `walk_back` | 6 | 10 | lặp | Đi **lùi** (về phía trái) nhưng **vẫn quay mặt sang phải**, người hơi ngả ra sau, cảnh giác. Không vẽ quay lưng |
| `dash` | 4 | 14 | không | Lướt nhanh tới: khung 0 nhún người, khung 1–2 người đổ hẳn về trước (áo choàng / tóc / đuôi bay ra sau), khung 3 hãm lại |
| `backstep` | 5 | 14 | không | Nhảy lùi né đòn: khung 0 nhún, khung 1–3 bật lùi lên không (chân rời đất, co người), khung 4 tiếp đất hơi khuỵu |
| `launched` | 4 | 12 | lặp 1–3 | Bị hất tung trên không: khung 0 bật ngửa ra sau, khung 1–3 lộn / chới với giữa không trung (game giữ lặp các khung này tới khi rơi xuống) |

## Quy định bắt buộc (giữ đúng định dạng gói)
- Khung **192×192**, nền trong suốt, nhân vật **quay mặt sang phải**, **cùng tỉ lệ, bảng màu, nét vẽ, trang phục** với các hàng sẵn có của chính nhân vật đó (so với hàng `idle`). Không thay đổi thiết kế nhân vật.
- **Vẽ tại chỗ:** nhân vật **không tự trượt ngang** trong khung, tâm thân người giữ quanh x ≈ 96 (game tự dịch chuyển nhân vật). Lệch ngang tối đa ±12 px chỉ để thể hiện dáng đổ người.
- **Đường đáy y = 180**: chân chạm y = 180 ở mọi khung đứng đất (`walk`, `walk_back`, `dash`, khung 0 và 4 của `backstep`).
  Khung trên không (`backstep` 1–3, `launched`) vẽ **ngay trong ô**, điểm thấp nhất cao hơn đường đáy 10–40 px; game tự nâng nhân vật lên theo độ cao thật.
- **Không vẽ** bụi chân, vệt tốc độ, bóng đổ, hiệu ứng phép (game tự vẽ). Được giữ ánh sáng nhỏ vốn có trên người (lửa tóc của Hoả Pháp Sư, tia điện của Hồ Ly...).
- **Không sửa / xoá / dời** bất kỳ hàng cũ nào. Chỉ nối thêm hàng mới xuống dưới:
  - v1 (`pyro, storm_fox, tide, frost, terra, raven`): sheet 11 hàng → hàng mới là **11–15**, sheet mới 1152 × 3072.
  - v2 (`pharaoh, swordsman, tarot, mech, priest, chrono, monk, bard`): sheet 12 hàng → hàng mới là **12–16**, sheet mới 1152 × 3264.
- Cột 6 khung như cũ (ô thừa để trống trong suốt).

## Cập nhật `anim/<id>.json`
Thêm vào `anims` (giữ nguyên các mục cũ), `row` đúng theo sheet:

```json
"walk":      { "row": 11, "frames": 6, "fps": 10, "loop": true },
"walk_back": { "row": 12, "frames": 6, "fps": 10, "loop": true },
"dash":      { "row": 13, "frames": 4, "fps": 14, "loop": false },
"backstep":  { "row": 14, "frames": 5, "fps": 14, "loop": false, "air": [1, 3] },
"launched":  { "row": 15, "frames": 4, "fps": 12, "loop": false, "loopFrom": 1 }
```
(v2 cộng thêm 1 vào mỗi `row`: 12–16.) `air` = các khung nhân vật ở trên không; `loopFrom` = khung bắt đầu lặp khi còn ở trên không.
Nếu một hàng thực tế ít khung hơn, ghi đúng `frames`.

## Dáng di chuyển riêng từng nhân vật
1. **pyro** – Hoả Pháp Sư Ignar: bước dứt khoát, vạt áo choàng đỏ phất, tóc lửa bập bùng theo nhịp; `dash` lao người như ngọn lửa liếm tới.
2. **storm_fox** – Hồ Ly Lôi Sư Kiora: bước nhẹ nhanh như cáo, đuôi to vẫy theo nhịp; `backstep` bật lùi rất cao, đuôi cong.
3. **tide** – Thuỷ Tộc Nerei: bước uyển chuyển như lướt sóng, tóc dài và vây đung đưa; `dash` trườn tới mềm mại.
4. **frost** – Băng Nữ Sylvi: bước nhỏ thanh, giữ mũ nhọn, vạt áo dài lướt; `backstep` nhẹ như bông tuyết.
5. **terra** – Thạch Đạo Sĩ Borrun: bước nặng, chậm, chắc, người hơi khom; `dash` như tảng đá lăn tới; `backstep` thấp, ít bay.
6. **raven** – Quạ Hắc Thuật Corvin: bước lắc nhẹ kiểu chim, lông cổ xù; `backstep` hơi vỗ vạt áo như cánh.
7. **pharaoh** – Tư Tế Sa Mạc Sethi: bước trang nghiêm, thẳng lưng, khăn sọc phất; `dash` lướt thẳng như cát cuốn.
8. **swordsman** – Kiếm Khách Lãng Du: bộ pháp võ hiệp, thấp người, tay giữ chuôi kiếm; `dash` cực nhanh, nón lá nghiêng; `backstep` nhảy lộn nhẹ nhàng.
9. **tarot** – Bài Sư Selene: bước bí ẩn, gần như lướt, lá bài lơ lửng quanh người lắc theo; `backstep` mờ ảo.
10. **mech** – Thợ Máy Gearwin: bước nhanh hơi vụng, đồ nghề trên lưng lắc lư; `dash` có tay chống trước như sắp ngã.
11. **priest** – Linh Mục Aurelius: bước từ tốn, áo lễ dài lay nhẹ, mũ cao giữ thẳng; `backstep` ngắn, giữ thăng bằng.
12. **chrono** – Thời Gian Sư Kairos: ông lão bước chậm, tay chắp sau lưng (hoặc giữ đạo cụ sẵn có trong idle), râu dài đung đưa; `dash` như "nhảy cóc thời gian" (người nghiêng mạnh rồi đứng lại).
13. **monk** – Võ Tăng Huyền Không: bộ pháp Thiếu Lâm, tấn thấp, tay thủ thế; `dash` xông tới như trâu húc; `backstep` lộn nhào gọn.
14. **bard** – Thi Sĩ Lyra: bước nhún nhảy vui vẻ theo nhịp, mũ nồi và lông vũ đung đưa, ôm đàn; `backstep` xoay nửa vòng điệu đà.

## Kiểm tra trước khi giao
- Làm 1 artifact xem trước: chọn nhân vật + hoạt ảnh, chạy đúng fps, nền ca-rô, **vạch ngang y = 180**, có nút lật ngang,
  và một chế độ "chạy thử": cho nhân vật thật sự dịch chuyển qua lại trên vạch (walk tới, walk_back lùi, dash, backstep) để xem chân có trượt không.
- Đặt cạnh hàng `idle` để so tỉ lệ: đầu, thân, chân không được to / nhỏ hơn.
- `walk`, `walk_back` lặp mượt; chân không "trượt băng" khi game dịch chuyển khoảng 120–160 px/giây ở cỡ khung gốc.
- Làm **1 nhân vật v1 (`pyro`) và 1 nhân vật v2 (`monk`) trước** cho mình duyệt, rồi mới làm 12 nhân vật còn lại.

## Đầu ra
- `anim/<id>-sheet.png` (đã nối hàng mới) và `anim/<id>.json` (đã thêm mục) cho cả 14 nhân vật, đóng gói lại `mage-anim` như cũ.
- Cập nhật `CLAUDE.md` của gói: thêm 5 hoạt ảnh mới vào phần "Hoạt ảnh nhân vật" của cả v1 và v2.
