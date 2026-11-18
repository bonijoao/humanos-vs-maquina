(function () {
  const H = window.HVM, R = H.Render, In = H.Input;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const STEP = 1 / 60, MAX_TICKS = 5;
  const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const rng = H.makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const GAMES = [H.Games.race, H.Games.plat, H.Games.drone];
  const GAME_KEY = 'hvm.game';

  // ---------- estado ----------
  let gameIdx = 0;
  try { gameIdx = Math.max(0, GAMES.findIndex(g => g.id === ls.getItem(GAME_KEY))); } catch (e) { /* padrão */ }
  let game, save, nets;
  let world, agents, human = null, trail = [], genSteps = 0;
  let mode = 'ATTRACT', modeT = 0, speedMul = 1;
  let result = null, nameEntry = null, toast = null;
  let cardIdx = Math.floor(rng() * 100), attractCard = null, attractCardT = 0;

  const saveKey = g => 'hvm.v3.' + g.id; // v3: regras novas (nave mais fácil, corrida por tempo)
  const popSize = () => game.popSize || H.POP_SIZE;
  const newPopulation = () => Array.from({ length: popSize() }, () => H.createNet(rng, game.nInputs, game.nOutputs || 1));

  function loadGame(i) {
    gameIdx = (i + GAMES.length) % GAMES.length;
    game = GAMES[gameIdx];
    save = H.loadState(ls, saveKey(game));
    if (!Number.isInteger(save.track)) save.track = 0;
    nets = restorePopulation(save.population);
    try { ls.setItem(GAME_KEY, game.id); } catch (e) { /* sem storage */ }
    startRun(false);
  }

  function restorePopulation(pop) {
    const n = H.nParams(game.nInputs, game.nOutputs || 1);
    try {
      if (Array.isArray(pop) && pop.length === popSize() &&
          pop.every(p => Array.isArray(p) && p.length === n && p.every(Number.isFinite))) {
        return pop.map(p => H.deserializeNet(p, game.nInputs, game.nOutputs || 1));
      }
    } catch (e) { /* cai para população nova */ }
    return newPopulation();
  }

  function startRun(withHuman) {
    world = game.createWorld((rng() * 4294967296) >>> 0, { track: save.track });
    agents = nets.map(() => game.createAgent(world));
    human = withHuman ? game.createAgent(world, { human: true }) : null;
    trail = []; genSteps = 0;
  }

  function finishGeneration() {
    const fit = agents.map(game.fitness);
    const best = bestScore(agents.map(game.score));
    const r = rec();
    if (best !== null && (!r.bestMachine || better(best, r.bestMachine))) r.bestMachine = best;
    nets = H.nextGeneration(nets.map((net, i) => ({ net, fitness: fit[i] })), rng);
    save.generation++;
    save.population = nets.map(H.serializeNet);
    H.saveState(ls, save, saveKey(game));
    return best;
  }

  // recorde e top 5 são por pista/fase (tempos de pistas diferentes não se comparam);
  // a IA (população) é a mesma em todas
  function rec() {
    if (!game.TRACKS) return save;
    if (!save.records || typeof save.records !== 'object') save.records = {};
    const k = String(save.track);
    const r = save.records[k];
    if (!r || !Array.isArray(r.humans)) save.records[k] = { bestMachine: 0, humans: [] };
    return save.records[k];
  }

  // placar: na corrida vale o MENOR tempo; null = não terminou
  const asc = () => !!game.lowerIsBetter;
  const better = (a, b) => (asc() ? a < b : a > b);
  function bestScore(list) {
    const ok = list.filter(s => s !== null && Number.isFinite(s) && s > 0);
    return ok.length ? (asc() ? Math.min(...ok) : Math.max(...ok)) : null;
  }
  const fmt = s => (game.formatScore ? game.formatScore(s) : String(s || 0));

  function robotsAlive() { let n = 0; for (const a of agents) if (a.alive) n++; return n; }

  function bestAliveIdx() {
    let bi = -1, bf = -Infinity;
    for (let i = 0; i < agents.length; i++) {
      if (!agents[i].alive) continue;
      const f = game.fitness(agents[i]) - i * 1e-6; // empate: a elite (começo do vetor) ganha
      if (f > bf) { bf = f; bi = i; }
    }
    return bi;
  }

  function stepSim(humanAction) {
    game.stepWorld(world);
    genSteps++;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.alive) game.stepAgent(a, world, H.act(game, nets[i], a, world));
    }
    if (human && human.alive) {
      game.stepAgent(human, world, humanAction);
      if (genSteps % 2 === 0) { trail.push(game.trailPoint(human)); if (trail.length > 22) trail.shift(); }
    }
  }

  function setMode(m) { mode = m; modeT = 0; }
  function showToast(s) { toast = { s, t: 2.5 }; }
  function nextCard() { return H.nextCard ? H.nextCard(cardIdx++) : null; }

  // ---------- operador ----------
  In.onOperator(cmd => {
    if (cmd === 'fullscreen') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
      return;
    }
    if (mode !== 'ATTRACT') { showToast('comandos do operador só na tela de espera'); return; }
    if (cmd === 'speed1') speedMul = 1;
    if (cmd === 'speed5') speedMul = 5;
    if (cmd === 'speed20') speedMul = 20;
    if (cmd.startsWith('speed')) showToast('treino ×' + speedMul);
    if (cmd === 'reset') {
      H.resetMachine(save);
      Object.values(save.records || {}).forEach(r => { r.bestMachine = 0; });
      nets = newPopulation();
      H.saveState(ls, save, saveKey(game));
      startRun(false);
      showToast('IA resetada — começando do zero');
    }
    if (cmd === 'game') {
      H.saveState(ls, save, saveKey(game));
      loadGame(gameIdx + 1);
      showToast('jogo: ' + game.title);
    }
    if (cmd === 'track') {
      if (!game.TRACKS) { showToast('este jogo não tem pistas'); return; }
      save.track = (save.track + 1) % game.TRACKS.length;
      H.saveState(ls, save, saveKey(game));
      startRun(false);
      showToast(trackWord() + ' nova: ' + game.TRACKS[save.track].name + ' — a IA nunca viu esta!');
    }
  });

  // ---------- modos ----------
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const NAME_TIMEOUT = 20; // segundos sem mexer na tela de nome

  function humanAction(inp) { return game.humanAction ? game.humanAction(inp) : game.axis === 'x' ? inp.axisX : inp.axis; }

  function update(ticks, inp) {
    const dt = ticks * STEP;
    modeT += dt;
    if (toast && (toast.t -= dt) <= 0) toast = null;

    if (mode === 'ATTRACT') {
      for (let k = 0; k < ticks * speedMul; k++) {
        stepSim(0);
        if (!robotsAlive() || genSteps > game.maxSteps) { finishGeneration(); startRun(false); }
      }
      attractCardT += dt;
      if (attractCardT > 15) { attractCardT = 0; attractCard = attractCard ? null : nextCard(); }
      if (inp.pressed.left || inp.pressed.right) {
        H.saveState(ls, save, saveKey(game));
        loadGame(gameIdx + (inp.pressed.right ? 1 : -1));
        showToast('jogo: ' + game.title);
      } else if (game.TRACKS && (inp.pressed.up || inp.pressed.down)) {
        const n = game.TRACKS.length;
        save.track = (save.track + (inp.pressed.down ? 1 : n - 1)) % n;
        H.saveState(ls, save, saveKey(game));
        startRun(false);
        showToast(trackWord() + ': ' + game.TRACKS[save.track].name);
      }
      if (inp.any && modeT > 0.4) { startRun(true); attractCard = null; setMode('COUNTDOWN'); }
    } else if (mode === 'COUNTDOWN') {
      if (modeT >= 3) setMode('PLAYING');
    } else if (mode === 'PLAYING') {
      for (let k = 0; k < ticks; k++) {
        stepSim(humanAction(inp));
        if (!human.alive || genSteps > game.maxSteps) break;
      }
      if (!human.alive || genSteps > game.maxSteps) {
        human.alive = false;
        result = { human: game.score(human), laps: human.laps, robot: null, gen: save.generation };
        setMode('RESULT_WAIT');
      }
    } else if (mode === 'RESULT_WAIT') {
      // robôs que ainda estão vivos terminam a corrida rapidinho
      for (let k = 0; k < 60 && robotsAlive() && genSteps < game.maxSteps; k++) stepSim(0);
      if ((!robotsAlive() || genSteps >= game.maxSteps) && modeT > 1) {
        result.robot = finishGeneration();
        setMode('RESULT');
      }
    } else if (mode === 'RESULT') {
      if (modeT > 5 || (modeT > 1 && inp.pressed.a)) {
        if (H.qualifies(rec(), result.human, asc())) { nameEntry = { letters: [0, 0, 0], pos: 0 }; setMode('NAME'); }
        else goCard();
      }
    } else if (mode === 'NAME') {
      const ne = nameEntry;
      if (inp.axis || inp.axisX || Object.values(inp.pressed).some(Boolean)) ne.lastInput = modeT;
      if (modeT - (ne.lastInput || 0) > NAME_TIMEOUT) { saveName(); return; }
      if (inp.pressed.up) ne.letters[ne.pos] = (ne.letters[ne.pos] + LETTERS.length - 1) % LETTERS.length;
      if (inp.pressed.down) ne.letters[ne.pos] = (ne.letters[ne.pos] + 1) % LETTERS.length;
      if ((inp.pressed.b || inp.pressed.left) && ne.pos > 0) ne.pos--;
      if (inp.pressed.a || inp.pressed.right) {
        if (ne.pos < 2) ne.pos++; else saveName();
      }
    } else if (mode === 'CARD') {
      if (modeT > 8 || (modeT > 1.5 && inp.pressed.a)) toAttract();
    }
  }

  function saveName() {
    H.addHumanScore(rec(), nameEntry.letters.map(i => LETTERS[i]).join(''), result.human, asc());
    H.saveState(ls, save, saveKey(game));
    goCard();
  }
  function goCard() {
    result.card = nextCard();
    if (result.card) setMode('CARD'); else toAttract();
  }
  function toAttract() { startRun(false); setMode('ATTRACT'); attractCardT = 0; }

  // ---------- desenho ----------
  function draw(inp) {
    const C = R.C;
    const bi = bestAliveIdx();
    if (bi >= 0) game.sensors(agents[bi], world); // atualiza os raios para desenhar
    game.draw(ctx, world, agents, bi, human, trail, C);

    R.hud(ctx, { bestHuman: fmt(H.bestHuman(rec()) || null), bestMachine: fmt(rec().bestMachine || null), score: human ? (game.hudText ? game.hudText(human) : String(game.score(human))) : null });
    R.panel(ctx, {
      title: game.title + (game.TRACKS ? ' · ' + game.TRACKS[save.track].name : ''),
      generation: save.generation, alive: robotsAlive(), total: agents.length,
      speedMul: mode === 'ATTRACT' ? speedMul : 1,
      net: bi >= 0 ? nets[bi] : null, inputs: bi >= 0 ? game.sensors(agents[bi], world) : null,
      labels: game.inputLabels, caption: game.inputCaption, outLabels: game.outputLabels,
      outLabel: o => (game.axis === 'x' ? (o < 0 ? '◀' : '▶') : (o < 0 ? '▲' : '▼')),
      humans: rec().humans.map(h => ({ name: h.name, score: fmt(h.score) })), padName: In.connectedName(),
    });

    if (mode === 'ATTRACT') {
      const blink = Math.floor(modeT * 2) % 2 === 0;
      R.center(ctx, [
        { s: 'HUMANOS vs. MÁQUINA', size: 54, weight: 900, shadow: true },
        { s: 'os robôs rosa estão aprendendo sozinhos — geração ' + save.generation, size: 22, color: '#c9d0f0', weight: 600, shadow: true },
      ]);
      if (blink) R.text(ctx, 'APERTE QUALQUER BOTÃO PARA DESAFIAR A MÁQUINA', R.GW / 2, R.GH - 42, 26, C.human, 'center', 800);
      drawSelector(C);
      if (attractCard) R.card(ctx, attractCard, 24, 150, 420, true);
    } else if (mode === 'COUNTDOWN') {
      R.overlay(ctx, 0.35);
      R.center(ctx, [
        { s: String(3 - Math.floor(modeT)), size: 120, color: C.human, weight: 900 },
        { s: 'você é o AMARELO — ' + game.hint, size: 26 },
      ]);
    } else if (mode === 'RESULT_WAIT') {
      R.overlay(ctx, 0.55);
      R.center(ctx, [
        { s: humanLine(), size: 46, color: C.human, weight: 900 },
        { s: robotsAlive() ? robotsAlive() + ' robôs ainda na disputa…' : 'contando…', size: 24, color: C.dim },
      ]);
    } else if (mode === 'RESULT') {
      R.overlay(ctx, 0.7);
      const win = result.human !== null && (result.robot === null || better(result.human, result.robot));
      const tie = result.human === null && result.robot === null;
      R.center(ctx, [
        { s: humanLine(), size: 46, color: C.human, weight: 900 },
        { s: result.robot === null ? 'Nenhum robô da geração ' + result.gen + ' terminou'
            : 'O melhor robô da geração ' + result.gen + ' fez ' + robotFmt(result.robot), size: 30, color: 'rgb(' + C.robot + ')' },
        { s: tie ? 'Empate: ninguém completou!' : win ? 'Você venceu a máquina! 🎉' : 'A máquina venceu… por enquanto.', size: 36, weight: 800 },
        { s: win ? 'Mas ela continua aprendendo a cada geração.' : 'Ninguém programou como ela joga: ela aprendeu.', size: 20, color: C.dim, weight: 500 },
      ]);
    } else if (mode === 'NAME') {
      R.overlay(ctx, 0.8);
      R.center(ctx, [
        { s: 'Você entrou no TOP 5!', size: 44, color: C.human, weight: 900 },
        { s: ' ', size: 70 },
        { s: '▲ ▼ troca a letra    botão ou → avança    ← volta', size: 20, color: C.dim, weight: 500 },
      ]);
      nameEntry.letters.forEach((li, i) => {
        const x = R.GW / 2 + (i - 1) * 90;
        R.text(ctx, LETTERS[li], x, R.GH / 2 + 4, 72, i === nameEntry.pos ? C.human : C.text, 'center', 900);
        if (i === nameEntry.pos) { ctx.fillStyle = C.human; ctx.fillRect(x - 30, R.GH / 2 + 50, 60, 5); }
      });
    } else if (mode === 'CARD') {
      R.overlay(ctx, 0.75);
      R.card(ctx, result.card, R.GW / 2 - 400, R.GH / 2 - 150, 800, false);
    }

    if (toast) R.text(ctx, toast.s, R.GW / 2, 190, 24, C.human, 'center', 800);
    if (DEBUG_INPUT) {
      R.text(ctx, 'debug: ' + JSON.stringify({ y: inp.axis.toFixed(2), x: (inp.axisX || 0).toFixed(2), pad: In.connectedName(), held: inp.pressed }), 10, R.GH - 14, 13, '#0f0');
    }
  }

  const trackWord = () => (game.id === 'plat' ? 'fase' : 'pista');

  function humanLine() {
    if (asc()) {
      if (result.human !== null) return 'Seu tempo: ' + fmt(result.human);
      return game.LAPS ? 'Você completou ' + result.laps + ' de ' + game.LAPS + ' voltas' : 'Não chegou na bandeira a tempo';
    }
    return 'Você fez ' + result.human + ' pontos';
  }
  const robotFmt = s => (asc() ? fmt(s) : s + ' pontos');

  function drawSelector(C) {
    const y = 92; // no topo: não cobre a fase
    ctx.fillStyle = 'rgba(5,6,15,0.75)'; ctx.fillRect(R.GW / 2 - 380, y - 26, 760, game.TRACKS ? 82 : 52);
    R.text(ctx, '◀', R.GW / 2 - 360, y, 24, C.dim, 'center', 800);
    R.text(ctx, '▶', R.GW / 2 + 360, y, 24, C.dim, 'center', 800);
    GAMES.forEach((g, i) => {
      const x = R.GW / 2 + (i - (GAMES.length - 1) / 2) * 230;
      R.text(ctx, g.title, x, y, 24, i === gameIdx ? C.human : C.dim, 'center', 900);
      if (i === gameIdx) { ctx.fillStyle = C.human; ctx.fillRect(x - 70, y + 16, 140, 4); }
    });
    if (game.TRACKS) R.text(ctx, '▲ ▼  ' + trackWord() + ' ' + (save.track + 1) + '/' + game.TRACKS.length + ': ' + game.TRACKS[save.track].name, R.GW / 2, y + 38, 18, C.text, 'center', 600);
  }

  // ---------- loop ----------
  const DEBUG_INPUT = /debug=input/.test(location.search);
  let last = performance.now(), acc = 0;
  let lastInp = { axis: 0, axisX: 0, pressed: {}, any: false };
  loadGame(gameIdx);
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    let ticks = 0;
    while (acc >= STEP && ticks < MAX_TICKS) { acc -= STEP; ticks++; }
    if (ticks === MAX_TICKS) acc = 0; // aba voltou do segundo plano: descarta o atraso
    requestAnimationFrame(frame); // agenda antes: um erro num quadro não mata o loop
    try {
      // só lê a entrada quando vai simular, senão toques são consumidos e perdidos
      if (ticks) { lastInp = In.poll(); update(ticks, lastInp); }
      draw(lastInp);
    } catch (e) {
      console.error(e);
    }
  }

  // mantém a tela acesa no stand
  function keepAwake() {
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) { /* sem suporte */ }
  }
  keepAwake();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
  addEventListener('keydown', keepAwake, { once: true });
  requestAnimationFrame(frame);
  window.__hvm = {
    get mode() { return mode; }, get save() { return save; }, get game() { return game.id; },
    setSpeed: m => (speedMul = m),
  };
})();
