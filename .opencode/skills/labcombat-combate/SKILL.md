---
name: LabCombat — Alterar regras de combate
description: Use ao mudar dano, cargas, HP, timers, modificadores de rodada, condições de vitória/W.O. ou revanche na MainScene do LabCombat.
---

# Skill: LabCombat — alterar regras de combate

Pré-requisito: leia `AGENTS.md` §4.2 (sincronização) e §5 (regras atuais) antes
de tocar em `src/scenes/MainScene.js`.

## ⛔ Invariantes multiplayer

- A resolução roda **somente no P1** (`resolveRound`, `pickNextQuestion`,
  resets). Nunca execute essas escritas no P2 — o P2 só tem fallback atrasado
  (5200 ms) para o caso do P1 travar.
- Campos compartilhados de tempo: `serverTimestamp()` na escrita e
  `nowMs()` (Date.now + offset de `.info/serverTimeOffset`) na leitura.
- Animações disparam por **diff** com o estado anterior: novo valor em
  `attackWinner`/`specialWinner`/queda de HP → animação. Se criar nova flag de
  round, anime-a comparando com `previousData` e zere-a em `pickNextQuestion`.
- **Finisher do ultimate** (`triggerUltimateFinisher`): toca a anim
  `{atlasKey}_ult` (ult1..3) + projétil/impacto via `lancarEfeitoUltimate`
  quando o atlas tem os frames; senão, fallback `attack2`. Atraso do desfecho:
  2000 ms com ult, 1100 ms sem. Mudança aqui é cosmética — a resolução/dano
  continua no `resolveRound`.
- W.O.: 15 s de graça (`startWalkoverCountdown`); vitória por W.O. NÃO fecha a
  sala — mantém `enterWaitForChallenger`.
- Pós-partida via `postMatchRequest` (`rematch`/`change_prof`); recusar fecha a
  sala com `state:'closed'`. Não crie paralelos a esse fluxo.

## Constantes atuais (AGENTS.md §5)

HP 100 · cargas 0–3 · golpe −15 · super −28 · ultimate ⇒ K.O. se oponente ≤33 ·
heal +10 · ambos erram: −1 carga · modifiers (30%/rodada): charge, shield, heal,
try_catch · timers default: 15 s/questão (`dev_question_limit`), 3 s início
(`dev_start_delay`).

## Workflow

1. Localize a regra em `MainScene.js` (use os nomes acima no grep).
2. Faça a mudança mínima; mantenha o shape da sala de `AGENTS.md` §4.1.
3. Teste com DOIS navegadores/abas (`npm run dev`): rodada normal, ambos
   acertam, ambos erram, timeout, escudo, ultimate, K.O., revanche e troca de
   personagem. Desconecte um lado e confira o W.O.
4. Rode `npm test` e atualize `AGENTS.md` §5 com os novos números/regras.
