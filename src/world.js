(function (root) {
  const makeRng = root.HVM && root.HVM.makeRng
    ? root.HVM.makeRng
    : require('./rng.js').makeRng;

  const W = 1280, H = 720;
  const DRONE_X = 200, DRONE_R = 14;
  const ACC = 0.9, DAMP = 0.88;      // controle direto: empuxo + amortecimento
  const GAP0 = 210, GAP_MIN = 150;   // altura da brecha (diminui com o tempo)
  const OBST_W = 80, OBST_SPACING = 360;
  const SPEED0 = 4, SPEED_MAX = 10, SPEED_INC = 0.0012; // por passo
  const MARGIN = 70;                 // brecha nunca cola no teto/chão

  function createWorld(seed) {
    const w = {
      rng: makeRng(seed), seed, t: 0, speed: SPEED0, distance: 0,
      obstacles: [], spawnX: W + 100,
    };
    return w;
  }

  function difficulty(w) { return (w.speed - SPEED0) / (SPEED_MAX - SPEED0); }

  function spawn(w, x) {
    const gapH = GAP0 - (GAP0 - GAP_MIN) * difficulty(w);
    const lo = MARGIN + gapH / 2, hi = H - MARGIN - gapH / 2;
    // limita o salto vertical entre brechas seguidas para ser sempre possível
    const last = w.obstacles[w.obstacles.length - 1];
    let gapY = lo + (hi - lo) * w.rng();
    if (last) {
      const maxJump = 260;
      gapY = Math.max(last.gapY - maxJump, Math.min(last.gapY + maxJump, gapY));
    }
    w.obstacles.push({ x, gapY, gapH, passed: false });
  }

  function stepWorld(w) {
    w.t++;
    w.speed = Math.min(SPEED_MAX, SPEED0 + w.t * SPEED_INC);
    w.distance += w.speed;
    for (const o of w.obstacles) o.x -= w.speed;
    while (w.obstacles.length && w.obstacles[0].x + OBST_W < -50) w.obstacles.shift();
    if (w.spawnX !== Infinity) {
      w.spawnX -= w.speed;
      while (w.spawnX < W + OBST_SPACING) {
        spawn(w, w.spawnX);
        w.spawnX += OBST_SPACING;
      }
    }
  }

  function createDrone() {
    return { y: H / 2, vy: 0, alive: true, distance: 0 };
  }

  function hits(d, o) {
    if (DRONE_X + DRONE_R < o.x || DRONE_X - DRONE_R > o.x + OBST_W) return false;
    const top = o.gapY - o.gapH / 2, bot = o.gapY + o.gapH / 2;
    return d.y - DRONE_R < top || d.y + DRONE_R > bot;
  }

  function stepDrone(d, w, action) {
    if (!d.alive) return;
    const a = Math.max(-1, Math.min(1, action || 0));
    d.vy = (d.vy + a * ACC) * DAMP;
    d.y += d.vy;
    d.distance += w.speed;
    if (d.y - DRONE_R < 0 || d.y + DRONE_R > H) { d.alive = false; return; }
    for (const o of w.obstacles) {
      if (hits(d, o)) { d.alive = false; return; }
    }
  }

  function nextObstacles(w, x) {
    const ahead = w.obstacles.filter(o => o.x + OBST_W >= x - DRONE_R);
    const fallback = { x: x + W, gapY: H / 2, gapH: GAP0 };
    return [ahead[0] || fallback, ahead[1] || ahead[0] && { ...fallback, x: ahead[0].x + OBST_SPACING } || fallback];
  }

  const api = {
    W, H, DRONE_X, DRONE_R, OBST_W, OBST_SPACING, SPEED0, SPEED_MAX, GAP0, GAP_MIN,
    createWorld, stepWorld, createDrone, stepDrone, nextObstacles,
  };
  root.HVM = Object.assign(root.HVM || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
