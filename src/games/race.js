// Jogo 2 — Corrida: carrinhos numa pista vista de cima. O carro acelera sozinho,
// o jogador/robô só vira. O robô enxerga a borda da pista com raios.
(function (root) {
  const W = 1280, H = 720;
  const HW = 46;                 // meia largura da pista
  const SP = 8;                  // espaçamento entre pontos da linha central
  const CELL = 4;
  const V0 = 5.5, VMAX = 10, VINC = 0.0010, ACCEL = 0.12, TURN = 0.065, GRIP = 0.85;
  const N_RAYS = 7, RAY_LEN = 260, RAY_STEP = 5;
  const RAY_ANG = Array.from({ length: N_RAYS }, (_, i) => (-90 + i * 180 / (N_RAYS - 1)) * Math.PI / 180);
  const STALL_STEPS = 180;
  const CAR_L = 22, CAR_W = 12;

  const TRACKS = [
    { name: 'Oval com chicane', ctrl: [[200, 360], [250, 150], [640, 110], [1050, 150], [1100, 360], [1050, 580], [820, 610], [640, 460], [460, 610], [250, 570]] },
    { name: 'Serpente', ctrl: [[150, 600], [150, 160], [370, 120], [460, 380], [600, 500], [760, 330], [850, 130], [1110, 140], [1140, 560], [640, 660], [300, 670]] },
    { name: 'Grampo de Lavras', ctrl: [[180, 200], [500, 130], [700, 250], [900, 130], [1130, 220], [1120, 440], [920, 430], [820, 560], [620, 655], [380, 655], [170, 540], [220, 430], [180, 320]] },
  ];

  // ---------- geometria da pista ----------
  function catmull(ctrl) {
    const n = ctrl.length, raw = [];
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
      for (let t = 0; t < 1; t += 0.02) {
        const t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        raw.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
      }
    }
    // reamostra com espaçamento constante SP
    const pts = [raw[0]];
    let acc = 0;
    for (let i = 1; i <= raw.length; i++) {
      const a = raw[i - 1], b = raw[i % raw.length];
      let seg = Math.hypot(b.x - a.x, b.y - a.y), u = 0;
      while (acc + seg - u >= SP) {
        u += SP - acc; acc = 0;
        const k = u / Math.hypot(b.x - a.x, b.y - a.y);
        pts.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      }
      acc += seg - u;
    }
    return pts;
  }

  const cache = {};
  function buildTrack(i) {
    if (cache[i]) return cache[i];
    const def = TRACKS[i % TRACKS.length];
    const pts = catmull(def.ctrl);
    const gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
    const grid = new Uint8Array(gw * gh);
    const r = Math.ceil(HW / CELL);
    for (const p of pts) {
      const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const gx = cx + dx, gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
        if (Math.hypot((gx + 0.5) * CELL - p.x, (gy + 0.5) * CELL - p.y) <= HW) grid[gy * gw + gx] = 1;
      }
    }
    return (cache[i] = { index: i % TRACKS.length, name: def.name, pts, grid, gw, gh });
  }

  function onTrack(w, x, y) {
    const t = w.track;
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    if (gx < 0 || gy < 0 || gx >= t.gw || gy >= t.gh) return false;
    return t.grid[gy * t.gw + gx] === 1;
  }

  // ---------- mundo e carros ----------
  function createWorld(seed, opts) {
    return { t: 0, vlim: V0, track: buildTrack((opts && opts.track) || 0), seed };
  }
  // o limite de velocidade sobe com o tempo: quem aguenta mais rápido vai mais longe
  function stepWorld(w) { w.t++; w.vlim = Math.min(VMAX, V0 + w.t * VINC); }

  function createAgent(w) {
    const p = w.track.pts;
    return {
      x: p[0].x, y: p[0].y, ang: Math.atan2(p[3].y - p[0].y, p[3].x - p[0].x),
      vx: 0, vy: 0, speed: 0, alive: true, idx: 0, prog: 0, best: 0, lastGain: 0, steps: 0, laps: 0, rays: null,
    };
  }

  function nearestIdx(t, c) {
    const n = t.pts.length;
    let bi = c.idx, bd = Infinity;
    for (let k = -15; k <= 15; k++) {
      const i = (c.idx + k + n) % n, p = t.pts[i];
      const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  }

  function stepAgent(c, w, action) {
    if (!c.alive) return;
    const a = Math.max(-1, Math.min(1, action || 0));
    c.steps++;
    // inércia: a velocidade lateral só é perdida aos poucos (o carro derrapa)
    c.ang += a * TURN;
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    let fwd = c.vx * fx + c.vy * fy;
    const lx = (c.vx - fx * fwd) * GRIP, ly = (c.vy - fy * fwd) * GRIP;
    fwd = Math.min(w.vlim, fwd + ACCEL);
    c.vx = fx * fwd + lx; c.vy = fy * fwd + ly;
    c.speed = Math.hypot(c.vx, c.vy);
    c.x += c.vx; c.y += c.vy;
    const t = w.track, n = t.pts.length;
    const ni = nearestIdx(t, c);
    let d = ni - c.idx;
    if (d > n / 2) d -= n; if (d < -n / 2) d += n;
    c.idx = ni; c.prog += d;
    c.laps = Math.max(c.laps, Math.floor(c.prog / n));
    if (c.prog > c.best) { c.best = c.prog; c.lastGain = c.steps; }
    if (!onTrack(w, c.x, c.y) || c.prog < -10 || c.steps - c.lastGain > STALL_STEPS) c.alive = false;
  }

  function castRays(c, w) {
    return RAY_ANG.map(ra => {
      const ang = c.ang + ra, dx = Math.cos(ang), dy = Math.sin(ang);
      let dist = RAY_LEN;
      for (let s = RAY_STEP; s <= RAY_LEN; s += RAY_STEP) {
        if (!onTrack(w, c.x + dx * s, c.y + dy * s)) { dist = s; break; }
      }
      return { x: c.x + dx * dist, y: c.y + dy * dist, v: 1 - dist / RAY_LEN };
    });
  }

  function sensors(c, w) {
    c.rays = castRays(c, w);
    return [...c.rays.map(r => r.v), c.speed / VMAX];
  }

  const fitness = c => Math.max(0, c.best) * SP;
  const score = c => Math.floor(Math.max(0, c.best) * SP / 10);

  // piloto automático simples (só para testes): mira um ponto à frente na linha central
  function autopilot(c, w) {
    const p = w.track.pts, n = p.length, tgt = p[(c.idx + 10) % n];
    let diff = Math.atan2(tgt.y - c.y, tgt.x - c.x) - c.ang;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return Math.max(-1, Math.min(1, diff * 3));
  }

  // ---------- desenho ----------
  function trackImage(t, C) {
    if (t.img || typeof document === 'undefined') return t.img;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#050a10'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(60,90,200,0.08)'; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x < W; x += 40) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y < H; y += 40) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke();
    const path = () => { g.beginPath(); t.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    path(); g.strokeStyle = C.obst; g.shadowColor = C.obst; g.shadowBlur = 16; g.lineWidth = HW * 2 + 6; g.stroke();
    g.shadowBlur = 0;
    path(); g.strokeStyle = '#141a33'; g.lineWidth = HW * 2; g.stroke();
    path(); g.setLineDash([14, 18]); g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
    // linha de largada
    const p0 = t.pts[0], p1 = t.pts[2], a = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    g.save(); g.translate(p0.x, p0.y); g.rotate(a);
    for (let i = -HW; i < HW; i += 8) { g.fillStyle = ((i / 8) & 1) ? '#fff' : '#111'; g.fillRect(-4, i, 8, 8); }
    g.restore();
    g.font = '700 16px "Segoe UI", system-ui, sans-serif'; g.fillStyle = C.dim; g.textAlign = 'left';
    g.fillText('pista: ' + t.name, 16, H - 16);
    return (t.img = cv);
  }

  function car(ctx, c, fill, stroke, scale) {
    const s = scale || 1;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang);
    ctx.fillStyle = fill; ctx.fillRect(-CAR_L / 2 * s, -CAR_W / 2 * s, CAR_L * s, CAR_W * s);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.strokeRect(-CAR_L / 2 * s, -CAR_W / 2 * s, CAR_L * s, CAR_W * s); }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(CAR_L / 2 * s - 4, -CAR_W / 2 * s + 2, 3, CAR_W * s - 4);
    ctx.restore();
  }

  function draw(ctx, w, agents, bestIdx, human, trail, C) {
    const img = trackImage(w.track, C);
    if (img) ctx.drawImage(img, 0, 0);
    // carros mortos ficam como "marcas" apagadas onde bateram
    for (const c of agents) if (!c.alive) car(ctx, c, 'rgba(' + C.robot + ',0.12)');
    const best = bestIdx >= 0 ? agents[bestIdx] : null;
    if (best && best.rays) {
      for (const r of best.rays) {
        ctx.strokeStyle = 'rgba(255,60,200,' + (0.15 + 0.6 * r.v) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(best.x, best.y); ctx.lineTo(r.x, r.y); ctx.stroke();
        ctx.fillStyle = 'rgba(255,60,200,0.9)'; ctx.fillRect(r.x - 3, r.y - 3, 6, 6);
      }
    }
    for (let i = 0; i < agents.length; i++) {
      const c = agents[i];
      if (c.alive && i !== bestIdx) car(ctx, c, 'rgba(' + C.robot + ',0.45)');
    }
    if (best) { ctx.shadowColor = 'rgb(' + C.robot + ')'; ctx.shadowBlur = 12; car(ctx, best, 'rgb(' + C.robot + ')', '#fff'); ctx.shadowBlur = 0; }
    if (human) {
      ctx.strokeStyle = 'rgba(255,210,63,0.5)'; ctx.lineWidth = 3; ctx.beginPath();
      trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.shadowColor = C.human; ctx.shadowBlur = 18;
      car(ctx, human, human.alive ? C.human : '#776622', '#fff', 1.3);
      ctx.shadowBlur = 0;
    }
  }

  const api = {
    id: 'race', title: 'CORRIDA', hint: '◀ ▶ para virar — o carro acelera sozinho',
    axis: 'x', maxSteps: 7200,
    nInputs: N_RAYS + 1,
    inputLabels: ['raio ←', 'raio ↖', 'raio ↖↑', 'raio ↑', 'raio ↑↗', 'raio ↗', 'raio →', 'velocidade'],
    W, H, TRACKS, VMAX,
    createWorld, stepWorld, createAgent, stepAgent, sensors, fitness, score, draw, onTrack, autopilot,
    trailPoint: c => ({ x: c.x, y: c.y }),
  };
  root.HVM = root.HVM || {};
  root.HVM.Games = Object.assign(root.HVM.Games || {}, { race: api });
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
