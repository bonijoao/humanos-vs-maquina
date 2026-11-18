const test = require('node:test');
const assert = require('node:assert');
const { makeRng } = require('../src/rng.js');
const NN = require('../src/nn.js');
const GA = require('../src/ga.js');
const GAMES = { drone: require('../src/games/drone.js') };
const RACE = require('../src/games/race.js');

test('nextGeneration devolve 50 redes e mantém as 5 melhores', () => {
  const rng = makeRng(10);
  const pop = Array.from({ length: 50 }, (_, i) => ({ net: NN.createNet(rng, 8), fitness: i }));
  const next = GA.nextGeneration(pop, rng);
  assert.strictEqual(next.length, 50);
  const best = pop.slice().sort((a, b) => b.fitness - a.fitness).slice(0, 5);
  for (let i = 0; i < 5; i++) assert.deepStrictEqual(NN.serializeNet(next[i]), NN.serializeNet(best[i].net));
  for (const n of next) assert.strictEqual(n.nIn, 8);
});

// A máquina precisa aprender, mas não pode dominar logo de cara: o público
// tem que VER a evolução (reclamação do primeiro teste: "na 3ª já ganhava").
for (const [id, game] of Object.entries(GAMES)) {
  test(id + ': aprende devagar — geração 3 bem pior que a 20, geração 20 bem melhor que a 1 (mediana de 3 sementes)', () => {
    const runs = [11, 22, 33].map(seed => {
      const rng = makeRng(seed);
      let nets = Array.from({ length: GA.POP_SIZE }, () => NN.createNet(rng, game.nInputs));
      const best = {};
      for (let g = 1; g <= 20; g++) {
        const fit = GA.evaluate(game, nets, seed * 1000 + g, game.maxSteps, { track: 0 });
        best[g] = Math.max(...fit);
        nets = GA.nextGeneration(nets.map((net, i) => ({ net, fitness: fit[i] })), rng);
      }
      return best;
    });
    const med = g => runs.map(r => r[g]).sort((a, b) => a - b)[1];
    const best = { 1: med(1), 3: med(3), 20: med(20) };
    const msg = `g1=${best[1]} g3=${best[3]} g20=${best[20]}`;
    assert.ok(best[20] >= 3 * best[1], 'aprende: ' + msg);
    assert.ok(best[3] < 0.6 * best[20], 'não domina cedo: ' + msg);
  });
}

// Corrida: bater só freia, então o que mostra a evolução é QUANTOS robôs terminam
// as 3 voltas e o tempo caindo. Na 1ª geração quase ninguém termina.
test('race: poucos terminam na geração 1; muitos terminam na 10, com tempo menor (mediana de 3 sementes)', () => {
  const runs = [11, 22, 33].map(seed => {
    const rng = makeRng(seed);
    let nets = Array.from({ length: GA.POP_SIZE }, () => NN.createNet(rng, RACE.nInputs));
    const r = {};
    for (let g = 1; g <= 10; g++) {
      const world = RACE.createWorld(seed * 1000 + g, { track: 0 });
      const agents = nets.map(() => RACE.createAgent(world));
      for (let s = 0; s < RACE.maxSteps; s++) {
        RACE.stepWorld(world);
        let alive = 0;
        agents.forEach((a, i) => { if (a.alive) { RACE.stepAgent(a, world, GA.act(RACE, nets[i], a, world)); if (a.alive) alive++; } });
        if (!alive) break;
      }
      const times = agents.map(RACE.score).filter(t => t !== null);
      r[g] = { fin: times.length, best: times.length ? Math.min(...times) : Infinity };
      const fit = agents.map(RACE.fitness);
      nets = GA.nextGeneration(nets.map((net, i) => ({ net, fitness: fit[i] })), rng);
    }
    return r;
  });
  const med = f => runs.map(f).sort((a, b) => a - b)[1];
  const fin1 = med(r => r[1].fin), fin10 = med(r => r[10].fin);
  const t1 = med(r => r[1].best), t10 = med(r => r[10].best);
  const msg = `fin1=${fin1} fin10=${fin10} t1=${t1} t10=${t10}`;
  assert.ok(fin1 <= 10, 'poucos no começo: ' + msg);
  assert.ok(fin10 >= 3 * Math.max(1, fin1), 'muitos depois: ' + msg);
  assert.ok(t10 < t1, 'tempo cai: ' + msg);
});

// Plataforma: na fase difícil, ninguém chega na 1ª geração; em até 25, alguns chegam.
test('plat: fase 3 — ninguém chega na geração 1, alguns chegam até a 25 (2 de 3 sementes)', () => {
  const P = require('../src/games/plat.js');
  const ok = [11, 22, 33].map(seed => {
    const rng = makeRng(seed);
    let nets = Array.from({ length: GA.POP_SIZE }, () => NN.createNet(rng, P.nInputs, P.nOutputs));
    let firstFin = null, gen1Fin = 0;
    for (let g = 1; g <= 25 && firstFin === null; g++) {
      const w = P.createWorld(g, { track: 2 }); const ag = nets.map(() => P.createAgent(w));
      for (let s = 0; s < P.maxSteps; s++) {
        P.stepWorld(w); let a = 0;
        ag.forEach((c, i) => { if (c.alive) { P.stepAgent(c, w, GA.act(P, nets[i], c, w)); if (c.alive) a++; } });
        if (!a) break;
      }
      const fin = ag.filter(c => c.finished).length;
      if (g === 1) gen1Fin = fin;
      if (fin && firstFin === null) firstFin = g;
      nets = GA.nextGeneration(nets.map((net, i) => ({ net, fitness: P.fitness(ag[i]) })), rng);
    }
    return gen1Fin === 0 && firstFin !== null;
  });
  assert.ok(ok.filter(Boolean).length >= 2, JSON.stringify(ok));
});
