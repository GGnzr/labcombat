import { get, ref } from 'firebase/database';
import { db } from './firebase.js';
import { logEvent } from './logger.js';
import { professors, getProfessorById } from './professors.js';

const CORINGA_ID = 'coringa';

// Nome amigável da disciplina para logs (o id cru, ex.: "so", confunde nos logs)
const profLabel = (id) => getProfessorById(id)?.name || id;

/**
 * Regra do Coringa: se um dos lutadores da partida for o 'coringa', o catálogo
 * de questões deixa de ser "união dos 2 bancos" e vira a união dos bancos de
 * TODOS os outros professores (o coringa NÃO tem banco próprio).
 * Centralizado aqui: MainScene e CharacterSelectScene herdam via
 * loadQuestionBanks() — os dois clientes computam o mesmo conjunto.
 */
export function resolveMatchProfessorIds(professorIds) {
    const uniqueIds = [...new Set(professorIds.filter(Boolean))];
    if (!uniqueIds.includes(CORINGA_ID)) return uniqueIds;
    return professors.map(p => p.id).filter(id => id !== CORINGA_ID);
}

function isValidQuestion(question) {
    return question && question.id != null && typeof question.text === 'string'
        && Array.isArray(question.options) && question.options.length >= 2
        && Number.isInteger(question.correctIndex)
        && question.correctIndex >= 0 && question.correctIndex < question.options.length;
}

// Cache em memória por professor (válido na sessão da guia): a tela de seleção
// pré-carrega quando os 2 jogadores dão pronto, então a MainScene pega quente
// no round 1. O GM invalida ao publicar/importar (invalidateQuestionBankCache).
const bankCache = new Map();
export function invalidateQuestionBankCache(professorId = null) {
    if (professorId) bankCache.delete(professorId);
    else bankCache.clear();
}

export async function loadQuestionBank(professorId) {
    if (bankCache.has(professorId)) return bankCache.get(professorId);
    const startedAt = Date.now();
    try {
        const snapshot = await get(ref(db, `questionBanks/${professorId}`));
        const bank = snapshot.val();
        const entries = Array.isArray(bank) ? bank : Object.values(bank || {});
        const questions = entries.filter(isValidQuestion);
        const invalidCount = entries.length - questions.length;

        if (questions.length === 0) {
            logEvent('error', `[Questões] Banco vazio ou ausente para "${profLabel(professorId)}".`, {
                professorId,
                rawEntries: entries.length,
                durationMs: Date.now() - startedAt
            });
        } else if (invalidCount > 0) {
            logEvent('warn', `[Questões] Banco "${profLabel(professorId)}" possui questões inválidas.`, {
                professorId,
                loaded: questions.length,
                invalid: invalidCount,
                durationMs: Date.now() - startedAt
            });
        } else {
            logEvent('info', `[Questões] Banco "${profLabel(professorId)}" carregado.`, {
                professorId,
                loaded: questions.length,
                durationMs: Date.now() - startedAt
            });
        }
        if (questions.length > 0) bankCache.set(professorId, questions); // só cacheia sucesso
        return questions;
    } catch (error) {
        logEvent('error', `[Questões] Falha ao carregar banco "${profLabel(professorId)}".`, {
            professorId,
            durationMs: Date.now() - startedAt,
            error
        });
        return [];
    }
}

export async function loadQuestionBanks(professorIds) {
    const uniqueIds = resolveMatchProfessorIds(professorIds);
    logEvent('info', '[Questões] Iniciando carregamento dos bancos da partida.', {
        professorIds: uniqueIds,
        disciplinas: uniqueIds.map(profLabel)
    });
    const banks = await Promise.all(uniqueIds.map(loadQuestionBank));
    const questions = banks.flat();
    if (questions.length === 0) {
        logEvent('error', '[Questões] Nenhuma questão disponível para a partida.', {
            professorIds: uniqueIds,
            disciplinas: uniqueIds.map(profLabel)
        });
    }
    return questions;
}

export function validateQuestionBank(value) {
    if (!Array.isArray(value) || value.length === 0) {
        return { valid: false, message: 'O JSON deve ser um array com pelo menos uma questão.' };
    }
    if (value.some(question => !isValidQuestion(question))) {
        return { valid: false, message: 'Cada questão precisa de id, text, options e correctIndex válido.' };
    }
    return { valid: true, message: `${value.length} questões válidas.` };
}
