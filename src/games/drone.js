// Jogo 1 — Nave: desviar de colunas com brechas (algumas se mexem).
// O robô enxerga com raios e sente a própria velocidade; tem gravidade e inércia.
(function (root) {
  const H0 = typeof module !== 'undefined' ? (require('../rng.js'), globalThis.HVM) : root.HVM;
  const makeRng = H0.makeRng;

  const W = 1280, H = 720;
  const DRONE_X = 220, DRONE_R = 14;
  const GRAV = 0.32, THRUST = 0.7, DAMP = 0.985, VMAX = 9;
  const HOVER = -GRAV / THRUST;               // ação que equilibra a gravidade
  const GAP0 = 200, GAP_MIN = 150;
  const OBST_W = 80, OBST_SPACING = 380;
  const SPEED0 = 4, SPEED_MAX = 9, SPEED_INC = 0.001;
  const MARGIN = 60;
  const N_RAYS = 7, RAY_LEN = 520, RAY_STEP = 10;
  const RAY_ANG = Array.from({ length: N_RAYS }, (_, i) => (-70 + i * 140 / (N_RAYS - 1)) * Math.PI / 180);

  function createWorld(seed) {
    return { rng: makeRng(seed), seed, t: 0, speed: SPEED0, distance: 0, obstacles: [], spawnX: W + 100, count: 0 };
  }

  function difficulty(w) { return (w.speed - SPEED0) / (SPEED_MAX - SPEED0); }

  function spawn(w, x) {
    const d = difficulty(w);
    const gapH = GAP0 - (GAP0 - GAP_MIN) * d;
    w.count++;
    // a partir do 4º obstáculo, algumas brechas sobem e descem (cada vez mais)
    const moving = w.count > 1 && w.rng() < 0.5 + 0.4 * d;
    const amp = moving ? 50 + 90 * d * w.rng() + 30 * w.rng() : 0;
    const lo = MARGIN + gapH / 2 + amp, hi = H - MARGIN - gapH / 2 - amp;
    const baseY = lo + (hi - lo) * w.rng();
    w.obstacles.push({ x, baseY, gapY: baseY, gapH, amp, phase: w.rng() * Math.PI * 2, freq: 0.02 + 0.02 * w.rng() });
  }

  function stepWorld(w) {
    w.t++;
    w.speed = Math.min(SPEED_MAX, SPEED0 + w.t * SPEED_INC);
    w.distance += w.speed;
    for (const o of w.obstacles) {
      o.x -= w.speed;
      if (o.amp) o.gapY = o.baseY + o.amp * Math.sin(o.phase + w.t * (o.freq || 0.03));
    }
    while (w.obstacles.length && w.obstacles[0].x + OBST_W < -50) w.obstacles.shift();
    if (w.spawnX !== Infinity) {
      w.spawnX -= w.speed;
      while (w.spawnX < W + OBST_SPACING) { spawn(w, w.spawnX); w.spawnX += OBST_SPACING; }
    }
  }

  function createAgent() { return { y: H / 2, vy: 0, alive: true, distance: 0, rays: null }; }

  function solid(w, x, y) {
    if (y < 0 || y > H) return true;
    for (const o of w.obstacles) {
      if (x >= o.x && x <= o.x + OBST_W) {
        return y < o.gapY - o.gapH / 2 || y > o.gapY + o.gapH / 2;
      }
    }
    return false;
  }

  function hits(d, o) {
    if (DRONE_X + DRONE_R < o.x || DRONE_X - DRONE_R > o.x + OBST_W) return false;
    return d.y - DRONE_R < o.gapY - o.gapH / 2 || d.y + DRONE_R > o.gapY + o.gapH / 2;
  }

  function stepAgent(d, w, action) {
    if (!d.alive) return;
    const a = Math.max(-1, Math.min(1, action || 0));
    d.vy = Math.max(-VMAX, Math.min(VMAX, (d.vy + GRAV + a * THRUST) * DAMP));
    d.y += d.vy;
    d.distance += w.speed;
    if (d.y - DRONE_R < 0 || d.y + DRONE_R > H) { d.alive = false; return; }
    for (const o of w.obstacles) if (hits(d, o)) { d.alive = false; return; }
  }

  // devolve [{x, y, v}] — v = 1 quando a parede está colada, 0 quando não vê nada
  function castRays(d, w) {
    return RAY_ANG.map(ang => {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      let dist = RAY_LEN;
      for (let s = RAY_STEP; s <= RAY_LEN; s += RAY_STEP) {
        if (solid(w, DRONE_X + dx * s, d.y + dy * s)) { dist = s; break; }
      }
      return { x: DRONE_X + dx * dist, y: d.y + dy * dist, v: 1 - dist / RAY_LEN };
    });
  }

  function sensors(d, w) {
    d.rays = castRays(d, w);
    return [...d.rays.map(r => r.v), d.vy / VMAX];
  }

  const fitness = d => d.distance;
  const score = d => Math.floor(d.distance / 10);

  // ---------- desenho ----------
  function draw(ctx, w, agents, bestIdx, human, trail, C) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const off1 = (w.distance * 0.25) % 80, off2 = (w.distance * 0.6) % 160;
    ctx.lineWidth = 1; ctx.strokeStyle = C.grid2; ctx.beginPath();
    for (let x = -off1; x < W; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y < H; y += 80) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.strokeStyle = C.grid; ctx.beginPath();
    for (let x = -off2; x < W + 160; x += 160) {
      ctx.moveTo(x, 120); ctx.lineTo(x + 60, 120); ctx.lineTo(x + 90, 150); ctx.lineTo(x + 160, 150);
      ctx.moveTo(x, H - 140); ctx.lineTo(x + 50, H - 140); ctx.lineTo(x + 80, H - 110); ctx.lineTo(x + 160, H - 110);
    }
    ctx.stroke();

    for (const o of w.obstacles) {
      if (o.x > W || o.x + OBST_W < 0) continue;
      const top = o.gapY - o.gapH / 2, bot = o.gapY + o.gapH / 2;
      const col = o.amp ? C.warn : C.obst;
      ctx.fillStyle = o.amp ? 'rgba(255,150,40,0.10)' : C.obstFill;
      ctx.fillRect(o.x, 0, OBST_W, top); ctx.fillRect(o.x, bot, OBST_W, H - bot);
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.strokeRect(o.x + 1.5, -5, OBST_W - 3, top + 3.5);
      ctx.strokeRect(o.x + 1.5, bot + 1.5, OBST_W - 3, H - bot + 5);
      ctx.shadowBlur = 0;
    }

    // raios do melhor robô: "o que ele enxerga"
    const best = bestIdx >= 0 ? agents[bestIdx] : null;
    if (best && best.rays) {
      for (const r of best.rays) {
        ctx.strokeStyle = 'rgba(255,60,200,' + (0.15 + 0.6 * r.v) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(DRONE_X, best.y); ctx.lineTo(r.x, r.y); ctx.stroke();
        if (r.v > 0) { ctx.fillStyle = 'rgba(255,60,200,0.9)'; ctx.fillRect(r.x - 3, r.y - 3, 6, 6); }
      }
    }
    for (let i = 0; i < agents.length; i++) {
      const d = agents[i];
      if (d.alive && i !== bestIdx) ship(ctx, d.y, d.vy, 'rgba(' + C.robot + ',0.28)');
    }
    if (best) {
      ctx.shadowColor = 'rgb(' + C.robot + ')'; ctx.shadowBlur = 12;
      ship(ctx, best.y, best.vy, 'rgba(' + C.robot + ',0.9)', '#fff');
      ctx.shadowBlur = 0;
    }
    if (human) {
      ctx.strokeStyle = 'rgba(255,210,63,0.5)'; ctx.lineWidth = 3; ctx.beginPath();
      trail.forEach((p, i) => { const x = DRONE_X - (trail.length - i) * 6; i ? ctx.lineTo(x, p.y) : ctx.moveTo(x, p.y); });
      ctx.stroke();
      ctx.shadowColor = C.human; ctx.shadowBlur = 18;
      ship(ctx, human.y, human.vy, human.alive ? C.human : '#776622', '#fff', 1.25);
      ctx.shadowBlur = 0;
    }
  }

  function ship(ctx, y, vy, fill, stroke, scale) {
    const r = DRONE_R * (scale || 1);
    ctx.save(); ctx.translate(DRONE_X, y); ctx.rotate(Math.max(-0.5, Math.min(0.5, vy * 0.06)));
    ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r, -r); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r, r); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }

  const api = {
    id: 'drone', title: 'NAVE', hint: 'segure ▲ para subir — a gravidade puxa para baixo',
    axis: 'y', maxSteps: 12000,
    nInputs: N_RAYS + 1,
    inputLabels: ['raio ↑↑', 'raio ↑', 'raio ↗', 'raio →', 'raio ↘', 'raio ↓', 'raio ↓↓', 'velocidade'],
    W, H, DRONE_X, DRONE_R, OBST_W, SPEED_MAX, HOVER, N_RAYS,
    createWorld, stepWorld, createAgent, stepAgent, sensors, fitness, score, draw,
    trailPoint: d => ({ y: d.y }),
  };
  root.HVM = root.HVM || {};
  root.HVM.Games = Object.assign(root.HVM.Games || {}, { drone: api });
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
