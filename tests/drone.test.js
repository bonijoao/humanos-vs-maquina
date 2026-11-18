const test = require('node:test');
const assert = require('node:assert');
const { makeRng } = require('../src/rng.js');
const G = require('../src/games/drone.js');

test('rng com mesma semente gera mesma sequência', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 10; i++) assert.strictEqual(a(), b());
});

test('mesma semente gera os mesmos obstáculos', () => {
  const w1 = G.createWorld(7), w2 = G.createWorld(7);
  for (let i = 0; i < 2000; i++) { G.stepWorld(w1); G.stepWorld(w2); }
  const sig = w => w.obstacles.map(o => [o.x, o.baseY, o.gapH, o.amp]);
  assert.deepStrictEqual(sig(w1), sig(w2));
  assert.ok(w1.obstacles.length > 0);
});

function emptyWorld() {
  const w = G.createWorld(1); w.obstacles = []; w.spawnX = Infinity; return w;
}

test('com gravidade, sem empuxo o drone cai e morre no chão', () => {
  const w = emptyWorld(), d = G.createAgent(w);
  let i = 0;
  for (; i < 600 && d.alive; i++) { G.stepWorld(w); G.stepAgent(d, w, 0); }
  assert.strictEqual(d.alive, false);
  assert.ok(d.y > G.H / 2);
});

test('empuxo máximo para cima mata no teto', () => {
  const w = emptyWorld(), d = G.createAgent(w);
  for (let i = 0; i < 600 && d.alive; i++) { G.stepWorld(w); G.stepAgent(d, w, -1); }
  assert.strictEqual(d.alive, false);
  assert.ok(d.y < G.H / 2);
});

test('empuxo de equilíbrio mantém o drone vivo (tem inércia, não para na hora)', () => {
  const w = emptyWorld(), d = G.createAgent(w);
  for (let i = 0; i < 300; i++) { G.stepWorld(w); G.stepAgent(d, w, G.HOVER); }
  assert.strictEqual(d.alive, true);
  // inércia: depois de soltar, ele continua caindo por alguns passos
  d.vy = 0; G.stepAgent(d, w, 0); G.stepAgent(d, w, 0);
  const v = d.vy; G.stepAgent(d, w, G.HOVER);
  assert.ok(d.vy > 0 && v > 0);
});

test('drone fora da brecha morre ao encostar no obstáculo', () => {
  const w = emptyWorld();
  w.obstacles = [{ x: G.DRONE_X + 30, baseY: 100, gapY: 100, gapH: 200, amp: 0, phase: 0 }];
  const d = G.createAgent(w);
  for (let i = 0; i < 60 && d.alive; i++) { G.stepWorld(w); G.stepAgent(d, w, G.HOVER); }
  assert.strictEqual(d.alive, false);
});

test('brechas móveis se mexem; brechas paradas não', () => {
  const w = emptyWorld();
  w.obstacles = [
    { x: 900, baseY: 360, gapY: 360, gapH: 200, amp: 80, phase: 0 },
    { x: 1200, baseY: 360, gapY: 360, gapH: 200, amp: 0, phase: 0 },
  ];
  const ys = [];
  for (let i = 0; i < 60; i++) { G.stepWorld(w); ys.push(w.obstacles[0].gapY); }
  assert.ok(Math.max(...ys) - Math.min(...ys) > 40);
  assert.strictEqual(w.obstacles[1].gapY, 360);
});

test('sensores: 8 números em [-1.5, 1.5]; raio para baixo vê o chão perto', () => {
  const w = emptyWorld(), d = G.createAgent(w);
  d.y = G.H - 40;
  const s = G.sensors(d, w);
  assert.strictEqual(s.length, G.nInputs);
  assert.strictEqual(G.inputLabels.length, G.nInputs);
  for (const v of s) assert.ok(Number.isFinite(v) && Math.abs(v) <= 1.5);
  // último raio aponta mais para baixo: chão perto => valor alto
  assert.ok(s[G.N_RAYS - 1] > 0.6, String(s[G.N_RAYS - 1]));
  assert.ok(s[0] < 0.3, String(s[0])); // raio para cima: teto longe
});

test('velocidade cresce mas nunca passa do máximo', () => {
  const w = G.createWorld(5), v0 = w.speed;
  for (let i = 0; i < 100000; i++) G.stepWorld(w);
  assert.ok(w.speed > v0 && w.speed <= G.SPEED_MAX);
});
