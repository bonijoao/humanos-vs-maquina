const test = require('node:test');
const assert = require('node:assert');
const { makeRng } = require('../src/rng.js');
const NN = require('../src/nn.js');
const GA = require('../src/ga.js');

test('nextGeneration devolve 50 redes e mantém as 5 melhores', () => {
  const rng = makeRng(10);
  const pop = Array.from({ length: 50 }, (_, i) => ({ net: NN.createNet(rng), fitness: i }));
  const next = GA.nextGeneration(pop, rng);
  assert.strictEqual(next.length, 50);
  const best = pop.slice().sort((a, b) => b.fitness - a.fitness).slice(0, 5);
  for (let i = 0; i < 5; i++) {
    assert.deepStrictEqual(NN.serializeNet(next[i]), NN.serializeNet(best[i].net));
  }
});

test('a população aprende: geração 30 vai pelo menos 5x mais longe que a 1', () => {
  const rng = makeRng(123);
  let nets = Array.from({ length: GA.POP_SIZE }, () => NN.createNet(rng));
  let first = 0, last = 0;
  for (let g = 1; g <= 30; g++) {
    const fit = GA.evaluate(nets, 1000 + g, 5000);
    const best = Math.max(...fit);
    if (g === 1) first = best;
    last = best;
    nets = GA.nextGeneration(nets.map((net, i) => ({ net, fitness: fit[i] })), rng);
  }
  assert.ok(last >= 5 * first, `gen1=${first} gen30=${last}`);
});
