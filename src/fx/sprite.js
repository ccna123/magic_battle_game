/* ---------- Sprite: mỗi lá có 1 ảnh, tra theo id lá ----------
   Ưu tiên: ảnh bạn tải lên (ART) → sprite pixel tự sinh từ dữ liệu lá.
   Quái vật: khuôn nửa thân 8×16 + số ngẫu nhiên có seed theo id, lật gương thành 16×16.
   Phép: icon pixel 12×12 vẽ tay, tô theo bảng màu riêng từng lá. */
export const SPRITE = (() => {
  const TPL = {
    humanoid: ["........","......oo",".....oBB",".....BEB",".....oBB","......BB","....ooBB","...oBBBB","..o.oBBB","..o..BBB","..B..BBB","....oBBB",".....BB.",".....BB.","....oBB.","....BB.."],
    beast:    ["........","...o....","...Bo...","...BBoBB","....BBBB","...oBEBB","...oBBBB","....oBBB","..oBBBBB",".oBBBBBB",".BBBBBBB",".oBBBBBB","..BBoBBB","..BB..oB","..BB...o","..oo...."],
    winged:   ["........","o.......","Bo......","BBo....o","oBBo..BB",".oBBoBEB","..oBBBBB","...oBBBB","..oBBBBB",".oB.oBBB",".o...BBB",".....oBB","......BB",".....oB.",".....o..","........"],
    serpent:  ["........","....ooo.","...oBBBo","...BEBBB","...oBBBB","....oBBB","......BB","....oBBo","...oBBo.","...BBo..","...BBo..","...oBBo.","....oBBB","..o..oBB","..oBBBBB","...ooooo"]
  };
  const ICON = {
    fire:   [".....b......","....ba......","....aab.....","...baaa..b..","...aaaab.a..","..baacaa.aa.","..aacccaaaa.",".baaccccaab.",".aacc..ccaa.",".aaccbbccaa.","..aacbbcaa..","...aaaaaa..."],
    bolt:   [".......bbb..","......baa...",".....baa....","....baa.....","...baaaaab..","..baaaaaa...","......baa...",".....baa....","....baa.....","...baa......","..ba........","..a........."],
    shield: ["..cccccccc..",".cbbbbbbbbc.",".cbaaaaaabc.",".cbaaaaaabc.",".cbaabbaabc.",".cbaabbaabc.",".cbaaaaaabc.","..cbaaaabc..","..cbaaaabc..","...cbaabc...","....cbbc....",".....cc....."],
    heart:  ["............","..bb....bb..",".baab..baab.",".baaabbaaab.",".baaaaaaaab.",".baaaaaaaab.","..baaaaaab..","...baaaab...","....baab....",".....bb.....","............","............"],
    star:   [".....bb.....",".....aa.....",".....aa.....","..b..aa..b..","...baaaab...","bbaaaccaaabb","bbaaaccaaabb","...baaaab...","..b..aa..b..",".....aa.....",".....aa.....",".....bb....."],
    burst:  ["b....b....b.",".b...a...b..","..a..a..a...","...aaaaa....","b.aacccaa..b",".aacc.ccaab.",".aac...caa..","..acc.cca...","...aaaaa....","..a..a..a...",".b...a...b..","b....b....b."],
    magnet: [".cccc..cccc.",".caac..caac.",".caac..caac.",".caac..caac.",".caac..caac.",".caac..caac.",".caaccccaac.",".caaaaaaaac.","..caaaaaac..","...cccccc...",".bb......bb.","b..b....b..b"],
    feather:[".........bb.","........baa.",".......baab.","......baab..",".....baab...","....baab....","...baab.....","...aab......","..cab.......",".cc.........","cc..........","c..........."],
    swirl:  ["....aaaa....","..aa....a...",".a...bb..a..",".a..b..b..a.","a..b.aa.b.a.","a..b.a..b.a.","a..b..ab..a.",".a..bb...a..",".a......a...","..a...aa....","...aaa......","............"],
    vine:   ["..a......a..",".aba....aba.","..a.c..c.a..","....c..c....","...cc..cc...","..c..cc..c..","..c..cc..c..","...cc..cc...","....c..c....","..a.c..c.a..",".aba....aba.","..a......a.."],
    eye:    ["............","............","....cccc....","..cc.aa.cc..",".c..abba..c.","c..ab..ba..c","c..ab..ba..c",".c..abba..c.","..cc.aa.cc..","....cccc....","............","............"],
    mirror: ["...cccccc...","..cbbbbbbc..",".cbaaaabbbc.",".cbaaabbabc.",".cbaabbaaac.",".cbabbaaaac.",".cbbbaaaaac.","..cbaaaaac..","...cccccc...",".....cc.....","....cbbc....","...cccccc..."],
    wand:   ["..........bb",".........bab","........cbb.",".......cc...","......cc....",".....cc.....","....cc......","...cc.......","..cc........",".ac.........","aa..........","a..........."],
    drop:   [".....a......",".....a......","....aba.....","....aba.....","...abbba....","...abaaa....","..abaaaaa...","..abaaaaa...","..aaaaaaa...","..aaaaaca...","...aacca....","....aaa....."]
  };
  const OUT = '#090c0e';
  function rng(seed){ let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); h ||= 1;
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
  function paint(grid){ // grid: mảng màu hoặc null; tự thêm viền 1px
    const H = grid.length, W = grid[0].length, cv = document.createElement('canvas');
    cv.width = W + 2; cv.height = H + 2; const g = cv.getContext('2d');
    const at = (x, y) => (y >= 0 && y < H && x >= 0 && x < W) ? grid[y][x] : null;
    for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
      const c = at(x, y);
      if (c) { g.fillStyle = c; g.fillRect(x + 1, y + 1, 1, 1); }
      else if (at(x-1,y) || at(x+1,y) || at(x,y-1) || at(x,y+1)) { g.fillStyle = OUT; g.fillRect(x + 1, y + 1, 1, 1); }
    }
    return cv.toDataURL();
  }
  function creature(id, d){
    const r = rng(id), t = TPL[d.shape] || TPL.beast, [main, dark, light, eye] = d.pal;
    const cell = [...Array(16)].map(() => Array(16).fill(0));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      const ch = t[y][x]; const v = ch === 'B' ? 1 : ch === 'E' ? 2 : ch === 'o' ? (r() < .55 ? 1 : 0) : 0;
      cell[y][x] = v; cell[y][15 - x] = v;
    }
    const grid = cell.map((row, y) => row.map((v, x) => {
      if (!v) return null; if (v === 2) return eye;
      if (y === 0 || !cell[y-1][x]) return light;
      if (y > 11 || !cell[y][x-1] || !cell[y][x+1]) return dark;
      return r() < .12 ? light : main;
    }));
    return paint(grid);
  }
  function spell(d){
    const ic = ICON[d.icon] || ICON.star, [a, b, c] = d.pal, map = {a, b, c};
    return paint(ic.map(row => row.padEnd(12, '.').slice(0, 12).split('').map(ch => map[ch] || null)));
  }
  const cache = {};
  return {
    gen(id, d){ return cache[id] ||= (d.kind === 'creature' ? creature(id, d) : spell(d)); }
  };
})();
