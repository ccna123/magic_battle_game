/* Cho máy tự đấu với máy để cân bằng bộ bài.
   Chạy: npm run sim            (60 ván)
         npm run sim -- 200     (200 ván)
   Engine chạy thật, chỉ thay trình duyệt bằng một DOM giả tối giản. */

const N = +(process.argv[2] || 60);

// ---- DOM giả (đủ cho engine và giao diện chạy không lỗi) ----
const el = () => ({ innerHTML: '', textContent: '', hidden: true, value: '', className: '', style: {},
  addEventListener() {}, click() {}, remove() {}, appendChild() {}, setAttribute() {},
  getBoundingClientRect() { return { left: 0, top: 0, width: 1, height: 1 }; } });
const els = {};
globalThis.window = globalThis;
globalThis.document = { querySelector: s => els[s] || (els[s] = el()), addEventListener() {}, body: el(), baseURI: 'http://localhost/',
  createElement: () => ({ ...el(), getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:x' }) };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.matchMedia = () => ({ matches: true });
globalThis.requestAnimationFrame = () => 0;
const realTimeout = setTimeout;
globalThis.setTimeout = (f) => realTimeout(f, 0);   // bỏ thời gian chờ hoạt ảnh

const core = await import('../src/engine/core.js');

const stats = { games: 0, wins: [0, 0], turns: 0, reactions: {}, evolve: 0, weather: {} };
for (let i = 0; i < N; i++) {
  core.newGame();
  core.G.p[0].ai = true;            // cả hai bên đều là máy
  await core.startTurn();
  const G = core.G;
  stats.games++; stats.wins[G.winner]++; stats.turns += G.turnNo;
  for (const l of G.log) {
    const r = l.t.match(/Phản ứng <b>(.*?)<\/b>/); if (r) stats.reactions[r[1]] = (stats.reactions[r[1]] || 0) + 1;
    if (/tiến hoá thành/.test(l.t)) stats.evolve++;
    const w = l.t.match(/Thời tiết đổi: <b>(.*?)<\/b>/); if (w) stats.weather[w[1]] = (stats.weather[w[1]] || 0) + 1;
  }
}
console.log(`Số ván: ${stats.games}`);
console.log(`Thắng: Thuỷ – Lôi ${stats.wins[0]} · Hoả – Băng ${stats.wins[1]}`);
console.log(`Trung bình ${(stats.turns / stats.games).toFixed(1)} lượt/ván`);
console.log('Phản ứng nguyên tố:', stats.reactions);
console.log('Số lần tiến hoá:', stats.evolve);
console.log('Thời tiết đã xuất hiện:', stats.weather);
process.exit(0);
