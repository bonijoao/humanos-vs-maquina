(function (root) {
  const H = root.HVM;
  const GW = H.W, GH = H.H, PANEL_X = GW, PANEL_W = 280;
  const C = {
    bg: '#070a18', grid: 'rgba(60,90,200,0.13)', grid2: 'rgba(60,90,200,0.07)',
    obst: '#19e6ff', obstFill: 'rgba(25,230,255,0.10)',
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

  function background(ctx, world) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, GW, GH);
    const off1 = (world.distance * 0.25) % 80, off2 = (world.distance * 0.6) % 160;
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.grid2;
    ctx.beginPath();
    for (let x = -off1; x < GW; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, GH); }
    for (let y = 0; y < GH; y += 80) { ctx.moveTo(0, y); ctx.lineTo(GW, y); }
    ctx.stroke();
    // "trilhas de circuito" mais rápidas
    ctx.strokeStyle = C.grid;
    ctx.beginPath();
    for (let x = -off2; x < GW + 160; x += 160) {
      ctx.moveTo(x, 120); ctx.lineTo(x + 60, 120); ctx.lineTo(x + 90, 150); ctx.lineTo(x + 160, 150);
      ctx.moveTo(x, GH - 140); ctx.lineTo(x + 50, GH - 140); ctx.lineTo(x + 80, GH - 110); ctx.lineTo(x + 160, GH - 110);
    }
    ctx.stroke();
  }

  function obstacles(ctx, world) {
    for (const o of world.obstacles) {
      if (o.x > GW || o.x + H.OBST_W < 0) continue;
      const top = o.gapY - o.gapH / 2, bot = o.gapY + o.gapH / 2;
      ctx.fillStyle = C.obstFill;
      ctx.fillRect(o.x, 0, H.OBST_W, top);
      ctx.fillRect(o.x, bot, H.OBST_W, GH - bot);
      ctx.strokeStyle = C.obst;
      ctx.lineWidth = 3;
      ctx.shadowColor = C.obst; ctx.shadowBlur = 14;
      ctx.strokeRect(o.x + 1.5, -5, H.OBST_W - 3, top + 3.5);
      ctx.strokeRect(o.x + 1.5, bot + 1.5, H.OBST_W - 3, GH - bot + 5);
      ctx.shadowBlur = 0;
      // detalhes internos
      ctx.strokeStyle = 'rgba(25,230,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = top - 30; y > 0; y -= 40) { ctx.moveTo(o.x + 12, y); ctx.lineTo(o.x + H.OBST_W - 12, y); }
      for (let y = bot + 30; y < GH; y += 40) { ctx.moveTo(o.x + 12, y); ctx.lineTo(o.x + H.OBST_W - 12, y); }
      ctx.stroke();
    }
  }

  function drone(ctx, y, vy, fill, stroke, scale) {
    const x = H.DRONE_X, r = H.DRONE_R * (scale || 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.max(-0.5, Math.min(0.5, vy * 0.05)));
    ctx.beginPath();
    ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r, -r); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r, r); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }

  function robots(ctx, drones, bestIdx) {
    for (let i = 0; i < drones.length; i++) {
      const d = drones[i];
      if (!d.alive || i === bestIdx) continue;
      drone(ctx, d.y, d.vy, 'rgba(' + C.robot + ',0.28)');
    }
    if (bestIdx >= 0) {
      const d = drones[bestIdx];
      ctx.shadowColor = 'rgb(' + C.robot + ')'; ctx.shadowBlur = 12;
      drone(ctx, d.y, d.vy, 'rgba(' + C.robot + ',0.9)', '#fff');
      ctx.shadowBlur = 0;
    }
  }

  function human(ctx, h, trail) {
    ctx.strokeStyle = 'rgba(255,210,63,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath();
    trail.forEach((y, i) => {
      const x = H.DRONE_X - (trail.length - i) * 6;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.shadowColor = C.human; ctx.shadowBlur = 18;
    drone(ctx, h.y, h.vy, h.alive ? C.human : '#776622', '#fff', 1.25);
    ctx.shadowBlur = 0;
  }

  const IN_LABELS = ['altura', 'velocidade', 'dist. 1º', 'brecha 1º', 'dist. 2º', 'brecha 2º'];

  function network(ctx, net, inputs, x0, y0, w, h) {
    const act = net && inputs ? H.forward(net, inputs) : null;
    const colX = [x0 + 70, x0 + w / 2 + 20, x0 + w - 30];
    const ys = n => Array.from({ length: n }, (_, i) => y0 + (i + 0.5) * h / n);
    const yi = ys(6), yh = ys(6), yo = [y0 + h / 2];
    if (net) {
      for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
        const wgt = net.w1[j * 6 + i];
        const a = act ? Math.min(1, Math.abs(inputs[i]) * 0.8 + 0.15) : 0.4;
        ctx.strokeStyle = 'rgba(' + (wgt > 0 ? C.pos : C.neg) + ',' + (0.15 + 0.6 * a * Math.min(1, Math.abs(wgt) / 2)) + ')';
        ctx.lineWidth = Math.min(4, 0.5 + Math.abs(wgt));
        ctx.beginPath(); ctx.moveTo(colX[0], yi[i]); ctx.lineTo(colX[1], yh[j]); ctx.stroke();
      }
      for (let j = 0; j < 6; j++) {
        const wgt = net.w2[j];
        const a = act ? Math.abs(act.hidden[j]) : 0.4;
        ctx.strokeStyle = 'rgba(' + (wgt > 0 ? C.pos : C.neg) + ',' + (0.15 + 0.7 * a) + ')';
        ctx.lineWidth = Math.min(4, 0.5 + Math.abs(wgt));
        ctx.beginPath(); ctx.moveTo(colX[1], yh[j]); ctx.lineTo(colX[2], yo[0]); ctx.stroke();
      }
    }
    const node = (x, y, v) => {
      const b = v === null ? 0.2 : Math.min(1, Math.abs(v));
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + ((v || 0) >= 0 ? C.pos : C.neg) + ',' + (0.15 + 0.85 * b) + ')';
      ctx.fill(); ctx.strokeStyle = '#cfd6ff'; ctx.lineWidth = 1; ctx.stroke();
    };
    for (let i = 0; i < 6; i++) {
      node(colX[0], yi[i], act ? inputs[i] : null);
      text(ctx, IN_LABELS[i], colX[0] - 14, yi[i], 11, C.dim, 'right', 500);
    }
    for (let j = 0; j < 6; j++) node(colX[1], yh[j], act ? act.hidden[j] : null);
    node(colX[2], yo[0], act ? act.out : null);
    if (act) text(ctx, act.out < 0 ? '▲' : '▼', colX[2], yo[0] + 24, 16, C.text, 'center');
  }

  function panel(ctx, v) {
    const x = PANEL_X;
    ctx.fillStyle = C.panel; ctx.fillRect(x, 0, PANEL_W, GH);
    ctx.fillStyle = 'rgba(25,230,255,0.4)'; ctx.fillRect(x, 0, 2, GH);
    text(ctx, 'GERAÇÃO', x + 20, 32, 14, C.dim);
    text(ctx, String(v.generation), x + 20, 64, 38, C.text, 'left', 800);
    text(ctx, 'robôs vivos: ' + v.alive + '/' + v.total, x + 20, 100, 15, C.text, 'left', 500);
    if (v.speedMul > 1) text(ctx, 'treino acelerado ×' + v.speedMul, x + 20, 124, 14, C.human, 'left', 600);
    text(ctx, 'CÉREBRO DO MELHOR ROBÔ', x + 20, 160, 13, C.dim);
    network(ctx, v.net, v.inputs, x + 10, 176, PANEL_W - 20, 240);
    text(ctx, 'TOP 5 HUMANOS', x + 20, 446, 13, C.dim);
    v.humans.forEach((hm, i) => {
      text(ctx, (i + 1) + '. ' + hm.name, x + 20, 474 + i * 26, 17, C.text, 'left', 600);
      text(ctx, String(hm.score), x + PANEL_W - 20, 474 + i * 26, 17, C.human, 'right', 700);
    });
    if (!v.humans.length) text(ctx, 'ninguém ainda… seja o 1º!', x + 20, 474, 14, C.dim, 'left', 500);
    text(ctx, v.padName ? '🎮 controle conectado' : '⌨ teclado (↑ ↓ espaço)', x + 20, GH - 24, 12, C.dim, 'left', 500);
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
    // lines: [{s, size, color}]
    const total = lines.reduce((a, l) => a + l.size * 1.5, 0);
    let y = GH / 2 - total / 2;
    for (const l of lines) {
      y += l.size * 0.75;
      text(ctx, l.s, GW / 2, y, l.size, l.color || C.text, 'center', l.weight || 700);
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
    Render: { C, GW, GH, PANEL_W, background, obstacles, robots, human, panel, hud, overlay, center, card, text },
  });
})(window);
