(function (root) {
  const H = typeof module !== 'undefined' ? (require('./rng.js'), globalThis.HVM) : root.HVM;

  // rede pequena: nIn entradas -> HIDDEN neurônios (tanh) -> 1 saída (tanh)
  const HIDDEN = 8;
  const nParams = nIn => nIn * HIDDEN + HIDDEN + HIDDEN + 1;

  function createNet(rng, nIn) {
    const arr = new Array(nParams(nIn));
    for (let i = 0; i < arr.length; i++) arr[i] = H.gauss(rng);
    return deserializeNet(arr, nIn);
  }

  function forward(net, inputs) {
    const nIn = net.nIn, hidden = new Array(HIDDEN);
    let out = net.b2;
    for (let j = 0; j < HIDDEN; j++) {
      let s = net.b1[j];
      for (let i = 0; i < nIn; i++) s += net.w1[j * nIn + i] * inputs[i];
      hidden[j] = Math.tanh(s);
      out += net.w2[j] * hidden[j];
    }
    return { hidden, out: Math.tanh(out) };
  }

  function serializeNet(net) {
    return [...net.w1, ...net.b1, ...net.w2, net.b2];
  }

  function deserializeNet(arr, nIn) {
    let k = 0;
    const take = n => Float32Array.from(arr.slice(k, (k += n)));
    const w1 = take(nIn * HIDDEN), b1 = take(HIDDEN), w2 = take(HIDDEN);
    return { nIn, w1, b1, w2, b2: Math.fround(arr[k]) };
  }

  const api = { HIDDEN, nParams, createNet, forward, serializeNet, deserializeNet };
  root.HVM = Object.assign(root.HVM || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
