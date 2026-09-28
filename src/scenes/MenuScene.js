import Phaser from 'phaser';
import { db } from '../firebase.js';
import { ref, get, set, onDisconnect } from "firebase/database";
import { logEvent } from '../logger.js';
import { drawRoundedRect, createSmoothCard, createSmoothButton, createSmoothBanner } from '../ui/smoothUI.js';
import { SoundManager } from '../audio/SoundManager.js';

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

export class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    registerPlayerSession(roomId, playerId, nickname) {
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

    preload() {
        this.load.image('menu_bg', '/assets/campus_veranopolis.jpg');
    }

    create() {
        SoundManager.startMenuBGM();

        // Auto-reconnect se já houver uma sessão salva
        let savedRoom = sessionStorage.getItem('labcombat_room_id');
        let savedPlayer = sessionStorage.getItem('labcombat_player_id');
        
        if (savedRoom && savedPlayer) {
            this.registerPlayerSession(savedRoom, savedPlayer, sessionStorage.getItem('labcombat_nickname') || savedPlayer);
            this.scene.start('CharacterSelectScene', { roomId: savedRoom, playerId: savedPlayer });
            return;
        }

        // 1. Fundo do Campus Instituto Federal Veranópolis com Overlay Suave
        const width = this.scale.width;
        const centerX = width / 2;

        const bg = this.add.image(centerX, 360, 'menu_bg').setOrigin(0.5);
        bg.setDisplaySize(width, 720);

        // Overlay suave neutro para valorizar a arte do campus sem escurecer como modo noturno
        this.add.rectangle(centerX, 360, width, 720, 0x181e26, 0.20);

        // 2. Cabeçalho / Branding Suave Arcade
        const topBadge = this.add.container(centerX, 42);
        const topBadgeGfx = this.add.graphics();
        drawRoundedRect(topBadgeGfx, -170, -14, 340, 28, 14, 0x242a35, 0.95, 0x475569, 1.2);
        const topBadgeTxt = this.add.text(0, 0, '⚔️ ARENA DE DUELO 1V1 • MULTIPLAYER ONLINE', { 
            fontSize: '11px', fill: '#f59e0b', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        topBadge.add([topBadgeGfx, topBadgeTxt]);

        const titleText = this.add.text(centerX, 95, 'LABCOMBAT', { 
            fontSize: '62px', fill: '#ffffff', fontStyle: 'bold', letterSpacing: 6, resolution: 2,
            fontFamily: '"Impact", "Arial Black", system-ui, sans-serif'
        }).setOrigin(0.5);
        titleText.setShadow(0, 0, '#d97706', 14, false, true);

        this.add.text(centerX, 142, 'Batalha de Conhecimento e Algoritmos em Tempo Real', { 
            fontSize: '14px', fill: '#e2e8f0', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);

        createSmoothButton(this, width - 92, 36, 138, 30, '🔐 Conta / Visitante', {
            radius: 15,
            fillColor: 0x242a35,
            hoverFillColor: 0x334155,
            strokeColor: 0x38bdf8,
            textColor: '#bae6fd',
            fontSize: '11px',
            onClick: () => window.dispatchEvent(new CustomEvent('open-account-modal'))
        });

        if (!sessionStorage.getItem('labcombat_access_mode')) {
            this.time.delayedCall(0, () => {
                window.dispatchEvent(new CustomEvent('open-account-modal', { detail: { required: true } }));
            });
        }

        // Barra de Definição de Apelido (Nickname)
        this.playerNickname = sessionStorage.getItem('labcombat_nickname') || 'Jogador 1';
        this.createNicknameBar(centerX, 190);

        // 3. Card 1: Criar Sala (Host / P1)
        this.createHostCard();

        // 4. Card 2: Entrar em Sala (Client / P2)
        this.createJoinCard();

        // 5. Mensagens de Status / Feedback (Suave e Arredondado)
        this.statusText = createSmoothBanner(this, centerX, 560, '', { 
            radius: 14,
            fillColor: 0x242a35,
            strokeColor: 0x475569,
            strokeWidth: 1.5,
            fontSize: '13px',
            textColor: '#f59e0b',
            fontStyle: 'bold',
            paddingX: 18,
            paddingY: 6
        }).setVisible(false);

        // 6. Rodapé: Regras Rápidas da Partida
        this.createRulesFooter();

        // 7. Sub-rodapé informativo
        this.add.text(centerX, 680, 'LabCombat • Duelos de Computação • 6 Disciplinas Disponíveis', {
            fontSize: '11px', fill: '#94a3b8', resolution: 2
        }).setOrigin(0.5);

        // 8. Botão discreto de Acesso Professor / GM (Suave)
        createSmoothButton(this, width - 90, 680, 110, 28, '🛡️ Modo GM', {
            radius: 14,
            fillColor: 0x242a35,
            hoverFillColor: 0x323a48,
            strokeColor: 0x475569,
            textColor: '#cbd5e1',
            fontSize: '11px',
            onClick: () => window.dispatchEvent(new CustomEvent('open-gm-modal'))
        });

        // 9. Botão de Áudio Mudo / Som (🔊 / 🔇) no Canto Superior Direito
        SoundManager.createMuteButton(this, width - 36, 36);

        // Ocultar Overlay do HTML sempre que a cena carregar
        const overlay = document.getElementById('join-overlay');
        if (overlay) overlay.style.display = 'none';

        // Ouvir submissão de código de sala vinda do HTML
        this.handleSubmitRoomCode = this.handleJoinSubmit.bind(this);
        window.addEventListener('submit-room-code', this.handleSubmitRoomCode);

        // Listener para Dev Reset de qualquer lugar
        this.handleDevReset = () => {
            sessionStorage.clear();
            window.location.reload();
        };
        window.addEventListener('dev-reset', this.handleDevReset);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('submit-room-code', this.handleSubmitRoomCode);
            window.removeEventListener('dev-reset', this.handleDevReset);
            if (this.handleNicknameChanged) {
                window.removeEventListener('nickname-changed', this.handleNicknameChanged);
            }
            if (this.handleDevTimersChanged) {
                window.removeEventListener('dev-set-timers', this.handleDevTimersChanged);
            }
        });
    }

    createNicknameBar(x, y) {
        this.nicknameContainer = this.add.container(x, y);

        const bgGfx = this.add.graphics();
        const renderBg = (fColor, sColor) => {
            bgGfx.clear();
            drawRoundedRect(bgGfx, -220, -20, 440, 40, 20, fColor, 0.96, sColor, 1.5);
        };
        renderBg(0x242a35, 0x475569);

        const avatarBg = this.add.circle(-186, 0, 14, 0x334155, 1);
        const icon = this.add.text(-186, 0, '👤', { 
            fontSize: '16px',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif'
        }).setOrigin(0.5);

        const label = this.add.text(-160, 0, 'SEU APELIDO:', { 
            fontSize: '11px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0, 0.5);

        this.nicknameDisplayText = this.add.text(-68, 0, this.playerNickname, { 
            fontSize: '15px', fill: '#f59e0b', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0, 0.5);

        const openModal = () => {
            window.dispatchEvent(new CustomEvent('open-nickname-modal'));
        };

        const btnEdit = createSmoothButton(this, 155, 0, 96, 28, '✏️ Alterar', {
            radius: 14,
            fillColor: 0x323a48,
            hoverFillColor: 0x3e4758,
            strokeColor: 0x526075,
            textColor: '#f59e0b',
            fontSize: '11px',
            onClick: openModal
        });

        this.nicknameContainer.add([bgGfx, avatarBg, icon, label, this.nicknameDisplayText, btnEdit]);

        this.nicknameContainer.setSize(440, 40);
        this.nicknameContainer.setInteractive({ useHandCursor: true });

        this.nicknameContainer.on('pointerover', () => {
            SoundManager.playHover();
            renderBg(0x2d3544, 0xd97706);
        });
        this.nicknameContainer.on('pointerout', () => renderBg(0x242a35, 0x475569));
        this.nicknameContainer.on('pointerdown', () => {
            SoundManager.playClick();
            openModal();
        });

        // Ouvir mudanças de apelido vindas do modal
        this.handleNicknameChanged = (e) => {
            this.playerNickname = e.detail || 'Jogador 1';
            if (this.nicknameDisplayText) {
                this.nicknameDisplayText.setText(this.playerNickname);
            }
        };
        window.addEventListener('nickname-changed', this.handleNicknameChanged);
    }

    createHostCard() {
        const cardX = (this.scale.width / 2) - 190;
        const cardY = 375;
        const card = this.add.container(cardX, cardY);

        const bgGfx = this.add.graphics();
        const renderBg = (fColor, sColor, sWidth = 1.5) => {
            bgGfx.clear();
            drawRoundedRect(bgGfx, -160, -125, 320, 250, 20, fColor, 0.96, sColor, sWidth);
        };
        renderBg(0x242a35, 0x2563eb, 1.5);

        const glow = this.add.circle(0, -56, 26, 0x2563eb, 0.18);

        const icon = this.add.text(0, -56, '⚔️', { 
            fontSize: '38px'
        }).setOrigin(0.5);
        const title = this.add.text(0, -18, 'CRIAR SALA (1P)', { 
            fontSize: '19px', fill: '#60a5fa', fontStyle: 'bold', letterSpacing: 2, resolution: 2 
        }).setOrigin(0.5);

        const desc = this.add.text(0, 20, 'Inicie como Jogador 1 (Host).\nCompartilhe o código da sala e\ndesafie seu colega em tempo real.', { 
            fontSize: '13px', fill: '#cbd5e1', align: 'center', lineSpacing: 5, resolution: 2 
        }).setOrigin(0.5);

        card.add([bgGfx, glow, icon, title, desc]);

        card.setSize(320, 250);
        card.setInteractive({ useHandCursor: true });

        card.on('pointerover', () => {
            SoundManager.playHover();
            this.tweens.add({ targets: card, scale: 1.03, duration: 120, ease: 'Power1' });
            renderBg(0x2d3544, 0x60a5fa, 2);
        });
        card.on('pointerout', () => {
            this.tweens.add({ targets: card, scale: 1.0, duration: 120, ease: 'Power1' });
            renderBg(0x242a35, 0x2563eb, 1.5);
        });
        card.on('pointerdown', () => {
            SoundManager.playClick();
            this.createRoom();
        });
    }

    createJoinCard() {
        const cardX = (this.scale.width / 2) + 190;
        const cardY = 375;
        const card = this.add.container(cardX, cardY);

        const bgGfx = this.add.graphics();
        const renderBg = (fColor, sColor, sWidth = 1.5) => {
            bgGfx.clear();
            drawRoundedRect(bgGfx, -160, -125, 320, 250, 20, fColor, 0.96, sColor, sWidth);
        };
        renderBg(0x242a35, 0xdc2626, 1.5);

        const glow = this.add.circle(0, -56, 26, 0xdc2626, 0.18);

        const icon = this.add.text(0, -56, '📡', { 
            fontSize: '38px'
        }).setOrigin(0.5);
        const title = this.add.text(0, -18, 'ENTRAR EM SALA (2P)', { 
            fontSize: '19px', fill: '#f87171', fontStyle: 'bold', letterSpacing: 2, resolution: 2 
        }).setOrigin(0.5);

        const desc = this.add.text(0, 20, 'Escolha uma sala aberta na lista\nou digite o código de 4 dígitos\npara disputar o combate.', { 
            fontSize: '13px', fill: '#cbd5e1', align: 'center', lineSpacing: 5, resolution: 2 
        }).setOrigin(0.5);

        card.add([bgGfx, glow, icon, title, desc]);

        card.setSize(320, 250);
        card.setInteractive({ useHandCursor: true });

        card.on('pointerover', () => {
            SoundManager.playHover();
            this.tweens.add({ targets: card, scale: 1.03, duration: 120, ease: 'Power1' });
            renderBg(0x2d3544, 0xfca5a5, 2);
        });
        card.on('pointerout', () => {
            this.tweens.add({ targets: card, scale: 1.0, duration: 120, ease: 'Power1' });
            renderBg(0x242a35, 0xdc2626, 1.5);
        });
        card.on('pointerdown', () => {
            const overlay = document.getElementById('join-overlay');
            if (overlay && overlay.style.display === 'flex') return;
            SoundManager.playClick();
            this.showJoinOverlay();
        });
    }

    createRulesFooter() {
        const barWidth = Math.min(this.scale.width - 40, 1020);
        const bar = createSmoothCard(this, this.scale.width / 2, 620, barWidth, 44, {
            radius: 16,
            fillColor: 0x242a35,
            fillAlpha: 0.95,
            strokeColor: 0x475569,
            strokeWidth: 1.5
        });

        const getLimit = () => parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;

        this.rulesText = this.add.text(0, 0, `💚 100 HP  •  ⚡ 3 Cargas de Especial  •  💥 Super Golpe & Ultimate K.O.  •  ⏱️ ${getLimit()}s por Questão`, {
            fontSize: '13px', fill: '#f1f5f9', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);

        bar.add(this.rulesText);

        this.handleDevTimersChanged = (e) => {
            const limit = e?.detail?.questionTimeLimit || getLimit();
            if (this.rulesText) {
                this.rulesText.setText(`💚 100 HP  •  ⚡ 3 Cargas de Especial  •  💥 Super Golpe & Ultimate K.O.  •  ⏱️ ${limit}s por Questão`);
            }
        };
        window.addEventListener('dev-set-timers', this.handleDevTimersChanged);
    }

    async createRoom() {
        this.statusText.setText('⏳ Gerando sala no Firebase...').setStyle({ 
            fill: '#facc15',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 6, bottom: 6, left: 16, right: 16 }
        }).setVisible(true);

        const roomId = this.generateRoomCode();
        const roomRef = ref(db, `rooms/${roomId}`);
        
        let devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10);
        if (!devStartDelay || devStartDelay === 30) devStartDelay = 3;
        const devQuestionLimit = parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;

        logEvent('room', `[Criar Sala] Gerando nova sala "${roomId}" para o Host "${this.playerNickname}"...`);

        try {
            await set(roomRef, {
                p1: { 
                    nickname: this.playerNickname,
                    clientId: tabInstanceId,
                    hp: 100,
                    charges: 0,
                    hasShield: false,
                    hasTryCatch: false,
                    lives: 3, 
                    streak: 0, 
                    answered: false, 
                    characterId: 'so', 
                    ready: false 
                },
                round: 0,
                roundModifier: 'normal',
                roundResolved: false,
                currentQuestionId: null,
                questionStartTime: null,
                matchStartDelay: devStartDelay,
                questionTimeLimit: devQuestionLimit,
                createdAt: Date.now()
            });
            try { onDisconnect(roomRef).remove(); } catch(e) {}

            logEvent('room', `[Sala Criada] Sucesso! Código oficial: "${roomId}". Aguardando P2.`);

            sessionStorage.setItem('labcombat_room_id', roomId);
            sessionStorage.setItem('labcombat_player_id', 'p1');
            sessionStorage.setItem('labcombat_nickname', this.playerNickname);
            this.registerPlayerSession(roomId, 'p1', this.playerNickname);

            // Inicia o jogo na CharacterSelectScene como Jogador 1 com o apelido definido
            this.scene.start('CharacterSelectScene', { 
                roomId, 
                playerId: 'p1', 
                nickname: this.playerNickname 
            });
        } catch(err) {
            console.error('Erro ao criar sala:', err);
            logEvent('error', `[Erro Criar Sala] Falha ao gravar "${roomId}": ${err.message}`);
            this.statusText.setText('❌ Erro de conexão com o banco de dados.').setStyle({ fill: '#ef4444' }).setVisible(true);
        }
    }

    showJoinOverlay() {
        const overlay = document.getElementById('join-overlay');
        if (overlay && overlay.style.display === 'flex') {
            return;
        }
        window.dispatchEvent(new CustomEvent('open-join-modal'));
    }

    async handleJoinSubmit(e) {
        let inputCode = '';
        let nickname = this.playerNickname || 'Jogador 2';

        if (typeof e.detail === 'object' && e.detail !== null) {
            inputCode = (e.detail.roomId || '').toUpperCase().trim();
            if (e.detail.nickname) nickname = e.detail.nickname.trim();
        } else if (typeof e.detail === 'string') {
            inputCode = e.detail.toUpperCase().trim();
        }

        // Sanitização profunda: remove qualquer caractere que não seja letra ou dígito
        inputCode = inputCode.replace(/[^A-Z0-9]/g, '');
        if (inputCode.length > 4) {
            inputCode = inputCode.slice(-4);
        }

        const errorMsg = document.getElementById('join-error-msg');
        const overlay = document.getElementById('join-overlay');
        const btnSubmitJoin = document.getElementById('btn-submit-join');

        const resetButton = () => {
            if (btnSubmitJoin) {
                btnSubmitJoin.disabled = false;
                btnSubmitJoin.textContent = '🚀 Conectar à Sala';
            }
        };

        if (!inputCode || inputCode.length < 4) {
            if (errorMsg) errorMsg.textContent = 'Digite o código da sala de 4 caracteres (Ex: 2A9Y).';
            resetButton();
            return;
        }

        logEvent('join', `[Entrar] Tentando conectar na sala "${inputCode}" como "${nickname}"...`);

        this.statusText.setText(`Buscando sala ${inputCode}...`).setStyle({ fill: '#38bdf8' }).setVisible(true);
        if (errorMsg) errorMsg.textContent = 'Conectando à sala...';

        try {
            let targetRoomId = inputCode;
            let roomRef = ref(db, `rooms/${targetRoomId}`);
            let snapshot = await get(roomRef);

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

            if (snapshot.exists()) {
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

                if (duplicateNickname) {
                    const msg = 'Este nickname já está sendo usado nesta sala. Escolha outro.';
                    logEvent('warn', `[Nickname duplicado] Entrada recusada na sala "${targetRoomId}" para "${nickname}".`);
                    this.statusText.setText(`❌ ${msg}`).setStyle({ fill: '#ef4444' }).setVisible(true);
                    if (errorMsg) errorMsg.textContent = `⚠️ ${msg}`;
                    resetButton();
                    return;
                }
                
                // 1. Reconexão do Jogador 2
                if (isP2) {
                    logEvent('join', `[Reconectado] Jogador "${nickname}" reconectou como P2 na sala "${targetRoomId}".`);
                    sessionStorage.setItem('labcombat_room_id', targetRoomId);
                    sessionStorage.setItem('labcombat_player_id', 'p2');
                    sessionStorage.setItem('labcombat_nickname', nickname);
                    this.registerPlayerSession(targetRoomId, 'p2', nickname);
                    if (overlay) overlay.style.display = 'none';
                    resetButton();
                    this.scene.start('CharacterSelectScene', { roomId: targetRoomId, playerId: 'p2', nickname });
                }
                // 2. Reconexão do Host
                else if (isP1) {
                    logEvent('join', `[Reconectado] Host "${nickname}" reconectou como P1 na sala "${targetRoomId}".`);
                    sessionStorage.setItem('labcombat_room_id', targetRoomId);
                    sessionStorage.setItem('labcombat_player_id', 'p1');
                    sessionStorage.setItem('labcombat_nickname', nickname);
                    this.registerPlayerSession(targetRoomId, 'p1', nickname);
                    if (overlay) overlay.style.display = 'none';
                    resetButton();
                    this.scene.start('CharacterSelectScene', { roomId: targetRoomId, playerId: 'p1', nickname });
                }
                // 3. Se a partida já começou e não é reconexão
                else if (data.round && data.round >= 1) {
                    const msg = 'A partida nesta sala já está em andamento!';
                    logEvent('warn', `[Partida em Andamento] Recusada conexão em "${targetRoomId}" para "${nickname}".`);
                    this.statusText.setText(`❌ ${msg}`).setStyle({ fill: '#ef4444' }).setVisible(true);
                    if (errorMsg) errorMsg.textContent = `⚠️ ${msg}`;
                    resetButton();
                }
                // 4. Vaga P1 livre (caso o host tenha saído antes)
                else if (!data.p1 || !data.p1.nickname) {
                    const p1Ref = ref(db, `rooms/${targetRoomId}/p1`);
                    await set(p1Ref, { 
                        nickname: nickname,
                        clientId: tabInstanceId,
                        hp: 100,
                        charges: 0,
                        hasShield: false,
                        hasTryCatch: false,
                        lives: 3, 
                        streak: 0, 
                        answered: false, 
                        characterId: 'so', 
                        ready: false 
                    });
                    try { onDisconnect(p1Ref).remove(); } catch(e) {}
                    logEvent('join', `[Conectado] Jogador "${nickname}" assumiu P1 na sala "${targetRoomId}".`);
                    sessionStorage.setItem('labcombat_room_id', targetRoomId);
                    sessionStorage.setItem('labcombat_player_id', 'p1');
                    sessionStorage.setItem('labcombat_nickname', nickname);
                    this.registerPlayerSession(targetRoomId, 'p1', nickname);
                    if (overlay) overlay.style.display = 'none';
                    resetButton();
                    this.scene.start('CharacterSelectScene', { roomId: targetRoomId, playerId: 'p1', nickname });
                } 
                // 5. Vaga P2 livre (APENAS se P2 NÃO EXISTIR!)
                else if (!data.p2 || !data.p2.nickname) {
                    const p2Ref = ref(db, `rooms/${targetRoomId}/p2`);
                    await set(p2Ref, { 
                        nickname: nickname,
                        clientId: tabInstanceId,
                        hp: 100,
                        charges: 0,
                        hasShield: false,
                        hasTryCatch: false,
                        lives: 3, 
                        streak: 0, 
                        answered: false, 
                        characterId: 'web', 
                        ready: false 
                    });
                    try { onDisconnect(p2Ref).remove(); } catch(e) {}
                    logEvent('join', `[Conectado] Jogador "${nickname}" entrou com sucesso como P2 na sala "${targetRoomId}".`);
                    sessionStorage.setItem('labcombat_room_id', targetRoomId);
                    sessionStorage.setItem('labcombat_player_id', 'p2');
                    sessionStorage.setItem('labcombat_nickname', nickname);
                    this.registerPlayerSession(targetRoomId, 'p2', nickname);
                    if (overlay) overlay.style.display = 'none';
                    resetButton();
                    this.scene.start('CharacterSelectScene', { roomId: targetRoomId, playerId: 'p2', nickname });
                } 
                // 6. Sala já cheia (P1 e P2 ocupados) -> NUNCA DERRUBAR QUEM ESTÁ NA SALA!
                else {
                    const msg = 'Esta sala já está cheia! (2/2 jogadores).';
                    logEvent('warn', `[Sala Cheia] Recusada conexão em "${targetRoomId}" para "${nickname}".`);
                    this.statusText.setText(`❌ ${msg}`).setStyle({ fill: '#ef4444' }).setVisible(true);
                    if (errorMsg) errorMsg.textContent = `⚠️ ${msg}`;
                    resetButton();
                }
            } else {
                const msg = `Sala "${inputCode}" não encontrada! Verifique o código.`;
                logEvent('error', `[Não Encontrada] Sala "${inputCode}" não existe no banco de dados.`);
                this.statusText.setText(`❌ ${msg}`).setStyle({ fill: '#ef4444' }).setVisible(true);
                if (errorMsg) errorMsg.textContent = msg;
                resetButton();
            }
        } catch(err) {
            console.error('Erro ao buscar sala:', err);
            logEvent('error', `[Erro de Busca] Falha na busca da sala "${inputCode}": ${err.message}`);
            const msg = 'Erro ao conectar com o banco de dados.';
            this.statusText.setText(`❌ ${msg}`).setStyle({ fill: '#ef4444' }).setVisible(true);
            if (errorMsg) errorMsg.textContent = msg;
            resetButton();
        }
    }

    generateRoomCode() {
        // Caracteres sem ambiguidade visual (sem 0, O, 1, I, L)
        const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}
