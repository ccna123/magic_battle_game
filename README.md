# Đấu Trường Phép Thuật

Game đấu phép thời gian thực một người chơi với máy, chạy trên trình duyệt. Hiển thị kiểu game đối kháng: hai đấu sĩ trên sân khấu ngang, phép bay qua lại.

- **Không có lượt:** ma lực tự hồi liên tục. Lối chơi kiểu Asuka R♯: chọn phép mang vào sách, trong trận có 4 ô phép, niệm xong phải tự rút (rút 1, xem 3 chọn 1, thay cả tay).
- **Thời gian niệm:** đối thủ nhìn thấy vòng phép và tên phép bạn đang niệm, nên có thể dựng khiên, phản phép hoặc ngắt phép.
- **Niệm chuẩn:** bấm đúng vạch vàng trên thanh niệm để phép mạnh hơn.
- **Đấu Đũa:** hai phép sát thương va nhau giữa sân, ai bấm nhanh hơn thì đẩy được luồng phép về phía đối thủ.
- **Phản ứng nguyên tố** (Ướt + Sét = Giật lan, Đóng băng + Lửa = Hơi nước…) và **thời tiết** đổi mỗi 30 giây.
- **6 sách phép:** Thuỷ – Lôi, Hoả – Băng, Chimera, Wyvern, Phượng Hoàng, Ma Cà Rồng; máy có 3 độ khó.

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
index.html              Khung trang: HUD, sân khấu, thanh niệm, tay 4 lá
src/
  duel/
    data.js             ★ Dữ liệu phép, sách phép, thời tiết, độ khó, hằng số luật
    duel.js             Vòng lặp thời gian thực, sát thương/phản ứng, máy (AI), giao diện, điều khiển
    duel.css            Giao diện màn đấu (HUD, sân khấu, đấu sĩ, hình phép, Đấu Đũa)
    base.css            Nền dùng chung: màu, nút, khung lá phép, chip trạng thái
    art.js, sprites.js  Sinh class .art-<tên> cho từng sprite trong public/sprites
    config.js           Hệ nguyên tố (tên, màu)
  fx/three-fx.js        Lớp hiệu ứng three.js: hạt, flipbook, rung màn hình, hạt thời tiết
public/
  sprites/<tên>.png     Hình linh thú và phép
  fx/<tên>.png          Dải hiệu ứng 8 khung (lửa, sét, khiên, gương, triệu hồi…)
  ui/                   Khung lá phép
tools/
  slice_sheet.py        Cắt sprite sheet nền magenta thành từng PNG
  sprite-prompts.html   Prompt Gemini để tạo thêm sprite (mở bằng trình duyệt)
```

## Thêm một phép mới

Thêm vào một sách trong `BOOKS` ở `src/duel/data.js`. Ví dụ phép Sét gây 4 sát thương và ngắt phép:

```js
XYZ:{name:'Tia Sét Cầu', type:'atk', art:'fulmen', cost:3, cast:.8, cd:9, el:'storm', dmg:4, interrupt:true,
  text:'4 sát thương Sét. Trúng lúc đối thủ đang niệm thì ngắt phép.'},
```

- `type`: `atk` (tấn công), `counter` (phản chú), `support` (hỗ trợ) · `cost` ma lực · `cast` giây niệm
- `el`: `fire`, `water`, `storm`, `ice`, `earth`, `light`, `dark`, `mind`
- Phép lên đối thủ: `dmg`, `wet`, `burn`, `freeze`, `stun`, `interrupt`, `drain`, `curse`, `weaken`, `slow`, `manaBurn`, `manaSteal`, `travel`, `volley`
- Phép lên bản thân (`self:true`): `shield`, `mirror`, `evade`, `nullify`, `barrier`, `heal`, `regen`, `haste`, `cleanse`, `rebirth`, `manaGain`, `weather`, `pet`
- Ghi chú đầy đủ từng trường nằm ở đầu phần sách phép trong `data.js`. Máy tự dùng phép mới theo loại, không cần viết thêm AI.

## Thêm sprite

1. Tạo ảnh bằng prompt trong `tools/sprite-prompts.html` (nền magenta, lưới 4×4).
2. Cắt ảnh:
   ```bash
   pip install pillow numpy scipy
   python3 tools/slice_sheet.py dot-01.png --grid 4x4 --ids ten_1,ten_2,... --out public/sprites
   ```
3. Thêm tên vào `src/duel/sprites.js`, rồi dùng `art:'ten'` trong dữ liệu phép.

## Ghi chú

Tên phép lấy cảm hứng từ thế giới phù thuỷ quen thuộc chỉ dùng cho dự án cá nhân. Nếu phát hành công khai hoặc thương mại, nên đổi sang tên tự đặt.
