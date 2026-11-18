(function (root) {
  const H = root.HVM;
  const GW = 1280, GH = 720, PANEL_X = GW, PANEL_W = 280;
  const C = {
    bg: '#070a18', grid: 'rgba(60,90,200,0.13)', grid2: 'rgba(60,90,200,0.07)',
    obst: '#19e6ff', obstFill: 'rgba(25,230,255,0.10)', warn: '#ff9a2e',
    robot: '255,60,200', human: '#ffd23f', text: '#e8ecff', dim: '#8a93c0',
    panel: '#0b0f24', pos: '25,230,255', neg: '255,60,200',
  };
  const FONT = '"Segoe UI", system-ui, sans-serif';

  function text(ctx, s, x, y, size, color, align, weight) {
    ctx.font = (weight || 600) + ' ' + size + 'px ' + FONT;
    ctx.fillStyle = color || C.text;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  // desenha a rede: entradas (com rótulos) -> ocultos -> saída
  function network(ctx, net, inputs, labels, outLabel, x0, y0, w, h) {
    const nIn = labels.length, nH = H.HIDDEN;
    const act = net && inputs ? H.forward(net, inputs) : null;
    const colX = [x0 + 78, x0 + w / 2 + 24, x0 + w - 28];
    const ys = n => Array.from({ length: n }, (_, i) => y0 + (i + 0.5) * h / n);
    const yi = ys(nIn), yh = ys(nH), yo = y0 + h / 2;
    if (net) {
      for (let j = 0; j < nH; j++) for (let i = 0; i < nIn; i++) {
        const wgt = net.w1[j * nIn + i];
        const a = act ? Math.min(1, Math.abs(inputs[i]) * 0.8 + 0.1) : 0.4;
        ctx.strokeStyle = 'rgba(' + (wgt > 0 ? C.pos : C.neg) + ',' + (0.08 + 0.6 * a * Math.min(1, Math.abs(wgt) / 2)) + ')';
        ctx.lineWidth = Math.min(3, 0.4 + Math.abs(wgt) * 0.8);
        ctx.beginPath(); ctx.moveTo(colX[0], yi[i]); ctx.lineTo(colX[1], yh[j]); ctx.stroke();
      }
      for (let j = 0; j < nH; j++) {
        const wgt = net.w2[j], a = act ? Math.abs(act.hidden[j]) : 0.4;
        ctx.strokeStyle = 'rgba(' + (wgt > 0 ? C.pos : C.neg) + ',' + (0.15 + 0.7 * a) + ')';
        ctx.lineWidth = Math.min(4, 0.5 + Math.abs(wgt));
        ctx.beginPath(); ctx.moveTo(colX[1], yh[j]); ctx.lineTo(colX[2], yo); ctx.stroke();
      }
    }
    const node = (x, y, v, r) => {
      const b = v === null ? 0.2 : Math.min(1, Math.abs(v));
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + ((v || 0) >= 0 ? C.pos : C.neg) + ',' + (0.15 + 0.85 * b) + ')';
      ctx.fill(); ctx.strokeStyle = '#cfd6ff'; ctx.lineWidth = 1; ctx.stroke();
    };
    for (let i = 0; i < nIn; i++) {
      node(colX[0], yi[i], act ? inputs[i] : null, 7);
      text(ctx, labels[i], colX[0] - 12, yi[i], 11, C.dim, 'right', 500);
    }
    for (let j = 0; j < nH; j++) node(colX[1], yh[j], act ? act.hidden[j] : null, 7);
    node(colX[2], yo, act ? act.out : null, 9);
    if (act) text(ctx, outLabel(act.out), colX[2], yo + 24, 16, C.text, 'center');
  }

  function panel(ctx, v) {
    const x = PANEL_X;
    ctx.fillStyle = C.panel; ctx.fillRect(x, 0, PANEL_W, GH);
    ctx.fillStyle = 'rgba(25,230,255,0.4)'; ctx.fillRect(x, 0, 2, GH);
    text(ctx, 'JOGO: ' + v.title, x + 20, 22, 13, C.human, 'left', 800);
    text(ctx, 'GERAÇÃO', x + 20, 48, 13, C.dim);
    text(ctx, String(v.generation), x + 20, 78, 36, C.text, 'left', 800);
    text(ctx, 'robôs vivos: ' + v.alive + '/' + v.total, x + 20, 112, 15, C.text, 'left', 500);
    if (v.speedMul > 1) text(ctx, 'treino acelerado ×' + v.speedMul, x + 20, 134, 14, C.human, 'left', 600);
    text(ctx, 'CÉREBRO DO MELHOR ROBÔ', x + 20, 160, 13, C.dim);
    network(ctx, v.net, v.inputs, v.labels, v.outLabel, x + 6, 172, PANEL_W - 16, 260);
    text(ctx, 'TOP 5 HUMANOS', x + 20, 456, 13, C.dim);
    v.humans.forEach((hm, i) => {
      text(ctx, (i + 1) + '. ' + hm.name, x + 20, 482 + i * 26, 17, C.text, 'left', 600);
      text(ctx, String(hm.score), x + PANEL_W - 20, 482 + i * 26, 17, C.human, 'right', 700);
    });
    if (!v.humans.length) text(ctx, 'ninguém ainda… seja o 1º!', x + 20, 482, 14, C.dim, 'left', 500);
    text(ctx, v.padName ? '🎮 controle conectado' : '⌨ teclado (setas + espaço)', x + 20, GH - 24, 12, C.dim, 'left', 500);
  }

  function hud(ctx, v) {
    ctx.fillStyle = 'rgba(5,6,15,0.65)'; ctx.fillRect(0, 0, GW, 52);
    text(ctx, 'HUMANOS', GW / 2 - 60, 26, 16, C.dim, 'right');
    text(ctx, String(v.bestHuman), GW / 2 - 160, 26, 28, C.human, 'right', 800);
    text(ctx, 'vs', GW / 2, 26, 16, C.dim, 'center');
    text(ctx, 'MÁQUINA', GW / 2 + 60, 26, 16, C.dim, 'left');
    text(ctx, String(v.bestMachine), GW / 2 + 160, 26, 28, 'rgb(' + C.robot + ')', 'left', 800);
    if (v.score !== null) text(ctx, 'você: ' + v.score, 24, 26, 22, C.human, 'left', 700);
  }

  function overlay(ctx, alpha) {
    ctx.fillStyle = 'rgba(5,6,15,' + alpha + ')';
    ctx.fillRect(0, 0, GW, GH);
  }

  function center(ctx, lines) {
    const total = lines.reduce((a, l) => a + l.size * 1.5, 0);
    let y = GH / 2 - total / 2;
    for (const l of lines) {
      y += l.size * 0.75;
      if (l.shadow) { ctx.shadowColor = '#000'; ctx.shadowBlur = 12; }
      text(ctx, l.s, GW / 2, y, l.size, l.color || C.text, 'center', l.weight || 700);
      ctx.shadowBlur = 0;
      y += l.size * 0.75;
    }
  }

  function wrap(ctx, s, maxW, size) {
    ctx.font = '500 ' + size + 'px ' + FONT;
    const words = s.split(' '), out = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  function card(ctx, c, x, y, w, small) {
    const size = small ? 16 : 24, title = small ? 18 : 32;
    const lines = wrap(ctx, c.body, w - 48, size);
    const h = 40 + title * 1.4 + lines.length * size * 1.45 + 24;
    ctx.fillStyle = 'rgba(11,15,36,0.92)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.obst; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    const tags = { agora: 'O QUE VOCÊ VIU', mundo: 'NO MUNDO REAL', alem: 'IA ALÉM DO CHATGPT', ufla: 'ESTUDE ISSO NA UFLA' };
    text(ctx, tags[c.tag] || '', x + 24, y + 26, small ? 11 : 14, C.human, 'left', 700);
    text(ctx, c.title, x + 24, y + 30 + title, title, C.text, 'left', 800);
    lines.forEach((l, i) => text(ctx, l, x + 24, y + 40 + title * 1.4 + (i + 0.5) * size * 1.45 + 8, size, '#c9d0f0', 'left', 500));
    return h;
  }

  root.HVM = Object.assign(root.HVM || {}, {
    Render: { C, GW, GH, PANEL_W, panel, hud, overlay, center, card, text },
  });
})(window);
