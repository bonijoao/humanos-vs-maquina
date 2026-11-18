(function () {
  const H = window.HVM, R = H.Render, In = H.Input;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const STEP = 1 / 60, MAX_TICKS = 5, MAX_GEN_STEPS = 30000;
  const SCORE_DIV = 10; // pontos = distância / 10
  const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const rng = H.makeRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);

  // ---------- estado ----------
  const save = H.loadState(ls);
  let nets = restorePopulation(save.population);
  let world, drones, humanDrone = null, trail = [], genSteps = 0;
  let mode = 'ATTRACT', modeT = 0, speedMul = 1;
  let result = null, nameEntry = null, toast = null;
  let cardIdx = Math.floor(rng() * 100), attractCard = null, attractCardT = 0;

  function restorePopulation(pop) {
    try {
      if (Array.isArray(pop) && pop.length === H.POP_SIZE && pop.every(p => p.length === H.N_PARAMS)) {
        return pop.map(H.deserializeNet);
      }
    } catch (e) { /* cai para população nova */ }
    return Array.from({ length: H.POP_SIZE }, () => H.createNet(rng));
  }

  function startRun(withHuman) {
    world = H.createWorld((rng() * 4294967296) >>> 0);
    drones = nets.map(() => H.createDrone());
    humanDrone = withHuman ? H.createDrone() : null;
    trail = []; genSteps = 0;
  }

  function finishGeneration() {
    const fit = drones.map(d => d.distance);
    const best = Math.floor(Math.max(...fit) / SCORE_DIV);
    if (best > save.bestMachine) save.bestMachine = best;
    nets = H.nextGeneration(nets.map((net, i) => ({ net, fitness: fit[i] })), rng);
    save.generation++;
    save.population = nets.map(H.serializeNet);
    H.saveState(ls, save);
    return best;
  }

  function robotsAlive() { let n = 0; for (const d of drones) if (d.alive) n++; return n; }

  function bestAliveIdx() {
    // a elite fica no começo do vetor: o primeiro vivo é o "melhor"
    for (let i = 0; i < drones.length; i++) if (drones[i].alive) return i;
    return -1;
  }

  function stepSim(humanAxis) {
    H.stepWorld(world);
    genSteps++;
    for (let i = 0; i < drones.length; i++) {
      const d = drones[i];
      if (d.alive) H.stepDrone(d, world, H.act(nets[i], d, world));
    }
    if (humanDrone && humanDrone.alive) {
      H.stepDrone(humanDrone, world, humanAxis);
      if (genSteps % 2 === 0) { trail.push(humanDrone.y); if (trail.length > 22) trail.shift(); }
    }
  }

  function setMode(m) { mode = m; modeT = 0; }
  function showToast(s) { toast = { s, t: 2.5 }; }
  function nextCard() { return H.nextCard ? H.nextCard(cardIdx++) : null; }

  // ---------- operador ----------
  In.onOperator(cmd => {
    if (cmd === 'speed1') speedMul = 1;
    if (cmd === 'speed5') speedMul = 5;
    if (cmd === 'speed20') speedMul = 20;
    if (cmd === 'fullscreen') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    }
    if (cmd === 'reset') {
      H.resetMachine(save);
      nets = Array.from({ length: H.POP_SIZE }, () => H.createNet(rng));
      H.saveState(ls, save);
      if (mode === 'ATTRACT') startRun(false);
      showToast('IA resetada — começando do zero');
    }
    if (speedMul > 1 && cmd.startsWith('speed')) showToast('treino ×' + speedMul);
  });

  // ---------- modos ----------
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  function update(ticks, inp) {
    const dt = ticks * STEP;
    modeT += dt;
    if (toast && (toast.t -= dt) <= 0) toast = null;

    if (mode === 'ATTRACT') {
      for (let k = 0; k < ticks * speedMul; k++) {
        stepSim(0);
        if (!robotsAlive() || genSteps > MAX_GEN_STEPS) { finishGeneration(); startRun(false); }
      }
      attractCardT += dt;
      if (attractCardT > 15) { attractCardT = 0; attractCard = attractCard ? null : nextCard(); }
      if (inp.any && modeT > 0.4) { startRun(true); attractCard = null; setMode('COUNTDOWN'); }
    } else if (mode === 'COUNTDOWN') {
      if (modeT >= 3) setMode('PLAYING');
    } else if (mode === 'PLAYING') {
      for (let k = 0; k < ticks; k++) {
        stepSim(inp.axis);
        if (!humanDrone.alive) break;
      }
      if (!humanDrone.alive) {
        result = { human: Math.floor(humanDrone.distance / SCORE_DIV), robot: null, gen: save.generation };
        setMode('RESULT_WAIT');
      }
    } else if (mode === 'RESULT_WAIT') {
      // robôs que ainda voam terminam a corrida rapidinho
      for (let k = 0; k < 60 && robotsAlive() && genSteps < MAX_GEN_STEPS; k++) stepSim(0);
      if ((!robotsAlive() || genSteps >= MAX_GEN_STEPS) && modeT > 1) {
        result.robot = finishGeneration();
        setMode('RESULT');
      }
    } else if (mode === 'RESULT') {
      if (modeT > 5 || (modeT > 1 && inp.pressed.a)) {
        if (H.qualifies(save, result.human)) { nameEntry = { letters: [0, 0, 0], pos: 0 }; setMode('NAME'); }
        else goCard();
      }
    } else if (mode === 'NAME') {
      const ne = nameEntry;
      if (inp.pressed.up) ne.letters[ne.pos] = (ne.letters[ne.pos] + LETTERS.length - 1) % LETTERS.length;
      if (inp.pressed.down) ne.letters[ne.pos] = (ne.letters[ne.pos] + 1) % LETTERS.length;
      if ((inp.pressed.b || inp.pressed.left) && ne.pos > 0) ne.pos--;
      if (inp.pressed.a || inp.pressed.right) {
        if (ne.pos < 2) ne.pos++;
        else {
          H.addHumanScore(save, ne.letters.map(i => LETTERS[i]).join(''), result.human);
          H.saveState(ls, save);
          goCard();
        }
      }
    } else if (mode === 'CARD') {
      if (modeT > 8 || (modeT > 1.5 && inp.pressed.a)) toAttract();
    }
  }

  function goCard() {
    result.card = nextCard();
    if (result.card) setMode('CARD'); else toAttract();
  }
  function toAttract() { startRun(false); setMode('ATTRACT'); attractCardT = 0; }

  // ---------- desenho ----------
  function draw(inp) {
    const C = R.C;
    R.background(ctx, world);
    R.obstacles(ctx, world);
    const bi = bestAliveIdx();
    R.robots(ctx, drones, bi);
    if (humanDrone) R.human(ctx, humanDrone, trail);

    const playing = mode === 'PLAYING' || mode === 'COUNTDOWN';
    R.hud(ctx, {
      bestHuman: H.bestHuman(save), bestMachine: save.bestMachine,
      score: humanDrone ? Math.floor(humanDrone.distance / SCORE_DIV) : null,
    });
    R.panel(ctx, {
      generation: save.generation, alive: robotsAlive(), total: drones.length,
      speedMul: mode === 'ATTRACT' ? speedMul : 1,
      net: bi >= 0 ? nets[bi] : null, inputs: bi >= 0 ? H.sensors(drones[bi], world) : null,
      humans: save.humans, padName: In.connectedName(),
    });

    if (mode === 'ATTRACT') {
      const blink = Math.floor(modeT * 2) % 2 === 0;
      R.center(ctx, [
        { s: 'HUMANOS vs. MÁQUINA', size: 54, weight: 900 },
        { s: 'os robôs rosa estão aprendendo sozinhos a desviar', size: 22, color: C.dim, weight: 500 },
      ]);
      if (blink) R.text(ctx, 'APERTE QUALQUER BOTÃO PARA DESAFIAR A MÁQUINA', R.GW / 2, R.GH - 60, 26, C.human, 'center', 800);
      if (attractCard) R.card(ctx, attractCard, 24, 70, 420, true);
    } else if (mode === 'COUNTDOWN') {
      R.overlay(ctx, 0.35);
      R.center(ctx, [
        { s: String(3 - Math.floor(modeT)), size: 120, color: C.human, weight: 900 },
        { s: 'você é o drone AMARELO — ▲ ▼ para desviar', size: 26 },
      ]);
    } else if (mode === 'RESULT_WAIT') {
      R.overlay(ctx, 0.55);
      R.center(ctx, [
        { s: 'Você fez ' + result.human + ' pontos', size: 46, color: C.human, weight: 900 },
        { s: robotsAlive() ? robotsAlive() + ' robôs ainda voando…' : 'contando…', size: 24, color: C.dim },
      ]);
    } else if (mode === 'RESULT') {
      R.overlay(ctx, 0.7);
      const win = result.human > result.robot;
      R.center(ctx, [
        { s: 'Você fez ' + result.human + ' pontos', size: 46, color: C.human, weight: 900 },
        { s: 'O melhor robô da geração ' + result.gen + ' fez ' + result.robot, size: 30, color: 'rgb(' + C.robot + ')' },
        { s: win ? 'Você venceu a máquina! 🎉' : 'A máquina venceu… por enquanto.', size: 36, weight: 800 },
        { s: win ? 'Mas ela continua aprendendo a cada geração.' : 'Ninguém programou como ela desvia: ela aprendeu.', size: 20, color: C.dim, weight: 500 },
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

    if (toast) R.text(ctx, toast.s, R.GW / 2, 90, 24, C.human, 'center', 800);
    if (DEBUG_INPUT) {
      R.text(ctx, 'debug: ' + JSON.stringify({ axis: inp.axis.toFixed(2), pad: In.connectedName(), held: inp.pressed }), 10, R.GH - 14, 13, '#0f0');
    }
  }

  // ---------- loop ----------
  const DEBUG_INPUT = /debug=input/.test(location.search);
  let last = performance.now(), acc = 0;
  startRun(false);
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    let ticks = 0;
    while (acc >= STEP && ticks < MAX_TICKS) { acc -= STEP; ticks++; }
    if (ticks === MAX_TICKS) acc = 0; // aba voltou do segundo plano: descarta o atraso
    const inp = In.poll();
    if (ticks) update(ticks, inp);
    draw(inp);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__hvm = { get mode() { return mode; }, save, setSpeed: m => (speedMul = m) };
})();
