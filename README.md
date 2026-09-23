# 🥊 LabCombat - Arena de Batalha de Conhecimento

![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Phaser 3](https://img.shields.io/badge/Phaser_3-8B5CF6?style=for-the-badge&logo=javascript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase_RTDB-FFA611?style=for-the-badge&logo=firebase&logoColor=white)
![JavaScript](https://img.shields.io/badge/ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**LabCombat** é um jogo de luta multiplayer educacional em tempo real que combina a adrenalina dos jogos de arcade clássicos (Street Fighter, The King of Fighters) com quizzes de tecnologia da informação e computação.

Dois jogadores entram na arena, escolhem seus personagens/professores favoritos e batalham respondendo a perguntas técnicas. Acertos rápidos e combos contínuos liberam ataques especiais e ultimates para nocautear o adversário!

---

## ✨ Principais Funcionalidades

### 🎮 Multiplayer em Tempo Real
- **Sincronização Instantânea:** Partidas sincronizadas via Firebase Realtime Database com latência ultra-baixa sem necessidade de backend dedicado.
- **Lobby de Salas ao Vivo:** Lista dinâmica de salas públicas abertas esperando adversários.
- **Entrada Descomplicada:** Entrada via código de 4 caracteres com botão rápido de colar da área de transferência.
- **Proteção de Vagas (2/2):** Controle estrito de capacidade que impede que terceiros entrem ou derrubem jogadores já conectados.
- **Limpeza Automática:** Gatilhos nativos de `onDisconnect` que limpam jogadores inativos e salas abandonadas.

### 🕹️ Seleção de Personagens (Estilo Arcade)
- **Grid de Lutadores:** Escolha entre diferentes professores/disciplinas (Web, Banco de Dados, Engenharia de Software, Redes, Sistemas Operacionais, POO).
- **Pré-visualização Dinâmica:** Sprites animados em repouso (Idle) e portraits retro.
- **Confirmação Sincronizada:** Indicadores de "PRONTO" e início imediato do combate quando ambos os jogadores confirmam.

### ⚔️ Batalha e Mecânicas de Combate
- **HUD Renovado:** Interface limpa sem poluição visual, barras de vida e termômetro de sequência.
- **Sistema de Streak (Combos):** Sequência de acertos preenche o termômetro. Ao atingir +5, um ataque "Ultimate" devastador é disparado!
- **Punições:** Erros e tempo esgotado penalizam o termômetro de combate (-3 custa uma vida).
- **Temporizador Ajustável:** Tempo por questão configurável dinamicamente.

### 🛠️ Painel do Game Master / Dev (Modo Administrador)
- **Acesso Seguro via PIN:** Abertura da sidebar de administração protegida por autenticação.
- **Ajustes de Tempo:** Calibração em tempo real do tempo de início de rodada e limite por questão.
- **Monitor de Salas:** Painel em tempo real para visualizar salas criadas, jogadores conectados e botões para limpeza de salas vazias.
- **Terminal de Logs:** Histórico detalhado de eventos (salas, conexões, partidas, avisos e erros) com filtro por cores e botão de cópia.

---

## 👨‍🏫 Personagens / Professores

| Personagem | Matéria / Especialidade | Estilo de Ataque |
| :--- | :--- | :--- |
| **Dr. Script** | Desenvolvimento Web & Frontend | Ataques rápidos com tags HTML e scripts reativos |
| **Prof. Query** | Bancos de Dados & SQL | Golpes pesados com comandos estruturados e transações |
| **Dra. Agile** | Engenharia de Software & Scrum | Gestão tática e ataques em sprints coordenados |
| **Prof. Packet** | Redes de Computadores & Protocolos | Rajadas de pacotes TCP e controle de fluxo |
| **Dr. Kernel** | Sistemas Operacionais | Manipulação de memória e processos de baixo nível |
| **Profa. Class** | Programação Orientada a Objetos | Herança de dano e polimorfismo destrutivo |

---

## 🚀 Como Rodar o Projeto Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) instalado (versão 18 ou superior recomendada).

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/GGnzr/labcombat.git
   cd labcombat
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **Acesse no navegador:**
   Abra [http://localhost:5173](http://localhost:5173) no seu navegador.

> 💡 **Dica para Testes Multiplayer:**
> - Abra uma janela normal para o **Jogador 1 (Host)**.
> - Abra uma janela anônima (`Ctrl + Shift + N`) ou use o Microsoft Edge para o **Jogador 2**.
> - Para testar pelo celular na mesma rede Wi-Fi, inicie com `npm run dev -- --host` e acesse pelo IP local exibido no terminal.

---

## 🎮 Como Jogar

1. **Criar Sala (Host):**
   - O Jogador 1 insere seu apelido e clica em **CRIAR SALA**.
   - Um código de 4 caracteres será gerado (ex: `ABCD`).
2. **Entrar na Sala (Desafiante):**
   - O Jogador 2 clica em **ENTRAR EM SALA**, insere seu apelido e digita ou cola o código, ou seleciona a sala diretamente na lista de **Salas Abertas ao Vivo**.
3. **Seleção de Personagens:**
   - Ambos os jogadores escolhem seu professor favorito e clicam em **CONFIRMAR**.
4. **O Combate:**
   - Leia a pergunta técnica exibida na tela e clique na alternativa correta antes que o cronômetro expire.
   - O primeiro jogador a zerar as vidas do oponente vence a partida!

---

## 📁 Estrutura de Arquivos

```
labcombat/
├── public/
│   └── assets/
│       ├── professors/       # Portraits e sprites dos lutadores
│       └── ...               # Fundos de arena, sons e efeitos
├── src/
│   ├── scenes/
│   │   ├── BootScene.js              # Pré-carregamento de assets
│   │   ├── MenuScene.js              # Menu inicial e criação/busca de salas
│   │   ├── CharacterSelectScene.js   # Seleção arcade de lutadores
│   │   └── MainScene.js              # Arena principal de combate e lógica do quiz
│   ├── auth.js               # Autenticação e controle de sessão do Game Master
│   ├── firebase.js           # Inicialização e configuração do Firebase RTDB
│   ├── game.js               # Configurações de escala e inicialização do Phaser
│   ├── logger.js             # Sistema central de logs para o terminal GM
│   ├── professors.js         # Dados e descrições dos lutadores
│   ├── questions.js          # Banco de questões técnicas
│   ├── style.css             # Estilos do jogo, sidebar GM e HUD
│   └── main.js               # Ponto de entrada da aplicação
├── index.html                # Estrutura HTML, painel GM e modais de entrada
├── package.json              # Dependências e scripts do projeto
└── README.md                 # Documentação oficial
```

---

## 🛠️ Tecnologias

- **[Phaser 3](https://phaser.io/):** Motor de física e renderização 2D Canvas/WebGL.
- **[Firebase Realtime Database](https://firebase.google.com/):** Sincronização em tempo real de salas, jogadores e estado da partida.
- **[Vite](https://vitejs.dev/):** Build tool e servidor de desenvolvimento ágil.

---

Desenvolvido para fins educacionais e competitivos. 🥊⚡
