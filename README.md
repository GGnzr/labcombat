# 🥊 LabCombat - Arena de Batalha de Conhecimento

![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Phaser 3](https://img.shields.io/badge/Phaser_3-8B5CF6?style=for-the-badge&logo=javascript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase_RTDB-FFA611?style=for-the-badge&logo=firebase&logoColor=white)
![JavaScript](https://img.shields.io/badge/ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)

**LabCombat** é um jogo de luta multiplayer educacional em tempo real que combina a adrenalina dos jogos de arcade clássicos (Street Fighter, The King of Fighters) com quizzes de tecnologia da informação e computação.

Dois jogadores entram na arena, escolhem suas disciplinas/personagens favoritos e batalham respondendo a perguntas técnicas. Acertos rápidos acumulam cargas de energia para desferir super golpes e ultimates para nocautear o adversário!

---

## ✨ Principais Funcionalidades

### 🎮 Multiplayer em Tempo Real
- **Sincronização Instantânea:** Partidas sincronizadas via Firebase Realtime Database com latência ultra-baixa sem necessidade de backend dedicado.
- **Lobby de Salas ao Vivo:** Lista dinâmica de salas públicas abertas esperando adversários.
- **Entrada Descomplicada:** Entrada via código de 4 caracteres com botão rápido de colar da área de transferência.
- **Proteção de Vagas (2/2):** Controle estrito de capacidade que impede que terceiros entrem ou derrubem jogadores já conectados.
- **Limpeza Automática:** Gatilhos nativos de `onDisconnect` que limpam jogadores inativos e salas abandonadas.

### 🕹️ Seleção de Personagens (Estilo Arcade)
- **Grid de Lutadores:** Escolha entre diferentes disciplinas da computação (Web & Mobile, Banco de Dados, Engenharia de Software, Redes, Sistemas Operacionais, POO).
- **Pré-visualização Dinâmica:** Sprites animados em repouso (Idle) e portraits retro.
- **Confirmação Sincronizada:** Indicadores de "PRONTO" e início imediato do combate quando ambos os jogadores confirmam.
- **Modo Solo para Testes:** Botão `⚡ Iniciar Solo` para testar as rodadas de perguntas diretamente sem precisar de um segundo jogador.

### ⚔️ Batalha e Mecânicas de Combate
- **Pontos de Vida (100 HP):** Cada jogador inicia o duelo com **100 HP**. O combate encerra quando o HP de um dos lutadores chega a 0 (K.O.).
- **Sistema de Cargas e Ultimate (⚡ 0 a 3 Cargas):**
  - Acertos acumulam cargas de energia para ataques especiais (máximo de 3 cargas).
  - Com **3 Cargas**, o próximo acerto dispara um **Super Golpe (-28 HP)** ou um devastador **Ultimate Finisher (K.O. instantâneo)** se o adversário estiver com 33 HP ou menos!
- **Disputa de Respostas por Rodada:**
  - **Apenas um acerta:** O acertador causa **-15 HP** de dano direto no rival e ganha +1 Carga.
  - **Duelo de Velocidade (Ambos acertam):** Quem responder em menor tempo vence a disputa de velocidade, recebendo +1 Carga e o bônus do modificador da rodada, enquanto o mais lento se defende sem sofrer dano.
  - **Ambos erram:** Ambos são penalizados e perdem 1 carga acumulada (**-1 Carga**).
- **Modificadores Especiais de Rodada:**
  - 🛡️ **Firewall:** Ganha escudo que anula e absorve 100% do dano do próximo ataque ou Ultimate.
  - 🪲 **Try-Catch:** Tratamento de exceção que anula o dano do próximo erro.
  - 💚 **Backup:** Restaura **+10 HP** ao acertar primeiro.
  - ⚡ **Overclock:** Concede **+1 Carga extra** ao acertar primeiro.
- **Temporizador Dinâmico:** Tempo por questão calibrado e sincronizado em tempo real com o painel do desenvolvedor.

### 🛠️ Painel do Game Master / Dev (Modo Administrador)
- **Acesso Seguro via PIN:** Abertura da sidebar de administração protegida por autenticação (atalho **F2**, **Ctrl + Shift + D** ou parâmetro `?gm=1` na URL; PIN padrão: `admin` ou `gm2026`).
- **Ajustes de Tempo:** Calibração em tempo real do tempo de início de rodada e limite por questão.
- **Monitor de Salas:** Painel em tempo real para visualizar salas criadas, jogadores conectados e botões para limpeza de salas vazias.
- **Terminal de Logs:** Histórico detalhado de eventos (salas, conexões, partidas, avisos e erros) com filtro por cores e botão de cópia.

---

## 🎮 Disciplinas / Personagens

Cada lutador representa uma disciplina fundamental da área de tecnologia:

| Disciplina | Tópicos & Especialidades | Golpe Especial (Ultimate) |
| :--- | :--- | :--- |
| **Sistemas Operacionais** | Threads, Processos & Kernel | KERNEL PANIC (TELA AZUL) |
| **Engenharia de Software** | Scrum, Requisitos & Clean Code | DEPLOY EM PRODUÇÃO NA SEXTA |
| **Programação Orientada a Objetos** | Classes, Polimorfismo & Herança | NULL POINTER EXCEPTION |
| **Web & Mobile** | Frontend, Fullstack & APIs | 404 NOT FOUND (CORS ERROR) |
| **Banco de Dados** | SQL, Índices & Normalização | DROP DATABASE --FORCE |
| **Redes de Computadores** | TCP/IP, Roteamento & Ping | DDoS OVERLOAD (PING DA MORTE) |

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
   - Ambos os jogadores escolhem sua disciplina/personagem e clicam em **CONFIRMAR**.
4. **O Combate:**
   - Leia a pergunta técnica exibida na tela e clique na alternativa correta antes que o cronômetro expire.
   - Seja rápido: em caso de acerto mútuo, quem responder primeiro vence a disputa de velocidade da rodada.
   - Acumule 3 cargas para desferir o Ultimate Finisher. O primeiro a zerar os 100 HP do rival vence a batalha por K.O.!

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
├── PLANO_DE_IMPLEMENTACAO.md # Planejamento técnico, deploy, autenticação e LGPD
├── LICENSE                   # Licença de uso e distribuição do código (MIT)
└── README.md                 # Documentação oficial
```

---

## 📋 Plano de Produção & Roadmap

Para consultar o planejamento de evolução técnica, roteiro de deploy online (Vercel/Firebase), arquitetura de autenticação, conformidade com a LGPD e licenciamento, acesse o documento completo:
👉 **[PLANO_DE_IMPLEMENTACAO.md](PLANO_DE_IMPLEMENTACAO.md)**

---

## 🛠️ Tecnologias

- **[Phaser 3](https://phaser.io/):** Motor de física e renderização 2D Canvas/WebGL.
- **[Firebase Realtime Database](https://firebase.google.com/):** Sincronização em tempo real de salas, jogadores e estado da partida.
- **[Vite](https://vitejs.dev/):** Build tool e servidor de desenvolvimento ágil.

---

## 📄 Licença

Este projeto está licenciado sob os termos da **Licença MIT** - consulte o arquivo [LICENSE](LICENSE) para mais detalhes.  
*Os assets visuais, personagens e conteúdos pedagógicos são de autoria do projeto e destinados a fins estritamente educacionais.*

---

Desenvolvido para fins educacionais e competitivos. 🥊⚡
