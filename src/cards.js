(function (root) {
  const CARDS = [
    // o que você viu
    { tag: 'agora', title: 'Ninguém programou o desvio',
      body: 'Não escrevemos nenhuma regra do tipo "se tiver parede, suba". Os robôs começam apertando botões ao acaso e vão melhorando sozinhos, geração após geração.' },
    { tag: 'agora', title: 'Isso é seleção natural',
      body: 'A cada geração, os robôs que foram mais longe viram "pais" da próxima, com pequenas mutações. É um algoritmo genético: a ideia de Darwin aplicada a programas.' },
    { tag: 'agora', title: 'O cérebro do robô',
      body: 'O desenho ao lado é uma rede neural: 6 sensores (altura, distância da parede...) ligados a 6 neurônios que decidem subir ou descer. São só 49 números, que a evolução vai ajustando.' },
    { tag: 'agora', title: 'Por que ele ainda erra?',
      body: 'A máquina só aprende com o que viu. Quando o jogo fica rápido demais ou aparece uma situação nova, ela erra. Toda IA tem esse limite, inclusive as grandes.' },
    // no mundo real
    { tag: 'mundo', title: 'IA no campo',
      body: 'Drones e câmeras com visão computacional identificam pragas, doenças e falhas de plantio, e tratores aplicam adubo só onde precisa. É a agricultura de precisão, muito forte aqui no sul de Minas.' },
    { tag: 'mundo', title: 'IA na saúde',
      body: 'Modelos treinados com milhares de exames ajudam médicos a encontrar sinais de doenças em raio-X, tomografias e fotos da retina, às vezes mais cedo do que um olho humano.' },
    { tag: 'mundo', title: 'Robôs que aprendem a andar',
      body: 'Robôs com pernas aprendem a se equilibrar do mesmo jeito que esses drones: tentando milhões de vezes numa simulação antes de ir para o mundo real.' },
    { tag: 'mundo', title: 'Previsão do tempo e do preço',
      body: 'Estatística e aprendizado de máquina preveem chuva, safra, preço do café e até falhas em máquinas antes de elas quebrarem.' },
    // além do ChatGPT
    { tag: 'alem', title: 'ChatGPT é só um tipo de IA',
      body: 'Ele é um modelo de linguagem: aprendeu a prever a próxima palavra lendo uma quantidade enorme de texto. Mas existe IA que enxerga, que joga, que dirige, que recomenda...' },
    { tag: 'alem', title: 'Quem escolhe seu próximo vídeo?',
      body: 'O TikTok, o YouTube e o Instagram usam sistemas de recomendação: IAs que aprendem com o que você assiste até o fim e decidem o que mostrar depois.' },
    { tag: 'alem', title: 'Seu celular já usa IA',
      body: 'Desbloquear pelo rosto, o modo retrato da câmera, o teclado que completa palavras, o filtro de spam: tudo isso é aprendizado de máquina rodando no seu bolso.' },
    { tag: 'alem', title: 'IA também erra (e engana)',
      body: 'Deepfakes, imagens falsas e textos inventados ficaram fáceis de fazer. Entender como a IA funciona é a melhor defesa para não cair.' },
    // UFLA (cursos confirmados em fontes públicas; conferir no site oficial)
    { tag: 'ufla', title: 'Ciência da Computação',
      body: 'Programação, algoritmos, inteligência artificial e o "porquê" de tudo funcionar. Dá pra fazer aqui em Lavras, na UFLA, de graça.' },
    { tag: 'ufla', title: 'Sistemas de Informação',
      body: 'Desenvolvimento de software, banco de dados, sistemas para empresas e governo. Curso da UFLA com muita vaga no mercado.' },
    { tag: 'ufla', title: 'Engenharia de Controle e Automação',
      body: 'Robótica, sensores, máquinas que se controlam sozinhas, como esses drones. Também tem na UFLA.' },
    { tag: 'ufla', title: 'Agronomia + tecnologia',
      body: 'A UFLA é referência nacional em agro, e o agro hoje é cheio de drones, satélites, sensores e dados. Tecnologia não é só curso de computação.' },
  ];

  const ORDER = ['agora', 'alem', 'mundo', 'ufla'];
  const byTag = {};
  for (const c of CARDS) (byTag[c.tag] = byTag[c.tag] || []).push(c);

  function nextCard(i) {
    const n = Math.abs(Math.floor(i)) || 0;
    const list = byTag[ORDER[n % ORDER.length]];
    return list[Math.floor(n / ORDER.length) % list.length];
  }

  const api = { CARDS, nextCard };
  root.HVM = Object.assign(root.HVM || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
