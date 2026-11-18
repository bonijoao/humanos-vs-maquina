// Diagnóstico da plataforma: progresso por geração + piloto heurístico
const { makeRng } = require('../src/rng.js');
const NN = require('../src/nn.js'), GA = require('../src/ga.js'), G = require('../src/games/plat.js');
const lvl = +(process.argv[2] || 0), GENS = +(process.argv[3] || 30);
// piloto heurístico: corre e pula quando há buraco/espinho/parede logo à frente
function pilot(c, w) {
  const T = G.TILE, tx = Math.floor((c.x + 30) / T), ty = Math.floor(c.y / T);
  const row = r => (w.level.rows[r] || '').padEnd(32, '.');
  const ahead = row(ty)[tx], below = row(ty + 1)[tx], below2 = row(ty + 1)[tx + 1];
  const danger = ahead === '#' || ahead === '^' || below !== '#' || below2 === '^' || below2 === '.';
  return [1, danger ? 1 : -1];
}
{ const w = G.createWorld(1, { track: lvl }); const c = G.createAgent(w);
  for (let i = 0; i < G.maxSteps && c.alive; i++) { G.stepWorld(w); G.stepAgent(c, w, pilot(c, w)); }
  console.log('heurístico:', c.finished ? 'chegou ' + G.score(c) + 's' : 'morreu em x=' + Math.round(c.x / G.TILE) + ' y=' + Math.round(c.y / G.TILE)); }
const rng = makeRng(7);
let nets = Array.from({ length: GA.POP_SIZE }, () => NN.createNet(rng, G.nInputs, G.nOutputs));
const out = [];
for (let g = 1; g <= GENS; g++) {
  const w = G.createWorld(g, { track: lvl }); const ag = nets.map(() => G.createAgent(w));
  for (let s = 0; s < G.maxSteps; s++) { G.stepWorld(w); let a = 0; ag.forEach((c, i) => { if (c.alive) { G.stepAgent(c, w, GA.act(G, nets[i], c, w)); if (c.alive) a++; } }); if (!a) break; }
  const D = w.level.dist[w.level.start.ty][w.level.start.tx];
  const prog = Math.max(...ag.map(c => D - c.bestDist)), fin = ag.filter(c => c.finished);
  if (g <= 5 || g % 5 === 0) out.push(`g${g}:${prog}/${D}${fin.length ? ' fin' + fin.length + ' ' + Math.min(...fin.map(G.score)) + 's' : ''}`);
  nets = GA.nextGeneration(nets.map((net, i) => ({ net, fitness: G.fitness(ag[i]) })), rng);
}
console.log(out.join(' | '));
