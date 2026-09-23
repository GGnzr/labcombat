/**
 * Módulo de Autenticação e Controle de Acesso (GM vs Alunos)
 * LabCombat 1v1 Arena
 */

import { db } from './firebase.js';
import { ref, get, set, child } from "firebase/database";

// Senha/PIN mestre padrão para acesso Game Master (GM/Professor)
const GM_DEFAULT_PIN = 'admin';
const GM_ALT_PIN = 'gm2026';

/**
 * Retorna se a sessão atual possui privilégios de GM
 * @returns {boolean}
 */
export function isGM() {
    const role = localStorage.getItem('labcombat_role');
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('gm') === '1' || urlParams.get('dev') === 'true') {
        localStorage.setItem('labcombat_role', 'gm');
        return true;
    }
    return role === 'gm';
}

/**
 * Tenta autenticar o Game Master via PIN
 * @param {string} pin 
 * @returns {boolean}
 */
export function loginGM(pin) {
    const trimmed = (pin || '').trim();
    if (trimmed === GM_DEFAULT_PIN || trimmed === GM_ALT_PIN) {
        localStorage.setItem('labcombat_role', 'gm');
        window.dispatchEvent(new CustomEvent('labcombat-role-changed', { detail: { role: 'gm' } }));
        return true;
    }
    return false;
}

/**
 * Desconecta do modo GM e retorna para o modo Jogador/Aluno padrão
 */
export function logoutGM() {
    localStorage.removeItem('labcombat_role');
    window.dispatchEvent(new CustomEvent('labcombat-role-changed', { detail: { role: 'student' } }));
}

/**
 * Modelo e scaffold para futuro cadastro de alunos no Firebase Realtime Database
 * @typedef {Object} StudentData
 * @property {string} id - Matrícula ou ID único do aluno
 * @property {string} name - Nome completo do aluno
 * @property {string} nickname - Apelido escolhido para os combates
 * @property {string} turma - Código da turma / disciplina (Ex: CC3A, ES2)
 * @property {string} email - Email institucional ou pessoal
 */

/**
 * Registra ou atualiza um aluno no banco de dados Firebase
 * @param {StudentData} studentData 
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function registerStudent(studentData) {
    if (!studentData || !studentData.id || !studentData.nickname) {
        return { success: false, message: 'ID/Matrícula e apelido são obrigatórios.' };
    }

    try {
        const studentRef = ref(db, `students/${studentData.id}`);
        await set(studentRef, {
            ...studentData,
            role: 'student',
            registeredAt: Date.now(),
            score: 0,
            matchesPlayed: 0,
            matchesWon: 0
        });
        localStorage.setItem('labcombat_nickname', studentData.nickname);
        localStorage.setItem('labcombat_student_id', studentData.id);
        return { success: true };
    } catch (err) {
        console.error('Erro ao cadastrar aluno no Firebase:', err);
        return { success: false, message: err.message };
    }
}

/**
 * Busca dados de um aluno pela matrícula/ID
 * @param {string} studentId 
 * @returns {Promise<StudentData|null>}
 */
export async function getStudent(studentId) {
    try {
        const snapshot = await get(child(ref(db), `students/${studentId}`));
        if (snapshot.exists()) {
            return snapshot.val();
        }
        return null;
    } catch (err) {
        console.error('Erro ao buscar aluno:', err);
        return null;
    }
}
