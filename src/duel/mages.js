/* Dàn pháp sư từ gói hoạt ảnh (public/mage, định dạng xem docs/mage-anim/CLAUDE.md). Có 2 định dạng:
   v1 (6 pháp sư gốc): 12 phép bolt1–3, sky1–3, ground1–3, spread1–3, 4 tư thế chung (release / release_sky / release_ground / release_spread).
   v2 (8 nhân vật): 8 phép riêng, mỗi phép một hàng tư thế sp_<key>, phép bật ra ở khung `release`, cơ chế ở `mech`.
   Đọc game-data.json + anim/<id>.json + spells/<id>-spells.json, rồi đổi mỗi phép thành phép của trận đấu kèm thông số hiển thị. */
export const ROOT = '/mage';
const ELEMENT = {fire:'fire', storm:'storm', water:'water', ice:'ice', earth:'earth', shadow:'dark', sand:'earth', qi:'none', arcana:'mind',
  steam:'fire', holy:'light', time:'mind', zen:'light', sound:'mind'};
const TIP = {
  pyro:'Lửa: đạn nảy, phượng hoàng bổ nhào, mưa thiên thạch, núi lửa. Gây Cháy liên tục, có Hoả Thân tăng sát thương.',
  storm_fox:'Sét: loạt cầu sét, tháp lôi, bão cửu vĩ. Nhiều nhịp Choáng ngắn để ngắt phép đối thủ, có Lôi Tốc niệm nhanh.',
  tide:'Nước: đẩy lùi, làm Ướt, vũng xoáy làm chậm. Bộ hồi máu và bong bóng giảm sát thương mạnh nhất.',
  frost:'Băng: làm chậm cộng dồn, Đóng băng, ngục băng và thời khắc đóng băng ngắt phép. Có giáp sương.',
  terra:'Đất: đòn nặng, Trói chân, hất tung. Dựng tường đá chặn đạn phép, đánh trúng thì được thêm giáp.',
  raven:'Bóng tối: mọi đòn đều hút máu, làm Mù khiến phép đối thủ yếu đi, xoá phép duy trì của đối thủ.',
  pharaoh:'Cát: Mắt Horus làm Mù, lốc cát di chuyển, tay xác ướp trói chân, quan tài phong ấn, đĩa mặt trời hút máu.',
  swordsman:'Kiếm khí: lướt chém xuyên giáp, kiếm bay hồi toàn, vạn kiếm giáng, điểm huyệt ngắt phép, phân thân.',
  tarot:'Bài: phi bài, bánh xe số phận ngẫu nhiên, lá Tử Thần hẹn giờ, Mặt Trăng mê hoặc, Thế Giới vây đứng yên.',
  mech:'Máy hơi nước: súng đinh tán, lựu đạn ném vòng, tháp pháo tự bắn, nam châm kéo và ngắt phép, khinh khí cầu ném bom.',
  priest:'Thánh quang: đạn x2 lên địch bị Mù / nguyền, cột sáng, khiên thánh phản đạn, thiên thần hộ vệ, ấn hồi sinh.',
  chrono:'Thời gian: kim đồng hồ làm chậm, ngưng đọng, bom hẹn giờ nổ sớm khi địch bị chậm, Gia Tốc, Tua Ngược hồi máu.',
  monk:'Thiền võ: chưởng đẩy lùi, Kim Chung Tráo giáp 35 miễn choáng, La Hán quyền liên hoàn, Sư Tử Hống ngắt phép.',
  bard:'Âm nhạc: nốt lượn sóng, ru ngủ, âm thoa ngắt phép từng nhịp, hành khúc tăng sát thương, Bis! diễn lại phép trước.',
};
const num = s => parseFloat(String(s).replace(',', '.'));
const loadImg = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const loadJson = src => fetch(src).then(r => r.json());

export const MAGES = {};      // id → {id, name, el, tip, v2, anim, sheet, sheetSrc, spellImg, spellSrc, spellRows, hand, head, spells: {key: sp}}

// Đọc hiệu ứng từ câu mô tả (effect) của phép: Cháy, Choáng, Làm chậm, Đóng băng, Hút máu, Mù...
function effects(info, sp){
  const e = info.effect || '', m = re => { const r = e.match(re); return r ? num(r[1]) : 0; };
  if (m(/(?:Cháy|cháy|Thiêu đốt) (\d+)/)) sp.burn = m(/(?:Cháy|cháy|Thiêu đốt) (\d+)/);
  if (/Cháy liên tục/.test(e)) sp.burn = 2;
  if (m(/Chảy máu (\d+)/)) sp.burn = m(/Chảy máu (\d+)/);
  if (m(/[Cc]hoáng ([\d,]+)/)) sp.stun = m(/[Cc]hoáng ([\d,]+)/);
  if (m(/chậm (?:thêm )?(\d+)%/)) sp.slow = m(/chậm (?:thêm )?(\d+)%/) / 100;
  if (/Ướt/.test(e) && sp.el === 'water') sp.wet = true;
  if (m(/Đóng băng ([\d,]+)/)) sp.freeze = m(/Đóng băng ([\d,]+)/);
  if (m(/Trói chân ([\d,]+)/)) sp.root = m(/Trói chân ([\d,]+)/);
  if (/Trói chân trong lúc/.test(e)) sp.root = 1.2;
  if (m(/Hút (\d+) máu/)) sp.drainHp = m(/Hút (\d+) máu/);
  if (m(/hồi (\d+) máu cho người niệm/)) sp.selfHeal = m(/hồi (\d+) máu cho người niệm/);
  if (m(/người niệm hồi (\d+) máu/)) sp.selfHeal = m(/người niệm hồi (\d+) máu/);
  if (/[Mm]ỗi .*hồi|hồi .*mỗi/.test(e) && m(/(\d+) máu/)) { sp.lifePerHit = m(/(\d+) máu/); delete sp.selfHeal; }
  if (/Mù/.test(e)) sp.blind = m(/Mù ([\d,]+)/) || 2;
  if (/xoá 1 phép duy trì|cướp 1 phép duy trì|xoá 1 hiệu ứng tốt/.test(e)) sp.dispel = true;
  if (m(/\+(\d+) giáp/)) sp.armorOnHit = m(/\+(\d+) giáp/);
  if (/Hất tung/.test(e)) sp.launch = true;
  if (/đứng yên|không di chuyển được/.test(e)) sp.stun = Math.max(sp.stun || 0, m(/([\d,]+) giây/) || 1.5);
  if (/[Nn]gắt phép|phép đang niệm bị ngắt/.test(e)) sp.interrupt = true;
  if (/mất thăng bằng/.test(e)) sp.stun = Math.max(sp.stun || 0, m(/mất thăng bằng ([\d,]+)/));
  if (/xuyên qua khiên|Xuyên giáp/.test(e)) sp.pierce = true;
  if (m(/[Pp]há (\d+)% giáp/)) sp.armorBreak = m(/[Pp]há (\d+)% giáp/) / 100;
  if (m(/giảm (\d+)% giáp/)) sp.armorBreak = m(/giảm (\d+)% giáp/) / 100;
  if (/Đánh dấu con mồi/.test(e)) sp.mark = 3;
  if (m(/giảm (\d+)% kháng phép/)) sp.vuln = m(/giảm (\d+)% kháng phép/) / 100;
  if (m(/(\d+)% chí mạng/)) sp.crit = m(/(\d+)% chí mạng/) / 100;
  if (m(/bằng (\d+)% máu hiện tại/)) sp.pctHp = m(/bằng (\d+)% máu hiện tại/) / 100;
  if (m(/dưới (\d+)% máu thì gây gấp đôi/)) sp.execute = m(/dưới (\d+)% máu/) / 100;
  if (/gấp đôi lên địch đang có hiệu ứng bóng tối/.test(e)) sp.smite = true;
  if (/nổ sớm hơn/.test(e)) sp.early = m(/sớm hơn (\d+)/) || 1;
  if (/giảm hồi máu/.test(e)) sp.healCut = 3;
  if (/Trúng đủ 3 nốt/.test(e)) { sp.stunLast = sp.stun; delete sp.stun; }
  if (/Đòn cuối choáng/.test(e)) { sp.stunLast = sp.stun; delete sp.stun; }
  // Phép tự thân
  if (info.heal && !info.damage && !/mỗi nhịp/.test(e)) sp.heal = info.heal;
  if (info.heal && info.damage) sp.drainHp = info.heal;
  if (m(/chặn (\d+)% sát thương trong (\d+)/)) sp.guard = {pct:m(/chặn (\d+)%/) / 100, dur:m(/sát thương trong (\d+) giây/)};
  if (/giải hiệu ứng xấu/.test(e)) sp.cleanse = true;
  const shield = info.shield || m(/Giáp chặn (\d+)/) || m(/Giáp (\d+)/);
  if (shield) sp.barrier = {hp:shield, dur:m(/trong (\d+) giây/) || 4};
  if (/Chặn (\d+) đạn phép|Chặn mọi đạn phép/.test(e)) sp.wall = {n:/mọi/.test(e) ? 99 : m(/Chặn (\d+) đạn/), dur:m(/(?:đứng|trong) (\d+) giây/) || 3, rootOnFall:/Trói chân/.test(e)};
  if (/phép (?:tiếp theo|kế tiếp) \+(\d+)% sát thương/.test(e)) sp.empower = {mul:1 + m(/\+(\d+)% sát thương/) / 100, n:m(/(\d+) phép tiếp theo/) || 1};
  if (/Thời gian niệm.*?(\d+)% trong (\d+)/.test(e)) sp.haste = m(/% trong (\d+) giây/);
  if (/phản lại đạn phép đầu tiên/.test(e)) sp.mirror = m(/trong (\d+) giây/) || 3;
  if (/phản (\d+)% sát thương/.test(e)) sp.thorns = {pct:m(/phản (\d+)%/) / 100, dur:m(/trong (\d+) giây/) || 3};
  if (/miễn choáng/.test(e)) sp.immune = m(/trong (\d+) giây/) || 4;
  if (/Hồi sinh với (\d+)% máu/.test(e)) sp.revive = m(/Hồi sinh với (\d+)%/) / 100;
  if (/Hồi lượng máu đã mất/.test(e)) sp.rewind = {secs:m(/trong (\d+) giây trước/) || 3, max:m(/tối đa (\d+)/) || 30};
}

function v1Spell(cid, key, info, meta, el){
  const sp = {id:`${cid}.${key}`, mage:cid, key, name:info.name, el, cost:info.mana, cast:info.castTime, dmg:info.damage, hits:info.hits || 1,
    level:info.level, kind:info.type, pose:info.pose, meta, mech:info.mechanic,
    text:`${info.how} ${info.damage ? `${info.damage} sát thương${info.hits > 1 ? ` × ${info.hits} nhịp` : ''}. ` : ''}${info.effect || ''}`.trim()};
  effects(info, sp);
  return typed(sp);
}
// Loại phép: tấn công (có sát thương hoặc nhắm địch) · phản chú (giáp, tường, phản đạn) · hỗ trợ
function typed(sp){
  sp.self = !sp.dmg && !sp.sleep && !sp.encore;
  sp.type = !sp.self ? 'atk' : sp.wall || sp.barrier || sp.mirror || sp.thorns ? 'counter' : 'support';
  return sp;
}
// v2: bộ phép riêng; mech.type quyết định cách bay / đặt; root / freeze / slow / confuse / shield / empower / heal đọc thẳng từ mech
function v2Spell(cid, key, info, meta, el, anim){
  const mech = meta.mech || info.mech || {type:'projectile'};
  const sp = {id:`${cid}.${key}`, mage:cid, key, name:meta.name || info.name, el, cost:meta.mana ?? info.mana, cast:meta.cast ?? info.castTime,
    dmg:meta.dmg ?? info.damage, hits:meta.hits || info.hits || 1, v2:true, kind:mech.type, pose:meta.pose, meta, mech,
    poseFps:(anim.anims[meta.pose] || {}).fps || 12, release:meta.release ?? 2,
    text:`${meta.how || info.how || ''} ${(meta.dmg ?? info.damage) ? `${meta.dmg ?? info.damage} sát thương${(meta.hits || 1) > 1 ? ` × ${meta.hits} nhịp` : ''}. ` : ''}${meta.effect || info.effect || ''}`.trim()};
  sp.level = sp.cost <= 3 ? 1 : sp.cost <= 5 ? 2 : 3;
  effects({...info, effect:meta.effect || info.effect, heal:meta.heal ?? info.heal, shield:mech.shield || info.shield, damage:sp.dmg}, sp);
  if (mech.root) sp.root = mech.root;
  if (typeof mech.freeze === 'number') sp.stun = Math.max(sp.stun || 0, mech.freeze);
  if (mech.slow) sp.slow = mech.slow;
  if (mech.confuse) sp.confuse = mech.confuse;
  if (mech.shield) sp.barrier = {hp:mech.shield, dur:sp.barrier ? sp.barrier.dur : 4};
  if (mech.empower && !sp.empower) sp.empower = {mul:1 + mech.empower / 100, n:1};
  if (mech.type === 'self' && mech.heal) sp.heal = mech.heal;
  if (mech.type === 'regen') { sp.regenHeal = mech.heal || 5; delete sp.heal; }
  if (mech.type === 'sleep') sp.sleep = mech.dur || 3;
  if (mech.type === 'encore') sp.encore = true;
  if (mech.type === 'random') { sp.random = mech.outcomes || ['dmg2']; delete sp.stun; }   // choáng chỉ là 1 trong các kết quả
  return typed(sp);
}

export async function loadMages(){
  const data = await loadJson(`${ROOT}/game-data.json`);
  await Promise.all(Object.entries(data.characters).map(async ([id, c]) => {
    const [anim, sm, sheet, spellImg] = await Promise.all([loadJson(`${ROOT}/anim/${id}.json`), loadJson(`${ROOT}/spells/${id}-spells.json`),
      loadImg(`${ROOT}/anim/${id}-sheet.png`), loadImg(`${ROOT}/spells/${id}-spells.png`)]);
    const el = ELEMENT[c.element] || 'none', v2 = c.format === 2 || anim.version === 2, metas = Object.fromEntries(sm.spells.map(s => [s.key, s]));
    const M = MAGES[id] = {id, name:c.name, el, v2, tip:TIP[id] || c.look || '', anim, sheet, sheetSrc:`${ROOT}/anim/${id}-sheet.png`, spellImg,
      spellSrc:`${ROOT}/spells/${id}-spells.png`, spellRows:spellImg ? Math.round(spellImg.height / 192) : 12,
      hand:(anim.hand || {}).release || [150, 104], head:anim.head || [100, 40], spells:{}};
    for (const [key, info] of Object.entries(c.spells))
      M.spells[key] = v2 ? v2Spell(id, key, info, metas[key] || {}, el, anim) : v1Spell(id, key, info, metas[key] || {}, el);
  }));
  return MAGES;
}

// Ô hình đại diện của phép trên lá bài: một khung đẹp trong hàng của phép
export function spellIcon(sp){
  const M = MAGES[sp.mage], m = sp.meta || {}, flying = sp.v2 ? ['projectile', 'fan', 'wave', 'boomerang', 'lob'].includes(sp.kind) : sp.kind === 'bolt' && !['beam', 'chain'].includes(m.mode);
  const col = flying ? 1 : 3, row = m.row || 0;
  return `background-image:url(${M.spellSrc});background-size:800% ${M.spellRows * 100}%;background-position:${col / 7 * 100}% ${M.spellRows > 1 ? row / (M.spellRows - 1) * 100 : 0}%;background-repeat:no-repeat`;
}
