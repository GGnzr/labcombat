import { get, ref } from 'firebase/database';
import { db } from './firebase.js';

function isValidQuestion(question) {
    return question && question.id != null && typeof question.text === 'string'
        && Array.isArray(question.options) && question.options.length >= 2
        && Number.isInteger(question.correctIndex)
        && question.correctIndex >= 0 && question.correctIndex < question.options.length;
}

export async function loadQuestionBank(professorId) {
    try {
        const snapshot = await get(ref(db, `questionBanks/${professorId}`));
        const bank = snapshot.val();
        const entries = Array.isArray(bank) ? bank : Object.values(bank || {});
        return entries.filter(isValidQuestion);
    } catch (error) {
        console.error(`Erro ao carregar banco de questões de ${professorId}:`, error);
        return [];
    }
}

export async function loadQuestionBanks(professorIds) {
    const uniqueIds = [...new Set(professorIds.filter(Boolean))];
    const banks = await Promise.all(uniqueIds.map(loadQuestionBank));
    return banks.flat();
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
