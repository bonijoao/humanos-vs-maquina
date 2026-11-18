(function (root) {
  const H = typeof module !== 'undefined' ? (require('./rng.js'), globalThis.HVM) : root.HVM;

  // rede pequena: nIn entradas -> HIDDEN neurônios (tanh) -> nOut saídas (tanh)
  const HIDDEN = 8;
  const nParams = (nIn, nOut = 1) => nIn * HIDDEN + HIDDEN + HIDDEN * nOut + nOut;

  function createNet(rng, nIn, nOut = 1) {
    const arr = new Array(nParams(nIn, nOut));
    for (let i = 0; i < arr.length; i++) arr[i] = H.gauss(rng);
    return deserializeNet(arr, nIn, nOut);
  }

  function forward(net, inputs) {
    const nIn = net.nIn, nOut = net.nOut, hidden = new Array(HIDDEN);
    for (let j = 0; j < HIDDEN; j++) {
      let s = net.b1[j];
      for (let i = 0; i < nIn; i++) s += net.w1[j * nIn + i] * inputs[i];
      hidden[j] = Math.tanh(s);
    }
    const outs = new Array(nOut);
    for (let o = 0; o < nOut; o++) {
      let s = net.b2s[o];
      for (let j = 0; j < HIDDEN; j++) s += net.w2[o * HIDDEN + j] * hidden[j];
      outs[o] = Math.tanh(s);
    }
    return { hidden, outs, out: outs[0] };
  }

  function serializeNet(net) {
    return [...net.w1, ...net.b1, ...net.w2, ...net.b2s];
  }

  function deserializeNet(arr, nIn, nOut = 1) {
    let k = 0;
    const take = n => Float32Array.from(arr.slice(k, (k += n)));
    const w1 = take(nIn * HIDDEN), b1 = take(HIDDEN), w2 = take(HIDDEN * nOut), b2s = take(nOut);
    return { nIn, nOut, w1, b1, w2, b2s, b2: b2s[0] };
  }

  const api = { HIDDEN, nParams, createNet, forward, serializeNet, deserializeNet };
  root.HVM = Object.assign(root.HVM || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
