"""Testes de navegador (Playwright + Chrome). Rodar: python -I tests/browser_check.py"""
import sys, time, pathlib
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright

URL = pathlib.Path(__file__).resolve().parent.parent.joinpath('index.html').as_uri()
INIT = """
navigator.getGamepads = () => [];
// simula tela de 144 Hz: muitos quadros sem passo de simulação
window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 7);
window.__wake = 0;
Object.defineProperty(navigator, 'wakeLock', { value: { request: () => { window.__wake++; return Promise.resolve({ addEventListener() {} }); } } });
"""
fails = []

def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' — ' + str(info) if info else ''))
    if not ok: fails.append(name)

def wait_mode(pg, modes, timeout):
    t = time.time()
    while time.time() - t < timeout:
        if pg.evaluate('__hvm.mode') in modes: return True
        time.sleep(0.1)
    return False

def select(pg, gid):
    for _ in range(4):
        if pg.evaluate('__hvm.game') == gid: return True
        pg.keyboard.press('KeyG'); time.sleep(0.3)
    return pg.evaluate('__hvm.game') == gid

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    errors = []
    def page():
        pg = b.new_page(viewport={'width': 1560, 'height': 720})
        pg.add_init_script(INIT)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(URL); time.sleep(1)
        return pg

    # 1. toque rápido em tela 144 Hz sempre inicia a partida
    pg = page()
    ok = 0
    for i in range(8):
        pg.keyboard.press('Space'); time.sleep(0.15)
        if pg.evaluate('__hvm.mode') == 'COUNTDOWN': ok += 1
        pg.evaluate('localStorage.clear()'); pg.reload(); time.sleep(1)
    check('toques rápidos não se perdem (144 Hz)', ok == 8, f'{ok}/8')

    # 2. tela de nome tem tempo limite (na nave, onde bater acaba a partida)
    select(pg, 'drone')
    pg.keyboard.press('Space')
    reached = wait_mode(pg, ['NAME'], 40)
    check('chegou na tela de nome', reached)
    if reached:
        left = wait_mode(pg, ['CARD', 'ATTRACT'], 35)
        check('tela de nome sai sozinha sem input', left)
        check('pontuação salva mesmo sem digitar nome',
              pg.evaluate('__hvm.save.humans.length') == 1)

    # 3. exceção num quadro não mata o loop
    pg.evaluate('localStorage.clear()'); pg.reload(); time.sleep(1)
    pg.evaluate("""(() => { const R = HVM.Render, o = R.hud; let n = 0;
        R.hud = (...a) => { if (n++ < 1) throw new Error('teste'); return o(...a); }; })()""")
    pg.evaluate('__hvm.setSpeed(20)')
    g0 = pg.evaluate('__hvm.save.generation'); time.sleep(4)
    check('loop continua depois de um erro', pg.evaluate('__hvm.save.generation') > g0)

    # 4. pede para a tela não apagar
    check('pede wake lock da tela', pg.evaluate('window.__wake') >= 1)

    # 5. reset no meio da partida é ignorado
    time.sleep(2)
    pg.evaluate('__hvm.setSpeed(1)')
    g1 = pg.evaluate('__hvm.save.generation')
    pg.keyboard.press('Space'); wait_mode(pg, ['COUNTDOWN'], 2)
    pg.keyboard.down('KeyR'); time.sleep(2.4); pg.keyboard.up('KeyR')
    check('reset ignorado fora da tela de espera', pg.evaluate('__hvm.save.generation') == g1,
          f"{g1} -> {pg.evaluate('__hvm.save.generation')}")

    # 6. troca de jogo (G) e de pista (T) na tela de espera; placares separados
    pg.evaluate('localStorage.clear()'); pg.reload(); time.sleep(1)
    g_before = pg.evaluate('__hvm.game')
    pg.keyboard.press('KeyG'); time.sleep(0.5)
    g_after = pg.evaluate('__hvm.game')
    check('G troca de jogo', g_before != g_after, f'{g_before} -> {g_after}')
    select(pg, 'race')
    t0 = pg.evaluate('__hvm.save.track'); pg.keyboard.press('KeyT'); time.sleep(0.5)
    check('T troca de pista na corrida', pg.evaluate('__hvm.save.track') != t0)
    pg.keyboard.press('Space'); time.sleep(3.5)
    pg.keyboard.down('ArrowRight'); time.sleep(3); pg.keyboard.up('ArrowRight')
    check('corrida: bater na parede não acaba a corrida', pg.evaluate('__hvm.mode') == 'PLAYING')
    check('corrida: termina sozinha no tempo limite', wait_mode(pg, ['RESULT_WAIT', 'RESULT', 'NAME', 'CARD'], 60))
    wait_mode(pg, ['ATTRACT'], 40)
    g1 = pg.evaluate('__hvm.game'); pg.keyboard.press('ArrowLeft'); time.sleep(0.5)
    check('◀ ▶ na tela de espera troca de jogo (controle)', pg.evaluate('__hvm.game') != g1)
    pg.keyboard.press('ArrowRight'); time.sleep(0.5)
    tr = pg.evaluate('__hvm.save.track'); pg.keyboard.press('ArrowDown'); time.sleep(0.5)
    check('▲ ▼ na tela de espera troca de pista', pg.evaluate('__hvm.save.track') != tr)
    pg.reload(); time.sleep(1)
    check('jogo escolhido é lembrado ao recarregar', pg.evaluate('__hvm.game') == 'race')

    # 7. plataforma: morrer não acaba a partida (volta ao início)
    check('plataforma disponível', select(pg, 'plat'))
    pg.keyboard.press('Space'); time.sleep(3.5)
    pg.keyboard.down('ArrowRight'); time.sleep(4); pg.keyboard.up('ArrowRight')
    check('plataforma: cair no buraco não acaba a partida', pg.evaluate('__hvm.mode') == 'PLAYING')

    real = [e for e in errors if 'teste' not in e]
    check('sem erros de página', not real, real)
    b.close()

sys.exit(1 if fails else 0)
