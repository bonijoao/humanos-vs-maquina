const test = require('node:test');
const assert = require('node:assert');
const { makeRng } = require('../src/rng.js');
const W = require('../src/world.js');

test('rng com mesma semente gera mesma sequência', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 10; i++) {
    const x = a();
    assert.strictEqual(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('mesma semente gera os mesmos obstáculos', () => {
  const w1 = W.createWorld(7), w2 = W.createWorld(7);
  for (let i = 0; i < 2000; i++) { W.stepWorld(w1); W.stepWorld(w2); }
  assert.deepStrictEqual(
    w1.obstacles.map(o => [o.x, o.gapY, o.gapH]),
    w2.obstacles.map(o => [o.x, o.gapY, o.gapH]));
  assert.ok(w1.obstacles.length > 0);
});

function worldWithObstacle(gapY) {
  const w = W.createWorld(1);
  w.obstacles = [{ x: W.DRONE_X + 30, gapY, gapH: 200, passed: false }];
  w.spawnX = Infinity; // sem novos obstáculos
  return w;
}

test('drone fora da brecha morre ao encostar no obstáculo', () => {
  const w = worldWithObstacle(100); // brecha em cima
  const d = W.createDrone();        // drone no centro (y = H/2)
  for (let i = 0; i < 60 && d.alive; i++) { W.stepWorld(w); W.stepDrone(d, w, 0); }
  assert.strictEqual(d.alive, false);
});

test('drone dentro da brecha sobrevive e acumula distância', () => {
  const w = worldWithObstacle(W.H / 2);
  const d = W.createDrone();
  for (let i = 0; i < 120; i++) { W.stepWorld(w); W.stepDrone(d, w, 0); }
  assert.strictEqual(d.alive, true);
  assert.ok(d.distance > 100);
});

test('bater no teto ou no chão mata o drone', () => {
  for (const action of [-1, 1]) {
    const w = W.createWorld(3); w.obstacles = []; w.spawnX = Infinity;
    const d = W.createDrone();
    for (let i = 0; i < 600 && d.alive; i++) { W.stepWorld(w); W.stepDrone(d, w, action); }
    assert.strictEqual(d.alive, false, 'action ' + action);
  }
});

test('velocidade cresce mas nunca passa do máximo', () => {
  const w = W.createWorld(5);
  const v0 = w.speed;
  for (let i = 0; i < 100000; i++) W.stepWorld(w);
  assert.ok(w.speed > v0);
  assert.ok(w.speed <= W.SPEED_MAX);
});

test('nextObstacles devolve os dois próximos à frente', () => {
  const w = W.createWorld(9);
  for (let i = 0; i < 300; i++) W.stepWorld(w);
  const [a, b] = W.nextObstacles(w, W.DRONE_X);
  assert.ok(a.x + W.OBST_W >= W.DRONE_X - W.DRONE_R);
  assert.ok(b.x > a.x);
});
