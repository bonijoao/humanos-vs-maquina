const test = require('node:test');
const assert = require('node:assert');
const { makeRng } = require('../src/rng.js');
const NN = require('../src/nn.js');
const Wd = require('../src/world.js');

test('forward é determinístico e saída fica em [-1, 1]', () => {
  const net = NN.createNet(makeRng(1));
  const inp = [0.5, -0.2, 0.9, 0.1, -0.7, 0.3];
  const a = NN.forward(net, inp), b = NN.forward(net, inp);
  assert.strictEqual(a.out, b.out);
  assert.strictEqual(a.hidden.length, 6);
  for (let i = 0; i < 100; i++) {
    const r = makeRng(i);
    const o = NN.forward(NN.createNet(r), inp.map(() => r() * 20 - 10)).out;
    assert.ok(o >= -1 && o <= 1);
  }
});

test('serialize/deserialize preserva a rede', () => {
  const net = NN.createNet(makeRng(3));
  const copy = NN.deserializeNet(NN.serializeNet(net));
  const inp = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  assert.strictEqual(NN.forward(copy, inp).out, NN.forward(net, inp).out);
  assert.deepStrictEqual(NN.serializeNet(copy), NN.serializeNet(net));
});

test('sensors devolve 6 números finitos e pequenos', () => {
  const w = Wd.createWorld(2);
  for (let i = 0; i < 200; i++) Wd.stepWorld(w);
  const s = NN.sensors(Wd.createDrone(), w);
  assert.strictEqual(s.length, 6);
  for (const v of s) assert.ok(Number.isFinite(v) && Math.abs(v) <= 3);
});
