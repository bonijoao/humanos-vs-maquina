(function (root) {
  const H = typeof module !== 'undefined'
    ? (require('./rng.js'), require('./nn.js'), globalThis.HVM)
    : root.HVM;

  const POP_SIZE = 50, ELITE = 5, RANDOM_NEW = 5, TOURNAMENT = 3;
  const MUT_PROB = 0.1, MUT_SIGMA = 0.3;

  function tournament(sorted, rng) {
    let best = null;
    for (let i = 0; i < TOURNAMENT; i++) {
      const c = sorted[Math.floor(rng() * sorted.length)];
      if (!best || c.fitness > best.fitness) best = c;
    }
    return best;
  }

  function mutate(net, rng) {
    const arr = H.serializeNet(net);
    for (let i = 0; i < arr.length; i++) if (rng() < MUT_PROB) arr[i] += H.gauss(rng) * MUT_SIGMA;
    return H.deserializeNet(arr, net.nIn, net.nOut);
  }

  // pop: [{net, fitness}] -> net[] (elite primeiro, na ordem de fitness)
  function nextGeneration(pop, rng) {
    const nIn = pop[0].net.nIn, nOut = pop[0].net.nOut || 1;
    const sorted = pop.slice().sort((a, b) => b.fitness - a.fitness);
    const next = sorted.slice(0, ELITE).map(p => H.deserializeNet(H.serializeNet(p.net), nIn, nOut));
    const size = pop.length;
    while (next.length < size - RANDOM_NEW) next.push(mutate(tournament(sorted, rng).net, rng));
    while (next.length < size) next.push(H.createNet(rng, nIn, nOut));
    return next;
  }

  function act(game, net, agent, world) {
    const r = H.forward(net, game.sensors(agent, world));
    return (game.nOutputs || 1) > 1 ? r.outs : r.out;
  }

  // simula uma geração inteira sem desenhar; devolve o fitness de cada rede
  function evaluate(game, nets, seed, maxSteps, opts) {
    const world = game.createWorld(seed, opts);
    const agents = nets.map(() => game.createAgent(world));
    for (let s = 0; s < maxSteps; s++) {
      game.stepWorld(world);
      let alive = 0;
      for (let i = 0; i < nets.length; i++) {
        const a = agents[i];
        if (!a.alive) continue;
        game.stepAgent(a, world, act(game, nets[i], a, world));
        if (a.alive) alive++;
      }
      if (!alive) break;
    }
    return agents.map(game.fitness);
  }

  const api = { POP_SIZE, nextGeneration, evaluate, act };
  root.HVM = Object.assign(root.HVM || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
