# Humanos vs. Máquina — design do jogo

Stand de tecnologia na E. E. Firmino Costa (Lavras/MG), turma de ensino médio (3º ano).
Prazo: pronto até 2026-11-19. Não precisa ser polido.

## Por quê

O jogo é isca para o stand: chama a atenção, a pessoa joga 1–2 minutos e a conversa
começa. A conversa é ampla — tecnologia, cursos da UFLA, mercado de trabalho — e o
jogo puxa dois ganchos:

1. **IA não é só ChatGPT.** Mostrar uma máquina aprendendo sozinha, por tentativa e
   erro, sem texto nenhum.
2. **"Dá pra estudar/trabalhar com isso."** Ligação com cursos da UFLA.

## Objetivos

- Entender em 5 segundos, partida curta (30 s – 2 min), jogável no joystick.
- Ver ao vivo uma população de robôs evoluindo e ficando melhor que os humanos ao longo do dia.
- Placar Humanos vs. Máquina que dá vontade de competir.
- Ganchos visuais para a conversa: geração atual, rede neural "pensando", cartões de curiosidade.

## Não-objetivos

- Polimento, áudio elaborado, várias fases, online/multiplayer em rede.
- Explicar IA dentro do jogo — quem explica são vocês.

## Anti-objetivos (fracasso mesmo funcionando)

- Regras que precisam de explicação antes de jogar.
- Travar, depender de internet ou de instalar algo no dia.
- Cara de clone de jogo famoso (ex.: Flappy Bird, dinossauro do Chrome).
- Máquina que não aprende visivelmente em poucos minutos.

## Abordagens consideradas

- **A. Neuroevolução (algoritmo genético + rede neural pequena)** — ESCOLHIDA.
  50 robôs jogam juntos; os melhores se reproduzem com mutação. Aprende rápido, é
  bonito de ver, explica-se com seleção natural.
- B. Aprendizado por reforço (Q-learning) — mais lento, menos visual, mais risco no prazo.
- C. Imitação dos jogadores — dados da própria turma, mas aprende pouco com poucos jogadores.
  Possível extra se sobrar tempo.

## O jogo (proposta minha — corrigir à vontade)

Uma navezinha/drone avança sozinha para a direita por um corredor com obstáculos
(colunas com uma brecha). O jogador só controla **subir/descer** (analógico ou
direcional). Bateu, acabou. A velocidade aumenta aos poucos. Pontuação = distância.

Visual próprio: fundo escuro, estilo neon/circuito, robôs da IA como drones
semitransparentes.

```
┌──────────────────────────────────────────────┬────────────────┐
│  HUMANOS 312   vs   MÁQUINA 1.840            │  GERAÇÃO 14    │
│                                              │  vivos: 23/50  │
│      ▓▓        ▓▓          ▓▓                │                │
│      ▓▓        ▓▓    ◇◇◇   ▓▓                │  rede neural   │
│  ◆ ◇◇          ▓▓  ◇◇      ▓▓                │  do melhor:    │
│      ▓▓   ◇◇◇            ▓▓▓▓                │   o─o          │
│      ▓▓        ▓▓        ▓▓▓▓                │   o─o─o        │
│                                              │   o─o          │
│  ◆ = você    ◇ = robôs da IA                 │                │
└──────────────────────────────────────────────┴────────────────┘
```

### Modos

- **Atração (padrão, sem ninguém jogando):** só a IA treinando, em tela cheia, com
  velocidade acelerável. Chama gente de longe.
- **Desafio:** apertar qualquer botão do joystick entra o humano. O humano corre junto
  com a geração atual de robôs, no mesmo cenário. No fim: "Você fez 412. O melhor robô
  da geração 14 fez 980." + cartão de curiosidade.
- A evolução continua o dia todo; a população é salva no navegador (sobrevive a recarregar).

### IA

- Entradas da rede: altura do drone, velocidade vertical, distância até o próximo
  obstáculo, altura da brecha (e do seguinte).
- Rede pequena (ex.: 5–6 → 6 → 1), saída = subir/descer.
- Fitness = distância percorrida. Elitismo + mutação gaussiana.
- Painel mostra a rede do melhor robô vivo com ativações acesas em tempo real.
- Botões de controle (teclado, para vocês): acelerar treino ×1/×5/×20, resetar IA
  (para mostrar "do zero" para uma turma nova).

### Cartões de curiosidade (entre partidas)

Curtos, um por vez, alternando:
- O que acabou de acontecer ("isso se chama algoritmo genético / rede neural").
- Onde isso aparece no mundo real (jogos, robótica, agricultura de precisão, carros).
- IA além do ChatGPT (visão computacional, recomendação do YouTube/TikTok, previsão do tempo).
- Um curso da UFLA relacionado (lista a conferir no site da UFLA antes de usar).

### Placar

- Recorde humano do dia (com 3 letras de nome, escolhidas no joystick) vs. recorde da máquina.
- Top 5 humanos.
- Salvo no navegador.

## Decisões técnicas (minhas)

- Um único `index.html` + JS puro + Canvas. Sem build, sem internet, abre no Chrome.
- Gamepad API (Xbox/PS/genérico); teclado como reserva (setas / espaço).
- Tela cheia (F11), pensada para 1080p num notebook ou TV.
- Pasta: `C:\Users\jpab2\Documentos\jogo-firmino-costa\`.

## Fica para o construtor

Cores exatas, constantes de física e dificuldade, parâmetros do algoritmo genético
(ajustar até a IA aprender visivelmente em ~2–5 min a ×1), texto final dos cartões.
