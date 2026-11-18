const test = require('node:test');
const assert = require('node:assert');
const G = require('../src/games/race.js');

test('há pelo menos 3 pistas, todas fechadas e com nome', () => {
  assert.ok(G.TRACKS.length >= 3);
  for (let t = 0; t < G.TRACKS.length; t++) {
    const w = G.createWorld(1, { track: t });
    assert.ok(w.track.name);
    const p = w.track.pts, a = p[0], z = p[p.length - 1];
    assert.ok(Math.hypot(a.x - z.x, a.y - z.y) < 40, 'pista ' + t + ' fecha');
    // todos os pontos dentro da tela
    for (const q of p) assert.ok(q.x > 20 && q.x < G.W - 20 && q.y > 20 && q.y < G.H - 20);
  }
});

test('carro na largada está dentro da pista', () => {
  for (let t = 0; t < G.TRACKS.length; t++) {
    const w = G.createWorld(1, { track: t });
    const c = G.createAgent(w);
    assert.ok(G.onTrack(w, c.x, c.y));
  }
});

test('sem virar, o carro sai da pista e morre', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w);
  for (let i = 0; i < 2000 && c.alive; i++) { G.stepWorld(w); G.stepAgent(c, w, 0); }
  assert.strictEqual(c.alive, false);
});

test('em toda pista, um piloto que segue o centro completa uma volta (curvas possíveis)', () => {
  for (let t = 0; t < G.TRACKS.length; t++) {
    const w = G.createWorld(1, { track: t });
    const c = G.createAgent(w);
    for (let i = 0; i < 6000 && c.alive && c.laps < 1; i++) {
      G.stepWorld(w);
      G.stepAgent(c, w, G.autopilot(c, w));
    }
    assert.strictEqual(c.alive, true, 'pista ' + w.track.name);
    assert.ok(c.laps >= 1 && G.score(c) > 0);
  }
});

test('andar para trás não dá pontos e mata o carro', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w);
  c.ang += Math.PI; // vira de costas
  for (let i = 0; i < 2000 && c.alive; i++) { G.stepWorld(w); G.stepAgent(c, w, G.autopilot(c, w)); }
  assert.strictEqual(c.alive, false);
  assert.ok(G.fitness(c) <= 0);
});

test('carro parado/sem progresso morre por tempo', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w);
  for (let i = 0; i < 2000 && c.alive; i++) { G.stepWorld(w); c.vx = c.vy = 0; G.stepAgent(c, w, 0); c.x -= c.vx; c.y -= c.vy; }
  assert.strictEqual(c.alive, false);
});

test('sensores: nInputs números em [0,1]', () => {
  const w = G.createWorld(1, { track: 1 });
  const s = G.sensors(G.createAgent(w), w);
  assert.strictEqual(s.length, G.nInputs);
  assert.strictEqual(G.inputLabels.length, G.nInputs);
  for (const v of s) assert.ok(v >= 0 && v <= 1);
});
