# AGENTS.md — LabCombat

Documentação técnica para agentes de IA (e humanos) que vão alterar este projeto
sem quebrar o jogo. **Leia antes de qualquer mudança.** Se você alterar algo
descrito aqui, atualize este arquivo na mesma entrega.

---

## 1. O que é

Jogo web de quiz-luta 1v1 online (estilo street fighter acadêmico): dois alunos
escolhem um "professor" (personagem) e respondem perguntas da matéria dele;
acertar mais rápido/certo aplica golpes, especiais e ultimates. Há um painel
de GM (professor regente) para gerenciar salas, questões e logs.

## 2. Stack e comandos

- **Phaser 4** (motor do jogo) + **Vite 8** (bundler/dev server) + **Firebase**
  (Auth + Realtime Database como "servidor" multiplayer — não há backend próprio).
- Áudio 100% **Web Audio API procedural** (não existem arquivos de som).

```bash
npm install        # primeira vez
npm run dev        # http://localhost:5173
npm run build      # build de produção em dist/
npm test           # testes de regressão (node:test, sem dependências extras)
```

## 3. Mapa do repositório

```
index.html            Shell da página + TODO o DOM/UI de overlay (login, entrar em sala,
                      painel GM) + scripts inline (auth UI, GM). Ponte DOM↔Phaser.
src/game.js           Cria o Phaser.Game (config global, resize responsivo, FPS 60).
src/main.js           Entry point (importa game.js).
src/firebase.js       Inicializa Firebase (config embutida) — exporta auth e db.
src/auth.js           Login/registro/Google/visitante, perfis users/{uid}, adminUsers.
src/logger.js         logEvent() — log local + persiste tipos admin/error/warn em logs/.
src/questionBank.js   Carrega/valida bancos de questões do RTDB (questionBanks/{id}).
src/questions.js      ⚠️ LEGADO: banco embutido de 18 questões, NÃO é importado por
                      ninguém. Fonte real em runtime é o RTDB. Manter só como referência.
src/professors.js     Registro dos 6 lutadores (dados, atlas, portrait, escala).
src/arenas.js         Registro das 6 arenas (cenários).
src/ui/smoothUI.js    Helpers de UI Phaser (cards, botões, banners arredondados).
src/audio/SoundManager.js  Singleton de áudio procedural (SFX + 2 temas de BGM).
src/scenes/BootScene.js          Tela de loading (500 ms) → MenuScene.
src/scenes/MenuScene.js          Menu principal: criar sala (1P) / entrar (2P) / conta / GM.
src/scenes/CharacterSelectScene.js  Seleção de professor + ready + countdown → MainScene.
src/scenes/MainScene.js          ★ A LUTA (~2700 linhas). Máquina de estados da partida.
src/scenes/AnimationTestScene.js Cena dev p/ testar frames/animações dos atlases.
public/assets/      Atlases Phaser por professor + portraits + arenas + questões base.
docs/               Prompts de geração de sprites (referência de art style).
tests/              Testes de regressão (node:test). Rode com npm test.
.opencode/skills/   Skills do OpenCode para tarefas recorrentes: `labcombat`
                    (contratos gerais), `labcombat-sprites`, `labcombat-professor`,
                    `labcombat-combate`. Mantenha-as em sync com este arquivo.
```

**Fluxo de cenas:** `BootScene` → `MenuScene` → (criar/entrar sala) →
`CharacterSelectScene` → (2 prontos + countdown) → `MainScene` → fim de jogo →
(revanche / trocar personagem → volta a `CharacterSelectScene` / menu).

## 4. Multiplayer (Firebase Realtime Database)

Não há servidor: **o cliente do Player 1 (P1) é a autoridade** da partida.

### 4.1 Schema da sala `rooms/{roomId}` (código de 4 chars)

```jsonc
{
  "state": "character_select | in_match | closed",
  "arenaId": "quadra|classroom|lab07|lab08|lab09|biblioteca",
  "round": 0,
  "roundModifier": "normal|charge|shield|heal|try_catch",
  "roundResolved": false,
  "roundAlert": null,
  "currentQuestionId": 123,
  "questionStartedAt": "<serverTimestamp ms>",
  "matchStartTime": null,          // ms absoluto do início (relógio do servidor)
  "countdownStartTime": null,      // countdown da tela de seleção
  "matchStartDelay": 10,           // s (default localStorage dev_start_delay)
  "questionTimeLimit": 15,         // s (default localStorage dev_question_limit)
  "attackWinner": null,            // 'p1'|'p2'|null — animações reagem a mudanças
  "specialWinner": null,
  "ultimateWinner": null,
  "postMatchRequest": null,        // { type:'rematch'|'change_prof', from, fromNick, status?, declinedBy?, declinedNick?, timestamp }
  "p1": { "nickname": "...", "clientId": "<uuid da aba>", "uid": "<auth uid>", "characterId": "so",
          "ready": false, "hp": 100, "charges": 0,
          "hasShield": false, "hasTryCatch": false, "lives": 3, "streak": 0,
          "answered": false, "answeredAt": null,
          "answerCorrect": null, "answeredChoice": null,
          "rankLabel": "💻 II" },                  // opcional: badge de elo gerado na seleção
  "p2": { "...": "mesmo shape" },
  "sessions": { "<tabInstanceId>": { "clientId": "...", "playerId": "p1", "..." } }
}
```

Outros nós: `questionBanks/{professorId}` (única fonte de questões em partida),
`logs`, `users/{uid}`, `adminUsers/{uid}`, `students/{id}`, **`nicknames/{apelido}`
(índice de unicidade de apelidos: `nicknames/<apelido em minúsculas> = uid`;
reserva atômica por `claimNickname` no registro/troca, em auth.js)**, **`leaderboard/{uid}`
(ranking: `{ nickname, points, wins, matches, subjects: {characterId: n},
updatedAt }` — gravado por cada cliente no `showGameOver` da própria partida via
`src/ranking.js`; visitantes sem conta não pontuam)**.
Não existem `seasons` — "zerar temporada" = apagar o nó `leaderboard`.

### 4.2 Regras de ouro da sincronização (NÃO QUEBRAR)

1. **Só o P1** executa `resolveRound()`, `pickNextQuestion()` e os resets de
   partida. O P2 apenas reage ao listener (tem fallback com delay maior: 5200 ms
   vs 2600 ms do P1, para o caso do P1 travar).
2. **Relógio**: escritas compartilhadas usam `serverTimestamp()`; leituras de
   tempo usam `nowMs() = Date.now() + serverTimeOffset` (offset de
   `.info/serverTimeOffset`). Nunca substitua por `Date.now()` puro em campos
   compartilhados — exceção conhecida e tolerada: CharacterSelectScene escreve
   `questionStartedAt: Date.now()` no fim do countdown.
3. **onDisconnect**: cada jogador registra `rooms/{id}/{playerId}.remove()`; a
   desconexão do oponente dispara a contagem de **W.O. (15 s de graça)** →
   vitória por walkover.
4. **Saída**: ao sair, **P1 remove a sala inteira**; **P2 remove só
   `rooms/{id}/p2`**. O **espectador** (GM "👀 Assistir", entra com
   `playerId: 'spectator'`) **não remove nem escreve nada** — sem onDisconnect,
   sem resposta, sem W.O., sem revanche. Inverter isso quebra reconexão e W.O.
5. **Sessão por aba**: `sessionStorage labcombat_tab_instance_id` (UUID) +
   `BroadcastChannel('labcombat-tab-presence')` evitam roubo de identidade entre
   abas; reconexão usa `clientId`/`labcombat_room_id`/`labcombat_player_id`.
6. As **opções das questões são embaralhadas deterministicamente** por ambos os
   clientes com seed `${roomId}:${currentRound}:${question.id}` (LCG) — os dois
   veem a mesma ordem. Não torne o shuffle aleatório.
7. Animações de golpe/dano disparam por **diff com o estado anterior**
   (`previousData`): queda de HP → hit; `attackWinner`/`specialWinner` novo →
   animação correspondente. Campos escritos com o mesmo valor não reanimam.

## 5. Regras de combate (resolução de rodada — `MainScene.resolveRound`)

Por rodada ambos respondem à mesma questão (timer = `questionTimeLimit`, 15 s).
Resposta = `{ answered, answeredAt, answerCorrect, answeredChoice }` no nó do
jogador. Timeout conta como erro (`answeredChoice: -1`).

| Situação | Resultado |
|---|---|
| Ambos erram | −1 carga cada (mín. 0); quem tem `hasTryCatch` só consome o buff |
| Ambos acertam | Disputa de velocidade (menor `answeredAt`; empate → P1). Mais rápido: +1 carga + bônus do modificador. **Sem dano** |
| Só um acerta, loser tem try-catch | Consome o buff, **0 dano**, winner +1 carga |
| Só um acerta, winner tinha 3 cargas (ULTIMATE) | Loser com escudo: escudo absorve (cargas zeram) · loser ≤33 HP: **K.O. (finisher)** · senão **−28 HP** e cargas zeram |
| Só um acerta, sem ultimate | Ataque normal: loser com escudo bloqueia · senão **−15 HP**; winner +1 carga |

Modificadores de rodada (30% de chance por rodada, uniforme): `charge` (+1 carga
extra), `shield` (ganha escudo/FIREWALL), `heal` (+10 HP, máx 100),
`try_catch` (anula o próximo erro). HP máx 100, cargas máx 3.
Ultimate fica "pronta" com 3 cargas e HP do oponente ≤33 (label do HUD muda).

**Valores ajustáveis pelo painel GM** (aba Controles → ⚔️ Dano & LP; §13):
dano do ataque (`dev_dmg_attack`, default 15), dano do super/especial
(`dev_dmg_special`, default 28), limiar de K.O. da ultimate (`dev_ult_ko_hp`,
default 33), vida inicial/máx (`dev_max_hp`, default 100, painel limita 10–200),
chance de modificador de rodada (`dev_mod_chance`, default 30%, 0 = nunca) e
cura do BACKUP (`dev_mod_heal`, default 10, 4º campo do switch do badge),
e LabPoints (`dev_lp_win` 25, `dev_lp_bonus` 5, `dev_lp_loss` 10).
Como a rodada é resolvida só no P1, o dano aplicado é o do client do P1; ao
salvar no GM, o P1 grava os valores na sala (`dmgAttack`/`dmgSpecial`/
`ultKoHp`/`maxHp`/`modChance`/`modHeal`/`lpWin`/`lpBonus`/`lpLoss`) e o outro
client usa os mesmos números ao exibir/registrar LP no fim da partida. Novas
vagas na sala herdam o
`maxHp` da sala (MenuScene lê da sala; criar sala usa o localStorage do host).

**Pós-partida**: `postMatchRequest` coordena revanche/troca de professor
(ver MainScene §1.7 da exploração); recusar fecha a sala (`state:'closed'`).
**Pedidos expiram em 15s sem resposta** (`POST_MATCH_TIMEOUT_MS` em
MainScene): só o remetente exerce a expiração (grava `status:'expired'` +
`state:'closed'`), e ambos veem o aviso e retornam ao menu (o countdown é
exibido nos textos de espera/prompt por `startPostMatchCountdown`). A troca
de professor é um PEDIDO como a revanche (`handleChangeProfessor` — no modo
solo sem oponente ela continua direta); aceitar a troca leva os dois de volta
à seleção (`executeChangeProfessorDirectly` → `state:'character_select'`).
Empate duplo (ambos HP ≤0) → `'🤝 EMPATE DUPLO!'`.

## 6. Questões

- Fonte única em partida: **RTDB `questionBanks/{professorId}`**, carregado por
  `loadQuestionBanks([charP1, charP2])` (união dos 2 bancos, com cache
  **por professor em `questionBank.js`**: a CharacterSelectScene pré-carrega os
  bancos assim que os 2 jogadores dão pronto, então a MainScene pega os dados
  quentes no round 1; trocar de personagem muda a `catalogKey` e recarrega os
  bancos do professor novo automaticamente; o GM invalida o cache ao
  publicar/importar bancos via `invalidateQuestionBankCache`).
  **Regra do Coringa**: se um dos lutadores é `coringa`, o catálogo vira a
  união dos bancos de TODOS os outros professores (ele não tem banco próprio)
  — expansão em `questionBank.resolveMatchProfessorIds()`. **Modo solo
  (`forceStartMatch` da CharacterSelectScene): o oponente é sempre o Coringa**
  (o script escreve `characterId:'coringa'` + apelido '🃏 Professor Coringa' no
  slot do outro jogador e o pool de questões já nasce misturado).
  **Solo não pontua:** o slot leva `isBot: true` e a MainScene pula
  `recordMatchResult` (zero LP/vitórias no leaderboard; o painel mostra
  "🃏 Modo Treino — não conta LP").
  Catálogo vazio bloqueia o início (P1 loga erro e não sorteia).
- Formato por questão: `{ id, text: string, options: string[≥2],
  correctIndex: int dentro do range }` — validado por `validateQuestionBank()`
  (mesma regra do painel GM de importação).
- GM publica os bancos base de `public/assets/questions/{id}.json` (botão
  "Publicar Bancos-base") ou importa JSON próprio. Baixar = export do RTDB.
- IDs de professor válidos: `so, eng_soft, coringa, web, bd, redes` — **`so` é
  o professor de POO** (vestígio da troca de personagem: o id ficou, a matéria
  mudou). O select do GM e os arquivos `assets/questions/*.json` seguem esses
  ids, EXCETO `coringa`, que não tem banco próprio.

## 7. Contrato de sprites e atlases (Phaser)

Cada professor tem atlas em `public/assets/<pasta>/phaser/<nome>.png|.json`
(caminhos exatos em `professors.js` — **case-sensitive em produção**:
`assets/so/phaser/SO.png`/`SO.json` são maiúsculos).

- **Frames válidos (23, todos presentes em TODOS os atlases):**
  `idle, walk1..4, run1..4, defense, ready, attack1..4, fall1, jump, fall2,
  special, hit, stun, down, getup`.
- **Frames de ultimate (mesclados por `tools/merge_ultimates.py` do projeto
  remover, a partir de folhas "3 poses + projétil + impacto"):**
  `ult1, ult2, ult3` — usados por DUAS anims distintas: `{atlasKey}_ult`
  (finisher do ultimate, projétil tamanho cheio) e `{atlasKey}_special`
  (especial; mesmos frames, **FPS próprio ajustável no painel GM**). Ambos são
  **golpes à distância**: o lutador NÃO avança até o oponente — prepara parado
  e o projétil voa; no especial o projétil/impacto saem a 60% do tamanho
  (`lancarEfeitoUltimate(..., 0.6)`). FPS default de ambas: 7
  (`dev_anim_ult_fps`/`dev_anim_special_fps` no localStorage).
  `projetil`, `impacto` — sprites soltos lançados/exibidos por
  `MainScene.lancarEfeitoUltimate`.
- **Frames que a luta efetivamente usa:** `idle` (parado/retrato do ultimate),
  `walk1..4` (anim `{atlasKey}_walk`, 8 fps, loop), `attack1+attack4`
  (anim `{atlasKey}_attack`, 8 fps), `attack2` (especial e fallback do
  finisher), `ult1..ult3` + `projetil`/`impacto` (finisher do ultimate),
  `hit` (dano), `defense` (bloqueio). Não existem anims de `ko`.
- AnimationTestScene registra as animações com os **mesmos nomes** da MainScene
  (`{atlasKey}_walk`/`_attack`/`_ult`/`_special`) lendo os FPS do painel GM
  (localStorage + evento `dev-anim-speeds`), para replicar o jogo fielmente.
- O atlas é gerado pela ferramenta externa `separar_poses.py` (projeto remover):
  empacota as poses **alinhadas** aparadas, preservando alinhamento via
  `spriteSourceSize`/`sourceSize`/`pivot` no JSON. Sprites usam
  `setOrigin(0.5, 1.0)` (base nos pés) + `scale` individual por professor
  (campo `scale` em professors.js, ex.: `bd` usa 0.728 p/ mesma altura dos demais).
- Se gerar sprites novos: **manter os 23 nomes de frame e o pivot/trim do
  JSON** — o teste `tests/gameplay-contract.test.js` falha se um frame usado
  no código sumir do atlas. Para ADICIONAR frames de ultimate a um professor:
  processar a folha no remover (nomes `ult1 ult2 ult3 projetil impacto`) e rodar
  `python tools/merge_ultimates.py --pacote <pasta>/phaser --atlas
  public/assets/<pasta>/phaser/<nome>` (normaliza escala/pivot e reempacota;
  backup automático em `saida/_backup_atlases/`).

## 8. Ponte DOM ↔ Phaser (index.html)

O Phaser expõe `window.game`. Overlays de login/conta/join/GM são DOM no
index.html; as cenas se comunicam por **CustomEvents** (contrato testado em
`tests/dom-bridge.test.js`):

| Evento | Quem dispara | Quem ouve |
|---|---|---|
| `open-account-modal`, `open-gm-modal`, `open-join-modal`, `open-profile-modal`, `open-ranking-modal`, `open-rules-modal` | MenuScene | index.html |
| `open-nickname-modal` | index.html (fluxo visitante) | index.html |
| `open-bug-modal` | index.html (botão rodapé "🐛 Bug Report") | index.html |
| `submit-room-code`, `nickname-changed`, `admin-access-changed`, `account-state-changed` | index.html | MenuScene |
| `dev-set-timers` | index.html | MainScene + MenuScene |
| `dev-set-combat` (detail: `{dmgAttack, dmgSpecial, ultKoHp, maxHp, modChance, modHeal, lpWin, lpBonus, lpLoss}`) | index.html | MainScene |
| `dev-anim-speeds` (detail: `{walk, attack, special, ult}` fps) | index.html | MainScene + AnimationTestScene |
| `dev-streak`, `dev-next-question`, `dev-attack`, `dev-special`, `dev-ultimate` | index.html | MainScene |
| `dev-reset` | index.html | MainScene + MenuScene |
| `labcombat-log`, `labcombat-logs-cleared` | logger.js | index.html |
| `labcombat-mute-changed` | SoundManager | SoundManager (botão) |

DOM ids usados pelo código Phaser: `app`, `join-overlay`, `join-error-msg`,
`btn-submit-join` (existem no index.html — verificado em teste).

**Storage keys** (não renomear sem migrar):
localStorage: `dev_start_delay`, `dev_question_limit`, `dev_anim_walk_fps`,
`dev_anim_attack_fps`, `dev_anim_special_fps`, `dev_anim_ult_fps`,
`dev_dmg_attack`, `dev_dmg_special`, `dev_ult_ko_hp`, `dev_max_hp`,
`dev_mod_chance`, `dev_mod_heal`,
`dev_lp_win`, `dev_lp_bonus`, `dev_lp_loss`,
`labcombat_volume`,
`labcombat_effects_volume`, `labcombat_music_volume`, `labcombat_muted`,
`labcombat_effects_muted`, `labcombat_music_muted`, `labcombat_account_uid`.
sessionStorage: `labcombat_nickname`, `labcombat_access_mode` ('guest'|'account'),
`labcombat_room_id`, `labcombat_player_id`, `labcombat_tab_instance_id`.

## 9. Áudio (`SoundManager`, singleton exportado)

Sem arquivos de som — tudo sintetizado (Web Audio) + narrador
(`speechSynthesis`, en-US). BGM de menu e batalha são **procedurais com
variação por loop**: progressões de acordes alternam e a melodia é remontada a
cada ciclo a partir de bancos de frases (`chordSets`/`phrases`/`structures` +
`_bgmLoopCount` em SoundManager), com baixo caminhante/colcheias de chimbal nos
loops ímpares e kick duplo na batalha — evita repetição monótona. API usada pelas cenas:
`startMenuBGM()`, `startBattleBGM()`, `stopBGM()`, `playClick()`, `playHover()`,
`playCorrect()`, `playWrong()`, `playTick()`, `playPunch()`, `playShield()`,
`playSpecial()`, `playFight()`, `playKO()`, `createMuteButton(scene, x, y,
{panelSide})`, toggles/volumes com persistência em localStorage.
O contexto de áudio só desbloqueia após o 1º gesto do usuário (autoplay policy).

## 10. Painel GM (modo professor)

- Acesso: conta cujo uid está em `adminUsers/{uid}: true` (RTDB). Entrada pelo
  botão **🛡️ Modo GM** no menu (canto inferior direito); painel aberto fecha
  com "✕ Fechar" e reabre por **F2 ou Ctrl+Shift+D** (o antigo pill flutuante
  `#gm-reopen-pill` do topo foi desativado). Abas Controles/Questões/Salas/Logs
  no index.html. O painel é uma
  **tela de gerenciamento full-screen (overlay)** — o jogo não encolhe, fica
  rodando ao fundo. Em batalha (MainScene marca `body.in-battle`), a **barra
  rápida flutuante `#gm-quickbar`** (➕/➖ carga · ⚡ atacar · 💥 especial ·
  🔥 ultimate · ⏭️ pular questão) aparece com o painel fechado.
- Funções: ajustar timers da partida, ajustar dano/limiar de K.O. da ultimate e
  pontuação de LP (vitória/bônus/derrota), ajustar FPS das animações
  (walk/attack/especial/ultimate — persistente em localStorage, aplica ao vivo
  na luta e na AnimationTestScene), cheat de golpe/carga/pular questão/reset,
  gerenciar salas (listar, limpar vazias, limpar todas, **👀 assistir partida
  ao vivo como espectador somente-leitura**), terminal de logs
  (retenção 30 dias / máx 2000) e **aba 👥 Usuários (LGPD)**: lista todos os
  cadastrados (apelido, e-mail, LP/V/D, data de cadastro) com filtro e
  exclusão por linha — remove `users`/`leaderboard`/`adminUsers`/`nicknames`
  (a conta Auth fica no Firebase: exclusão completa pelo Perfil do próprio
  usuário, com senha, ou pelo console) e **aba 🐛 Bugs (tickets)**: relatos dos
  jogadores (nó `bugReports/`; botão rodapé "🐛 Bug Report" fixo no canto
  inferior direito, visível em todas as telas, inclusive na arena) em lista de
  tickets clicáveis — clicar abre o detalhe completo (apelido, data, sala,
  cena, uid) e o botão "✓ Resolver" apaga o ticket. Exige regras atualizadas do
  `database.rules.json` (admin lê/escreve `users` e `nicknames`). AnimationTestScene existe, mas NÃO tem botão
  no painel (aba Controles limpa: Tempos, Combate (dano/vida/modificadores),
  LabPoints & Temporada, Sessão da Arena e Velocidade das Animações) — abra por
  código/console se precisar depurar sprites.
- **Aba Questões (CRUD)**: lista as questões de `questionBanks/{id}` com filtro;
  criar/editar/excluir questão individual (editor com 2–6 opções + gabarito por
  rádio; validação espelha `validateQuestionBank`); importar/exportar com
  **alvo escolhido por rádio** — "Professor selecionado" (array único no banco
  do seletor) ou "Todos os professores" (**lista única**: cada questão carrega
  o professor no prefixo do `id` — `so-1`, `eng_soft-2`, `web-3`, `bd-1`,
  `redes-9` — e a publicação agrupa/distribui automaticamente, validando cada
  grupo, tudo-ou-nada; Baixar gera um único `questions-todos.json` na mesma
  lista única); 🗑️ Limpar banco apaga o banco do seletor com confirmação;
  publicar bancos-base. O Coringa NÃO aparece no
  seletor (sem banco próprio — ver regra em §6).

## 11. Testes (`npm test`)

Testes de regressão com **node:test** (zero dependências novas). Servem como
"rede de segurança" para alterações futuras:

| Arquivo | O que garante |
|---|---|
| `tests/professors.test.js` | 6 professores íntegros, ids/keys únicos, arquivos de atlas/portrait existem com case exato, `scale` válida, atlas JSON tem os frames do contrato (28: 23 base + ult1..3 + projetil/impacto, com isenção documentada em `FRAMES_PENDENTES`) |
| `tests/arenas.test.js` | 6 arenas íntegras, imagens existem, fallback de `getArenaById` |
| `tests/gameplay-contract.test.js` | Nenhum frame de atlas referenciado no código das cenas está ausente nos atlases (código ↔ sprites nunca divergem) |
| `tests/questions.test.js` | Questões válidas (embutidas + `assets/questions/*.json`), ids únicos, `correctIndex` no range |
| `tests/questionBank.test.js` | `validateQuestionBank()` aceita/rejeita corretamente |
| `tests/dom-bridge.test.js` | Todo CustomEvent do contrato tem produtor e ouvinte; ids de DOM usados pelas cenas existem no index.html |

Ao mudar regras/contratos: **atualize o teste correspondente e este AGENTS.md
na mesma entrega**.

## 12. ⛔ Invariantes — checklist "não quebrar"

1. Não mude a autoridade: **só P1** resolve rodadas/sorteia questões.
2. Não use `Date.now()` em campos compartilhados — use `serverTimestamp()` /
   `nowMs()` (offset do servidor).
3. Não mude o shape de `rooms/{id}/p1|p2` sem atualizar: CharacterSelectScene,
   MainScene, index.html (join) e este doc, na mesma entrega.
4. Não inverta a saída: P1 apaga a sala, P2 apaga só `rooms/{id}/p2`.
5. Não torne o shuffle de respostas aleatório (seed determinística por sala/rodada).
6. Não remova/renomeie frames de atlas usados: `idle`, `walk1..4`, `attack1`,
   `attack2`, `attack4`, `ult1..3`, `projetil`, `impacto`, `hit`, `defense` —
   rode `npm test` após gerar/mesclar sprites.
7. Não hardcode caminhos de assets nas cenas — use `professors.js`/`arenas.js`.
8. Não apague o nó da sala fora dos fluxos previstos (W.O. mantém a sala aberta;
   recusa de revanche fecha com `state:'closed'`).
9. `questionBanks` é a única fonte de questões — não reintroduza fallback mudo
   que mascare banco vazio (o erro precisa aparecer nos logs).
10. Mudou evento/DOM id/storage key? Atualize produtor+consumidor, o teste
    `dom-bridge.test.js` e a tabela da seção 8.

## 13. Playbooks de mudanças comuns

- **Nova pose/animação**: gerar sprite (tool remover) mantendo alinhamento →
  reempacotar atlas (mesmos frames + pivot) → usar frame/anim na MainScene →
  `npm test` deve passar (atualize a lista de frames se adicionar novos).
- **Reemblar/trocar ultimates**: processar a folha no remover com nomes
  `ult1 ult2 ult3 projetil impacto` → `merge_ultimates.py` para mesclar no
  atlas → MainScene já toca `{atlasKey}_ult` + projétil/impacto no finisher
  (com fallback `attack2` se faltar frame).
- **Troca de personagem (concluída)**: o antigo professor `poo` virou o
  **Coringa** (id `coringa`, sem nenhuma referência a POO: pasta
  `assets/coringa/`, `coringa_portrait.png`, sem banco próprio) e o id `so`
  virou o professor de **POO** (`assets/questions/so.json` já tem conteúdo de
  programação). Se um dia o Coringa ganhar banco próprio: criar
  `assets/questions/coringa.json`, republicar via GM e ajustar
  `resolveMatchProfessorIds()` + testes.
- **Novo professor**: entrada em `professors.js` (atenção: `id` ≠ pasta do atlas,
  vide `eng_soft` → pasta `eng/`) → atlas + portrait em `public/assets/` →
  `assets/questions/<id>.json` → option no select GM do index.html → `npm test`.
- **Mudar dano/cargas/timers**: de preferência pelo painel GM (localStorage +
  evento `dev-set-combat`/`dev-set-timers`); se mudar algum DEFAULT, edite as
  constantes em `MainScene.init` (fallbacks), o `readLpDefault` em
  `src/ranking.js` e os defaults dos inputs no index.html; documentar aqui.
- **Ranking/temporada**: implementado — `leaderboard/{uid}` com LP/elos
  (`src/ranking.js`, pontos chamados **LabPoints (LP)**, elos com 4 divisões
  estilo LoL: IV→III→II→I, tabela do PLANO §1.5; ícones 🐣•☕•💻•💎•👑),
  registro automático no fim da partida —
  `recordMatchResult` retorna `{ delta, points, rank }` e a MainScene exibe no
  painel de fim de jogo quanto o jogador com conta ganhou/perdeu (+ elo atual;
  visitante vê convite p/ criar conta) —, **modais separados: Perfil
  (`open-profile-modal`, ranking/apelido/sessão da conta) e Conta
  (`open-account-modal`, formulário Entrar/Cadastrar/visitante)**,
  **top 10 público no menu via botão 🏆 da dock inferior do lobby**
  (`createDock`/`createRankingPanel` na MenuScene — o botão mostra seu LP/elo
  resumido; clicado abre o painel Top 10 + SEU ELO com botão ✕; o lobby usa
  layout "dock": tela limpa com título central e ações Criar/Entrar/Ranking/
  Regras numa doca no rodapé)
  e **badge de elo na seleção de personagem** (`rankLabel` no nó do jogador).
  GM tem **"Zerar Temporada"** (aba Controles): apaga o nó `leaderboard` com
  confirmação dupla + log admin.
- **Regras de segurança do RTDB**: arquivo pronto em `database.rules.json`
  (default-deny; salas só pelos participantes via `p1.uid`/`p2.uid` de Auth,
  GM via `adminUsers`, `questionBanks`/`logs` escrita só GM, anti-trapaça no
  leaderboard: LP sobe no máx **+100 por partida** e `matches`/`wins` só +1,
  `nicknames`/`users` escritas apenas pelo próprio uid — ajustes de LP do GM
  devem ficar ≤100/escrita). **Para aplicar**: cole
  o conteúdo em Firebase Console → Realtime Database → Rules → Publicar.
  ⚠️ Salas antigas (sem `uid`) param de funcionar — limpe-as com o GM antes.

## 14. Convenções

- ESM estrito (`"type": "module"`); sem TypeScript.
- UI do jogo em Phaser via helpers de `smoothUI.js`; overlays/modais em DOM no
  index.html — não misture os dois mundos sem evento entre eles.
- Logs importantes via `logEvent()` (tipos persistidos: `admin`, `error`, `warn`).
- Textos de UI em pt-BR; identificadores em inglês; comentários em pt-BR.
- **Apelido**: visitante define/troca pelo modal de apelido (fluxo "Continuar
  como visitante") — sessionStorage `labcombat_nickname`. O modal de conta só é
  obrigatório na 1ª entrada (sem `labcombat_access_mode`); visitante NÃO é
  forçado ao voltar de uma partida — no fim da luta (vitória/W.O. inclusive) ele
  apenas vê o aviso clicável "crie uma conta p/ pontuar" (goRankText, abre o
  modal já na aba Criar conta). Chip 👤 do menu abre:
  conta logada → Perfil; visitante/sem acesso → modal de Conta na aba **Criar
  conta** (`open-account-modal` com `detail.register: true`).
  Com conta logada, o apelido é o da conta (`users/{uid}.nickname`) e só muda
  pelo Perfil (`updateAccountNickname` em auth.js — sincroniza Auth
  displayName e, se existir, `leaderboard/{uid}.nickname`).
- Estilo visual dos sprites: travado pelos prompts em `docs/prompts-sprites/`
  (pixel art 90s, ~96 px, 1px outline).
