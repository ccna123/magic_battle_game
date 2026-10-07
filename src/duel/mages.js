/* Dàn pháp sư từ gói hoạt ảnh (public/mage, định dạng xem docs/mage-anim/CLAUDE.md):
   7 nhân vật × 12 phép (bolt1–3, sky1–3, ground1–3, spread1–3). Đọc game-data.json + anim/<id>.json + spells/<id>-spells.json,
   rồi đổi mỗi phép thành phép của trận đấu (sát thương, hiệu ứng, thời gian niệm) kèm thông số hiển thị. */
export const ROOT = '/mage';
const ELEMENT = {fire:'fire', storm:'storm', water:'water', ice:'ice', earth:'earth', shadow:'dark', beast:'none'};
const TIP = {
  pyro:'Lửa: đạn nảy, phượng hoàng bổ nhào, mưa thiên thạch, núi lửa. Gây Cháy liên tục, có Hoả Thân tăng sát thương.',
  storm_fox:'Sét: loạt cầu sét, tháp lôi, bão cửu vĩ. Nhiều nhịp Choáng ngắn để ngắt phép đối thủ, có Lôi Tốc niệm nhanh.',
  tide:'Nước: đẩy lùi, làm Ướt, vũng xoáy làm chậm. Bộ hồi máu và bong bóng giảm sát thương mạnh nhất.',
  frost:'Băng: làm chậm cộng dồn, Đóng băng, ngục băng và thời khắc đóng băng ngắt phép. Có giáp sương.',
  terra:'Đất: đòn nặng, Trói chân, hất tung. Dựng tường đá chặn đạn phép, đánh trúng thì được thêm giáp.',
  raven:'Bóng tối: mọi đòn đều hút máu, làm Mù khiến phép đối thủ yếu đi, xoá phép duy trì của đối thủ.',
  beastmaster:'Triệu thú: gọi quái xung phong, bổ nhào, trồi lên. Đánh dấu con mồi để đòn sau đau hơn. (Hình nhân vật tạm.)',
};
const num = s => parseFloat(String(s).replace(',', '.'));
const loadImg = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const loadJson = src => fetch(src).then(r => r.json());

export const MAGES = {};      // id → {id, name, el, tip, anim, sheet, sheetSrc, spellImg, spellSrc, hand, spells: {key: sp}}
export const MONS = {};       // id quái → Image

// Đọc hiệu ứng từ câu mô tả trong game-data (Cháy, Choáng, Làm chậm, Đóng băng, Hút máu...)
function effects(info, sp){
  const e = info.effect || '', m = (re) => { const r = e.match(re); return r ? num(r[1]) : 0; };
  if (m(/Cháy (\d+)/)) sp.burn = m(/Cháy (\d+)/);
  if (/Cháy liên tục/.test(e)) sp.burn = 2;
  if (m(/Choáng ([\d,]+)/)) sp.stun = m(/Choáng ([\d,]+)/);
  if (m(/[Ll]àm chậm (?:thêm )?(\d+)%/)) sp.slow = m(/[Ll]àm chậm (?:thêm )?(\d+)%/) / 100;
  if (/Ướt/.test(e) && sp.el === 'water') sp.wet = true;
  if (m(/Đóng băng ([\d,]+)/)) sp.freeze = m(/Đóng băng ([\d,]+)/);
  if (m(/Trói chân ([\d,]+)/)) sp.root = m(/Trói chân ([\d,]+)/);
  if (m(/Hút (\d+) máu/)) sp.drainHp = m(/Hút (\d+) máu/);
  if (m(/hồi (\d+) máu cho người niệm/)) sp.selfHeal = m(/hồi (\d+) máu cho người niệm/);
  if (m(/người niệm hồi (\d+) máu/)) sp.selfHeal = m(/người niệm hồi (\d+) máu/);
  if (m(/Mù ([\d,]+)/)) sp.blind = m(/Mù ([\d,]+)/);
  if (/xoá 1 phép duy trì|cướp 1 phép duy trì/.test(e)) sp.dispel = true;
  if (m(/\+(\d+) giáp/)) sp.armorOnHit = m(/\+(\d+) giáp/);
  if (/Hất tung/.test(e)) sp.launch = true;
  if (/ngắt|đứng yên|không di chuyển được/.test(e)) { sp.interrupt = /ngắt/.test(e); sp.stun = Math.max(sp.stun || 0, m(/([\d,]+) giây/) || 1); }
  if (/mất thăng bằng/.test(e)) sp.stun = Math.max(sp.stun || 0, m(/mất thăng bằng ([\d,]+)/));
  if (/xuyên qua khiên/.test(e)) sp.pierce = true;
  if (/Đánh dấu con mồi/.test(e)) sp.mark = 3;
  if (/thú đánh thêm (\d+)/.test(e)) sp.extra = m(/thú đánh thêm (\d+)/);
  // Phép tự thân
  if (info.heal && !info.damage) sp.heal = info.heal;
  if (info.heal && info.damage) sp.drainHp = info.heal;
  if (m(/chặn (\d+)% sát thương trong (\d+)/)) sp.guard = {pct:m(/chặn (\d+)%/) / 100, dur:m(/sát thương trong (\d+) giây/)};
  if (/giải hiệu ứng xấu/.test(e)) sp.cleanse = true;
  if (info.shield || /Giáp chặn (\d+)/.test(e)) sp.barrier = {hp:info.shield || m(/Giáp chặn (\d+)/), dur:m(/trong (\d+) giây/) || 4};
  if (/Chặn (\d+) đạn phép|Chặn mọi đạn phép/.test(e)) sp.wall = {n:/mọi/.test(e) ? 99 : m(/Chặn (\d+) đạn/), dur:m(/(?:đứng|trong) (\d+) giây/) || 3, rootOnFall:/Trói chân/.test(e)};
  if (/phép tiếp theo \+(\d+)% sát thương/.test(e)) sp.empower = {mul:1 + m(/\+(\d+)% sát thương/) / 100, n:m(/(\d+) phép tiếp theo/)};
  if (/Thời gian niệm −(\d+)% trong (\d+)/.test(e)) sp.haste = m(/trong (\d+) giây/);
}

function toSpell(cid, key, info, meta, el){
  const sp = {id:`${cid}.${key}`, mage:cid, key, name:info.name, el, cost:info.mana, cast:info.castTime, dmg:info.damage, hits:info.hits || 1,
    level:info.level, kind:info.type, pose:info.pose, meta, mech:info.mechanic, summon:info.summon,
    text:`${info.how} ${info.damage ? `${info.damage} sát thương${info.hits > 1 ? ` × ${info.hits} nhịp` : ''}. ` : ''}${info.effect || ''}`.trim()};
  effects(info, sp);
  sp.self = !sp.dmg;
  sp.type = sp.dmg ? 'atk' : sp.wall || sp.barrier ? 'counter' : 'support';
  return sp;
}

export async function loadMages(){
  const data = await loadJson(`${ROOT}/game-data.json`);
  await Promise.all(Object.entries(data.characters).map(async ([id, c]) => {
    const [anim, sm, sheet, spellImg] = await Promise.all([loadJson(`${ROOT}/anim/${id}.json`), loadJson(`${ROOT}/spells/${id}-spells.json`),
      loadImg(`${ROOT}/anim/${id}-sheet.png`), loadImg(`${ROOT}/spells/${id}-spells.png`)]);
    const el = ELEMENT[c.element] || 'none', metas = Object.fromEntries(sm.spells.map(s => [s.key, s]));
    MAGES[id] = {id, name:c.name, el, tip:TIP[id] || '', anim, sheet, sheetSrc:`${ROOT}/anim/${id}-sheet.png`, spellImg, spellSrc:`${ROOT}/spells/${id}-spells.png`,
      hand:(anim.hand || {}).release || [150, 104], spellRows:12, spells:{}};
    for (const [key, info] of Object.entries(c.spells)) MAGES[id].spells[key] = toSpell(id, key, info, metas[key] || {}, el);
  }));
  const mons = new Set(Object.values(MAGES).flatMap(m => Object.values(m.spells).map(s => s.summon).filter(Boolean)));
  await Promise.all([...mons].map(async k => { MONS[k] = await loadImg(`${ROOT}/summons/${k}.png`); }));
  return MAGES;
}

// Ô hình đại diện của phép trên lá bài: khung đẹp nhất trong hàng của phép, hoặc hình quái được triệu hồi
export function spellIcon(sp){
  if (sp.summon) return `background:url(${ROOT}/summons/${sp.summon}.png) center/contain no-repeat`;
  const M = MAGES[sp.mage], col = sp.kind === 'bolt' && !['beam', 'chain'].includes(sp.meta.mode) ? 1 : 3;
  return `background-image:url(${M.spellSrc});background-size:800% ${M.spellRows * 100}%;background-position:${col / 7 * 100}% ${sp.meta.row / (M.spellRows - 1) * 100}%;background-repeat:no-repeat`;
}
