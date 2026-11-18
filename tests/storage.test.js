const test = require('node:test');
const assert = require('node:assert');
const S = require('../src/storage.js');

function mem(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('storage vazio devolve estado padrão', () => {
  const s = S.loadState(mem());
  assert.deepStrictEqual(s, S.defaultState());
});

test('JSON lixo devolve estado padrão', () => {
  assert.deepStrictEqual(S.loadState(mem({ 'hvm.v1': '{lixo' })), S.defaultState());
  assert.deepStrictEqual(S.loadState(mem({ 'hvm.v1': '42' })), S.defaultState());
});

test('getItem que lança devolve estado padrão; setItem que lança não quebra', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.deepStrictEqual(S.loadState(bad), S.defaultState());
  assert.doesNotThrow(() => S.saveState(bad, S.defaultState()));
  assert.deepStrictEqual(S.loadState(null), S.defaultState());
});

test('salvar e carregar ida e volta', () => {
  const st = mem();
  const s = S.defaultState();
  s.generation = 7; s.bestMachine = 900; s.population = [[1, 2], [3]];
  S.addHumanScore(s, 'ANA', 300);
  S.saveState(st, s);
  assert.deepStrictEqual(S.loadState(st), JSON.parse(JSON.stringify(s)));
});

test('top 5 ordenado e truncado; rank correto', () => {
  const s = S.defaultState();
  [100, 500, 300, 200, 400].forEach((v, i) => S.addHumanScore(s, 'P' + i, v));
  assert.deepStrictEqual(S.addHumanScore(s, 'NEW', 350), { rank: 3 });
  assert.deepStrictEqual(S.addHumanScore(s, 'LOW', 10), { rank: null });
  assert.deepStrictEqual(s.humans.map(h => h.score), [500, 400, 350, 300, 200]);
  assert.strictEqual(S.bestHuman(s), 500);
});

test('qualifies diz se a pontuação entra no top 5', () => {
  const s = S.defaultState();
  assert.strictEqual(S.qualifies(s, 1), true);
  [100, 500, 300, 200, 400].forEach((v, i) => S.addHumanScore(s, 'P' + i, v));
  assert.strictEqual(S.qualifies(s, 50), false);
  assert.strictEqual(S.qualifies(s, 150), true);
});

test('resetMachine zera a máquina e mantém humanos', () => {
  const s = S.defaultState();
  s.generation = 9; s.bestMachine = 1000; s.population = [[1]];
  S.addHumanScore(s, 'ZE', 50);
  S.resetMachine(s);
  assert.strictEqual(s.generation, 1);
  assert.strictEqual(s.bestMachine, 0);
  assert.strictEqual(s.population, null);
  assert.strictEqual(s.humans.length, 1);
});
