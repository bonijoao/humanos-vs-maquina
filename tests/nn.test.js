const test = require('node:test');
const assert = require('node:assert');
const { makeRng } = require('../src/rng.js');
const NN = require('../src/nn.js');

test('forward é determinístico e saída fica em [-1, 1]', () => {
  const net = NN.createNet(makeRng(1), 8);
  const inp = [0.5, -0.2, 0.9, 0.1, -0.7, 0.3, 0, 1];
  const a = NN.forward(net, inp), b = NN.forward(net, inp);
  assert.strictEqual(a.out, b.out);
  assert.strictEqual(a.hidden.length, NN.HIDDEN);
  for (let i = 0; i < 100; i++) {
    const r = makeRng(i);
    const o = NN.forward(NN.createNet(r, 8), inp.map(() => r() * 20 - 10)).out;
    assert.ok(o >= -1 && o <= 1);
  }
});

test('número de entradas é configurável', () => {
  const n5 = NN.createNet(makeRng(2), 5), n9 = NN.createNet(makeRng(2), 9);
  assert.strictEqual(n5.nIn, 5);
  assert.strictEqual(NN.serializeNet(n5).length, NN.nParams(5));
  assert.strictEqual(NN.serializeNet(n9).length, NN.nParams(9));
  assert.ok(NN.nParams(9) > NN.nParams(5));
});

test('serialize/deserialize preserva a rede', () => {
  const net = NN.createNet(makeRng(3), 7);
  const copy = NN.deserializeNet(NN.serializeNet(net), 7);
  const inp = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  assert.strictEqual(NN.forward(copy, inp).out, NN.forward(net, inp).out);
  assert.deepStrictEqual(NN.serializeNet(copy), NN.serializeNet(net));
});

test('rede com 2 saídas: outs tem 2 valores em [-1,1] e serialização ida e volta', () => {
  const net = NN.createNet(makeRng(5), 6, 2);
  assert.strictEqual(net.nOut, 2);
  const r = NN.forward(net, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
  assert.strictEqual(r.outs.length, 2);
  for (const o of r.outs) assert.ok(o >= -1 && o <= 1);
  assert.strictEqual(r.out, r.outs[0]);
  const arr = NN.serializeNet(net);
  assert.strictEqual(arr.length, NN.nParams(6, 2));
  const copy = NN.deserializeNet(arr, 6, 2);
  assert.deepStrictEqual(NN.forward(copy, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]).outs, r.outs);
});

test('rede de 1 saída mantém o formato antigo (placar/IA salvos continuam válidos)', () => {
  assert.strictEqual(NN.nParams(8), 8 * NN.HIDDEN + NN.HIDDEN + NN.HIDDEN + 1);
  assert.strictEqual(NN.nParams(8, 1), NN.nParams(8));
});
