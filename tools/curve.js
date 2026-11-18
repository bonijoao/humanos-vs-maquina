// Mede a curva de aprendizado: node tools/curve.js drone [gerações] [sementes]
const { makeRng } = require('../src/rng.js');
const NN = require('../src/nn.js');
const GA = require('../src/ga.js');
const game = require('../src/games/' + (process.argv[2] || 'drone') + '.js');
const GENS = +process.argv[3] || 40, SEEDS = +process.argv[4] || 3;
const opts = process.argv[5] ? JSON.parse(process.argv[5]) : undefined;

for (let seed = 1; seed <= SEEDS; seed++) {
  const rng = makeRng(seed * 7);
  let nets = Array.from({ length: GA.POP_SIZE }, () => NN.createNet(rng, game.nInputs));
  let steps = 0; const out = [];
  for (let g = 1; g <= GENS; g++) {
    // conta passos simulados = tempo real a x1 (60 passos/s)
    const world = game.createWorld(seed * 1000 + g, opts);
    const agents = nets.map(() => game.createAgent(world));
    let s = 0;
    for (; s < game.maxSteps; s++) {
      game.stepWorld(world);
      let alive = 0;
      for (let i = 0; i < nets.length; i++) {
        const a = agents[i]; if (!a.alive) continue;
        game.stepAgent(a, world, GA.act(game, nets[i], a, world)); if (a.alive) alive++;
      }
      if (!alive) break;
    }
    steps += s;
    const fit = agents.map(game.fitness);
    const sc = agents.map(game.score).filter(s => s !== null);
    const best = game.lowerIsBetter ? (sc.length ? Math.min(...sc) + "s(" + sc.length + "fin)" : "dnf:" + Math.max(...agents.map(a => a.laps || 0)) + "v") : Math.max(...sc);
    if (g <= 5 || g % 5 === 0) out.push(`g${g}:${best}@${Math.round(steps / 60)}s`);
    nets = GA.nextGeneration(nets.map((net, i) => ({ net, fitness: fit[i] })), rng);
  }
  console.log(out.join(' '));
}
