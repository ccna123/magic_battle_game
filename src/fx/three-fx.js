import * as THREE from 'three';

/* ---------- Lớp hiệu ứng three.js: canvas trong suốt phủ lên DOM, toạ độ = pixel màn hình ---------- */
export const FX = (() => {
  const sleepFx = ms => new Promise(r => setTimeout(r, ms));
  const NOOP = new Proxy({}, {get: () => () => Promise.resolve()});
  let renderer;
  try { renderer = new THREE.WebGLRenderer({alpha: true, antialias: false}); } catch (e) { return NOOP; }
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = renderer.domElement; cv.id = 'fx'; document.body.appendChild(cv);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  function resize(){ const w = innerWidth, h = innerHeight; renderer.setSize(w, h); cam.right = w; cam.bottom = -h; cam.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);

  // Pool hạt dùng chung, cập nhật trên CPU, vẽ bằng 1 lần draw call
  const N = RM ? 1200 : 4000;
  const pos = new Float32Array(N*3), rgba = new Float32Array(N*4), size = new Float32Array(N);
  const px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  const life = new Float32Array(N), max = new Float32Array(N), s0 = new Float32Array(N), grav = new Float32Array(N), drag = new Float32Array(N);
  const cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('rgba', new THREE.BufferAttribute(rgba, 4));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {pr: {value: renderer.getPixelRatio()}},
    vertexShader: `attribute float size; attribute vec4 rgba; varying vec4 vC; uniform float pr;
      void main(){ vC = rgba; gl_PointSize = size * pr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec4 vC;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC.rgb, vC.a * a * a); }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  let head = 0;
  const rnd = s => (Math.random() - .5) * 2 * s;
  const jit = (c, j = .12) => [c[0] + rnd(j), c[1] + rnd(j), c[2] + rnd(j)];
  function spawn(x, y, ux, uy, l, s, c, g = 0, d = 1){
    const i = head; head = (head + 1) % N;
    px[i] = x; py[i] = y; vx[i] = ux; vy[i] = uy; life[i] = max[i] = l; s0[i] = s; grav[i] = g; drag[i] = d;
    cr[i] = c[0]; cg[i] = c[1]; cb[i] = c[2];
  }
  const rings = [], emitters = [];

  // Toạ độ màn hình của lá bài / sinh lực / mộ / tay
  function where(t){
    if (!t) return null; if (t.x !== undefined) return t;
    let el = null;
    if (t.lp !== undefined) el = document.querySelector(t.lp === 0 ? '#myInfo .lp' : '#oppInfo .lp');
    else if (t.grave !== undefined) el = document.querySelector(`[data-grave="${t.grave}"]`);
    else if (t.hand !== undefined) el = document.querySelector(t.hand === 0 ? '#myHand' : '#oppHand');
    else if (t.center) el = document.querySelector('.strip');
    else if (t.uid) el = document.querySelector(`[data-uid="${t.uid}"]`) || document.querySelector(`[data-grave="${t.owner}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height};
  }
  function burst(t, o = {}){
    const p = where(t); if (!p) return;
    const n = RM ? (o.count || 60) / 3 : (o.count || 60), sp = o.speed || 160, c = o.color || [1, .8, .4];
    for (let i = 0; i < n; i++){
      const a = Math.random() * Math.PI * 2, v = sp * (.3 + Math.random() * .9);
      spawn(p.x + rnd(o.spread || 6), p.y + rnd(o.spread || 6), Math.cos(a) * v, Math.sin(a) * v,
        (o.life || .7) * (.6 + Math.random() * .6), (o.size || 12) * (.5 + Math.random()), jit(c), o.gravity || 0, o.drag || .15);
    }
  }
  function ring(t, c, r = 60, l = .6){
    const p = where(t); if (!p) return;
    const m = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 64),
      new THREE.MeshBasicMaterial({color: new THREE.Color(c[0], c[1], c[2]), transparent: true, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide}));
    m.position.set(p.x, -p.y, 0); scene.add(m); rings.push({m, l, max: l, r});
  }
  const bez = (a, m, b, k) => (1-k)*(1-k)*a + 2*(1-k)*k*m + k*k*b;
  function bolt(from, to, o = {}){
    const a = where(from), b = where(to); if (!a || !b) return Promise.resolve();
    const dur = o.dur || .45, c = o.color || [1, .8, .4], s = o.size || 14;
    const mx = (a.x + b.x)/2 + rnd(110), my = (a.y + b.y)/2 - 60 - Math.random() * 60;
    let t = 0;
    return new Promise(res => emitters.push(dt => {
      t += dt / dur; const k = Math.min(t, 1);
      const x = bez(a.x, mx, b.x, k), y = bez(a.y, my, b.y, k);
      const n = RM ? 1 : (o.fire ? 7 : 4);
      for (let j = 0; j < n; j++)
        spawn(x + rnd(5), y + rnd(5), rnd(30), o.fire ? -30 - Math.random()*70 : rnd(30), .3 + Math.random()*.35,
          s * (.5 + Math.random()*.7), o.fire ? jit([1, .35 + Math.random()*.45, .05], .05) : jit(c), o.fire ? -80 : 0, .3);
      spawn(x, y, 0, 0, .1, s * 2.4, [1, 1, 1]);
      if (k >= 1){ burst(b, {color: c, count: 80, speed: 230, life: .6}); ring(b, c, 54, .5); res(); return false; }
      return true;
    }));
  }
  function swirl(t, c, ms = 1000, r = 60){
    const p = where(t); if (!p) return;
    let el = 0, ang = Math.random() * 6;
    emitters.push(dt => {
      el += dt * 1000; ang += dt * 7;
      for (let j = 0; j < (RM ? 1 : 4); j++){
        const a = ang + j * Math.PI / 2, rr = r * (.6 + .4 * Math.sin(el / 160 + j));
        spawn(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * .6, -Math.sin(a) * 60, Math.cos(a) * 40 - 30, .8, 12 + Math.random() * 8, jit(c, .06), -20, .4);
      }
      return el < ms;
    });
  }
  function rise(t, c, n = 50){
    const p = where(t); if (!p) return;
    for (let i = 0; i < (RM ? n/3 : n); i++)
      spawn(p.x + rnd((p.w || 60) / 2), p.y + rnd((p.h || 30) / 2), rnd(20), -40 - Math.random() * 90, .9 + Math.random() * .6, 8 + Math.random() * 10, jit(c, .08), -30, .5);
  }
  function shake(power = 6){
    if (RM) return;
    const b = document.querySelector('.board'); if (!b || !b.animate) return;
    const k = [0, 1, 2, 3, 4].map(i => ({transform: `translate(${rnd(power)}px,${rnd(power)}px)`}));
    b.animate([...k, {transform: 'translate(0,0)'}], {duration: 320, easing: 'ease-out'});
  }


  // Flipbook: dải 8 khung ngang (fx/<tên>.png), vẽ bằng 1 plane + shader chọn khung
  const loader = new THREE.TextureLoader(), sheets = {}, anims = [];
  const ANIM_N = 8;
  function sheet(name){
    if (!sheets[name]) { const t = loader.load(`fx/${name}.png`); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; sheets[name] = t; }
    return sheets[name];
  }
  ['fire','mirror','shatter','fizzle','summon','bolt','petrify','patronus','shield','heal'].forEach(sheet);
  const animVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const animFS = `uniform sampler2D map; uniform float frame, count, alpha; varying vec2 vUv;
    void main(){ vec4 c = texture2D(map, vec2((vUv.x + frame) / count, vUv.y)); if (c.a < 0.02) discard; gl_FragColor = vec4(c.rgb, c.a * alpha); }`;
  function anim(t, name, o = {}){
    const p = where(t); if (!p) return Promise.resolve();
    const size = o.size || Math.max(70, Math.max(p.w || 0, p.h || 0) * 1.5);
    const from = o.from ?? 0, to = o.to ?? ANIM_N - 1, fps = o.fps || 14;
    const mat = new THREE.ShaderMaterial({uniforms: {map: {value: sheet(name)}, frame: {value: from}, count: {value: ANIM_N}, alpha: {value: 1}},
      vertexShader: animVS, fragmentShader: animFS, transparent: true, depthTest: false, depthWrite: false});
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.scale.set(size, size, 1); m.position.set(p.x + (o.dx || 0), -(p.y + (o.dy || 0)), 1); m.renderOrder = 2;
    scene.add(m);
    return new Promise(res => anims.push({m, t: 0, dur: (to - from + 1) / fps, from, to, res}));
  }

  // Bụi phép lơ lửng trên bàn
  // Hạt nền theo thời tiết
  let amb = 0, wmode = 'clear';
  const R = () => Math.random();
  const AMB = {
    clear:    {every: .09,  n: 1, f: r => spawn(r.left + R() * r.width, r.top + R() * r.height, rnd(8), -10 - R() * 15, 3 + R() * 2, 4 + R() * 5, [.55, .45, .2], 0, .9)},
    rain:     {every: .012, n: 2, f: r => spawn(r.left + R() * (r.width + 80), r.top + R() * r.height * .3, -70, 700 + R() * 250, .9, 3.5 + R() * 2, [.35, .5, .85], 0, 1)},
    heat:     {every: .045, n: 1, f: r => spawn(r.left + R() * r.width, r.bottom - R() * r.height * .4, rnd(12), -45 - R() * 45, 2.6, 5 + R() * 7, [.95, .45, .12], -12, .9)},
    blizzard: {every: .016, n: 2, f: r => spawn(r.left - 40 + R() * (r.width + 40), r.top + R() * r.height * .4, 70 + R() * 50, 70 + R() * 80, 4.5, 4 + R() * 6, [.85, .92, 1], 0, 1)},
    moon:     {every: .11,  n: 1, f: r => spawn(r.left + R() * r.width, r.top + R() * r.height, rnd(6), -6 - R() * 8, 4, 4 + R() * 4, [.7, .76, .95], 0, .9)},
    fog:      {every: .07,  n: 1, f: r => spawn(r.left - 60 + R() * r.width, r.top + R() * r.height, 18 + R() * 20, rnd(4), 5, 70 + R() * 70, [.1, .12, .13], 0, 1)},
    ley:      {every: .05,  n: 1, f: r => spawn(r.left + R() * r.width, r.bottom - R() * r.height * .2, rnd(15), -60 - R() * 60, 2.4, 5 + R() * 6, [.35, .65, 1], -20, .9)},
  };
  function ambient(dt){
    if (RM) return; const cfg = AMB[wmode] || AMB.clear; amb += dt; if (amb < cfg.every) return; amb = 0;
    const b = document.querySelector('.board'); if (!b) return;
    const r = b.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    for (let i = 0; i < cfg.n; i++) cfg.f(r);
  }

  let last = performance.now();
  function frame(now){
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    ambient(dt);
    for (let i = emitters.length - 1; i >= 0; i--) if (!emitters[i](dt)) emitters.splice(i, 1);
    for (let i = 0; i < N; i++){
      if (life[i] > 0){
        life[i] -= dt;
        const dk = Math.pow(drag[i], dt); vx[i] *= dk; vy[i] *= dk; vy[i] += grav[i] * dt;
        px[i] += vx[i] * dt; py[i] += vy[i] * dt;
        const t = Math.max(0, life[i] / max[i]);
        pos[i*3] = px[i]; pos[i*3+1] = -py[i];
        rgba[i*4] = cr[i]; rgba[i*4+1] = cg[i]; rgba[i*4+2] = cb[i]; rgba[i*4+3] = Math.min(1, t * 1.6);
        size[i] = s0[i] * (.35 + .65 * t);
      } else size[i] = 0;
    }
    geo.attributes.position.needsUpdate = geo.attributes.rgba.needsUpdate = geo.attributes.size.needsUpdate = true;
    for (let i = rings.length - 1; i >= 0; i--){
      const R = rings[i]; R.l -= dt; const t = Math.max(0, R.l / R.max), s = R.r * (1.15 - t);
      R.m.scale.set(s, s, 1); R.m.material.opacity = t;
      if (R.l <= 0){ scene.remove(R.m); R.m.geometry.dispose(); R.m.material.dispose(); rings.splice(i, 1); }
    }
    for (let i = anims.length - 1; i >= 0; i--){
      const A = anims[i]; A.t += dt; const k = A.t / A.dur;
      A.m.material.uniforms.frame.value = Math.min(A.to, A.from + Math.floor(k * (A.to - A.from + 1)));
      A.m.material.uniforms.alpha.value = k > .85 ? Math.max(0, (1 - k) / .15) : 1;
      if (k >= 1){ scene.remove(A.m); A.m.geometry.dispose(); A.m.material.dispose(); anims.splice(i, 1); A.res(); }
    }
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const KC = {creature: [.85, .58, .28], charm: [.3, .8, .65], enchant: [.55, .62, 1], counter: [1, .38, .32]};
  return {
    lp: i => ({lp: i}), grave: i => ({grave: i}),
    burst, ring, bolt, swirl, rise, shake, anim,
    cast(c){ const k = KC[c.d.kind]; ring(c, k, 70, .55); burst(c, {color: k, count: 40, speed: 110, life: .5, size: 10}); },
    summon(c){ anim(c, 'summon', {fps: 16}); ring(c, [1, .8, .35], 90, .7); ring(c, [1, .9, .6], 55, .5); rise(c, [1, .78, .35], 60); },
    shatter(c){ anim(c, 'shatter', {from: 1, fps: 16}); const k = KC[c.d.kind] || [1, 1, 1];
      burst(c, {color: k, count: 120, speed: 260, life: .9, gravity: 420, size: 11, spread: 20});
      burst(c, {color: [1, 1, 1], count: 30, speed: 140, life: .4, size: 16}); shake(5); },
    fizzle(c){ anim(c, 'fizzle', {fps: 15}); burst(c, {color: [.45, .45, .45], count: 50, speed: 50, life: 1, gravity: -40, size: 14}); },
    hit(pi, n){ burst({lp: pi}, {color: [1, .25, .2], count: 40 + Math.min(120, n / 10), speed: 200, life: .6}); if (n >= 700) shake(Math.min(14, n / 120)); },
    heal(pi){ anim({lp: pi}, 'heal', {from: 4, size: 110, fps: 10}); rise({lp: pi}, [.45, 1, .6], 55); },
    setWeather(id){ wmode = id; },
    wait: sleepFx
  };
})();
