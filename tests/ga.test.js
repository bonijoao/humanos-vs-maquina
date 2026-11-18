const test = require('node:test');
const assert = require('node:assert');
const { makeRng } = require('../src/rng.js');
const NN = require('../src/nn.js');
const GA = require('../src/ga.js');
const GAMES = { drone: require('../src/games/drone.js'), race: require('../src/games/race.js') };

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
