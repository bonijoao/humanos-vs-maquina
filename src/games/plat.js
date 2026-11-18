// Jogo 3 — Plataforma: uma fase por tela, chegar à bandeira no menor tempo.
// Humano que morre volta ao início com o relógio correndo; robô que morre sai da geração.
// O robô "enxerga" uma grade 5×5 de blocos ao redor dele e decide ANDAR e PULAR.
(function (root) {
  const W = 1280, H = 720, TILE = 40, COLS = 32, ROWS = 18;
  const GRAV = 0.6, JUMP = 11.5, FALL_MAX = 12, VX_MAX = 4.6;
  const ACC_GROUND = 0.3, ACC_AIR = 0.14, JUMP_CUT = -4, COYOTE = 6;
  const PW = 24, PH = 30;
  const STALL_STEPS = 240, MAX_STEPS = 60 * 60;
  const GX0 = -1, GX1 = 3, GY0 = -3, GY1 = 1; // grade de visão (em blocos)

  // ---------- fases ----------
  // construídas por retângulos para não errar a contagem de colunas
  function build(ops) {
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
    for (const [ch, x0, x1, y0, y1] of ops) {
      for (let y = y0; y <= (y1 === undefined ? y0 : y1); y++) for (let x = x0; x <= x1; x++) g[y][x] = ch;
    }
    return g.map(r => r.join(''));
  }

  const LEVELS = [
    { name: 'Primeiros pulos', rows: build([
      ['#', 0, 5, 15, 17], ['#', 8, 13, 15, 17], ['^', 10, 11, 14], ['#', 16, 18, 15, 17],
      ['#', 21, 26, 15, 17], ['^', 24, 24, 14], ['#', 29, 31, 15, 17],
      ['#', 12, 14, 11], ['S', 1, 1, 14], ['G', 30, 30, 14],
    ]) },
    { name: 'Escadaria', rows: build([
      ['#', 0, 4, 15, 17], ['#', 5, 7, 13, 17], ['#', 8, 9, 11, 17], ['^', 10, 15, 17],
      ['#', 12, 13, 12], ['#', 16, 19, 13, 17], ['^', 18, 18, 12], ['#', 20, 31, 15, 17],
      ['^', 23, 23, 14], ['^', 27, 28, 14], ['#', 25, 26, 11], ['S', 1, 1, 14], ['G', 31, 31, 14],
    ]) },
    { name: 'Ilhas no ar', rows: build([
      ['#', 0, 7, 15, 17], ['^', 8, 27, 17],
      ['#', 10, 10, 13], ['#', 13, 13, 12], ['#', 16, 16, 11], ['#', 19, 19, 12], ['#', 22, 22, 11], ['#', 25, 25, 13],
      ['^', 12, 23, 7], ['#', 12, 23, 6],
      ['#', 28, 31, 15, 17], ['S', 1, 1, 14], ['G', 30, 30, 14],
    ]) },
  ];

  const cache = {};
  function buildLevel(i) {
    const idx = ((i % LEVELS.length) + LEVELS.length) % LEVELS.length;
    if (cache[idx]) return cache[idx];
    const rows = LEVELS[idx].rows;
    let start = null, goal = null;
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === 'S') start = { tx: x, ty: y };
      if (ch === 'G') goal = { tx: x, ty: y };
    }));
    // distância (em blocos) até a chegada, por espaços livres: guia o "progresso"
    const dist = rows.map(r => [...r].map(() => Infinity));
    const q = [[goal.tx, goal.ty]]; dist[goal.ty][goal.tx] = 0;
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const ch = rows[ny][nx];
        if (ch === '#' || ch === '^' || dist[ny][nx] !== Infinity) continue;
        dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]);
      }
    }
    return (cache[idx] = { index: idx, name: LEVELS[idx].name, rows, start, goal, dist });
  }

  const tileAt = (w, tx, ty) => {
    if (tx < 0 || tx >= COLS) return '#';      // paredes laterais
    if (ty < 0 || ty >= ROWS) return '.';      // céu e abismo
    return w.level.rows[ty][tx];
  };
  const solidAt = (w, x, y) => tileAt(w, Math.floor(x / TILE), Math.floor(y / TILE)) === '#';

  // ---------- mundo e agentes ----------
  function createWorld(seed, opts) { return { t: 0, seed, level: buildLevel((opts && opts.track) || 0) }; }
  function stepWorld(w) { w.t++; }

  function spawn(c, w) {
    c.x = (w.level.start.tx + 0.5) * TILE; c.y = (w.level.start.ty + 1) * TILE - PH / 2 - 0.01;
    c.vx = 0; c.vy = 0; c.onGround = false; c.air = 0;
  }

  function createAgent(w, opts) {
    const c = {
      w: PW, h: PH, alive: true, finished: false, finishStep: 0, steps: 0, deaths: 0,
      human: !!(opts && opts.human), level: w.level, lastGain: 0, cells: null, dead: null,
    };
    spawn(c, w);
    c.bestDist = w.level.dist[w.level.start.ty][w.level.start.tx];
    return c;
  }

  function moveX(c, w) {
    c.x += c.vx;
    const top = c.y - PH / 2 + 1, bot = c.y + PH / 2 - 1;
    if (c.vx > 0) {
      const xr = c.x + PW / 2;
      if (solidAt(w, xr, top) || solidAt(w, xr, bot) || solidAt(w, xr, c.y)) { c.x = Math.floor(xr / TILE) * TILE - PW / 2 - 0.01; c.vx = 0; }
    } else if (c.vx < 0) {
      const xl = c.x - PW / 2;
      if (solidAt(w, xl, top) || solidAt(w, xl, bot) || solidAt(w, xl, c.y)) { c.x = (Math.floor(xl / TILE) + 1) * TILE + PW / 2 + 0.01; c.vx = 0; }
    }
  }

  function moveY(c, w) {
    c.y += c.vy;
    const l = c.x - PW / 2 + 1, r = c.x + PW / 2 - 1;
    c.onGround = false;
    if (c.vy > 0) {
      const yb = c.y + PH / 2;
      if (solidAt(w, l, yb) || solidAt(w, r, yb)) { c.y = Math.floor(yb / TILE) * TILE - PH / 2 - 0.01; c.vy = 0; c.onGround = true; }
    } else if (c.vy < 0) {
      const yt = c.y - PH / 2;
      if (solidAt(w, l, yt) || solidAt(w, r, yt)) { c.y = (Math.floor(yt / TILE) + 1) * TILE + PH / 2 + 0.01; c.vy = 0; }
    }
  }

  function touching(c, w, ch, shrink) {
    const s = shrink || 0;
    const xs = [c.x - PW / 2 + s, c.x, c.x + PW / 2 - s], ys = [c.y - PH / 2 + s, c.y, c.y + PH / 2 - s];
    for (const x of xs) for (const y of ys) {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (tileAt(w, tx, ty) !== ch) continue;
      if (ch !== '^') return true;
      if (y > ty * TILE + TILE * 0.45) return true; // espinho: só a parte de baixo do bloco machuca
    }
    return false;
  }

  function die(c, w) {
    c.dead = { x: c.x, y: c.y, t: 30 };
    if (c.human) { c.deaths++; spawn(c, w); } else c.alive = false;
  }

  // action = [andar (-1..1), pular (>0 = segurando)]
  function stepAgent(c, w, action) {
    if (!c.alive) return;
    const a = Array.isArray(action) ? action : [action || 0, -1];
    const move = Math.abs(a[0]) < 0.3 ? 0 : Math.sign(a[0]) * Math.min(1, Math.abs(a[0]) * 1.3);
    const jump = a[1] > 0;
    c.steps++;
    if (c.dead && --c.dead.t <= 0) c.dead = null;

    const target = move * VX_MAX;
    c.vx += (target - c.vx) * (c.onGround ? ACC_GROUND : ACC_AIR);
    c.air = c.onGround ? 0 : c.air + 1;
    if (jump && c.air < COYOTE && c.vy >= 0) { c.vy = -JUMP; c.air = COYOTE; }
    if (!jump && c.vy < JUMP_CUT) c.vy = JUMP_CUT;   // soltou cedo = pulo baixo
    c.vy = Math.min(FALL_MAX, c.vy + GRAV);
    moveX(c, w); moveY(c, w);

    if (c.y - PH / 2 > H || touching(c, w, '^', 3)) { die(c, w); return; }
    if (touching(c, w, 'G', 0)) { c.finished = true; c.finishStep = c.steps; c.alive = false; return; }

    const tx = Math.floor(c.x / TILE), ty = Math.floor(c.y / TILE);
    const d = (w.level.dist[ty] || [])[tx];
    if (d !== undefined && d < c.bestDist) { c.bestDist = d; c.lastGain = c.steps; }
    if (!c.human && c.steps - c.lastGain > STALL_STEPS) c.alive = false;
  }

  function sensors(c, w) {
    const tx = Math.floor(c.x / TILE), ty = Math.floor(c.y / TILE);
    const out = [], cells = [];
    for (let dy = GY0; dy <= GY1; dy++) for (let dx = GX0; dx <= GX1; dx++) {
      const ch = tileAt(w, tx + dx, ty + dy);
      const v = ch === '#' ? 1 : ch === '^' ? -1 : ch === 'G' ? 0.5 : (ty + dy >= ROWS ? -0.5 : 0);
      out.push(v); cells.push({ tx: tx + dx, ty: ty + dy, v });
    }
    c.cells = cells;
    out.push(Math.max(-1, Math.min(1, c.vx / VX_MAX)), Math.max(-1, Math.min(1, c.vy / FALL_MAX)), c.onGround ? 1 : -1);
    return out;
  }

  function fitness(c) {
    if (c.finished) return 1e6 + (MAX_STEPS - c.finishStep) * 10;
    const D = c.level.dist[c.level.start.ty][c.level.start.tx];
    return (D - c.bestDist) * 1000 - (c.steps || 0) * 0.01;
  }
  const score = c => (c.finished ? Math.round(c.finishStep / 6) / 10 : null);
  const formatScore = s => (s === null || s === undefined || s === 0 ? '—' : s.toFixed(1).replace('.', ',') + ' s');
  function hudText(c) {
    if (c.finished) return 'chegou! ' + formatScore(score(c));
    return (c.steps / 60).toFixed(1).replace('.', ',') + ' s · ' + c.deaths + (c.deaths === 1 ? ' morte' : ' mortes');
  }

  // ---------- desenho ----------
  function levelImage(L, C) {
    if (L.img || typeof document === 'undefined') return L.img;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#0a0820'); grd.addColorStop(1, '#05060f');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(60,90,200,0.07)'; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x <= W; x += TILE) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y <= H; y += TILE) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke();
    L.rows.forEach((r, ty) => [...r].forEach((ch, tx) => {
      const x = tx * TILE, y = ty * TILE;
      if (ch === '#') {
        g.fillStyle = '#121a3a'; g.fillRect(x, y, TILE, TILE);
        const up = tileAt({ level: L }, tx, ty - 1) !== '#';
        g.strokeStyle = 'rgba(25,230,255,0.35)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (up) { g.fillStyle = C.obst; g.shadowColor = C.obst; g.shadowBlur = 10; g.fillRect(x, y, TILE, 3); g.shadowBlur = 0; }
      } else if (ch === '^') {
        g.fillStyle = C.warn; g.shadowColor = C.warn; g.shadowBlur = 8;
        for (let k = 0; k < 3; k++) {
          const sx = x + k * TILE / 3;
          g.beginPath(); g.moveTo(sx, y + TILE); g.lineTo(sx + TILE / 6, y + TILE * 0.45); g.lineTo(sx + TILE / 3, y + TILE); g.fill();
        }
        g.shadowBlur = 0;
      }
    }));
    g.font = '700 16px "Segoe UI", system-ui, sans-serif'; g.fillStyle = C.dim; g.textAlign = 'left';
    g.fillText('fase ' + (L.index + 1) + '/' + LEVELS.length + ': ' + L.name, 16, H - 16);
    return (L.img = cv);
  }

  function body(ctx, c, fill, stroke, eyes) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(c.x - PW / 2, c.y - PH / 2, PW, PH, 6); ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    if (eyes) {
      const dir = c.vx >= 0 ? 1 : -1;
      ctx.fillStyle = '#05060f';
      ctx.fillRect(c.x + dir * 3 - 2, c.y - 7, 4, 6); ctx.fillRect(c.x + dir * 9 - 2, c.y - 7, 4, 6);
    }
  }

  function draw(ctx, w, agents, bestIdx, human, trail, C) {
    const img = levelImage(w.level, C);
    if (img) ctx.drawImage(img, 0, 0);
    // bandeira de chegada
    const gx = w.level.goal.tx * TILE, gy = w.level.goal.ty * TILE, pulse = 0.6 + 0.4 * Math.sin(w.t * 0.1);
    ctx.fillStyle = '#e8ecff'; ctx.fillRect(gx + 8, gy - 30, 4, TILE + 30);
    ctx.fillStyle = 'rgba(80,255,160,' + pulse + ')'; ctx.shadowColor = '#50ffa0'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.moveTo(gx + 12, gy - 30); ctx.lineTo(gx + 36, gy - 20); ctx.lineTo(gx + 12, gy - 10); ctx.fill();
    ctx.shadowBlur = 0;

    for (const c of agents) if (c.dead) { ctx.fillStyle = 'rgba(255,150,40,' + c.dead.t / 30 + ')'; ctx.fillRect(c.dead.x - 3, c.dead.y - 3, 6, 6); }
    const best = bestIdx >= 0 ? agents[bestIdx] : null;
    if (best && best.cells) {
      for (const cell of best.cells) {
        ctx.strokeStyle = 'rgba(255,60,200,0.35)'; ctx.lineWidth = 1;
        ctx.strokeRect(cell.tx * TILE + 2, cell.ty * TILE + 2, TILE - 4, TILE - 4);
        if (cell.v) {
          ctx.fillStyle = cell.v > 0 ? 'rgba(255,60,200,0.18)' : 'rgba(255,150,40,0.3)';
          ctx.fillRect(cell.tx * TILE + 2, cell.ty * TILE + 2, TILE - 4, TILE - 4);
        }
      }
    }
    for (let i = 0; i < agents.length; i++) {
      const c = agents[i];
      if (c.alive && i !== bestIdx) body(ctx, c, 'rgba(' + C.robot + ',0.35)');
    }
    if (best) { ctx.shadowColor = 'rgb(' + C.robot + ')'; ctx.shadowBlur = 12; body(ctx, best, 'rgb(' + C.robot + ')', '#fff', true); ctx.shadowBlur = 0; }
    if (human) {
      if (human.dead) { ctx.fillStyle = 'rgba(255,90,46,' + human.dead.t / 30 + ')'; ctx.beginPath(); ctx.arc(human.dead.x, human.dead.y, 30 - human.dead.t, 0, Math.PI * 2); ctx.fill(); }
      ctx.shadowColor = C.human; ctx.shadowBlur = 18;
      body(ctx, human, C.human, '#fff', true);
      ctx.shadowBlur = 0;
    }
  }

  const gridLabels = [];
  for (let dy = GY0; dy <= GY1; dy++) for (let dx = GX0; dx <= GX1; dx++) gridLabels.push('');
  const api = {
    id: 'plat', title: 'PLATAFORMA', hint: '◀ ▶ anda, botão pula — chegue na bandeira!',
    axis: 'x', maxSteps: MAX_STEPS, lowerIsBetter: true,
    nInputs: gridLabels.length + 3, nOutputs: 2,
    inputLabels: [...gridLabels, 'vel. →', 'vel. ↓', 'no chão'],
    outputLabels: ['andar', 'pular'],
    inputCaption: 'grade 5×5 em volta + velocidade',
    TRACKS: LEVELS, LEVELS, TILE, W, H,
    createWorld, stepWorld, createAgent, stepAgent, sensors, fitness, score, formatScore, hudText, draw, solidAt,
    humanAction: inp => [inp.axisX, inp.held && (inp.held.a || inp.held.up) ? 1 : -1],
    trailPoint: c => ({ x: c.x, y: c.y }),
  };
  root.HVM = root.HVM || {};
  root.HVM.Games = Object.assign(root.HVM.Games || {}, { plat: api });
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
