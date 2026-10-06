import { $, MAXF } from '../config.js';
import { G, P, addSt, amt, atk, destroySpell, drawCard, enemies, enemyUnits, evolve, heal, hero, hit, kill, log, onField, opp, spawnToken, toHand } from '../engine/core.js';
import { changeWeather } from '../engine/weather.js';
import { FX } from '../fx/three-fx.js';

/* ---------- Dữ liệu lá bài ----------
   Linh thú: cost, atk, hp, guard (hộ vệ), direct (được tấn công trực tiếp dù đối thủ còn linh thú), channel {el, bonus} (kênh phép), evolve (tiến hoá khi đủ 3 dấu ấn)
   Phép: cost, el, target ('enemy' | 'enemyUnit' | 'allyUnit' | 'oppSpell'), op(c, L) */
export const DB = {
  // ===== Linh thú Thuỷ – Lôi =====
  pixie:{name:'Tiên Sấm',kind:'creature',el:'storm',cost:1,atk:1,hp:2,art:'pixie',channel:{el:'storm',bonus:1},
    text:'Kênh Sét: phép Sét của bạn +1 sát thương.'},
  merfolk:{name:'Nhân Ngư',kind:'creature',el:'water',cost:2,atk:2,hp:3,art:'merfolk',channel:{el:'water',bonus:1},evolve:'kraken',
    text:'Kênh Nước: phép Nước của bạn +1 sát thương. Đủ 2 dấu ấn: tiến hoá thành Kraken Hồ Sâu.'},
  kraken:{name:'Kraken Hồ Sâu',kind:'creature',el:'water',cost:6,atk:5,hp:6,art:'kraken',channel:{el:'water',bonus:2},noDeck:true,
    text:'Chỉ có qua tiến hoá. Kênh Nước +2. Khi tiến hoá: mọi kẻ địch bị Ướt.',
    onEvolve(c){ for (const e of enemies(c.owner)) addSt(e, 'wet', c); }},
  owl:{name:'Cú Đưa Thư',kind:'creature',el:'none',cost:2,atk:1,hp:2,art:'owl',text:'Khi triệu hồi: rút 1 lá.',onSummon(c){ drawCard(c.owner); }},
  golem:{name:'Golem Mực',kind:'creature',el:'water',cost:3,atk:1,hp:6,art:'golem',guard:true,text:'Hộ vệ: đối thủ phải tấn công lá này trước.'},
  unicorn:{name:'Kỳ Lân Bạc',kind:'creature',el:'none',cost:4,atk:3,hp:4,art:'unicorn',text:'Khi triệu hồi: hồi 3 sinh lực.',onSummon(c){ heal(c.owner, 3); }},
  centaur:{name:'Nhân Mã Xạ Thủ',kind:'creature',el:'none',cost:3,atk:3,hp:2,art:'centaur',text:'Khi triệu hồi: bắn 1 sát thương vào pháp sư đối thủ.',
    onSummon(c){ FX.bolt(c, FX.lp(opp(c.owner)), {color:[1,.85,.5], size:10, dur:.3}); hit(hero(opp(c.owner)), 1, c, 'none'); }},
  wyvern:{name:'Wyvern Bão',kind:'creature',el:'storm',cost:4,atk:3,hp:4,art:'wyvern',channel:{el:'storm',bonus:1},bond:true,
    text:'Khế ước. Kênh Sét +1. Khi tấn công: mục tiêu bị Ướt trước khi chịu đòn.',onAttack(c, t){ addSt(t, 'wet', c); }},

  // ===== Linh thú Hoả – Băng =====
  gnome:{name:'Gnome Vườn',kind:'creature',el:'none',cost:1,atk:1,hp:2,art:'gnome',text:'Linh thú thường.'},
  spider:{name:'Nhện Khổng Lồ',kind:'creature',el:'none',cost:2,atk:2,hp:2,art:'spider',text:'Linh thú thường.'},
  ghost:{name:'Bóng Ma Hầm Ngục',kind:'creature',el:'ice',cost:2,atk:1,hp:3,art:'ghost',channel:{el:'ice',bonus:1},evolve:'banshee',
    text:'Kênh Băng: phép Băng +1 sát thương. Đủ 2 dấu ấn: tiến hoá thành Nữ Thần Than Khóc.'},
  banshee:{name:'Nữ Thần Than Khóc',kind:'creature',el:'ice',cost:5,atk:4,hp:5,art:'banshee',channel:{el:'ice',bonus:1},noDeck:true,
    text:'Chỉ có qua tiến hoá. Kênh Băng +1. Khi tiến hoá: Đóng băng mọi linh thú địch.',
    onEvolve(c){ for (const e of enemyUnits(c.owner)) addSt(e, 'frozen', c); }},
  werewolf:{name:'Người Sói',kind:'creature',el:'none',cost:3,atk:3,hp:3,art:'werewolf',text:'Khi bị hạ: rút 1 lá.',onDeath(c){ drawCard(c.owner); }},
  hippogriff:{name:'Hippogriff',kind:'creature',el:'none',cost:3,atk:3,hp:2,art:'hippogriff',rush:true,text:'Xung phong: tấn công được ngay lượt triệu hồi.'},
  troll:{name:'Troll Núi',kind:'creature',el:'none',cost:4,atk:3,hp:6,art:'troll',guard:true,text:'Hộ vệ: đối thủ phải tấn công lá này trước.'},
  cerberus:{name:'Chó Ba Đầu',kind:'creature',el:'fire',cost:5,atk:3,hp:5,art:'cerberus',multi:2,channel:{el:'fire',bonus:1},
    text:'Kênh Lửa +1. Tấn công được 2 lần mỗi lượt.'},
  phoenix:{name:'Phượng Hoàng Lửa',kind:'creature',el:'fire',cost:5,atk:4,hp:4,art:'phoenix',channel:{el:'fire',bonus:1},bond:true,
    text:'Khế ước. Kênh Lửa +1. Khi bị hạ: mọi kẻ địch bị Cháy.',onDeath(c){ for (const e of enemies(c.owner)) addSt(e, 'burn', c); }},

  // ===== Token =====
  birdtoken:{name:'Chim Phép',kind:'creature',el:'none',cost:0,atk:1,hp:1,art:'birdtoken',token:true,ttl:2,noDeck:true,text:'Token. Tan sau 2 lượt, không tốn phí duy trì.'},
  stag:{name:'Linh Hươu',kind:'creature',el:'none',cost:0,atk:3,hp:5,art:'expecto',token:true,ttl:3,guard:true,noDeck:true,text:'Token Hộ vệ. Tan sau 3 lượt, không tốn phí duy trì.'},

  // ===== Phép Thuỷ – Lôi =====
  aguamenti:{name:'Aguamenti',kind:'charm',el:'water',cost:1,art:'aguamenti',target:'enemy',cat:['DAMAGE'],
    text:'Gây 1 sát thương Nước lên 1 kẻ địch (linh thú hoặc pháp sư) và làm nó Ướt.',op(c, L){ hit(L.t, amt(L, 1), c, 'water'); addSt(L.t, 'wet', c); }},
  unda:{name:'Sóng Triều',kind:'charm',el:'water',cost:3,art:'aguamenti',cat:['DAMAGE'],
    text:'Mọi kẻ địch bị Ướt. Gây 1 sát thương Nước lên mỗi linh thú địch.',
    op(c, L){ for (const e of enemies(c.owner)) addSt(e, 'wet', c); for (const u of [...enemyUnits(c.owner)]) hit(u, amt(L, 1), c, 'water'); }},
  fulmen:{name:'Fulmen',kind:'charm',el:'storm',cost:2,art:'fulmen',target:'enemy',cat:['DAMAGE'],
    text:'Gây 3 sát thương Sét lên 1 kẻ địch (linh thú hoặc pháp sư).',op(c, L){ hit(L.t, amt(L, 3), c, 'storm'); }},
  stupefy:{name:'Stupefy',kind:'charm',el:'storm',cost:2,art:'stupefy',target:'enemyUnit',cat:['DAMAGE'],
    text:'Gây 2 sát thương Sét lên 1 linh thú và làm nó Choáng (không tấn công lượt tới).',op(c, L){ hit(L.t, amt(L, 2), c, 'storm'); addSt(L.t, 'stun', c); }},
  tempestas:{name:'Mưa Giông',kind:'charm',el:'storm',cost:5,art:'reducto',legend:true,cat:['DAMAGE'],
    text:'Huyền thoại. Gây 2 sát thương Sét lên mọi kẻ địch.',op(c, L){ for (const e of [...enemies(c.owner)]) hit(e, amt(L, 2), c, 'storm', {noChain:true}); }},
  expecto:{name:'Expecto Patronum',kind:'charm',el:'none',cost:6,art:'expecto',legend:true,
    text:'Huyền thoại. Gọi Linh Hươu (3/5, Hộ vệ, tan sau 3 lượt) và hồi 3 sinh lực.',
    cond:c => P(c.owner).fam.length < MAXF, op(c){ spawnToken('stag', c.owner); heal(c.owner, 3); }},
  avis:{name:'Avis',kind:'charm',el:'none',cost:2,art:'avis',text:'Gọi 2 Chim Phép (1/1, tan sau 2 lượt).',
    cond:c => P(c.owner).fam.length < MAXF, op(c){ spawnToken('birdtoken', c.owner); spawnToken('birdtoken', c.owner); }},
  fiantoduri:{name:'Fianto Duri',kind:'enchant',el:'none',cost:3,art:'fiantoduri',ward:true,
    text:'Duy trì: pháp sư của bạn nhận ít hơn 1 sát thương mỗi lần.',op(){ log('Lớp giáp phép bao quanh pháp sư'); }},
  speculum:{name:'Speculum Reverto',kind:'counter',el:'water',cost:3,art:'speculum',
    text:'Phản chú (3 ma lực): khi đối thủ dùng bùa chú gây sát thương, vô hiệu nó và gây 3 sát thương cho họ.',
    cond:(c, x) => x.type === 'activate' && x.link.player !== c.owner && x.link.card.d.kind === 'charm' && (x.link.card.d.cat || []).includes('DAMAGE'),
    op(c, L){ L.ctx.link.negated = true; hit(hero(opp(c.owner)), 3, c, 'none'); }},

  // ===== Phép Hoả – Băng =====
  incendio:{name:'Incendio',kind:'charm',el:'fire',cost:2,art:'incendio',target:'enemy',cat:['DAMAGE'],
    text:'Gây 2 sát thương Lửa lên 1 kẻ địch (linh thú hoặc pháp sư) và làm nó Cháy (1 sát thương đầu lượt, 2 lượt).',op(c, L){ const r = hit(L.t, amt(L, 2), c, 'fire'); if (!r.noBurn) addSt(L.t, 'burn', c); }},
  confringo:{name:'Confringo',kind:'charm',el:'fire',cost:4,art:'confringo',target:'enemyUnit',cat:['DAMAGE'],
    text:'Gây 5 sát thương Lửa lên 1 linh thú.',op(c, L){ hit(L.t, amt(L, 5), c, 'fire'); }},
  ignis:{name:'Ignis Serpens',kind:'charm',el:'fire',cost:5,art:'ignis',legend:true,cat:['DAMAGE'],
    text:'Huyền thoại. Gây 2 sát thương Lửa lên mọi kẻ địch và làm chúng Cháy.',
    op(c, L){ for (const e of [...enemies(c.owner)]) { const r = hit(e, amt(L, 2), c, 'fire'); if (!r.noBurn) addSt(e, 'burn', c); } }},
  bombarda:{name:'Bombarda',kind:'charm',el:'fire',cost:3,art:'bombarda',target:'oppSpell',cat:['DAMAGE'],
    text:'Phá huỷ 1 lá phép của đối thủ (kể cả lá úp) và gây 1 sát thương Lửa lên pháp sư đối thủ.',
    op(c, L){ if (onField(L.t)) destroySpell(L.t); hit(hero(opp(c.owner)), amt(L, 1), c, 'fire'); }},
  glacius:{name:'Glacius',kind:'charm',el:'ice',cost:2,art:'finite',target:'enemy',cat:['DAMAGE'],
    text:'Gây 1 sát thương Băng và Đóng băng mục tiêu (linh thú không tấn công được, pháp sư mất 1 ma lực lượt tới).',
    op(c, L){ hit(L.t, amt(L, 1), c, 'ice'); addSt(L.t, 'frozen', c); }},
  petrificus:{name:'Petrificus Totalus',kind:'counter',el:'ice',cost:2,art:'petrificus',
    text:'Phản chú (2 ma lực): khi đối thủ triệu hồi linh thú, Đóng băng nó.',
    cond:(c, x) => x.type === 'summon' && x.card.owner !== c.owner, op(c, L){ if (onField(L.ctx.card)) addSt(L.ctx.card, 'frozen', c); }},
  vincula:{name:'Vincula Radicis',kind:'enchant',el:'none',cost:3,art:'vincula',aura:(src, m) => m.owner !== src.owner ? -1 : 0,
    text:'Duy trì: mọi linh thú của đối thủ −1 công.',op(){ log('Rễ cây trói chân linh thú đối thủ'); }},
  engorgio:{name:'Engorgio',kind:'charm',el:'none',cost:1,art:'engorgio',target:'allyUnit',
    text:'1 linh thú của bạn +2 công đến hết lượt.',op(c, L){ if (onField(L.t)) { L.t.tmp += 2; log(`${L.t.d.name} phình to: +2 công`); } }},

  // ===== Phép đổi thời tiết =====
  callrain:{name:'Gọi Mưa',kind:'charm',el:'water',cost:2,art:'muffliato',
    text:'Đổi thời tiết thành Mưa giông ngay (3 vòng) và rút 1 lá.',op(c){ changeWeather('rain', true); drawCard(c.owner); }},
  callsun:{name:'Mặt Trời Thiêu',kind:'charm',el:'fire',cost:2,art:'rennervate',
    text:'Đổi thời tiết thành Nắng gắt ngay (3 vòng) và rút 1 lá.',op(c){ changeWeather('heat', true); drawCard(c.owner); }},

  // ===== Phép trung lập dùng chung =====
  episkey:{name:'Episkey',kind:'charm',el:'none',cost:2,art:'episkey',text:'Hồi 4 sinh lực.',op(c){ heal(c.owner, 4); }},
  accio:{name:'Accio',kind:'charm',el:'none',cost:1,art:'accio',text:'Lấy 1 linh thú ngẫu nhiên từ bộ bài lên tay (không có thì rút 1 lá).',
    op(c){ const d = P(c.owner).deck, cs = d.filter(x => x.d.kind === 'creature');
      if (!cs.length) { drawCard(c.owner); return; }
      const x = cs[Math.random() * cs.length | 0]; d.splice(d.indexOf(x), 1); toHand(x, c.owner); log(`${P(c.owner).name} gọi ${c.owner === 0 ? x.d.name : '1 linh thú'} từ bộ bài lên tay`); }},
  reducto:{name:'Reducto',kind:'charm',el:'none',cost:3,art:'reducto',target:'enemyUnit',targetFilter:u => u.hp <= 3,
    text:'Phá huỷ 1 linh thú của đối thủ còn 3 máu trở xuống.',op(c, L){ if (onField(L.t) && L.t.hp <= 3) kill(L.t); }},
  obliviate:{name:'Obliviate',kind:'charm',el:'none',cost:2,art:'obliviate',text:'Đối thủ bỏ 1 lá ngẫu nhiên khỏi tay.',
    cond:c => P(opp(c.owner)).hand.length > 0, op(c){ const h = P(opp(c.owner)).hand; const x = h[Math.random() * h.length | 0]; h.splice(h.indexOf(x), 1); P(x.owner).grave.push(x); log(`${P(x.owner).name} quên mất ${x.d.name}`); }},
  tempus:{name:'Tempus Retro',kind:'charm',el:'none',cost:3,art:'tempus',text:'Rút 2 lá.',op(c){ drawCard(c.owner); drawCard(c.owner); }},
  protego:{name:'Protego',kind:'counter',el:'none',cost:2,art:'protego',
    text:'Phản chú (2 ma lực): khi đối thủ dùng bùa chú hoặc phép duy trì, vô hiệu nó.',
    cond:(c, x) => x.type === 'activate' && x.link.player !== c.owner && ['charm','enchant'].includes(x.link.card.d.kind),
    op(c, L){ L.ctx.link.negated = true; }},
  expelliarmus:{name:'Expelliarmus',kind:'counter',el:'none',cost:1,art:'expelliarmus',
    text:'Phản chú (1 ma lực): khi linh thú đối thủ tấn công, huỷ đòn đánh và làm nó Choáng.',
    cond:(c, x) => x.type === 'attack' && x.attacker.owner !== c.owner, op(c, L){ G.attackNegated = true; if (onField(L.ctx.attacker)) addSt(L.ctx.attacker, 'stun', c); }},
};

/* ---------- Hai bộ bài khởi đầu (30 lá) ---------- */
export const DECKS = {
  thuyloi:{name:'Thuỷ – Lôi', bond:'wyvern', els:['water','storm'],
    desc:'Làm kẻ địch Ướt rồi giật Sét lan khắp sân. Gọi Mưa để tăng sức phép Sét; linh thú Nhân Ngư tiến hoá thành Kraken.',
    list:{aguamenti:2, unda:2, fulmen:2, stupefy:2, tempestas:1, expecto:1, avis:1, episkey:1, accio:2, callrain:1,
    fiantoduri:1, protego:2, speculum:1, expelliarmus:2, pixie:2, merfolk:2, owl:2, golem:1, unicorn:1, centaur:1}},
  hoabang:{name:'Hoả – Băng', bond:'phoenix', els:['fire','ice'],
    desc:'Đóng băng rồi thiêu bằng Lửa để gây Hơi nước gấp đôi sát thương. Nhiều linh thú hung hãn và phép phá huỷ.',
    list:{incendio:2, confringo:2, ignis:1, bombarda:1, glacius:2, petrificus:1, callsun:1, engorgio:1, vincula:1, tempus:1,
    episkey:1, reducto:1, protego:1, expelliarmus:2, accio:2, gnome:1, spider:2, ghost:2, werewolf:2, hippogriff:1, troll:1, cerberus:1}},
};
export const TUTORIAL_HAND = ['pixie', 'aguamenti', 'fulmen', 'merfolk'];
