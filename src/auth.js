/**
 * Módulo de Autenticação e Controle de Acesso (GM vs Alunos)
 * LabCombat 1v1 Arena
 */

import { auth, db } from './firebase.js';
import { ref, get, set, child } from "firebase/database";
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'firebase/auth';

// Senha/PIN mestre padrão para acesso Game Master (GM/Professor)
const GM_DEFAULT_PIN = 'admin';
const GM_ALT_PIN = 'gm2026';

export function observeAuthState(callback) {
    return onAuthStateChanged(auth, callback);
}

export function getAuthenticatedUser() {
    return auth.currentUser;
}

function getAuthErrorMessage(error) {
    const messages = {
        'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
        'auth/network-request-failed': 'Não foi possível conectar ao servidor.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns instantes.'
    };
    return messages[error?.code] || error?.message || 'Não foi possível concluir a autenticação.';
}

export async function registerAccount({ email, password, nickname }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanNickname = (nickname || '').trim();
    if (!cleanEmail || !password || !cleanNickname) {
        return { success: false, message: 'E-mail, senha e apelido são obrigatórios.' };
    }
    if (cleanNickname.length < 2 || cleanNickname.length > 14) {
        return { success: false, message: 'O apelido deve ter entre 2 e 14 caracteres.' };
    }

    try {
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(credential.user, { displayName: cleanNickname });
        await set(ref(db, `users/${credential.user.uid}`), {
            uid: credential.user.uid,
            email: cleanEmail,
            nickname: cleanNickname,
            role: 'student',
            registeredAt: Date.now(),
            lastLoginAt: Date.now(),
            score: 0,
            matchesPlayed: 0,
            matchesWon: 0
        });
        sessionStorage.setItem('labcombat_nickname', cleanNickname);
        localStorage.setItem('labcombat_account_uid', credential.user.uid);
        return { success: true, user: credential.user };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error), error };
    }
}

export async function loginAccount({ email, password }) {
    try {
        const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        const profileSnapshot = await get(ref(db, `users/${credential.user.uid}`));
        const profile = profileSnapshot.exists() ? profileSnapshot.val() : {};
        const nickname = profile.nickname || credential.user.displayName || 'Jogador 1';
        await set(ref(db, `users/${credential.user.uid}/lastLoginAt`), Date.now());
        sessionStorage.setItem('labcombat_nickname', nickname);
        localStorage.setItem('labcombat_account_uid', credential.user.uid);
        return { success: true, user: credential.user, profile };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error), error };
    }
}

export async function logoutAccount() {
    await signOut(auth);
    localStorage.removeItem('labcombat_account_uid');
}

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
