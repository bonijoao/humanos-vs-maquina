# Humanos vs. Máquina Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jogo de navegador, offline, em que humanos (joystick) competem contra uma população de drones que aprende por neuroevolução ao vivo.

**Architecture:** Scripts clássicos (sem módulos ES, para funcionar via `file://`) carregados por `index.html`. Cada arquivo de lógica pura exporta para `window.HVM` e para `module.exports`, permitindo testes em Node (`node --test`). Simulação de passo fixo (60 Hz) separada da renderização em Canvas.

**Tech Stack:** HTML5 Canvas, JavaScript puro, Gamepad API, localStorage, Node ≥18 apenas para testes.

**Spec:** `docs/design.md`

## Global Constraints

- Um único ponto de entrada `index.html`; nada de internet, CDN, build ou instalação no dia.
- Abre com duplo clique no Chrome (`file://`) — portanto nada de `type="module"`, nada de `fetch` de arquivos locais.
- Textos da interface em português do Brasil.
- Visual próprio estilo neon/circuito, fundo escuro; não pode lembrar Flappy Bird nem o dinossauro do Chrome.
- Jogador só controla subir/descer. Pontuação = distância.
- 50 robôs por geração.
- Rede pequena (entradas → 6 ocultos → 1 saída).
- Commits sem nenhum trailer de IA; autor jpab.27@hotmail.com.

## Review Focus

1. Joystick conectado depois da página abrir, ou desconectado no meio da partida → o jogo detecta sem recarregar e cai para teclado sem travar.
2. localStorage vazio, corrompido ou indisponível → o jogo começa do zero sem erro (teste em `storage.test.js`).
3. Aba em segundo plano/notebook dormindo → ao voltar, o loop não tenta simular milhares de passos de uma vez (limite de passos por frame).
4. IA estagnada (todos morrem no primeiro obstáculo por muitas gerações) → a evolução ainda progride; teste em `ga.test.js` exige melhora de fitness em N gerações num mundo simulado.
5. Treino acelerado ×20 num notebook fraco → renderização não trava; simulação a ×20 roda sem desenhar cada passo.

---

### Task 1: Esqueleto, mundo e física

**Files:**
- Create: `index.html`, `src/world.js`, `src/rng.js`, `tests/world.test.js`, `package.json` (só `"scripts": {"test": "node --test tests/"}`), `.gitignore`

**Interfaces:**
- Produces:
  - `HVM.makeRng(seed:number) -> () => number` (mulberry32, [0,1)).
  - `HVM.World` constants: `W=1280, H=720, GRAVITY`, `DRONE_X=200`, `GAP=200` (mín. 150 conforme dificuldade), `OBST_W=80`, `OBST_SPACING=360`, `SPEED0=4`, `SPEED_MAX=10`.
  - `createWorld(seed) -> {t, speed, distance, obstacles:[{x, gapY, gapH, passed}]}`
  - `createDrone() -> {y, vy, alive, distance}`
  - `stepWorld(world)` avança obstáculos, gera novos com o rng do mundo, aumenta velocidade.
  - `stepDrone(drone, world, action:number /* -1..1 */)` aplica empuxo vertical (sem gravidade forte: controle direto `vy += action*ACC`, amortecimento), detecta colisão com teto/chão/obstáculo, atualiza `distance`.
  - `nextObstacles(world, x) -> [o1, o2]` os dois próximos à frente de x.

- [ ] Step 1: Escrever `tests/world.test.js`: mesmo seed ⇒ mesma sequência de obstáculos; drone parado no centro morre ao encostar num obstáculo cuja brecha não o contém; drone dentro da brecha sobrevive e `distance` cresce; bater no chão/teto ⇒ `alive=false`; velocidade nunca passa de `SPEED_MAX`.
- [ ] Step 2: `npm test` → FAIL.
- [ ] Step 3: Implementar `src/rng.js` e `src/world.js` (padrão UMD: `(function(root){...; root.HVM=Object.assign(root.HVM||{},api); if(typeof module!=='undefined')module.exports=api})(typeof window!=='undefined'?window:globalThis)`).
- [ ] Step 4: `npm test` → PASS.
- [ ] Step 5: `index.html` com `<canvas>` escalado para a janela mantendo 16:9, carregando os scripts em ordem. Abrir no Chrome, sem erros no console.
- [ ] Step 6: `git init`, commit "Mundo e física do drone".

### Task 2: Rede neural e algoritmo genético

**Files:**
- Create: `src/nn.js`, `src/ga.js`, `tests/nn.test.js`, `tests/ga.test.js`

**Interfaces:**
- Consumes: `makeRng`, `createWorld`, `createDrone`, `stepWorld`, `stepDrone`, `nextObstacles`.
- Produces:
  - `HVM.NN_SHAPE = [6, 6, 1]`.
  - `createNet(rng) -> {w1:Float32Array(6*6), b1, w2:Float32Array(6), b2}`
  - `forward(net, inputs:number[6]) -> {hidden:number[6], out:number}` (tanh nas duas camadas; `out` ∈ [-1,1] é a ação).
  - `sensors(drone, world) -> number[6]` normalizados ~[-1,1]: y, vy, dx ao 1º obstáculo, gapY 1º − y, dx 2º, gapY 2º − y.
  - `nextGeneration(pop:[{net, fitness}], rng) -> net[]` — tamanho 50; elitismo top 5 copiados; resto: pai por torneio (k=3), mutação gaussiana em cada peso com prob 0.1, σ 0.3; 5 indivíduos totalmente aleatórios por geração (anti-estagnação).
  - `serializeNet(net) -> number[]`, `deserializeNet(arr) -> net`.

- [ ] Step 1: `nn.test.js`: `forward` determinístico; saída em [-1,1]; serialize/deserialize ida-e-volta igual.
- [ ] Step 2: `ga.test.js`: `nextGeneration` devolve 50 redes; as 5 melhores sobrevivem idênticas; **teste de aprendizado**: rodar 30 gerações headless (cada uma até todos morrerem ou 5000 passos) num mundo de seed fixa por geração e exigir que o melhor fitness da geração 30 seja ≥ 5× o da geração 1.
- [ ] Step 3: `npm test` → FAIL.
- [ ] Step 4: Implementar `nn.js` e `ga.js`; ajustar constantes de mutação até o teste de aprendizado passar.
- [ ] Step 5: `npm test` → PASS. Commit "Rede neural e evolução".

### Task 3: Persistência e placar

**Files:**
- Create: `src/storage.js`, `tests/storage.test.js`

**Interfaces:**
- Produces:
  - `loadState(storage) -> {generation, population:number[][]|null, bestMachine, humans:[{name, score, date}]}` — `storage` é um objeto com `getItem/setItem` (injeção para testar); chave `hvm.v1`. Qualquer erro/JSON inválido ⇒ estado padrão.
  - `saveState(storage, state)` — engole exceções.
  - `addHumanScore(state, name, score) -> {rank:number|null}` mantém top 5 por score desc, `bestHuman` derivado.
  - `resetMachine(state)` zera geração/população/bestMachine, mantém humanos.

- [ ] Step 1: Testes: storage vazio ⇒ padrão; JSON lixo ⇒ padrão; `getItem` que lança ⇒ padrão; top 5 ordenado e truncado; `resetMachine` preserva humanos.
- [ ] Step 2: FAIL → implementar → PASS. Commit "Placar salvo no navegador".

### Task 4: Entrada (joystick + teclado)

**Files:**
- Create: `src/input.js`

**Interfaces:**
- Produces: `HVM.Input = { poll() -> {axis:number /*-1..1, cima=-1*/, pressed:{a, b, up, down, left, right, start}, any:boolean}, connectedName() -> string|null }`.
  - `pressed` é borda de subida (só no frame em que apertou).
  - Joystick: eixo 1 do analógico esquerdo com zona morta 0.2 **ou** direcional (botões 12/13); A=botão 0, B=1, start=9. Varre `navigator.getGamepads()` a cada `poll()` (cobre conectar/desconectar a quente).
  - Teclado: ↑/↓ ou W/S = eixo; Espaço/Enter = a; Esc = b.
  - Teclas de operador (não passam por `poll`): `1/2/3` = velocidade ×1/×5/×20, `R` segurado 2 s = resetar IA, `F` = tela cheia. Expostas como `Input.onOperator(cb(cmd))`.

- [ ] Step 1: Página de teste manual temporária: abrir `index.html?debug=input` que escreve o estado de `poll()` na tela. Verificar com o joystick real: conectar após abrir, desconectar no meio.
- [ ] Step 2: Commit "Joystick e teclado".

### Task 5: Loop do jogo, modos e renderização

**Files:**
- Create: `src/render.js`, `src/main.js`
- Modify: `index.html` (scripts)

**Interfaces:**
- Consumes: tudo acima.
- Produces: máquina de estados em `main.js`: `ATTRACT → (any) → COUNTDOWN(3s) → PLAYING → RESULT → NAME_ENTRY? → CARD → ATTRACT`.

Comportamento:
- Uma geração = 50 drones IA + (se PLAYING) 1 humano no mesmo `world`. Geração termina quando todos (IA) morrem ou ao fim da partida humana; então `nextGeneration`, `generation++`, salvar estado.
- Se o humano ainda está vivo e todos os robôs morreram, o humano continua sozinho; a próxima geração começa só depois do RESULT.
- Passo fixo 1/60 s; acumulador limitado a 5 passos/frame em ×1 (Review Focus 3). Em ×5/×20, roda `speed` passos por frame e só desenha o último.
- `render.js`: fundo escuro com grade de circuito em parallax; obstáculos como colunas neon ciano; robôs = triângulos magenta semitransparentes (o melhor vivo destacado); humano = drone amarelo maior com rastro. HUD: `HUMANOS {bestHuman}  vs  MÁQUINA {bestMachine}`, pontuação atual. Painel lateral (~280 px): `GERAÇÃO n`, `vivos k/50`, desenho da rede do melhor vivo (nós acendem com ativação, linhas com cor/espessura pelo peso), velocidade ×N.
- ATTRACT: texto piscando "APERTE QUALQUER BOTÃO PARA DESAFIAR A MÁQUINA".
- RESULT (4 s ou botão A): "Você fez X. O melhor robô da geração N fez Y." + "Você venceu a máquina!" ou "A máquina venceu… por enquanto."
- NAME_ENTRY se entrou no top 5: 3 letras, ↑/↓ troca letra, A avança.
- Tecla R (2 s) mostra "IA resetada — começando do zero".

- [ ] Step 1: Implementar; abrir no Chrome; verificar à mão: atração aprende visivelmente em 2–5 min a ×1 (e em segundos a ×20); partida humana do começo ao fim com joystick; recarregar a página mantém geração e placar; sem erros no console.
- [ ] Step 2: `npm test` continua PASS. Commit "Loop, modos e visual".

### Task 6: Cartões de curiosidade

**Files:**
- Create: `src/cards.js`
- Modify: `src/main.js`, `src/render.js`

**Interfaces:**
- Produces: `HVM.CARDS: [{tag:'agora'|'mundo'|'alem'|'ufla', title, body}]`, `nextCard(i) -> card` rotacionando entre tags.

Conteúdo (≈12 cartões, 2–3 linhas cada): o que é rede neural; algoritmo genético = seleção natural; "ninguém programou como desviar"; IA na agricultura de precisão, diagnóstico médico, previsão do tempo, recomendação de vídeos, carros autônomos; ChatGPT é um tipo de IA (modelo de linguagem), não a única; cursos da UFLA ligados a tecnologia — **conferir no site oficial da UFLA antes de escrever** e citar só cursos existentes.

- [ ] Step 1: Pesquisar cursos da UFLA; escrever cartões; mostrar CARD por 6 s (ou A) depois de RESULT; no ATTRACT, alternar cartão a cada ~15 s num canto.
- [ ] Step 2: Verificar no navegador. Commit "Cartões de curiosidade".

### Task 7: Ensaio geral

- [ ] Step 1: Rodar 15 min em ATTRACT a ×1 — sem travar, memória estável (DevTools), geração avança.
- [ ] Step 2: 5 partidas seguidas com joystick, incluindo desconectar o controle no meio e entrar no top 5.
- [ ] Step 3: Apagar localStorage, recarregar: começa limpo. Corromper `hvm.v1` à mão: começa limpo.
- [ ] Step 4: Escrever `LEIA-ME.txt` curto: como abrir, teclas do operador, como resetar. Commit "Pronto para o stand".
