---
name: LabCombat — Adicionar professor
description: Use ao adicionar um novo professor/lutador jogável ao LabCombat (registro, atlas, portrait, banco de questões, painel GM).
---

# Skill: LabCombat — adicionar professor

Checklist completo (detalhes em `AGENTS.md` §7, §8 e §13). Não pule etapas:

1. **Sprites**: gere o personagem com a ferramenta remover e copie o atlas para
   `public/assets/<pasta>/phaser/<nome>.png|.json` (case exato), portrait e
   idle para `public/assets/professors/<id>_{portrait,idle}.png`.
2. **`src/professors.js`**: nova entrada no array `professors` com TODOS os
   campos obrigatórios (`id, name, shortName, subject, quote, ultimateName,
   ultimateQuote, color, idleKey, portraitKey, idleUrl, portraitUrl, atlasKey,
   atlasImage, atlasJson, scale`). Atenção: `id` ≠ pasta do atlas (ex.: o id
   `eng_soft` usa a pasta `eng/`). `atlasKey`/`portraitKey`/`idleKey` únicos.
3. **Questões**: crie `public/assets/questions/<id>.json` no formato
   `[{ id, text, options[≥2], correctIndex }]` e publique no RTDB pelo painel
   GM ("Publicar Bancos-base") — ou a sala nem inicia partida com ele.
4. **Painel GM**: adicione `<option value="<id>">` no select
   `gm-question-professor` do `index.html`.
5. **Roster**: verifique se a `CharacterSelectScene` renderiza o novo card
   (ela itera o array `professors`, mas confira visualmente).
6. Rode `npm test` e valide no jogo (`npm run dev`): seleção, uma luta completa
   com acerto/erro/ultimate, e a troca de personagem pós-partida.
7. Atualize `AGENTS.md` (§7 e §4.1, ids válidos) e os ids esperados em
   `tests/professors.test.js` se a lista canônica mudou.
