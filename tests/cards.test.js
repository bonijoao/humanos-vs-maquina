const test = require('node:test');
const assert = require('node:assert');
const { CARDS, nextCard } = require('../src/cards.js');

test('cartões têm tag válida, título e texto', () => {
  assert.ok(CARDS.length >= 10);
  for (const c of CARDS) {
    assert.ok(['agora', 'mundo', 'alem', 'ufla'].includes(c.tag), c.title);
    assert.ok(c.title && c.body);
  }
});

test('nextCard alterna entre tags e nunca quebra com índice grande', () => {
  const tags = [0, 1, 2, 3].map(i => nextCard(i).tag);
  assert.strictEqual(new Set(tags).size, 4);
  assert.ok(nextCard(123456).title);
});
