/**
 * rooms.js — Operações de sala multiplayer compartilhadas (MenuScene/LobbyScene).
 * Centraliza: identidade única da aba (tabInstanceId), geração de código,
 * registro de sessão, criação de sala (pública/privada/treino) e entrada em
 * sala (join). As cenas cuidam só de UI; aqui vai só Firebase + sessionStorage.
 */
import { db } from './firebase.js';
import { ref, get, set, onDisconnect } from 'firebase/database';
import { ensureGuestAuth, isNicknameTaken } from './auth.js';
import { logEvent } from './logger.js';

// ---- Identidade única por aba (anti-roubo de identidade entre abas) ----
const tabInstanceKey = 'labcombat_tab_instance_id';
const newTabInstanceId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
let tabInstanceId = sessionStorage.getItem(tabInstanceKey) || newTabInstanceId();
sessionStorage.setItem(tabInstanceKey, tabInstanceId);

if (typeof BroadcastChannel !== 'undefined') {
    const tabChannel = new BroadcastChannel('labcombat-tab-presence');
    tabChannel.onmessage = ({ data }) => {
        if (data?.type === 'probe' && data.id === tabInstanceId) {
            tabChannel.postMessage({ type: 'presence', id: tabInstanceId });
        } else if (data?.type === 'presence' && data.id === tabInstanceId) {
            tabInstanceId = newTabInstanceId();
            sessionStorage.setItem(tabInstanceKey, tabInstanceId);
        }
    };
    tabChannel.postMessage({ type: 'probe', id: tabInstanceId });
}

export function getTabInstanceId() {
    return tabInstanceId;
}

export function generateRoomCode() {
    // Caracteres sem ambiguidade visual (sem 0, O, 1, I, L)
    const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export function registerPlayerSession(roomId, playerId, nickname) {
    const sessionRef = ref(db, `rooms/${roomId}/sessions/${tabInstanceId}`);
    set(sessionRef, {
        clientId: tabInstanceId,
        playerId,
        nickname,
        connectedAt: Date.now(),
        status: 'connected'
    }).then(() => {
        onDisconnect(sessionRef).remove().catch(() => {});
    }).catch(() => {});
}

function makePlayerSlot(nickname, uid, hp, characterId, extra = {}) {
    return {
        nickname,
        clientId: tabInstanceId,
        uid,
        hp,
        charges: 0,
        hasShield: false,
        hasTryCatch: false,
        lives: 3,
        streak: 0,
        answered: false,
        characterId,
        ready: false,
        ...extra
    };
}

/**
 * Cria uma sala e já entra nela como P1.
 * @param {object} opts
 * @param {string} opts.nickname - apelido do host
 * @param {'public'|'private'} [opts.visibility] - pública aparece na LobbyScene
 * @param {boolean} [opts.training] - sala de treino: bot Coringa no slot P2
 * @returns {Promise<{success: boolean, roomId?: string, message?: string}>}
 */
export async function createRoom({ nickname, visibility = 'public', training = false }) {
    const access = await ensureGuestAuth();
    if (!access.success) {
        return { success: false, message: access.message };
    }

    const roomId = generateRoomCode();
    const roomRef = ref(db, `rooms/${roomId}`);
    const ownerUid = access.user.uid;

    let devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10);
    if (!devStartDelay || devStartDelay === 30) devStartDelay = 10;
    const devQuestionLimit = parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;
    const maxHp = parseInt(localStorage.getItem('dev_max_hp'), 10) || 100;

    logEvent('room', training
        ? `[Treino] Sala de treino "${roomId}" para "${nickname}" (vs Coringa).`
        : `[Criar Sala] Gerando sala ${visibility === 'private' ? 'PRIVADA' : 'pública'} "${roomId}" para o host "${nickname}"...`);

    const payload = {
        ownerUid,
        maxHp,
        visibility,
        p1: makePlayerSlot(nickname, ownerUid, maxHp, 'so'),
        round: 0,
        roundModifier: 'normal',
        roundResolved: false,
        currentQuestionId: null,
        questionStartTime: null,
        matchStartDelay: devStartDelay,
        questionTimeLimit: devQuestionLimit,
        createdAt: Date.now()
    };

    if (training) {
        payload.isTraining = true;
        payload.p2 = makePlayerSlot('🃏 Professor Coringa', ownerUid, maxHp, 'coringa', {
            clientId: 'bot-coringa',
            isBot: true
        });
    }

    try {
        await set(roomRef, payload);
        // onDisconnect: NÃO remover a sala inteira no multiplayer — senão, se o
        // P1 cair/atualizar (F5), a sala some de uma vez e o P2 vai direto pro
        // menu sem o aviso de "oponente desconectou". Cada cena registra
        // onDisconnect apenas no NÓ DO PRÓPRIO JOGADOR (rooms/{id}/p1|p2),
        // mantendo o fluxo de reconexão + W.O. por graça de 15s.
        // EXCEÇÃO: no treino o bot não reconecta — se o único humano cair, a
        // sala deixa de fazer sentido e é removida de vez.
        if (training) {
            try { await onDisconnect(roomRef).remove(); } catch (e) {}
        }

        logEvent('room', `[Sala Criada] Sucesso! Código oficial: "${roomId}".`);

        sessionStorage.setItem('labcombat_room_id', roomId);
        sessionStorage.setItem('labcombat_player_id', 'p1');
        sessionStorage.setItem('labcombat_nickname', nickname);
        registerPlayerSession(roomId, 'p1', nickname);

        return { success: true, roomId };
    } catch (err) {
        console.error('Erro ao criar sala:', err);
        logEvent('error', `[Erro Criar Sala] Falha ao gravar "${roomId}": ${err.message}`, {
            roomId,
            ownerUid,
            authProvider: access.user.isAnonymous ? 'anonymous' : 'account'
        });
        return { success: false, message: 'Erro de conexão com o banco de dados.' };
    }
}

/**
 * Entra numa sala existente (por código ou vinda da lista do lobby).
 * Cuida de: sanitização/ambiguidade do código, reconexão (P1/P2), partida em
 * andamento, sala cheia e escolha da vaga livre.
 * @returns {Promise<{success: boolean, roomId?: string, playerId?: string, message?: string}>}
 */
export async function joinRoom({ code, nickname }) {
    let inputCode = (code || '').toUpperCase().trim();
    // Sanitização profunda: remove qualquer caractere que não seja letra ou dígito
    inputCode = inputCode.replace(/[^A-Z0-9]/g, '');
    if (inputCode.length > 4) {
        inputCode = inputCode.slice(-4);
    }
    if (!inputCode || inputCode.length < 4) {
        return { success: false, message: 'Digite o código da sala de 4 caracteres (Ex: 2A9Y).' };
    }

    logEvent('join', `[Entrar] Tentando conectar na sala "${inputCode}" como "${nickname}"...`);

    try {
        // Visitante também precisa de auth (anônima) — as regras do RTDB
        // identificam os participantes por uid (database.rules.json).
        const access = await ensureGuestAuth();
        if (!access.success) {
            return { success: false, message: access.message };
        }
        const playerUid = access.user.uid;

        // Unicidade global: apelido reservado a OUTRA conta (nicknames/{nick})
        // não pode ser usado — vale para visitante também (anti-impersonação).
        // exceptUid = playerUid: o dono do apelido entra normalmente.
        try {
            if (await isNicknameTaken(nickname, playerUid)) {
                logEvent('warn', `[Apelido de conta] Entrada recusada: "${nickname}" pertence a outra conta.`);
                return { success: false, message: 'Esse apelido já pertence a uma conta registrada. Escolha outro.' };
            }
        } catch { /* falha de rede na checagem: segue o fluxo */ }

        let targetRoomId = inputCode;
        let snapshot = await get(ref(db, `rooms/${targetRoomId}`));

        // Resolução inteligente de ambiguidade visual (ex: 1260 vs 126O, I vs 1)
        if (!snapshot.exists()) {
            const candidates = [
                inputCode.replace(/0/g, 'O'),
                inputCode.replace(/O/g, '0'),
                inputCode.replace(/1/g, 'I'),
                inputCode.replace(/I/g, '1'),
                inputCode.replace(/0/g, 'O').replace(/1/g, 'I'),
                inputCode.replace(/O/g, '0').replace(/I/g, '1')
            ];

            for (const candidate of candidates) {
                if (candidate !== inputCode) {
                    const testSnap = await get(ref(db, `rooms/${candidate}`));
                    if (testSnap.exists()) {
                        targetRoomId = candidate;
                        snapshot = testSnap;
                        logEvent('info', `[Auto-Correção] Código "${inputCode}" corrigido para "${candidate}" (ambiguidade 0/O ou 1/I).`);
                        break;
                    }
                }
            }
        }

        if (!snapshot.exists()) {
            logEvent('error', `[Não Encontrada] Sala "${inputCode}" não existe no banco de dados.`);
            return { success: false, message: `Sala "${inputCode}" não encontrada! Verifique o código.` };
        }

        const data = snapshot.val();
        const sessionPlayerId = sessionStorage.getItem('labcombat_player_id');
        const sessionRoomId = sessionStorage.getItem('labcombat_room_id');

        const normalizeNickname = (value) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
        const lowerNick = normalizeNickname(nickname);
        const isP1 = sessionRoomId === targetRoomId && sessionPlayerId === 'p1' && data.p1?.clientId === tabInstanceId;
        const isP2 = sessionRoomId === targetRoomId && sessionPlayerId === 'p2' && data.p2?.clientId === tabInstanceId;
        const duplicateNickname = [data.p1, data.p2].some((player) => {
            return player?.nickname && normalizeNickname(player.nickname) === lowerNick;
        });

        if (duplicateNickname && !isP1 && !isP2) {
            logEvent('warn', `[Nickname duplicado] Entrada recusada na sala "${targetRoomId}" para "${nickname}".`);
            return { success: false, message: 'Este nickname já está sendo usado nesta sala. Escolha outro.' };
        }

        const enterAs = async (playerId) => {
            sessionStorage.setItem('labcombat_room_id', targetRoomId);
            sessionStorage.setItem('labcombat_player_id', playerId);
            sessionStorage.setItem('labcombat_nickname', nickname);
            registerPlayerSession(targetRoomId, playerId, nickname);
            return { success: true, roomId: targetRoomId, playerId };
        };

        // 1. Reconexão do Jogador 2
        if (isP2) {
            logEvent('join', `[Reconectado] Jogador "${nickname}" reconectou como P2 na sala "${targetRoomId}".`);
            return enterAs('p2');
        }
        // 2. Reconexão do Host
        if (isP1) {
            logEvent('join', `[Reconectado] Host "${nickname}" reconectou como P1 na sala "${targetRoomId}".`);
            return enterAs('p1');
        }
        // 3. Sala encerrada pelo host/GM
        if (data.state === 'closed') {
            logEvent('warn', `[Sala Encerrada] Recusada conexão em "${targetRoomId}" para "${nickname}".`);
            return { success: false, message: 'Esta sala já foi encerrada.' };
        }
        // 4. Se a partida já começou e não é reconexão
        if (data.round && data.round >= 1) {
            logEvent('warn', `[Partida em Andamento] Recusada conexão em "${targetRoomId}" para "${nickname}".`);
            return { success: false, message: 'A partida nesta sala já está em andamento!' };
        }
        // 5. Vaga P1 livre (caso o host tenha saído antes)
        if (!data.p1 || !data.p1.nickname) {
            const p1Ref = ref(db, `rooms/${targetRoomId}/p1`);
            // HP inicial respeita o HP máx da sala (ajustável no GM)
            const hp = Number(data.maxHp) || parseInt(localStorage.getItem('dev_max_hp'), 10) || 100;
            await set(p1Ref, makePlayerSlot(nickname, playerUid, hp, 'so'));
            try { onDisconnect(p1Ref).remove(); } catch (e) {}
            logEvent('join', `[Conectado] Jogador "${nickname}" assumiu P1 na sala "${targetRoomId}".`);
            return enterAs('p1');
        }
        // 6. Vaga P2 livre (APENAS se P2 NÃO EXISTIR!)
        if (!data.p2 || !data.p2.nickname) {
            const p2Ref = ref(db, `rooms/${targetRoomId}/p2`);
            const hp = Number(data.maxHp) || parseInt(localStorage.getItem('dev_max_hp'), 10) || 100;
            await set(p2Ref, makePlayerSlot(nickname, playerUid, hp, 'web'));
            try { onDisconnect(p2Ref).remove(); } catch (e) {}
            logEvent('join', `[Conectado] Jogador "${nickname}" entrou com sucesso como P2 na sala "${targetRoomId}".`);
            return enterAs('p2');
        }
        // 7. Sala já cheia (P1 e P2 ocupados) -> NUNCA DERRUBAR QUEM ESTÁ NA SALA!
        logEvent('warn', `[Sala Cheia] Recusada conexão em "${targetRoomId}" para "${nickname}".`);
        return { success: false, message: 'Esta sala já está cheia! (2/2 jogadores).' };
    } catch (err) {
        console.error('Erro ao buscar sala:', err);
        logEvent('error', `[Erro de Busca] Falha na busca da sala "${inputCode}": ${err.message}`);
        return { success: false, message: 'Erro ao conectar com o banco de dados.' };
    }
}
