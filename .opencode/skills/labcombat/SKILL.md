---
name: LabCombat — Visão Geral e Contratos
description: Use ao fazer QUALQUER alteração no projeto LabCombat (jogo de quiz-luta 1v1 com Phaser + Firebase). Carrega os contratos e invariantes que não podem quebrar.
---

# Skill: LabCombat — contratos do jogo

Antes de alterar qualquer código do jogo:

1. Leia `AGENTS.md` na raiz do repositório — ele é a fonte de verdade:
   - §4: schema da sala `rooms/{roomId}` no Firebase e regras de sincronização
   - §5: regras de combate (dano, cargas, modificadores, ultimate, W.O.)
   - §7: contrato de sprites/atlas (23 frames válidos)
   - §8: ponte DOM ↔ Phaser (CustomEvents, ids de DOM, storage keys)
   - §12: ⛔ invariantes que não podem quebrar
2. Identifique qual(is) contrato(s) a mudança toca.
3. Faça a mudança mínima necessária.
4. Rode `npm test` — os testes em `tests/` validam os contratos.
   Se um teste falhar, NÃO desative o teste: ou corrija o código, ou (se a
   mudança altera o contrato de propósito) atualize o teste e o AGENTS.md
   na mesma entrega.

## Regras de ouro (resumo)

- Só o **P1** resolve rodadas e sorteia questões (`resolveRound`/`pickNextQuestion`).
- Tempo compartilhado = `serverTimestamp()`/`nowMs()`, nunca `Date.now()` puro.
- Ao sair: **P1** remove a sala, **P2** remove só `rooms/{id}/p2`.
- Shuffle de respostas é determinístico (seed `roomId:round:questionId`).
- Assets nas cenas vêm de `professors.js`/`arenas.js` — nunca hardcode caminhos.
- UI de jogo = Phaser (`src/ui/smoothUI.js`); modais = DOM em `index.html`,
  comunicação só via CustomEvents documentados em AGENTS.md §8.
