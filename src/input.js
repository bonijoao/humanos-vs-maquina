(function (root) {
  const DEAD = 0.2;
  const keys = new Set(), tapped = new Set();
  const TAP_MAP = {
    a: ['Space', 'Enter'], b: ['Escape'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft'], right: ['ArrowRight'],
  };
  let prev = {};
  let opCb = () => {};
  let rDownAt = null, rFired = false;

  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', ' ', 'Space'].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    tapped.add(e.code); // garante que toques rápidos (aperta e solta no mesmo quadro) contem
    if (e.code === 'Digit1') opCb('speed1');
    if (e.code === 'Digit2') opCb('speed5');
    if (e.code === 'Digit3') opCb('speed20');
    if (e.code === 'KeyF') opCb('fullscreen');
    if (e.code === 'KeyG') opCb('game');
    if (e.code === 'KeyT') opCb('track');
    if (e.code === 'KeyR') { rDownAt = performance.now(); rFired = false; }
  });
  addEventListener('keyup', e => {
    keys.delete(e.code);
    if (e.code === 'KeyR') rDownAt = null;
  });
  addEventListener('blur', () => { keys.clear(); rDownAt = null; });

  function firstPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  function btn(p, i) { return !!(p && p.buttons[i] && p.buttons[i].pressed); }

  function poll() {
    if (rDownAt !== null && !rFired && performance.now() - rDownAt > 2000) {
      rFired = true; opCb('reset');
    }
    const p = firstPad();
    let axis = 0;
    if (p) {
      const a = p.axes[1] || 0;
      if (Math.abs(a) > DEAD) axis = (a - Math.sign(a) * DEAD) / (1 - DEAD);
      if (btn(p, 12)) axis = -1;
      if (btn(p, 13)) axis = 1;
    }
    const kUp = keys.has('ArrowUp') || keys.has('KeyW');
    const kDown = keys.has('ArrowDown') || keys.has('KeyS');
    if (kUp && !kDown) axis = -1;
    if (kDown && !kUp) axis = 1;

    const ax = p ? p.axes[0] || 0 : 0;
    let axisX = Math.abs(ax) > DEAD ? (ax - Math.sign(ax) * DEAD) / (1 - DEAD) : 0;
    if (btn(p, 14)) axisX = -1;
    if (btn(p, 15)) axisX = 1;
    const kL = keys.has('ArrowLeft') || keys.has('KeyA'), kR = keys.has('ArrowRight') || keys.has('KeyD');
    if (kL && !kR) axisX = -1;
    if (kR && !kL) axisX = 1;
    const now = {
      // qualquer botão frontal confirma (no controle do Switch o "A" fica à direita)
      a: btn(p, 0) || btn(p, 1) || btn(p, 2) || btn(p, 3) || keys.has('Space') || keys.has('Enter'),
      b: btn(p, 8) || keys.has('Escape'),
      start: btn(p, 9),
      up: axis < -0.5,
      down: axis > 0.5,
      left: btn(p, 14) || ax < -0.5 || keys.has('ArrowLeft'),
      right: btn(p, 15) || ax > 0.5 || keys.has('ArrowRight'),
      anyBtn: p ? p.buttons.some((b, i) => b.pressed && i < 12) : false,
    };
    const pressed = {};
    for (const k in now) {
      pressed[k] = (now[k] && !prev[k]) || (TAP_MAP[k] || []).some(c => tapped.has(c));
    }
    tapped.clear();
    prev = now;
    const any = pressed.a || pressed.b || pressed.start || pressed.anyBtn;
    const clamp = v => Math.max(-1, Math.min(1, v));
    return { axis: clamp(axis), axisX: clamp(axisX), pressed, held: now, any };
  }

  function connectedName() {
    const p = firstPad();
    return p ? p.id : null;
  }

  root.HVM = Object.assign(root.HVM || {}, {
    Input: { poll, connectedName, onOperator(cb) { opCb = cb; } },
  });
})(window);
