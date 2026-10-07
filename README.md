# Đấu Trường Phép Thuật

Game đấu phép thời gian thực một người chơi với máy, chạy trên trình duyệt. Hiển thị kiểu game đối kháng: hai đấu sĩ trên sân khấu ngang, phép bay qua lại.

- **Không có lượt:** ma lực tự hồi liên tục. Lối chơi kiểu Asuka R♯: chọn phép mang vào sách, trong trận có 4 ô phép, niệm xong phải tự rút (rút 1, xem 3 chọn 1, thay cả tay).
- **Thời gian niệm:** đối thủ nhìn thấy vòng phép và tên phép bạn đang niệm, nên có thể dựng khiên, phản phép hoặc ngắt phép.
- **Thanh niệm dưới chân:** đang niệm thì nhân vật có thanh tiến độ, đối thủ cũng nhìn thấy.
- **Đấu Đũa:** hai phép sát thương va nhau giữa sân, ai bấm nhanh hơn thì đẩy được luồng phép về phía đối thủ.
- **Phản ứng nguyên tố** (Ướt + Sét = Giật lan, Đóng băng + Lửa = Hơi nước…) và **thời tiết** đổi mỗi 30 giây.
- **7 pháp sư, mỗi người 12 phép** (bắn thẳng, giáng từ trời, dưới đất, dang tay), mỗi phép có hoạt ảnh riêng; máy có 3 độ khó.

Luật chi tiết: [docs/LUAT-CHOI.md](docs/LUAT-CHOI.md) · Việc sắp làm: [docs/LO-TRINH.md](docs/LO-TRINH.md)

## Chạy game

Cần [Node.js](https://nodejs.org) 18 trở lên.

```bash
npm install
npm run dev        # mở http://localhost:5173
```

| Lệnh | Việc làm |
|---|---|
| `npm run dev` | Chạy bản phát triển, sửa code là trang tự tải lại |
| `npm run build` | Đóng gói vào `dist/`, mở được ở bất kỳ web tĩnh nào |
| `npm run preview` | Xem thử bản đã build |

Thư mục `dist/` sau khi build có thể đưa thẳng lên GitHub Pages, Netlify, Vercel hoặc itch.io (dạng HTML5).

## Cấu trúc thư mục

```
index.html              Khung trang: HUD, sân khấu, canvas phép, tay 4 lá
src/
  duel/
    duel.js             Vòng lặp thời gian thực, niệm → tư thế → phép, sát thương/phản ứng, máy (AI), giao diện, điều khiển
    mages.js            Nạp gói pháp sư, đổi dữ liệu phép trong game-data.json thành phép của trận
    spellfx.js          Vẽ phép từ sheet phép lên canvas (đạn bay, giáng từ trời, tia, tường, quái triệu hồi…)
    anim.js             Chạy sprite sheet nhân vật (idle, niệm, các tư thế phóng phép, trúng đòn, gục)
    data.js             Luật trận, thời tiết, độ khó
    duel.css, base.css  Giao diện
    config.js           Hệ nguyên tố (tên, màu)
  fx/three-fx.js        Lớp hiệu ứng three.js: hạt, flipbook, rung màn hình, hạt thời tiết
public/
  mage/                 ★ Gói pháp sư: game-data.json, anim/<id>-sheet.png + .json, spells/<id>-spells.png + .json, summons/
  fx/<tên>.png          Dải hiệu ứng 8 khung dùng chung (khiên, ngắt phép…)
  ui/                   Khung lá phép
docs/mage-anim/CLAUDE.md  Định dạng gói pháp sư (khung, hàng hoạt ảnh, thông số phép)
```

## Sửa hoặc thêm phép

Chỉ số phép (tên, sát thương, số nhịp, ma lực, thời gian niệm, hiệu ứng) nằm trong `public/mage/game-data.json`, hình phép trong `public/mage/spells/<id>-spells.png` + `.json`.
`src/duel/mages.js` đọc câu hiệu ứng (`effect`) để ra cơ chế: Cháy, Choáng, Làm chậm, Ướt, Đóng băng, Trói chân, Hút máu, Mù, Hất tung, Đánh dấu con mồi, giáp, tường chặn đạn, Hoả Thân, Lôi Tốc…
Thêm nhân vật mới: thêm vào `game-data.json` và thả sheet nhân vật + sheet phép đúng định dạng trong `docs/mage-anim/CLAUDE.md`.
