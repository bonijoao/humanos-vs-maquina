(function (root) {
  const H = typeof module !== 'undefined'
    ? (require('./rng.js'), require('./world.js'), globalThis.HVM)
    : root.HVM;

  const NN_SHAPE = [6, 6, 1];
  const NI = NN_SHAPE[0], NH = NN_SHAPE[1];
  const N_PARAMS = NI * NH + NH + NH + 1;

  function createNet(rng) {
    const arr = new Array(N_PARAMS);
    for (let i = 0; i < N_PARAMS; i++) arr[i] = H.gauss(rng);
    return deserializeNet(arr);
  }

  function forward(net, inputs) {
    const hidden = new Array(NH);
    let out = net.b2;
    for (let j = 0; j < NH; j++) {
      let s = net.b1[j];
      for (let i = 0; i < NI; i++) s += net.w1[j * NI + i] * inputs[i];
      hidden[j] = Math.tanh(s);
      out += net.w2[j] * hidden[j];
    }
    return { hidden, out: Math.tanh(out) };
  }

  function sensors(drone, world) {
    const [o1, o2] = H.nextObstacles(world, H.DRONE_X);
    return [
      drone.y / H.H * 2 - 1,
      drone.vy / 10,
      (o1.x - H.DRONE_X) / H.W,
      (o1.gapY - drone.y) / H.H * 2,
      (o2.x - H.DRONE_X) / H.W,
      (o2.gapY - drone.y) / H.H * 2,
    ];
  }

  function serializeNet(net) {
    return [...net.w1, ...net.b1, ...net.w2, net.b2];
  }

  function deserializeNet(arr) {
    let k = 0;
    const take = n => Float32Array.from(arr.slice(k, (k += n)));
    const w1 = take(NI * NH), b1 = take(NH), w2 = take(NH);
    return { w1, b1, w2, b2: Math.fround(arr[k]) };
  }

  const api = { NN_SHAPE, N_PARAMS, createNet, forward, sensors, serializeNet, deserializeNet };
  root.HVM = Object.assign(root.HVM || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
