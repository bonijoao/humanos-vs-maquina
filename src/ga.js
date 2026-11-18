(function (root) {
  const H = typeof module !== 'undefined'
    ? (require('./rng.js'), require('./world.js'), require('./nn.js'), globalThis.HVM)
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
    for (let i = 0; i < arr.length; i++) {
      if (rng() < MUT_PROB) arr[i] += H.gauss(rng) * MUT_SIGMA;
    }
    return H.deserializeNet(arr);
  }

  // pop: [{net, fitness}] -> net[] (elite primeiro, na ordem de fitness)
  function nextGeneration(pop, rng) {
    const sorted = pop.slice().sort((a, b) => b.fitness - a.fitness);
    const next = sorted.slice(0, ELITE).map(p => H.deserializeNet(H.serializeNet(p.net)));
    while (next.length < POP_SIZE - RANDOM_NEW) next.push(mutate(tournament(sorted, rng).net, rng));
    while (next.length < POP_SIZE) next.push(H.createNet(rng));
    return next;
  }

  function act(net, drone, world) {
    return H.forward(net, H.sensors(drone, world)).out;
  }

  // simula uma geração inteira sem desenhar; devolve as distâncias
  function evaluate(nets, seed, maxSteps) {
    const world = H.createWorld(seed);
    const drones = nets.map(() => H.createDrone());
    for (let s = 0; s < maxSteps; s++) {
      H.stepWorld(world);
      let alive = 0;
      for (let i = 0; i < nets.length; i++) {
        const d = drones[i];
        if (!d.alive) continue;
        H.stepDrone(d, world, act(nets[i], d, world));
        if (d.alive) alive++;
      }
      if (!alive) break;
    }
    return drones.map(d => d.distance);
  }

  const api = { POP_SIZE, nextGeneration, evaluate, act };
  root.HVM = Object.assign(root.HVM || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
