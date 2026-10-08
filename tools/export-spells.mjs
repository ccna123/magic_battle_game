// Xuất dữ liệu phép đã chuyển đổi (src/duel/mages.js) ra JSON có trường rõ ràng, để dùng khi chuyển sang Godot.
// Chạy: node tools/export-spells.mjs   →   ghi godot-export/spells.json
// mages.js chạy trên trình duyệt (fetch + Image), ở đây giả lập bằng đọc file trong public/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { DIFF, DUEL_WEATHER, RULES } from '../src/duel/data.js';

const PUB = new URL('../public', import.meta.url).pathname;
globalThis.fetch = async url => ({ json: async () => JSON.parse(readFileSync(PUB + url, 'utf8')) });
// Image: chỉ cần width/height (đọc từ header PNG)
globalThis.Image = class { set src(url){ const b = readFileSync(PUB + url); this.width = b.readUInt32BE(16); this.height = b.readUInt32BE(20); queueMicrotask(() => this.onload()); } };

const { MAGES, loadMages } = await import('../src/duel/mages.js');
await loadMages();

// Trường chơi (không lấy phần hình) theo thứ tự dễ đọc
const PLAY = ['name', 'type', 'kind', 'el', 'level', 'cost', 'cast', 'dmg', 'hits', 'self', 'text',
  'burn', 'stun', 'stunLast', 'slow', 'root', 'wet', 'freeze', 'interrupt', 'drainHp', 'selfHeal', 'lifePerHit', 'blind', 'dispel', 'armorOnHit',
  'launch', 'pierce', 'armorBreak', 'mark', 'vuln', 'crit', 'pctHp', 'execute', 'smite', 'early', 'healCut', 'confuse', 'sleep', 'random',
  'heal', 'regenHeal', 'barrier', 'guard', 'wall', 'mirror', 'thorns', 'immune', 'revive', 'rewind', 'empower', 'haste', 'encore', 'cleanse'];
// Bỏ phần mô tả dành cho AI vẽ hình và các trường trùng với phần chơi
const DROP_META = new Set(['vis', 'guide', 'pose_txt', 'how', 'name', 'effect', 'key', 'dmg', 'hits', 'heal', 'mana', 'cast', 'level', 'type', 'pose', 'release']);

const characters = {};
for (const M of Object.values(MAGES)) {
  const spells = {};
  for (const sp of Object.values(M.spells)) {
    const o = {};
    for (const k of PLAY) if (sp[k] !== undefined && sp[k] !== false) o[k] = sp[k];
    o.copies = sp.level >= 3 ? 1 : 2;                                   // số bản trong sách
    o.anim = {pose:sp.pose, release:sp.v2 ? sp.release : 2, poseFps:sp.v2 ? sp.poseFps : 14};
    o.visual = Object.fromEntries(Object.entries(sp.meta || {}).filter(([k]) => !DROP_META.has(k)));
    spells[sp.key] = o;
  }
  characters[M.id] = {name:M.name, format:M.v2 ? 2 : 1, el:M.el, tip:M.tip, hand:M.hand, head:M.head,
    sheet:`anim/${M.id}-sheet.png`, anim:`anim/${M.id}.json`, spellSheet:`spells/${M.id}-spells.png`, spellRows:M.spellRows,
    defaultLoadout:Object.values(M.spells).filter(s => Object.keys(M.spells).length <= RULES.LOADOUT_MAX || s.level <= 2).slice(0, RULES.LOADOUT_MAX).map(s => s.key),
    spells};
}

const out = {
  version:1,
  note:'Sinh từ src/duel/mages.js bằng tools/export-spells.mjs. Ý nghĩa từng trường: CLAUDE.md mục 4 (hiệu ứng), mục 5 (cách tính đòn), docs/mage-anim/CLAUDE.md (visual).',
  rules:RULES, weather:DUEL_WEATHER, difficulty:DIFF,
  reactions:[
    {spell:'storm', target:'wet', mul:1.3, consume:'wet', name:'Giật lan'},
    {spell:'fire', target:'wet', mul:0.7, consume:'wet', noBurn:true, name:'Dập lửa'},
    {spell:'fire', target:'frozen', mul:1.5, consume:'frozen', name:'Hơi nước'},
    {spell:'ice', target:'burn', mul:1.2, consume:'burn', name:'Tan chảy'},
  ],
  characters,
};
mkdirSync(new URL('../godot-export', import.meta.url).pathname, {recursive:true});
const file = new URL('../godot-export/spells.json', import.meta.url).pathname;
writeFileSync(file, JSON.stringify(out, null, 1));
console.log('Đã ghi', file, '·', Object.keys(characters).length, 'nhân vật ·', Object.values(characters).reduce((n, c) => n + Object.keys(c.spells).length, 0), 'phép');
