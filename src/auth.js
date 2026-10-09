/**
 * Módulo de Autenticação e Controle de Acesso (GM vs Alunos)
 * LabCombat 1v1 Arena
 */

import { auth, db } from './firebase.js';
import { ref, get, set, update, remove, runTransaction, child, onDisconnect } from "firebase/database";
import {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    GoogleAuthProvider,
    onAuthStateChanged,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    sendPasswordResetEmail,
    signInAnonymously,
    signInWithPopup,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'firebase/auth';

export function observeAuthState(callback) {
    return onAuthStateChanged(auth, callback);
}

export function getAuthenticatedUser() {
    return auth.currentUser;
}

export async function isAdminAccount() {
    const user = await waitForAuthReady();
    if (!user || user.isAnonymous) return false;
    const snapshot = await get(ref(db, `adminUsers/${user.uid}`));
    return snapshot.val() === true;
}

export async function waitForAuthReady() {
    await auth.authStateReady();
    return auth.currentUser;
}

export async function ensureGuestAuth() {
    const currentUser = await waitForAuthReady();
    if (currentUser) return { success: true, user: currentUser };
    try {
        const credential = await signInAnonymously(auth);
        return { success: true, user: credential.user };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error), error };
    }
}

function getAuthErrorMessage(error) {
    const messages = {
        'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/admin-restricted-operation': 'Acesso visitante desativado no Firebase. Ative o provedor Anônimo em Authentication > Sign-in method.',
        'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
        'auth/network-request-failed': 'Não foi possível conectar ao servidor.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns instantes.'
    };
    return messages[error?.code] || error?.message || 'Não foi possível concluir a autenticação.';
}

// ── Apelidos únicos ─────────────────────────────────────────────────────────
// Índice próprio `nicknames/{apelidoNormalizado} = uid` — verificação atômica
// via runTransaction (não depende de índices do RTDB). Regra: apelido vinculado
// a uma conta ninguém mais usa (nem visitante, nem outro cadastro).
const normalizeNick = (nick) => (nick || '').trim().toLowerCase();

// Tenta reservar o apelido para uid (atômico). Retorna true se conseguiu.
async function claimNickname(uid, nickname) {
    const key = normalizeNick(nickname);
    if (!uid || !key) return false;
    const result = await runTransaction(ref(db, `nicknames/${key}`), (current) => {
        if (current == null || current === uid) return uid;
        return; // aborta — já pertence a outro uid
    });
    return result.committed;
}

// Checagem rápida (UX; a autoridade é o claim da transação):
export async function isNicknameTaken(nickname, exceptUid = null) {
    const key = normalizeNick(nickname);
    if (!key) return false;
    const snap = await get(ref(db, `nicknames/${key}`));
    return snap.exists() && snap.val() !== exceptUid;
}

// Libera o apelido antigo (ao trocar): remove só se ainda apontar pro mesmo uid.
async function releaseNickname(uid, nickname) {
    const key = normalizeNick(nickname);
    if (!key) return;
    const nickRef = ref(db, `nicknames/${key}`);
    const snap = await get(nickRef);
    if (snap.exists() && snap.val() === uid) await remove(nickRef).catch(() => {});
}

// Reserva de apelido para VISITANTE (uid anônimo): mesma transação atômica do
// claim de conta, mas com onDisconnect().remove() — a reserva é TEMPORÁRIA e
// se libera sozinha quando a aba/conexão cai (guest não tem conta p/ liberar).
// É o que impede dois visitantes de usarem o mesmo apelido ao mesmo tempo.
export async function claimGuestNickname(uid, nickname) {
    const claimed = await claimNickname(uid, nickname);
    if (claimed) {
        try { await onDisconnect(ref(db, `nicknames/${normalizeNick(nickname)}`)).remove(); } catch {}
    }
    return claimed;
}

// Libera a reserva temporária do visitante (troca de apelido ou upgrade p/ conta).
export async function releaseGuestNickname(uid, nickname) {
    if (!uid || !nickname) return;
    try {
        const nickRef = ref(db, `nicknames/${normalizeNick(nickname)}`);
        await onDisconnect(nickRef).cancel().catch(() => {});
        await releaseNickname(uid, nickname);
    } catch {}
}

export async function registerAccount({ email, password, nickname }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanNickname = (nickname || '').trim();
    if (!cleanEmail || !password || !cleanNickname) {
        return { success: false, message: 'E-mail, senha e apelido são obrigatórios.' };
    }
    if (cleanNickname.length < 2 || cleanNickname.length > 20) {
        return { success: false, message: 'O apelido deve ter entre 2 e 20 caracteres.' };
    }

    try {
        // Apelidos são únicos: primeiro tenta reservar o apelido (rápido)
        if (await isNicknameTaken(cleanNickname)) {
            return { success: false, message: 'Esse apelido já pertence a uma conta.' };
        }
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(credential.user, { displayName: cleanNickname });
        // Trava atômica de unicidade (ganha de checagens simultâneas)
        const claimed = await claimNickname(credential.user.uid, cleanNickname);
        if (!claimed) {
            await credential.user.delete().catch(() => {});
            return { success: false, message: 'Esse apelido acabou de ser registrado. Escolha outro.' };
        }
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
        await claimNickname(credential.user.uid, nickname).catch(() => {}); // garante o índice p/ contas antigas
        sessionStorage.setItem('labcombat_nickname', nickname);
        localStorage.setItem('labcombat_account_uid', credential.user.uid);
        return { success: true, user: credential.user, profile };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error), error };
    }
}

export async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const credential = await signInWithPopup(auth, provider);
        const userRef = ref(db, `users/${credential.user.uid}`);
        const profileSnapshot = await get(userRef);
        const existingProfile = profileSnapshot.exists() ? profileSnapshot.val() : null;
        const fallbackNickname = (credential.user.displayName || credential.user.email?.split('@')[0] || 'Visitante')
            .trim()
            .slice(0, 20);
        const nickname = existingProfile?.nickname || fallbackNickname;

        let finalNick = nickname;
        if (existingProfile) {
            await update(userRef, { lastLoginAt: Date.now() });
            await claimNickname(credential.user.uid, nickname).catch(() => {}); // garante o índice p/ contas antigas
        } else {
            // Google: se o apelido derivado já estiver tomado, adiciona sufixo até livrar
            for (let i = 2; i <= 9 && (await isNicknameTaken(finalNick)); i++) {
                finalNick = `${nickname.slice(0, 18)}${i}`;
            }
            if (await isNicknameTaken(finalNick)) finalNick = `${'Player'}${Date.now() % 10000}`;
            await claimNickname(credential.user.uid, finalNick).catch(() => {});
            await set(userRef, {
                uid: credential.user.uid,
                email: credential.user.email || '',
                nickname: finalNick,
                role: 'student',
                registeredAt: Date.now(),
                lastLoginAt: Date.now(),
                score: 0,
                matchesPlayed: 0,
                matchesWon: 0,
                authProvider: 'google'
            });
        }

        const effectiveNickname = existingProfile ? nickname : finalNick;
        sessionStorage.setItem('labcombat_nickname', effectiveNickname);
        localStorage.setItem('labcombat_account_uid', credential.user.uid);
        return { success: true, user: credential.user, profile: { ...(existingProfile || {}), nickname: effectiveNickname } };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error), error };
    }
}

// Apelido fica vinculado à conta: alterações só pelo perfil (modal de perfil).
// Atualiza Auth (displayName) + users/{uid}.nickname. O ranking
// (leaderboard/{uid}.nickname) é sincronizado pelo chamador quando existir.
export async function updateAccountNickname(uid, nickname) {
    const clean = (nickname || '').trim();
    if (!uid || !clean) return { success: false, message: 'Apelido obrigatório.' };
    if (clean.length < 2 || clean.length > 20) {
        return { success: false, message: 'O apelido deve ter entre 2 e 20 caracteres.' };
    }
    try {
        // Unicidade: rejeita se outro uid já reservou esse apelido
        if (await isNicknameTaken(clean, uid)) {
            return { success: false, message: 'Esse apelido já pertence a outra conta.' };
        }
        const previousNick = sessionStorage.getItem('labcombat_nickname') || auth.currentUser?.displayName || '';
        const claimed = await claimNickname(uid, clean);
        if (!claimed) {
            return { success: false, message: 'Esse apelido acabou de ser registrado. Escolha outro.' };
        }
        if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: clean });
        await update(ref(db, `users/${uid}`), { nickname: clean });
        if (normalizeNick(previousNick) !== normalizeNick(clean)) {
            await releaseNickname(uid, previousNick);
        }
        sessionStorage.setItem('labcombat_nickname', clean);
        return { success: true, nickname: clean };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export async function requestPasswordReset(email) {
    try {
        await sendPasswordResetEmail(auth, email.trim().toLowerCase());
        return { success: true };
    } catch (error) {
        return { success: false, message: getAuthErrorMessage(error), error };
    }
}

export async function logoutAccount() {
    await signOut(auth);
    localStorage.removeItem('labcombat_account_uid');
}

// ── Exclusão de conta (LGPD, direito de eliminação) ─────────────────────────
// Perfil → "🗑️ Excluir minha conta": exige SENHA para contas de e-mail
// (re-autenticação) ou popup do Google para contas Google. Apaga TODOS os
// dados do usuário: users/{uid}, leaderboard/{uid} e a reserva de apelido
// em nicknames/{apelido} — só então deleta a conta do Firebase Auth.
export async function deleteAccount({ password = '' } = {}) {
    try {
        const user = await waitForAuthReady();
        if (!user || user.isAnonymous) {
            return { success: false, message: 'Entre com uma conta para excluí-la.' };
        }
        const uid = user.uid;
        const isGoogle = user.providerData?.[0]?.providerId === 'google.com';
        if (isGoogle) {
            // Conta Google não tem senha: confirma identidade pelo popup
            await reauthenticateWithPopup(user, new GoogleAuthProvider());
        } else {
            if (!password) {
                return { success: false, message: 'Digite sua senha para confirmar a exclusão.' };
            }
            const credential = EmailAuthProvider.credential(user.email || '', password);
            await reauthenticateWithCredential(user, credential);
        }

        // Recolhe o apelido antes de apagar (para liberar nicknames/{apelido})
        const nickSnap = await get(ref(db, `users/${uid}/nickname`)).catch(() => null);
        const nickname = nickSnap?.val() || user.displayName || '';

        // Dados públicos/privados: perfil, ranking e índice de apelido
        await remove(ref(db, `users/${uid}`)).catch(() => {});
        await remove(ref(db, `leaderboard/${uid}`)).catch(() => {});
        await remove(ref(db, `adminUsers/${uid}`)).catch(() => {});
        if (nickname) {
            await remove(ref(db, `nicknames/${nickname.trim().toLowerCase()}`)).catch(() => {});
        }

        await user.delete();
        localStorage.removeItem('labcombat_account_uid');
        sessionStorage.removeItem('labcombat_nickname');
        sessionStorage.removeItem('labcombat_access_mode');
        return { success: true };
    } catch (error) {
        const messages = {
            'auth/wrong-password': 'Senha incorreta.',
            'auth/invalid-credential': 'Senha incorreta.',
            'auth/requires-recent-login': 'Por segurança, entre na conta de novo e repita a exclusão.',
            'auth/popup-closed-by-user': 'Janela do Google fechada — a conta NÃO foi excluída.',
            'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns instantes.'
        };
        return { success: false, message: messages[error?.code] || getAuthErrorMessage(error), error };
    }
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
