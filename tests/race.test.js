const test = require('node:test');
const assert = require('node:assert');
const G = require('../src/games/race.js');

function drive(c, w, steps, pilot) {
  for (let i = 0; i < steps && c.alive; i++) { G.stepWorld(w); G.stepAgent(c, w, pilot ? pilot(c, w) : 0); }
}

test('há 5 pistas, todas fechadas, com nome e dentro da tela; largada dentro da pista', () => {
  assert.strictEqual(G.TRACKS.length, 5);
  for (let t = 0; t < G.TRACKS.length; t++) {
    const w = G.createWorld(1, { track: t });
    assert.ok(w.track.name);
    const p = w.track.pts, a = p[0], z = p[p.length - 1];
    assert.ok(Math.hypot(a.x - z.x, a.y - z.y) < 40, 'pista ' + t + ' fecha');
    for (const q of p) assert.ok(q.x > 60 && q.x < G.W - 60 && q.y > 60 && q.y < G.H - 60, w.track.name + ' cabe na tela');
    const c = G.createAgent(w);
    assert.ok(G.onTrack(w, c.x, c.y));
  }
});

test('em toda pista, um piloto bom termina as 3 voltas e tem tempo', () => {
  for (let t = 0; t < G.TRACKS.length; t++) {
    const w = G.createWorld(1, { track: t });
    const c = G.createAgent(w);
    drive(c, w, G.maxSteps, G.autopilot);
    assert.strictEqual(c.finished, true, 'pista ' + w.track.name);
    assert.strictEqual(c.laps, G.LAPS);
    const s = G.score(c);
    assert.ok(Number.isFinite(s) && s > 5 && s < 90, w.track.name + ' tempo ' + s);
  }
});

test('bater na parede não elimina o humano: só freia', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w, { human: true });
  let minAfterHit = Infinity, hit = false;
  for (let i = 0; i < 900; i++) {
    G.stepWorld(w); const before = c.speed; G.stepAgent(c, w, 0);
    if (c.bumped) { hit = true; minAfterHit = Math.min(minAfterHit, c.speed / Math.max(before, 0.01)); }
  }
  assert.ok(hit, 'bateu');
  assert.strictEqual(c.alive, true);
  assert.ok(minAfterHit < 0.5, 'perdeu velocidade: ' + minAfterHit);
  assert.ok(G.onTrack(w, c.x, c.y), 'continua dentro da pista');
});

test('robô parado na parede sem progresso é eliminado (para a geração andar)', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w);
  drive(c, w, 2000);
  assert.strictEqual(c.alive, false);
  assert.strictEqual(c.finished, false);
  assert.strictEqual(G.score(c), null);
});

test('fitness: terminar rápido > terminar devagar > ir longe > ir perto', () => {
  const f = (o) => G.fitness(Object.assign({ best: 0, finished: false, finishStep: 0 }, o));
  const n = G.createWorld(1, { track: 0 }).track.pts.length;
  const fast = f({ best: 3 * n, finished: true, finishStep: 1500 });
  const slow = f({ best: 3 * n, finished: true, finishStep: 3000 });
  const far = f({ best: 2 * n });
  const near = f({ best: 50 });
  assert.ok(fast > slow && slow > far && far > near);
});

test('andar para trás não dá pontos e elimina o robô', () => {
  const w = G.createWorld(1, { track: 0 });
  const c = G.createAgent(w);
  c.ang += Math.PI;
  // piloto na contramão: mira um ponto ATRÁS na linha central
  const backwards = (c, w) => {
    const p = w.track.pts, n = p.length, tgt = p[(c.idx - 10 + n) % n];
    const diff = Math.atan2(tgt.y - c.y, tgt.x - c.x) - c.ang;
    return Math.max(-1, Math.min(1, Math.atan2(Math.sin(diff), Math.cos(diff)) * 3));
  };
  drive(c, w, 2000, backwards);
  assert.strictEqual(c.alive, false);
  assert.ok(G.fitness(c) <= 0);
});

test('sensores: nInputs números em [0,1]', () => {
  const w = G.createWorld(1, { track: 1 });
  const s = G.sensors(G.createAgent(w), w);
  assert.strictEqual(s.length, G.nInputs);
  assert.strictEqual(G.inputLabels.length, G.nInputs);
  for (const v of s) assert.ok(v >= 0 && v <= 1);
});
