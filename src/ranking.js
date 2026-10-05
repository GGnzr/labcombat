import { get, ref, runTransaction, serverTimestamp } from 'firebase/database';
import { db } from './firebase.js';
import { logEvent } from './logger.js';

// Elos de carreira (PLANO_DE_IMPLEMENTACAO.md §1.5), com 4 divisões por elo
// no estilo League of Legends (IV → III → II → I). O último elo não tem divisões.
// Vitória +25 RP (+5 bônus se K.O. via ultimate ou "perfect match", isto é,
// vencer sem errar nenhuma questão). Derrota -10 RP (mínimo 0).
export const RANK_TIERS = [
    { id: 'estagiario', name: 'Estagiário', icon: '🥉', base: 0, span: 400 },          // 0–399 RP
    { id: 'junior', name: 'Dev Júnior', icon: '🥈', base: 400, span: 400 },           // 400–799 RP
    { id: 'pleno', name: 'Dev Pleno', icon: '🥇', base: 800, span: 400 },             // 800–1199 RP
    { id: 'senior', name: 'Dev Sênior / Tech Lead', icon: '💎', base: 1200, span: 400 }, // 1200–1599 RP
    { id: 'arquiteto', name: 'Arquiteto / Mestre dos Algoritmos', icon: '👑', base: 1600, span: null } // 1600+ RP
];

const DIVISIONS = ['IV', 'III', 'II', 'I']; // IV = mais baixa, I = mais alta (como no LoL)

// Resolve pontos → elo + divisão: { icon, name, division, label, rankMin, nextMin }.
// label ex.: "🥇 Dev Pleno II". nextMin = null quando já está no elo máximo.
export function getRankForPoints(points) {
    let tier = RANK_TIERS[0];
    for (const t of RANK_TIERS) {
        if (points >= t.base) tier = t;
    }
    if (tier.span == null) {
        return { ...tier, division: null, label: `${tier.icon} ${tier.name}`, rankMin: tier.base, nextMin: null };
    }
    const quarter = tier.span / DIVISIONS.length;
    const div = Math.max(0, Math.min(DIVISIONS.length - 1, Math.floor((points - tier.base) / quarter)));
    const division = DIVISIONS[div];
    const rankMin = tier.base + div * quarter;
    return { ...tier, division, label: `${tier.icon} ${tier.name} ${division}`, rankMin, nextMin: rankMin + quarter };
}

// Registra o resultado da partida do jogador LOGADO (visitante não pontua).
// Cada cliente grava o próprio resultado — runTransaction evita perda de
// atualização se a mesma conta terminar 2 partidas ao mesmo tempo.
export async function recordMatchResult({ uid, nickname, characterId, won, tie, bonus }) {
    if (!uid) return;
    const entryRef = ref(db, `leaderboard/${uid}`);
    const delta = tie ? 0 : won ? 25 + (bonus ? 5 : 0) : -10;
    const result = await runTransaction(entryRef, (current) => {
        const cur = current && typeof current === 'object' ? current : {};
        const points = Math.max(0, (cur.points || 0) + delta);
        const wins = (cur.wins || 0) + (won ? 1 : 0);
        const matches = (cur.matches || 0) + 1;
        const subjects = { ...(cur.subjects || {}) };
        if (characterId) subjects[characterId] = (subjects[characterId] || 0) + 1;
        return {
            nickname: nickname || cur.nickname || 'Jogador',
            points,
            wins,
            matches,
            subjects,
            updatedAt: serverTimestamp()
        };
    });
    if (result.committed) {
        logEvent('info', `[Ranking] Resultado registrado: ${won ? `vitória (+${delta} RP)` : tie ? 'empate (0 RP)' : `derrota (${delta} RP)`}.`, { uid, won, tie, bonus });
    } else {
        logEvent('warn', '[Ranking] Transação abortada ao registrar resultado.', { uid });
    }
}

// Lê a entrada do jogador + posição geral no ranking (conta quantos têm mais RP).
export async function loadMyLeaderboardEntry(uid) {
    if (!uid) return null;
    const [mineSnap, allSnap] = await Promise.all([
        get(ref(db, `leaderboard/${uid}`)),
        get(ref(db, 'leaderboard'))
    ]);
    const entry = mineSnap.exists() ? mineSnap.val() : null;
    let position = null;
    let total = 0;
    if (allSnap.exists()) {
        const entries = Object.values(allSnap.val());
        total = entries.length;
        if (entry) {
            const myPoints = entry.points || 0;
            position = 1 + entries.filter(e => (e?.points || 0) > myPoints).length;
        }
    }
    return { entry, position, total };
}

// Top N do ranking geral (por RP, desempate por vitórias).
export async function loadTopLeaderboard(limit = 10) {
    const snap = await get(ref(db, 'leaderboard'));
    if (!snap.exists()) return [];
    return Object.entries(snap.val())
        .map(([uid, e]) => ({ uid, ...(e && typeof e === 'object' ? e : {}) }))
        .sort((a, b) => ((b.points || 0) - (a.points || 0)) || ((b.wins || 0) - (a.wins || 0)))
        .slice(0, limit);
}
