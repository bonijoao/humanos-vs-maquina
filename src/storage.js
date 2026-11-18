(function (root) {
  const KEY = 'hvm.v1', TOP = 5;

  function defaultState() {
    return { generation: 1, population: null, bestMachine: 0, humans: [] };
  }

  function valid(s) {
    return s && typeof s === 'object'
      && Number.isFinite(s.generation) && Number.isFinite(s.bestMachine)
      && Array.isArray(s.humans)
      && (s.population === null || Array.isArray(s.population));
  }

  function loadState(storage, key) {
    try {
      const raw = storage && storage.getItem(key || KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      return valid(s) ? s : defaultState();
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(storage, state, key) {
    try { storage && storage.setItem(key || KEY, JSON.stringify(state)); } catch (e) { /* sem espaço/bloqueado */ }
  }

  function qualifies(state, score) {
    return score > 0 && (state.humans.length < TOP || score > state.humans[TOP - 1].score);
  }

  function addHumanScore(state, name, score) {
    if (!qualifies(state, score)) return { rank: null };
    const entry = { name, score, date: new Date().toISOString().slice(0, 10) };
    state.humans.push(entry);
    state.humans.sort((a, b) => b.score - a.score);
    state.humans.length = Math.min(state.humans.length, TOP);
    return { rank: state.humans.indexOf(entry) + 1 };
  }

  function bestHuman(state) {
    return state.humans.length ? state.humans[0].score : 0;
  }

  function resetMachine(state) {
    state.generation = 1; state.population = null; state.bestMachine = 0;
  }

  const api = { defaultState, loadState, saveState, qualifies, addHumanScore, bestHuman, resetMachine };
  root.HVM = Object.assign(root.HVM || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
