#!/usr/bin/env node
/**
 * check-contrast.mjs — Auditoria de contraste WCAG 2.1 dos pares texto×fundo.
 *
 * Uso:
 *   node tools/check-contrast.mjs                # audita os pares de CONTRAST_PAIRS
 *   node tools/check-contrast.mjs "#fff" "#000"  # ratio avulso de um par
 *
 * Critérios (WCAG 2.1):
 *   AA  texto normal ≥ 4.5:1 · texto grande (≥24px ou ≥18.5px bold) ≥ 3:1
 *   AAA texto normal ≥ 7:1   · texto grande ≥ 4.5:1
 */

// ── Pares texto×fundo levantados na auditoria (edite conforme a UI evolui) ──
// { onde, fg, bg, grande } — grande: texto ≥24px ou ≥18.5px(≈14pt) bold
// Fundos rgba() foram compostos sobre o fundo da página (#181e26).
// Gradientes usam o stop mais escuro (pior caso p/ texto claro).
export const CONTRAST_PAIRS = [
  // ── index.html · base ──
  { onde: 'index:53 dev-panel texto', fg: '#eeeeee', bg: '#1e1e28' },
  { onde: 'index:92 orientation p', fg: '#ffffff', bg: '#060912' },
  { onde: 'index:107 orientation h3', fg: '#38bdf8', bg: '#060912' },
  { onde: 'index:112 orientation texto', fg: '#cbd5e1', bg: '#060912' },
  { onde: 'index:119 btn-dismiss', fg: '#cbd5e1', bg: '#1e293b' },
  { onde: 'index:159 account-close:hover', fg: '#ffffff', bg: '#7f1d1d' },
  { onde: 'index:163 select option', fg: '#e2e8f0', bg: '#020617' },

  // ── index.html · Painel GM ──
  { onde: 'index:177 GM título', fg: '#38bdf8', bg: '#1e1e28' },
  { onde: 'index:178 GM status', fg: '#34d399', bg: '#1e1e28' },
  { onde: 'index:188 GM tab ativa', fg: '#38bdf8', bg: '#1e293b' },
  { onde: 'index:189 GM tab inativa', fg: '#cbd5e1', bg: '#0b1120' },
  { onde: 'index:193 GM tab badge', fg: '#cbd5e1', bg: '#334155' },
  { onde: 'index:200 card Tempos título', fg: '#facc15', bg: '#1e293b' },
  { onde: 'index:204 input valor', fg: '#34d399', bg: '#020617' },
  { onde: 'index:211 btn salvar azul', fg: '#ffffff', bg: '#2563eb' },
  { onde: 'index:221 card Combate título', fg: '#f87171', bg: '#1e293b' },
  { onde: 'index:224 input vermelho', fg: '#f87171', bg: '#020617' },
  { onde: 'index:224 input verde', fg: '#4ade80', bg: '#020617' },
  { onde: 'index:224 input amarelo', fg: '#fef08a', bg: '#020617' },
  { onde: 'index:247 btn salvar vermelho', fg: '#ffffff', bg: '#dc2626' },
  { onde: 'index:252 card LP título/input', fg: '#c084fc', bg: '#020617' },
  { onde: 'index:269 btn LP roxo', fg: '#ffffff', bg: '#7c3aed' },
  { onde: 'index:268 btn Zerar Temporada', fg: '#fca5a5', bg: '#7f1d1d' },
  { onde: 'index:278 nota LGPD', fg: '#cbd5e1', bg: '#1e293b' },
  { onde: 'index:289 Animações título', fg: '#c084fc', bg: '#1e293b' },
  { onde: 'index:307 btn animações', fg: '#ffffff', bg: '#7c3aed' },
  { onde: 'index:327 btn Nova questão', fg: '#ffffff', bg: '#15803d' },
  { onde: 'index:333 Import título', fg: '#f59e0b', bg: '#1e293b' },
  { onde: 'index:366 hint/code 10.5px', fg: '#cbd5e1', bg: '#020617' },
  { onde: 'index:371 editor título', fg: '#d8b4fe', bg: '#1e293b' },
  { onde: 'index:385 lista vazia', fg: '#cbd5e1', bg: '#1e293b' },
  { onde: 'index:404 lista vazia (salas)', fg: '#cbd5e1', bg: '#080d1a' },
  { onde: 'index:411 Logs título', fg: '#facc15', bg: '#1e293b' },
  { onde: 'index:414 btn Limpar local', fg: '#fca5a5', bg: '#334155' },
  { onde: 'index:420 terminal logs', fg: '#cbd5e1', bg: '#020617' },
  { onde: 'index:434 nota usuários', fg: '#cbd5e1', bg: '#0f172a' },
  { onde: 'index:448 bug detalhe título', fg: '#fbbf24', bg: '#1e293b' },
  { onde: 'index:465 btn Voltar/Cancelar', fg: '#cbd5e1', bg: '#334155' },

  // ── index.html · GM quickbar (texto = cor padrão UA, preto) ──
  { onde: 'index:475 quickbar Carga', fg: '#ffffff', bg: '#15803d' },
  { onde: 'index:476 quickbar Atacar', fg: '#ffffff', bg: '#b91c1c' },
  { onde: 'index:477 quickbar Especial', fg: '#ffffff', bg: '#b45309' },
  { onde: 'index:478 quickbar Ultimate', fg: '#ffffff', bg: '#dc2626' },
  { onde: 'index:479 quickbar Pular', fg: '#ffffff', bg: '#0369a1' },
  { onde: 'index:480 quickbar -Carga', fg: '#ffffff', bg: '#9333ea' },

  // ── index.html · Modal Conta ──
  { onde: 'index:493 badge conta', fg: '#f59e0b', bg: '#232934' },
  { onde: 'index:495 LABCOMBAT 40px', fg: '#ffffff', bg: '#0c1d33', grande: true },
  { onde: 'index:495 sub branding', fg: '#cbd5e1', bg: '#0c1d33' },
  { onde: 'index:497 btn visitante', fg: '#ffffff', bg: '#047857' },
  { onde: 'index:501 ✕ modal', fg: '#ef4444', bg: '#0f172a' },
  { onde: 'index:506 título modal', fg: '#f8fafc', bg: '#0f172a' },
  { onde: 'index:510 tab inativa', fg: '#cbd5e1', bg: '#0f172a' },
  { onde: 'index:514 input nick', fg: '#38bdf8', bg: '#020617' },
  { onde: 'index:517 input email/senha', fg: '#f8fafc', bg: '#020617' },
  { onde: 'index:523 label força senha', fg: '#cbd5e1', bg: '#0b1120' },
  { onde: 'index:531 termos corpo', fg: '#cbd5e1', bg: '#0f172a' },
  { onde: 'index:537 hint conta', fg: '#cbd5e1', bg: '#0f172a' },
  { onde: 'index:537 erro conta', fg: '#f87171', bg: '#0f172a' },
  { onde: 'index:540 link esqueci', fg: '#7dd3fc', bg: '#0f172a' },
  { onde: 'index:542 btn Google', fg: '#1e293b', bg: '#ffffff' },

  // ── index.html · Termos/Perfil/Ranking/Nickname ──
  { onde: 'index:561 Termos título', fg: '#f8fafc', bg: '#1e293b' },
  { onde: 'index:570 Termos corpo', fg: '#cbd5e1', bg: '#1e293b' },
  { onde: 'index:576 Termos sub', fg: '#cbd5e1', bg: '#1e293b' },
  { onde: 'index:585 Perfil nick', fg: '#38bdf8', bg: '#0b1120' },
  { onde: 'index:600 Perfil card texto', fg: '#cbd5e1', bg: '#0b1120' },
  { onde: 'index:610 btn redefinir', fg: '#7dd3fc', bg: '#1e293b' },
  { onde: 'index:615 btn sair', fg: '#ffffff', bg: '#9f1239' },
  { onde: 'index:620 exclusão título', fg: '#f87171', bg: '#1a0505' },
  { onde: 'index:624 exclusão texto', fg: '#fca5a5', bg: '#020617' },
  { onde: 'index:627 btn confirmar exclusão', fg: '#fecaca', bg: '#991b1b' },
  { onde: 'index:640 Ranking Eu', fg: '#e9d5ff', bg: '#1a1230' },
  { onde: 'index:647 Ranking load more', fg: '#7dd3fc', bg: '#0b1120' },
  { onde: 'index:669 btn salvar nick', fg: '#ffffff', bg: '#047857' },

  // ── index.html · Join/Regras/Bug/Multiplayer ──
  { onde: 'index:700 Join código', fg: '#facc15', bg: '#020617' },
  { onde: 'index:720 Join btn colar', fg: '#38bdf8', bg: '#1e293b' },
  { onde: 'index:746 Join count', fg: '#cbd5e1', bg: '#1e293b' },
  { onde: 'index:770 Regras card roxo', fg: '#a78bfa', bg: '#0b1120' },
  { onde: 'index:780 Regras card amarelo', fg: '#fbbf24', bg: '#0b1120' },
  { onde: 'index:810 Bug nick', fg: '#cbd5e1', bg: '#0f172a' },
  { onde: 'index:830 MP CRIAR', fg: '#60a5fa', bg: '#0d1f3c' },
  { onde: 'index:836 MP ENTRAR', fg: '#f87171', bg: '#261616' },

  // ── index.html · JS dinâmico (perfil/ranking/salas/usuários/bugs/lobby) ──
  { onde: 'index:1440 +LP perfil', fg: '#34d399', bg: '#0b1120' },
  { onde: 'index:1445 LP perfil', fg: '#c084fc', bg: '#0b1120' },
  { onde: 'index:1452 próximo rank 9.5px', fg: '#cbd5e1', bg: '#0b1120' },
  { onde: 'index:1660 ranking pos', fg: '#f59e0b', bg: '#0b1120' },
  { onde: 'index:1665 ranking nick', fg: '#f8fafc', bg: '#0b1120' },
  { onde: 'index:1676 ranking V-D', fg: '#cbd5e1', bg: '#0b1120' },
  { onde: 'index:1690 ranking (você)', fg: '#a855f7', bg: '#0b1120' },
  { onde: 'index:1744 filtro ativo âmbar', fg: '#fde68a', bg: '#78350f' },
  { onde: 'index:1787 filtro ativo azul', fg: '#7dd3fc', bg: '#0c4a6e' },
  { onde: 'index:1790 filtro inativo', fg: '#cbd5e1', bg: '#0b1120' },
  { onde: 'index:2020 sala código', fg: '#facc15', bg: '#020617' },
  { onde: 'index:2030 sala badge', fg: '#cbd5e1', bg: '#1e293b' },
  { onde: 'index:2055 btn Assistir', fg: '#67e8f9', bg: '#164e63' },
  { onde: 'index:2060 btn excluir sala', fg: '#f87171', bg: '#450a0a' },
  { onde: 'index:2062 P2 presente', fg: '#60a5fa', bg: '#0f172a' },
  { onde: 'index:2062 P2 vazio', fg: '#34d399', bg: '#0f172a' },
  { onde: 'index:2925 usuário email', fg: '#cbd5e1', bg: '#0b1120' },
  { onde: 'index:2927 usuário meta', fg: '#cbd5e1', bg: '#0b1120' },
  { onde: 'index:3045 bug who', fg: '#fbbf24', bg: '#0b1120' },
  { onde: 'index:3049 bug when', fg: '#cbd5e1', bg: '#0b1120' },
  { onde: 'index:3057 bug seta →', fg: '#cbd5e1', bg: '#0b1120' },
  { onde: 'index:3231 lobby "Peça o código"', fg: '#cbd5e1', bg: '#070c16' },
  { onde: 'index:3228 lobby vazio', fg: '#cbd5e1', bg: '#070c16' },
  { onde: 'index:3314 lobby badge 9.5px bold', fg: '#34d399', bg: '#064e3b' },
  { onde: 'index:3316 lobby host', fg: '#cbd5e1', bg: '#090e1a' },

  // ── Phaser · smoothUI / MenuScene ──
  { onde: 'smoothUI card/banner texto', fg: '#f8fafc', bg: '#242a35' },
  { onde: 'smoothUI botão texto', fg: '#f8fafc', bg: '#2d3544' },
  { onde: 'MenuScene:84 badge topo', fg: '#f59e0b', bg: '#242a35' },
  { onde: 'MenuScene:150 statusText erro', fg: '#f87171', bg: '#242a35' },
  { onde: 'MenuScene:150 statusText info', fg: '#38bdf8', bg: '#242a35' },
  { onde: 'MenuScene:278 dock MULTIPLAYER', fg: '#dbeafe', bg: '#1d3a6e' },
  { onde: 'MenuScene:289 dock TREINO', fg: '#fde68a', bg: '#422006' },
  { onde: 'MenuScene:300 dock RANKING', fg: '#fde68a', bg: '#3a2f14' },
  { onde: 'MenuScene:310 dock RANKING sub', fg: '#cbd5e1', bg: '#3a2f14' },
  { onde: 'MenuScene:316 dock REGRAS', fg: '#e2e8f0', bg: '#242a35' },
  { onde: 'MenuScene:340 painel rank título', fg: '#cbd5e1', bg: '#0f172a' },
  { onde: 'MenuScene:350 TOP', fg: '#f59e0b', bg: '#0f172a' },
  { onde: 'MenuScene:360 top3 bronze', fg: '#d68a53', bg: '#0f172a' },
  { onde: 'MenuScene:370 rank lista', fg: '#cbd5e1', bg: '#0f172a' },
  { onde: 'MenuScene:390 rank link', fg: '#38bdf8', bg: '#0f172a' },
  { onde: 'MenuScene:485 chip LP', fg: '#facc15', bg: '#242a35' },

  // ── Phaser · CharacterSelectScene ──
  { onde: 'CharSelect:68 status host', fg: '#60a5fa', bg: '#242a35' },
  { onde: 'CharSelect:133 label código', fg: '#cbd5e1', bg: '#242a35' },
  { onde: 'CharSelect:271 nome P2', fg: '#f87171', bg: '#242a35' },
  { onde: 'CharSelect:329 avatar ? 44px', fg: '#f59e0b', bg: '#0f172a', grande: true },
  { onde: 'CharSelect:359 roster nome', fg: '#cbd5e1', bg: '#2d3544' },
  { onde: 'CharSelect:470 sel roxo', fg: '#e9d5ff', bg: '#4c1d95' },
  { onde: 'CharSelect:472 sel azul', fg: '#bfdbfe', bg: '#1e3a8a' },
  { onde: 'CharSelect:474 sel vermelho', fg: '#fecaca', bg: '#7f1d1d' },
  { onde: 'CharSelect:514 prof não escolhido', fg: '#cbd5e1', bg: '#242a35' },
  { onde: 'CharSelect:562 badge erro', fg: '#f87171', bg: '#242a35' },
  { onde: 'CharSelect:562 badge ok', fg: '#4ade80', bg: '#242a35' },
  { onde: 'CharSelect:624 PRONTO', fg: '#4ade80', bg: '#064e3b' },
  { onde: 'CharSelect:648 countdown 13px bold', fg: '#fbbf24', bg: '#78350f' },
  { onde: 'CharSelect:905 LUTEM', fg: '#ffffff', bg: '#15803d' },
  { onde: 'CharSelect prof so/eng_soft', fg: '#84cc16', bg: '#242a35' },
  { onde: 'CharSelect prof coringa', fg: '#10b981', bg: '#242a35' },
  { onde: 'CharSelect prof web', fg: '#60a5fa', bg: '#242a35' },
  { onde: 'CharSelect prof bd', fg: '#c084fc', bg: '#242a35' },

  // ── Phaser · MainScene ──
  { onde: 'MainScene:230 elo P1', fg: '#93c5fd', bg: '#242a35' },
  { onde: 'MainScene:255 slots carga vazios', fg: '#cbd5e1', bg: '#242a35' },
  { onde: 'MainScene:300 elo P2', fg: '#fca5a5', bg: '#242a35' },
  { onde: 'MainScene:390 GM CONSOLE', fg: '#4ade80', bg: '#050a08' },
  { onde: 'MainScene:400 timer 20px', fg: '#fbbf24', bg: '#050a08' },
  { onde: 'MainScene:407 badge modificador', fg: '#f59e0b', bg: '#1e293b' },
  { onde: 'MainScene:428 enunciado 18px bold', fg: '#fbbf24', bg: '#050a08' },
  { onde: 'MainScene:449 cursor opção', fg: '#22c55e', bg: '#050a08' },
  { onde: 'MainScene:455 num opção', fg: '#f59e0b', bg: '#050a08' },
  { onde: 'MainScene:465 texto opção 17px', fg: '#4ade80', bg: '#050a08' },
  { onde: 'MainScene:490 opção certa', fg: '#ffffff', bg: '#14532d' },
  { onde: 'MainScene:495 opção errada', fg: '#fecaca', bg: '#2a1216' },
  { onde: 'MainScene:500 opção timeout', fg: '#cbd5e1', bg: '#1f2937' },
  { onde: 'MainScene:540 dica console', fg: '#cbd5e1', bg: '#050a08' },
  { onde: 'MainScene:580 ULTIMATE 20px bold', fg: '#facc15', bg: '#030712', grande: true },
  { onde: 'MainScene:585 K.O. 26px', fg: '#ef4444', bg: '#030712', grande: true },
  { onde: 'MainScene:590 frase combate', fg: '#e2e8f0', bg: '#030712' },
  { onde: 'MainScene:615 game over sub', fg: '#e2e8f0', bg: '#242a35' },
  { onde: 'MainScene:660 stat tempo', fg: '#60a5fa', bg: '#1e2430' },
  { onde: 'MainScene:665 stat label', fg: '#cbd5e1', bg: '#1e2430' },
  { onde: 'MainScene:670 stat acertos', fg: '#4ade80', bg: '#1e2430' },
  { onde: 'MainScene:700 dica fim de jogo', fg: '#cbd5e1', bg: '#1e2430' },
  { onde: 'MainScene:705 LP ganho', fg: '#facc15', bg: '#1e2430' },
  { onde: 'MainScene:1270 btn menu alerta', fg: '#fca5a5', bg: '#450a0a' },
  { onde: 'MainScene:1280 btn menu', fg: '#ffffff', bg: '#991b1b' },
  { onde: 'MainScene:855 PAUSA 36px', fg: '#facc15', bg: '#0a0a0a', grande: true },
  { onde: 'MainScene:860 continua 28px', fg: '#34d399', bg: '#0a0a0a', grande: true },
  { onde: 'MainScene:2610 HP verde', fg: '#34d399', bg: '#242a35' },
  { onde: 'MainScene:2613 HP vermelho', fg: '#f87171', bg: '#242a35' },
  { onde: 'MainScene:2616 HP amarelo', fg: '#facc15', bg: '#242a35' },
  { onde: 'MainScene:2650 cargas cheias', fg: '#000000', bg: '#facc15' },
  { onde: 'MainScene:2662 buffs', fg: '#38bdf8', bg: '#242a35' },
  { onde: 'MainScene:3350 timer info', fg: '#38bdf8', bg: '#050a08' },
  { onde: 'MainScene:3350 timer ≤5s', fg: '#ef4444', bg: '#050a08' },
  { onde: 'MainScene:3350 timer idle', fg: '#cbd5e1', bg: '#050a08' },

  // ── Phaser · BootScene ──
  { onde: 'BootScene:13 Loading', fg: '#ffffff', bg: '#000000' },
];

// ── WCAG 2.1: luminância relativa ──────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channelLuminance(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Sugere a cor mais próxima (mesma matiz, clareada/escurecida) que atinge o alvo.
export function suggestFix(fg, bg, target = 4.5) {
  const [r, g, b] = hexToRgb(fg);
  const bgLum = relativeLuminance(bg);
  // Se o fundo é escuro, clareia o texto; se claro, escurece.
  const lighten = bgLum < 0.5;
  for (let t = 0.05; t <= 1.0; t += 0.05) {
    const mix = (c) =>
      Math.round(lighten ? c + (255 - c) * t : c * (1 - t));
    const cand = '#' + [mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
    if (contrastRatio(cand, bg) >= target) return cand;
  }
  return lighten ? '#ffffff' : '#000000';
}

function verdict(ratio, grande) {
  const aa = grande ? 3.0 : 4.5;
  const aaa = grande ? 4.5 : 7.0;
  if (ratio >= aaa) return 'AAA ✅';
  if (ratio >= aa) return 'AA ✅';
  if (ratio >= 3.0) return 'AA-grande ⚠️ (falha p/ texto normal)';
  return 'FALHA ❌';
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const [, , argFg, argBg] = process.argv;
if (argFg && argBg) {
  console.log(`${argFg} sobre ${argBg}: ${contrastRatio(argFg, argBg).toFixed(2)}:1`);
  process.exit(0);
}

if (CONTRAST_PAIRS.length === 0) {
  console.log('CONTRAST_PAIRS vazio — preencha com o inventário da auditoria.');
  process.exit(0);
}

let falhas = 0;
console.log('| Onde | Texto | Fundo | Ratio | WCAG | Sugestão |');
console.log('|---|---|---|---|---|---|');
for (const { onde, fg, bg, grande = false } of CONTRAST_PAIRS) {
  const ratio = contrastRatio(fg, bg);
  const v = verdict(ratio, grande);
  const aa = grande ? 3.0 : 4.5;
  const fix = ratio < aa ? suggestFix(fg, bg, aa) : '—';
  if (ratio < aa) falhas++;
  console.log(`| ${onde} | ${fg} | ${bg} | ${ratio.toFixed(2)}:1 | ${v} | ${fix} |`);
}
console.log(`\n${CONTRAST_PAIRS.length} pares auditados, ${falhas} abaixo do AA.`);
process.exit(falhas > 0 ? 1 : 0);
