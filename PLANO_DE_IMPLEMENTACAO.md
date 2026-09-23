# 📋 Plano de Implementação, Arquitetura e Produção - LabCombat

Este documento detalha o planejamento técnico completo para a evolução do **LabCombat**, cobrindo novas funcionalidades de gameplay, ferramentas pedagógicas, infraestrutura para disponibilizar o jogo online publicamente, estratégia de autenticação e diretrizes de conformidade com a **LGPD (Lei Geral de Proteção de Dados)**.

---

## 📌 Sumário
1. [Fase 1: Gameplay, Áudio e Resiliência Multiplayer](#-fase-1-gameplay-áudio-e-resiliência-multiplayer)
2. [Fase 2: Gestão Pedagógica e Painel do Game Master](#-fase-2-gestão-pedagógica-e-painel-do-game-master)
3. [Fase 3: Infraestrutura e Publicação Online (Deploy)](#-fase-3-infraestrutura-e-publicação-online-deploy)
4. [Fase 4: Autenticação e Segurança de Dados](#-fase-4-autenticação-e-segurança-de-dados)
5. [Fase 5: Conformidade com a LGPD](#-fase-5-conformidade-com-a-lgpd-lei-137092018)
6. [Fase 6: Licenciamento de Software e Propriedade Intelectual](#-fase-6-licenciamento-de-software-e-propriedade-intelectual)
7. [Matriz de Priorização e Cronograma Sugerido](#-matriz-de-priorização-e-cronograma-sugerido)

---

## 🎮 Fase 1: Gameplay, Áudio e Resiliência Multiplayer

### 1.1 Tratamento de Desconexão em Batalha (Vitória por W.O.)
* **Problema:** Se um jogador fechar o navegador no meio da partida (`MainScene`), o adversário fica esperando até o temporizador forçar timeout rodada a rodada.
* **Como implementar:**
  1. Registrar na entrada do `MainScene` o gatilho `onDisconnect(ref(db, `rooms/${roomId}/${playerId}`)).remove()`.
  2. No listener `onValue` do `MainScene`, monitorar a existência do nó do oponente (`data.p1` e `data.p2`).
  3. Se o oponente for removido com a partida em andamento (`!data[oppKey] && !this.isGameOver`), disparar o método `handleOpponentDisconnect()`:
     * Pausar temporizadores de rodada.
     * Exibir modal central: `⚠️ O oponente abandonou o duelo! Vitória por W.O.`.
     * Atribuir vitória ao jogador remanescente e oferecer botões `[Voltar ao Menu]` ou `[Aguardar Novo Desafiante]`.

### 1.2 Sistema de Efeitos Sonoros Retrô (Web Audio API)
* **Objetivo:** Adicionar imersão arcade sem precisar carregar arquivos de áudio externos pesados (MP3/WAV).
* **Como implementar:**
  * Criar o módulo `src/audio.js` utilizando a **Web Audio API** nativa dos navegadores:
    ```javascript
    // Exemplo de síntese chiptune nativa para acerto, erro e K.O.
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    export function playHitSound() {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    }
    ```
  * **Efeitos mapeados:**
    * 🔔 Contagem regressiva (3, 2, 1, FIGHT!).
    * 💥 Acerto normal (-15 HP).
    * 🛡️ Bloqueio com Firewall ou absorção Try-Catch.
    * ⚡ Ativação de Ultimate Finisher.
    * 💀 K.O. e Fanfarra de Vitória.
  * Adicionar botão flutuante `🔊/🔇` no topo da tela para controle do usuário.

### 1.3 Animações de Ataque e Projéteis Temáticos
* **Como implementar:**
  * Ao confirmar resposta com acerto, aplicar tween de arremetida no sprite do lutador:
    ```javascript
    this.tweens.add({
        targets: attackerSprite,
        x: attackerSprite.x + (isP1 ? 60 : -60),
        duration: 90,
        yoyo: true,
        ease: 'Quad.easeInOut'
    });
    ```
  * Criar projéteis temáticos com partículas ou sprites pequenos viajando entre os dois lados da arena:
    * *Sistemas Operacionais:* Ícone de processo / terminal.
    * *Redes:* Pacote TCP azul / raios de conexão.
    * *Banco de Dados:* Cilindro de tabela SQL / raio roxo.
    * *Web & Mobile:* Tag `</>` ou engrenagem reativa.

### 1.4 Suporte Mobile e Bloqueio de Orientação
* **Problema:** Em telas de smartphone na vertical, a proporção 16:9 corta a interface ou reduz demais a fonte.
* **Como implementar:**
  * Inserir um overlay CSS no `index.html` ativado por media query:
    ```css
    @media screen and (orientation: portrait) and (max-width: 900px) {
        #rotate-device-overlay {
            display: flex !important;
        }
    }
    ```
### 1.5 Sistema de Ranking Competitivo e Elos de Batalha (Progressão por Vitórias)
* **Objetivo:** Estimular o engajamento e a competição saudável entre estudantes e jogadores, permitindo subir de elo a cada sequência de vitórias conquistadas.
* **Elos Temáticos de Carreira Dev:**
  * 🥉 **Estagiário (Intern):** 0 a 2 vitórias (0 a 74 RP)
  * 🥈 **Desenvolvedor Júnior:** 3 a 5 vitórias (75 a 149 RP)
  * 🥇 **Desenvolvedor Pleno:** 6 a 9 vitórias (150 a 249 RP)
  * 💎 **Desenvolvedor Sênior / Tech Lead:** 10 a 14 vitórias (250 a 374 RP)
  * 👑 **Arquiteto / Mestre dos Algoritmos:** 15+ vitórias (375+ RP)

* **Mecânica de Pontuação (Rank Points - RP):**
  * **Vitória:** +25 RP base.
  * **Bônus de Desempenho:** +5 RP se vencer com K.O. via *Ultimate Finisher* ou sem sofrer nenhum erro (*Perfect Match*).
  * **Derrota:** -10 RP (com proteção nos elos iniciais para não desestimular o aprendizado).

* **Estrutura no Firebase Realtime Database:**
  ```json
  {
    "leaderboard": {
      "user_anon_uid_123": {
        "nickname": "DevNinja",
        "points": 210,
        "wins": 8,
        "matches": 11,
        "winRate": "72%",
        "tier": "Desenvolvedor Pleno",
        "tierIcon": "🥇",
        "favoriteSubject": "Banco de Dados",
        "updatedAt": 1727138000000
      }
    }
  }
  ```

* **Integração na Interface (UI/UX):**
  1. **Menu Principal:** Botão `🏆 Ranking da Arena` no cabeçalho ou rodapé, abrindo um modal estilizado com o **TOP 10 Geral** e a posição/elo atual do jogador local.
  2. **Card de Batalha & Seleção:** Badge de elo exibido ao lado do apelido (ex: `🥇 DevNinja [PLENO]`).
  3. **Tela de Vitória (Pós-Combate):** Animação de barra de experiência enchendo com `+25 RP` e banner comemorativo ao subir de elo: `🎉 PROMOÇÃO DE CARREIRA! Você subiu para Dev Sênior! 🚀`.
  4. **Controle no Painel GM:** O professor terá um botão `"Zerar Temporada / Ranking da Turma"` para iniciar novos torneios pontuais em sala de aula.

---

## 📚 Fase 2: Gestão Pedagógica e Painel do Game Master

### 2.1 Gerenciador de Perguntas no Firebase (CRUD de Questões)
* **Objetivo:** Permitir que o professor adicione, edite ou desative perguntas diretamente pelo navegador sem alterar o código-fonte.
* **Como implementar:**
  * Estruturar o nó `questions/` no Firebase Realtime Database:
    ```json
    {
      "questions": {
        "q_01": {
          "text": "O que faz o comando git status?",
          "options": ["Cria commits", "Exibe estado da working tree", "Deleta branches", "Baixa repositório"],
          "correctIndex": 1,
          "category": "eng_soft",
          "difficulty": "facil"
        }
      }
    }
    ```
  * Adicionar a 4ª aba no Painel GM: **"Gerenciar Questões"** com formulário de cadastro e listagem dinâmica com botão de excluir.
  * O `MainScene.js` carrega primeiro as perguntas do Firebase com fallback local para `src/questions.js` caso esteja offline.

### 2.2 Sorteio de Perguntas por Disciplina Escolhida
* Se a luta for entre o lutador de **Banco de Dados** e o de **Redes**, o algoritmo de sorteio de questões dá prioridade para perguntas dessas duas categorias, tornando o combate temático.

### 2.3 Importação e Exportação de Quizzes (JSON / CSV)
* Botão no painel do professor para importar um arquivo `.json` com até 50 questões prontas para simulados ou provas temáticas em sala de aula.

---

## 🌐 Fase 3: Infraestrutura e Publicação Online (Deploy)

Para que alunos e colegas possam jogar de qualquer lugar (em sala de aula, casa ou celular), o jogo precisa ser publicado em um provedor de hospedagem web com **HTTPS** e baixa latência.

### 3.1 Comparativo de Plataformas Recomendadas

| Provedor | Custo | Integração GitHub | Facilidade | Recomendação |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Gratuito | Automática (Deploy a cada git push) | Alta (Zero Configuração para Vite) | ⭐ **Principal Recomendação** |
| **Firebase Hosting** | Gratuito (Spark) | Via GitHub Actions ou CLI | Média (Mesmo ecossistema do RTDB) | ⭐ **Excelente alternativa** |
| **Netlify** | Gratuito | Automática | Alta | Boa alternativa |
| **GitHub Pages** | Gratuito | Via GitHub Actions | Média | Viável, porém requer ajuste de base path |

---

### 3.2 Passo a Passo para Deploy na Vercel (Recomendado)
A Vercel reconhece projetos Vite instantaneamente e gera um link público seguro com SSL (ex: `https://labcombat.vercel.app`):

1. Acesse [vercel.com](https://vercel.com/) e faça login com sua conta do **GitHub**.
2. Clique em **"Add New..."** ➔ **"Project"**.
3. Selecione o repositório `GGnzr/labcombat`.
4. A Vercel detectará automaticamente o framework como **Vite**:
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
5. Clique em **"Deploy"**.
6. Em menos de 1 minuto, o link público seguro estará online! Qualquer novo `git push main` atualizará o jogo automaticamente.

---

### 3.3 Capacidade e Limites do Firebase Realtime Database (Plano Gratuito Spark)
O Firebase oferece um plano gratuito generoso para ambientes educacionais:
* **Conexões simultâneas:** Até **100 usuários simultâneos** conectados ao mesmo tempo (o equivalente a 50 partidas 1v1 simultâneas).
* **Armazenamento de dados:** 1 GB (suficiente para milhares de salas e perguntas, já que cada sala ocupa menos de 2 KB).
* **Download de dados:** 10 GB/mês.
* **Boas práticas de economia de cota:**
  * Uso contínuo de `onDisconnect().remove()` para que salas antigas não fiquem ocupando espaço.
  * A rotina de limpeza de salas vazias já implementada no Painel GM garante o consumo mínimo da cota.

---

## 🔐 Fase 4: Autenticação e Segurança de Dados

Atualmente, o jogo utiliza PIN mestre local no código para o painel de desenvolvimento e apelidos livres para os jogadores. Para um ambiente de produção seguro, propõe-se a seguinte arquitetura:

```mermaid
flowchart TD
    User([Usuário acessa o LabCombat]) --> RoleCheck{Qual o perfil?}
    
    RoleCheck -->|Aluno / Jogador| StudentFlow[Entrada Rápida via Nickname]
    StudentFlow --> AnonAuth[Firebase Anonymous Auth]
    AnonAuth --> GameLobby[Acesso ao Lobby e Batalhas]
    
    RoleCheck -->|Professor / Administrador| TeacherFlow[Login Seguro GM]
    TeacherFlow --> EmailAuth[Firebase Auth - Email/Senha ou Google Institucional]
    EmailAuth --> VerifyClaims{Possui permissão GM?}
    VerifyClaims -->|Sim| GMPanel[Acesso Completo ao Painel GM]
    VerifyClaims -->|Não| BlockAccess[Acesso Negado]
```

### 4.1 Estratégia de Contas e Autenticação (Alunos vs Professores)

A introdução de um **Sistema de Ranking e Progressão de Carreira** torna essencial que o aluno tenha uma **Conta de Jogador**, pois:
* Em laboratórios de informática, múltiplos alunos utilizam a mesma máquina física. Sem login, o histórico e o elo seriam perdidos ou sobrescritos pelo próximo usuário.
* Permite que o estudante jogue na faculdade e continue subindo de patente em casa no celular ou notebook.
* Permite métricas de autoavaliação (ex: *"Sua taxa de acerto em Redes é 88%, mas em Banco de Dados é 55%"*).

#### A. Métodos de Acesso para os Alunos (Design de Baixa Fricção)

```mermaid
flowchart LR
    A[Aluno acessa o LabCombat] --> Choice{Como deseja entrar?}
    Choice -->|Mais Rápido| Google[Login com Google / E-mail Institucional]
    Choice -->|Tradicional| Email[E-mail e Senha]
    Choice -->|Partida Casual| Guest[Modo Convidado / Guest]
    
    Google --> Profile[Perfil Salvo: Elo, RP, Histórico e Vitórias]
    Email --> Profile
    Guest --> TempMatch[Joga a partida sem salvar no Ranking Global]
    TempMatch --> ConvertPrompt[Banner Pós-Jogo: 'Vincule sua conta para salvar seus +25 RP!']
    ConvertPrompt --> Google
    ConvertPrompt --> Email
```

1. **Login com Google (1 Clique - Altamente Recomendado):**
   * A maioria das escolas e universidades já utiliza Google Workspace institucional (`@aluno.instituicao.edu.br`) ou contas Google.
   * O aluno autentica com 1 clique através de popup nativo do Firebase Auth, sem precisar preencher cadastros demorados nem decorar novas senhas.
2. **E-mail e Senha Tradicional:**
   * Cadastro simples solicitando apenas: **Apelido (Nickname)**, **E-mail** e **Senha**.
3. **Modo Convidado com Conversão (Guest ➔ Registrado):**
   * O aluno pode jogar uma partida instantânea como convidado. Ao vencer e ganhar pontos, uma notificação o convida a vincular uma conta para não perder os pontos conquistados.

#### B. Proteção e Privacidade dos Dados dos Alunos (Conformidade LGPD)
* **Visibilidade Pública Restrita:** O e-mail do aluno é armazenado de forma criptografada no Firebase Auth e **JAMAIS é exibido publicamente** na arena ou no ranking.
* **O que os outros jogadores veem:** Apenas o **Nickname**, **Ícone do Lutador Favorito**, **Elo de Carreira** e **Pontos (RP)**.
* **Direito de Eliminação (Art. 18, VI da LGPD):** O aluno terá um botão no seu perfil para excluir sua conta e remover seus dados da tabela de líderes a qualquer momento.

#### C. Acesso do Professor / Game Master (Administração Segura)
* O painel GM deixa de depender de PIN no código e passa a exigir login administrativo via Firebase Auth.
* O Firebase valida se o e-mail do usuário possui o atributo de administrador (`customClaims: { role: 'gm' }`), impedindo que alunos acessem controles de moderador mesmo inspecionando o código.

### 4.2 Regras de Segurança do Firebase (`database.rules.json`)
Para evitar que alunos trapaceiem editando o HP ou carga de especial diretamente pelo console do navegador, as regras de segurança do Realtime Database devem ser configuradas no console do Firebase:

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      "$roomId": {
        ".write": "auth != null",
        "p1": {
          ".write": "auth != null"
        },
        "p2": {
          ".write": "auth != null"
        }
      }
    },
    "questions": {
      ".read": true,
      ".write": "auth != null && auth.token.email === 'professor@instituicao.edu.br'"
    }
  }
}
```

---

## 🛡️ Fase 5: Conformidade com a LGPD (Lei 13.709/2018)

A **LGPD** estabelece regras rígidas para a coleta, tratamento e armazenamento de dados pessoais no Brasil, especialmente no ambiente educacional. O LabCombat adota o conceito de **Privacy by Design (Privacidade desde a Concepção)**:

### 5.1 Princípio da Minimização de Dados (Art. 6º, III)
* **O que o LabCombat coleta:** Apenas um **Apelido temporário (Nickname)** e métricas do jogo (HP, tempo de resposta, acertos).
* **O que o LabCombat NÃO coleta:** Nome civil completo, CPF, e-mail de alunos, foto pessoal, localização geográfica, endereço IP persistente, cookies de rastreamento publicitário.
* **Vantagem Jurídica:** Por não coletar dados pessoais identificáveis de estudantes, o jogo não cria passivos de vazamento de dados e dispensa burocracias pesadas de consentimento parental (Art. 14 da LGPD sobre crianças e adolescentes).

### 5.2 Ciclo de Vida e Retenção Efêmera dos Dados (Art. 16)
* Os dados das partidas pertencem à categoria de **dados voláteis (efêmeros)**.
* Ao finalizar a partida ou fechar a aba do navegador:
  * A sala e os nós de jogador são deletados via `onDisconnect`.
  * Nenhum log com dados de navegação é vendido ou compartilhado com terceiros.
  * O `localStorage` armazena apenas preferências de interface do próprio dispositivo (ex: volume mudo, último apelido usado).

### 5.3 Termos de Uso e Aviso de Privacidade
Incluir um link discreto no rodapé do menu principal com um modal de transparência contendo o seguinte texto:

> **🔒 Aviso de Privacidade e Termos de Uso:**
> *"O LabCombat é uma ferramenta exclusivamente educacional. Não coletamos dados pessoais sensíveis, documentos ou e-mails de estudantes. Os apelidos inseridos são públicos dentro da sala da partida e descartados ao término da sessão. Ao utilizar este jogo, você concorda com o uso de cookies estritamente técnicos para a sincronização da partida em tempo real."*

---

## ⚖️ Fase 6: Licenciamento de Software e Propriedade Intelectual

Quando um projeto é publicado no GitHub sem uma licença explícita, a legislação internacional de direitos autorais considera que ele está sob *"Todos os Direitos Reservados"*. Isso significa que outras pessoas e instituições de ensino **não têm permissão legal** para clonar, executar em seus servidores, modificar ou contribuir com o projeto.

### 6.1 Comparativo de Licenças de Código Aberto

| Licença | Tipo | Liberdades | Obrigações | Ideal para... |
| :--- | :--- | :--- | :--- | :--- |
| **MIT** | Permissiva | Uso livre, comercial, educacional, modificação e distribuição | Manter o aviso de copyright original | ⭐ **Portfólio, projetos acadêmicos e ecossistema JavaScript/Phaser** |
| **GPLv3** | Copyleft Estrito | Uso livre e modificação | Derivados **devem** ser 100% código aberto sob a mesma licença | Quem não quer que terceiros fechem o código ou vendam sem abrir |
| **Apache 2.0** | Permissiva | Semelhante à MIT | Exige menção de alterações e concessão de patentes | Grandes ecossistemas corporativos |
| **CC BY-NC 4.0** | Conteúdo Criativo | Uso livre educacional e não comercial | Proíbe monetização/venda comercial das artes e mídias | Sprites, ilustrações, banco de questões e efeitos sonoros |

---

### 6.2 Qual Licença Aplicar no LabCombat? (Recomendação)

Recomendamos a estratégia de **Licenciamento Misto (Padrão da Indústria de Games)**:

1. **Para o Código-Fonte (Engine, Lógica, Cenas, Scripts):**
   * **Licença MIT**: É a mesma licença do **Phaser 3** e do **Vite**. É simples, universalmente reconhecida por recrutadores no GitHub e dá total segurança para professores e alunos usarem e estudarem o código sem receios jurídicos.
   * **Isenção de Responsabilidade:** A licença MIT contém cláusula expressa de que o software é fornecido *"NO ESTADO EM QUE SE ENCONTRA"* (*AS IS*), isentando os autores de responsabilidades por eventuais bugs ou indisponibilidade de serviços terceiros (como Firebase).

2. **Para os Assets Visuais e Conteúdo Educacional (Personagens, Sprites, Questões):**
   * Manter declaração de direitos morais autorais no README: o código é aberto (MIT), porém as artes visuais e os personagens são de autoria do projeto e voltados para **fins estritamente educacionais e não-comerciais**.

---

## 📊 Matriz de Priorização e Cronograma Sugerido

```
                 ALTO IMPACTO
                      │
   [1.1 Desconexão W.O.]    │    [3.2 Deploy Vercel Online]
   [1.2 Áudio/SFX Arcade]   │    [4.2 Regras Segurança Firebase]
   [1.4 Rotação Mobile]     │    [2.1 CRUD Perguntas GM]
                      │
 BAIXO ESFORÇO ───────┼─────── ALTO ESFORÇO
                      │
   [5.3 Aviso LGPD no Menu] │    [4.1 Login Institucional Google]
   [1.3 Projéteis e Tweens] │    [2.3 Importador JSON/Excel]
                      │
                 BAIXO IMPACTO
```

### Roteiro de Execução Recomendado:

1. **Sprint 1 (Deploy Online & Estabilidade):**
   * Publicar na Vercel para permitir testes reais com alunos online.
   * Implementar o tratamento de desconexão e W.O. na batalha (`MainScene.js`).
   * Adicionar aviso de rotação de tela para celular.
2. **Sprint 2 (Imersão & Feedback de Combate):**
   * Adicionar módulo de som com Web Audio API (`src/audio.js`).
   * Animações de arremetida e projéteis dos personagens.
   * Aviso de privacidade (LGPD) no rodapé.
3. **Sprint 3 (Expansão Pedagógica & Segurança):**
   * CRUD de perguntas no Painel GM sincronizado com o Firebase.
   * Autenticação real para o Game Master e regras de segurança no Firebase.

---
*Documento elaborado para a evolução do LabCombat (2026).*
