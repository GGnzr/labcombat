---
name: LabCombat — Atualizar sprites/atlases
description: Use ao gerar ou trocar sprites de professores (ferramenta remover/separar_poses.py), reempacotar atlases Phaser ou alterar frames/animações usadas na luta.
---

# Skill: LabCombat — atualizar sprites

Pré-requisito: leia `AGENTS.md` §7 (contrato de sprites) e §7 da ferramenta em
`../labcombat/remover/` (gera `recortadas/`, `alinhadas/` e `phaser/` por personagem).

## Contrato que NÃO pode quebrar

- Todo atlas precisa ter estes 23 frames: `idle, walk1..4, run1..4, attack1..4,
  defense, ready, special, hit, stun, down, getup, jump, fall1, fall2`.
- A luta usa: `idle`, anim `{atlasKey}_walk` (walk1..4), anim `{atlasKey}_attack`
  (attack1+attack4), `attack2` (especial/finisher), `hit`, `defense`.
- Atlas é montado a partir das poses **alinhadas** (aparadas, com
  `spriteSourceSize`/`sourceSize`/`pivot` preservados no JSON) — sprites usam
  `setOrigin(0.5, 1.0)` + `scale` por professor em `professors.js`.
- Caminhos são **case-sensitive** em produção (ex.: `assets/so/phaser/SO.png`).

## Workflow

1. Processe a folha com o projeto remover (dashboard ou
   `python separar_poses.py sheet.png --saida <prof>`) mantendo os nomes padrão.
   Folhas de ultimate (3 poses + projétil + impacto): nomes
   `ult1 ult2 ult3 projetil impacto`, depois mescle no atlas principal com
   `python tools/merge_ultimates.py --pacote <prof>/phaser --atlas
   ../labcombat-repo/public/assets/<pasta>/phaser/<nome>` (ajusta escala e
   pivô automaticamente; backup do atlas antigo em `saida/_backup_atlases/`).
2. Copie `phaser/<nome>.png` + `phaser/<nome>.json` para
   `public/assets/<pasta>/phaser/` **com o mesmo case** dos campos
   `atlasImage`/`atlasJson` em `src/professors.js`.
3. Se mudou o tamanho do canvas, recalibre o campo `scale` do professor
   (referência: altura final ~224-240 px — frames normalizados por pivô são
   independentes do tamanho do canvas do pacote após a mesclagem).
4. Rode `npm test` — `gameplay-contract.test.js` e `professors.test.js` validam
   frames, arquivos e case (incluindo `ult1..3`/`projetil`/`impacto`).
   Não entregue com teste falhando.
5. Validação visual: `npm run dev`, Painel GM (F2) → botão de teste abre a
   `AnimationTestScene`; confira walk/attack/hit/defense/attack2.

## Se ADICIONAR um frame novo ao contrato

Atualize: sprites de TODOS os professores + `REQUIRED_ATLAS_FRAMES` em
`tests/professors.test.js` + a lista em `AGENTS.md` §7, na mesma entrega.
