const test = require('node:test');
const assert = require('node:assert');
const G = require('../src/games/plat.js');

const run = (c, w, steps, act) => { for (let i = 0; i < steps && c.alive; i++) { G.stepWorld(w); G.stepAgent(c, w, act(c, i)); } };

test('3 fases, 40×22, com início S e chegada G alcançáveis (BFS)', () => {
  assert.strictEqual(G.LEVELS.length, 3);
  for (let l = 0; l < 3; l++) {
    const w = G.createWorld(1, { track: l });
    assert.ok(w.level.name);
    assert.strictEqual(w.level.rows.length, 22);
    for (const r of w.level.rows) assert.strictEqual(r.length, 40, w.level.name);
    assert.ok(Number.isFinite(w.level.dist[w.level.start.ty][w.level.start.tx]), w.level.name + ': chegada alcançável');
  }
});

test('parado, o personagem fica em pé no chão (gravidade + colisão)', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w);
  run(c, w, 120, () => [0, -1]);
  assert.strictEqual(c.alive, true);
  assert.strictEqual(c.onGround, true);
  assert.strictEqual(G.solidAt(w, c.x, c.y + c.h / 2 + 1), true);
});

test('pular sobe uns 100 px (≈3 blocos) e volta ao chão', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w);
  run(c, w, 60, () => [0, -1]);
  const y0 = c.y; let minY = y0;
  run(c, w, 80, (c, i) => { minY = Math.min(minY, c.y); return [0, i < 30 ? 1 : -1]; });
  const px = y0 - minY;
  assert.ok(px > 90 && px < 130, 'altura do pulo: ' + px);
  assert.strictEqual(c.onGround, true);
});

test('andar para a direita sem pular: robô morre (buraco ou espinho)', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w);
  run(c, w, 2000, () => [1, -1]);
  assert.strictEqual(c.alive, false);
  assert.strictEqual(c.finished, false);
  assert.strictEqual(G.score(c), null);
});

test('humano que morre volta ao início com o relógio correndo', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w, { human: true });
  run(c, w, 600, () => [1, -1]);
  assert.strictEqual(c.alive, true);
  assert.ok(c.deaths >= 1);
  assert.strictEqual(c.steps, 600);
});

test('fitness: chegar rápido > chegar devagar > chegar perto > ficar longe', () => {
  const w = G.createWorld(1, { track: 0 });
  const base = { bestDist: 0, finished: false, finishStep: 0, level: w.level };
  const f = o => G.fitness(Object.assign({}, base, o));
  const D = w.level.dist[w.level.start.ty][w.level.start.tx];
  assert.ok(f({ finished: true, finishStep: 300 }) > f({ finished: true, finishStep: 600 }));
  assert.ok(f({ finished: true, finishStep: 600 }) > f({ bestDist: 1 }));
  assert.ok(f({ bestDist: 1 }) > f({ bestDist: D }));
});

test('sensores: nInputs números finitos em [-1, 1]; 2 saídas', () => {
  const w = G.createWorld(1, { track: 1 });
  const s = G.sensors(G.createAgent(w), w);
  assert.strictEqual(s.length, G.nInputs);
  assert.strictEqual(G.nOutputs, 2);
  for (const v of s) assert.ok(Number.isFinite(v) && v >= -1 && v <= 1);
});

test('começo tranquilo: pelo menos 6 blocos de chão livre antes do primeiro obstáculo, em toda fase', () => {
  for (let l = 0; l < 3; l++) {
    const L = G.createWorld(1, { track: l }).level, y = L.start.ty;
    let x = L.start.tx;
    while (x < 40 && L.rows[y][x] !== '^' && L.rows[y + 1][x] === '#' && L.rows[y][x] !== '#') x++;
    assert.ok(x - L.start.tx >= 6, L.name + ': ' + (x - L.start.tx) + ' blocos livres');
  }
});

test('humano: tocar o pulo um pouco antes de cair no chão ainda pula (jump buffer)', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w, { human: true });
  run(c, w, 60, () => [0, -1]);            // parado no chão
  c.y -= 20; c.vy = 2; c.onGround = false; c.air = 20; // caindo, perto do chão
  G.stepWorld(w); G.stepAgent(c, w, [0, 1]); // toca o botão no ar
  let jumped = false;
  for (let i = 0; i < 10; i++) { G.stepWorld(w); G.stepAgent(c, w, [0, -1]); if (c.vy < -3) jumped = true; } // toque = pulo curto
  assert.ok(jumped);
});
