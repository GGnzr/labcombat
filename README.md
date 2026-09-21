# 🥊 LabCombat - Arena de Batalha

LabCombat é um jogo educacional multiplayer em tempo real construído com **Phaser 3** e **Firebase**.
Dois jogadores entram em uma arena e respondem a perguntas de conhecimentos gerais ou específicos da área de tecnologia. Acertos rápidos e em sequência liberam ataques poderosos para derrotar o oponente!

## ✨ Funcionalidades
- 🎮 **Multiplayer em Tempo Real:** Sincronização instantânea utilizando Firebase Realtime Database.
- ⚡ **Sistema de Combos (Streak):** Acertar múltiplas perguntas seguidas enche o termômetro. Ao atingir +5, um ataque "Ultimate" é desferido!
- ⏳ **Time Limits e Punições:** Respostas incorretas ou tempo esgotado penalizam o termômetro. Chegar em -3 custa uma vida.
- 🎨 **Estilo Cyberpunk/Pixel Art:** Interface dinâmica e arte estilo arcade.

## 🛠️ Tecnologias Utilizadas
- **[Phaser 3](https://phaser.io/):** Motor gráfico HTML5 Canvas para a renderização, UI e animações.
- **[Firebase RTDB](https://firebase.google.com/):** Banco de dados em tempo real para sincronizar o estado da partida sem a necessidade de um servidor Node.js backend.
- **[Vite](https://vitejs.dev/):** Empacotador de módulos super rápido para desenvolvimento web moderno.

## 🚀 Como Rodar o Projeto Localmente

1. **Clone o repositório:**
   `ash
   git clone https://github.com/GGnzr/labcombat.git
   cd labcombat
   `

2. **Instale as dependências:**
   `ash
   npm install
   `

3. **Inicie o servidor de desenvolvimento:**
   `ash
   npm run dev
   `

4. Acesse http://localhost:5173 no seu navegador!
*(Para testar sozinho, abra uma guia anônima ou outro navegador para simular o segundo jogador)*.

## 🎮 Como Jogar
1. O **Jogador 1** clica em "CRIAR SALA" e aguarda. Um código de 4 dígitos será gerado.
2. O **Jogador 2** clica em "ENTRAR EM SALA" e digita o código de 4 dígitos fornecido pelo P1.
3. Assim que ambos estiverem na sala, a partida começará!
4. Leia atentamente a pergunta na caixa inferior e clique na resposta correta antes que os 15 segundos acabem.
5. Quem zerar as 3 vidas do oponente primeiro, ganha a batalha!

---
*Projeto desenvolvido em 2026.*
