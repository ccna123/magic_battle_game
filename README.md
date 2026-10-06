# Đấu Trường Phép Thuật

Game đấu bài một người chơi với máy, chạy trên trình duyệt. Lấy cảm hứng từ Yu-Gi-Oh, nhưng phép thuật là trung tâm, còn linh thú chỉ hỗ trợ:

- **Ma lực** tăng dần mỗi lượt. Linh thú trên sân tốn phí duy trì.
- **Linh thú khế ước** nằm ngoài bộ bài và gọi lại được sau khi bị hạ.
- **Kênh phép & tiến hoá:** linh thú cùng hệ làm phép mạnh hơn, nhận dấu ấn rồi tiến hoá.
- **Phản ứng nguyên tố:** Ướt + Sét = Giật lan, Đóng băng + Lửa = Hơi nước…
- **Thời tiết sân đấu** đổi mỗi 3 vòng, có dự báo trước.
- **Chuỗi phản chú** dạng stack giống Yu-Gi-Oh, trả ma lực khi kích hoạt.

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
| `npm run sim` | Cho máy tự đấu 60 ván và in thống kê cân bằng (`npm run sim -- 200` để chạy 200 ván, `npm run sim -- 100 all` để đấu vòng tròn mọi cặp bộ bài) |

Thư mục `dist/` sau khi build có thể đưa thẳng lên GitHub Pages, Netlify, Vercel hoặc itch.io (dạng HTML5).

## Cấu trúc thư mục

```
index.html              Khung trang (bàn đấu, cột bên phải)
src/
  main.js               Điểm khởi động
  config.js             Hằng số luật: sinh lực, số ô, ma lực tối đa, số dấu ấn để tiến hoá…
  styles.css            Toàn bộ giao diện
  data/
    cards.js            ★ Dữ liệu và hiệu ứng của mọi lá bài + 4 bộ bài khởi đầu
    weather.js          Danh sách thời tiết
    sprites.js          Danh sách sprite có trong public/sprites
  engine/
    core.js             Luật chơi: trạng thái, sát thương, phản ứng, chuỗi phản chú, lượt
    weather.js          Đổi thời tiết, cộng trừ sát thương theo thời tiết
    ai.js               Máy: chấm điểm từng hành động rồi chọn cái tốt nhất
  ui/
    render.js           Vẽ bàn đấu, lá bài, bảng pháp sư
    input.js            Xử lý chạm / chuột / bàn phím
    tutorial.js         Gợi ý hướng dẫn hiện theo tình huống
    library.js          Màn "Kho lá bài" (xem lá, đổi hình)
    art.js, state.js    Sprite theo lá, trạng thái giao diện
  fx/
    three-fx.js         Lớp hiệu ứng three.js: hạt, tia phép, flipbook, thời tiết
    card-fx.js          Hiệu ứng hình ảnh riêng của từng lá
    sprite.js           Sprite pixel tự sinh (dự phòng khi lá chưa có hình)
public/
  sprites/<id>.png      Hình từng lá (tên file = id lá)
  fx/<tên>.png          Dải hiệu ứng 8 khung (lửa, khiên, triệu hồi…)
  ui/                   Khung bài và mặt sau
tools/
  slice_sheet.py        Cắt sprite sheet nền magenta thành từng PNG
  sprite-prompts.html   304 prompt Gemini để tạo thêm sprite (mở bằng trình duyệt)
sim/simulate.js         Máy đấu máy để cân bằng
```

## Thêm một lá bài mới

Mở `src/data/cards.js` và thêm một mục vào `DB`. Ví dụ một bùa chú Sét gây 4 sát thương và làm Choáng:

```js
fulgur:{name:'Tia Sét Cầu',kind:'charm',el:'storm',cost:3,art:'fulgur',target:'enemy',cat:['DAMAGE'],
  text:'Gây 4 sát thương Sét và làm mục tiêu Choáng.',
  op(c, L){ hit(L.t, amt(L, 4), c, 'storm'); addSt(L.t, 'stun', c); }},
```

- `kind`: `charm` (bùa chú), `enchant` (phép duy trì), `counter` (phản chú), `creature` (linh thú)
- `el`: `fire`, `water`, `storm`, `ice`, `none`
- `target`: `enemy` (pháp sư hoặc linh thú địch), `enemyUnit`, `allyUnit`, `oppSpell`; bỏ trống nếu không cần chọn
- `amt(L, 4)` tự cộng thêm sức mạnh từ linh thú đang kênh phép
- `hit(mục tiêu, sát thương, nguồn, hệ)` tự xử lý phản ứng nguyên tố và thời tiết
- Linh thú dùng `atk`, `hp`, `guard`, `rush`, `multi`, `channel:{el, bonus}`, `evolve:'id'`, cùng các hook `onSummon`, `onDeath`, `onAttack`, `onEvolve`
- Phản chú dùng `cond(c, ctx)` để quyết định khi nào được đáp trả (ctx.type là `activate`, `summon` hoặc `attack`)

Sau đó thêm lá vào một bộ bài trong `DECKS` (cuối file), thêm hiệu ứng hình ảnh trong `src/fx/card-fx.js` nếu muốn, và nếu máy cần biết cách dùng lá này thì thêm một `case` trong `aiPlan` ở `src/engine/ai.js`.

## Thêm sprite

1. Tạo ảnh bằng prompt trong `tools/sprite-prompts.html` (nền magenta, lưới 4×4).
2. Cắt ảnh:
   ```bash
   pip install pillow numpy scipy
   python3 tools/slice_sheet.py dot-01.png --grid 4x4 --ids treant_sapling,oak_guardian,... --out public/sprites
   ```
3. Thêm id vào `src/data/sprites.js`. Lá có `art:'id'` sẽ tự dùng hình đó.

Trong game cũng có thể bấm **Kho lá bài → Đổi hình** để thay hình một lá ngay trên trình duyệt (lưu trong trình duyệt của bạn).

## Ghi chú

Tên phép lấy cảm hứng từ thế giới phù thuỷ quen thuộc chỉ dùng cho dự án cá nhân. Nếu phát hành công khai hoặc thương mại, nên đổi sang tên tự đặt.
