import Phaser from 'phaser';
import { db } from '../firebase.js';
import { ref, get, set, onDisconnect } from "firebase/database";
import { logEvent } from '../logger.js';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    preload() {
        this.load.image('arena_bg', '/assets/bg.jpg');
    }

    create() {
        // Auto-reconnect se já houver uma sessão salva
        let savedRoom = sessionStorage.getItem('labcombat_room_id');
        let savedPlayer = sessionStorage.getItem('labcombat_player_id');
        
        if (savedRoom && savedPlayer) {
            this.scene.start('CharacterSelectScene', { roomId: savedRoom, playerId: savedPlayer });
            return;
        }

        // 1. Fundo da Arena com Overlay Cinematográfico
        const bg = this.add.image(640, 360, 'arena_bg').setOrigin(0.5);
        bg.setDisplaySize(1280, 720);

        // Overlay escuro translúcido para destacar a interface
        this.add.rectangle(640, 360, 1280, 720, 0x070b19, 0.72);

        // 2. Cabeçalho / Branding
        this.add.text(640, 42, '⚔️ ARENA DE DUELO 1V1 • MULTIPLAYER ONLINE', { 
            fontSize: '11px', fill: '#38bdf8', fontStyle: 'bold', 
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            backgroundColor: '#0a0f1d', padding: { top: 6, bottom: 6, left: 16, right: 16 } 
        }).setOrigin(0.5);

        const titleText = this.add.text(640, 95, 'LABCOMBAT', { 
            fontSize: '60px', fill: '#ffffff', fontStyle: 'bold', letterSpacing: 6 
        }).setOrigin(0.5);
        titleText.setShadow(0, 0, '#38bdf8', 14, false, true);

        this.add.text(640, 142, 'Batalha de Conhecimento e Algoritmos em Tempo Real', { 
            fontSize: '13px', fill: '#94a3b8' 
        }).setOrigin(0.5);

        // Barra de Definição de Apelido (Nickname)
        this.playerNickname = localStorage.getItem('labcombat_nickname') || 'Jogador 1';
        this.createNicknameBar(640, 190);

        // 3. Card 1: Criar Sala (Host / P1)
        this.createHostCard();

        // 4. Card 2: Entrar em Sala (Client / P2)
        this.createJoinCard();

        // 5. Mensagens de Status / Feedback
        this.statusText = this.add.text(640, 560, '', { 
            fontSize: '13px', fill: '#facc15', fontStyle: 'bold', 
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            backgroundColor: '#0f172a', padding: { top: 6, bottom: 6, left: 16, right: 16 } 
        }).setOrigin(0.5).setVisible(false);

        // 6. Rodapé: Regras Rápidas da Partida
        this.createRulesFooter();

        // 7. Sub-rodapé informativo
        this.add.text(640, 680, 'LabCombat • Duelos de Computação • 6 Disciplinas Disponíveis', {
            fontSize: '11px', fill: '#475569'
        }).setOrigin(0.5);

        // 8. Botão discreto de Acesso Professor / GM
        this.add.text(1180, 680, '🛡️ Modo GM', {
            fontSize: '10px', fill: '#64748b', fontStyle: 'bold',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', function() { this.setStyle({ fill: '#38bdf8' }); })
            .on('pointerout', function() { this.setStyle({ fill: '#64748b' }); })
            .on('pointerdown', () => {
                window.dispatchEvent(new CustomEvent('open-gm-modal'));
            });

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

        const bg = this.add.rectangle(0, 0, 440, 40, 0x0c1322, 0.95)
            .setStrokeStyle(1.5, 0x1e293b)
            .setInteractive({ useHandCursor: true });

        const avatarBg = this.add.circle(-186, 0, 14, 0x1e293b, 0.9);
        const icon = this.add.text(-186, 0, '👤', { 
            fontSize: '16px',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 8, bottom: 8, left: 8, right: 8 }
        }).setOrigin(0.5);

        const label = this.add.text(-160, 0, 'SEU APELIDO:', { 
            fontSize: '11px', fill: '#94a3b8', fontStyle: 'bold' 
        }).setOrigin(0, 0.5);

        this.nicknameDisplayText = this.add.text(-68, 0, this.playerNickname, { 
            fontSize: '15px', fill: '#38bdf8', fontStyle: 'bold' 
        }).setOrigin(0, 0.5);

        const btnEdit = this.add.text(155, 0, '✏️ Alterar', {
            fontSize: '11px', fill: '#ffffff', backgroundColor: '#1e293b',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 6, bottom: 6, left: 12, right: 12 }, fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btnEdit.on('pointerover', () => {
            btnEdit.setStyle({ backgroundColor: '#2563eb' });
            bg.setStrokeStyle(1.5, 0x38bdf8);
        });
        btnEdit.on('pointerout', () => {
            btnEdit.setStyle({ backgroundColor: '#1e293b' });
            bg.setStrokeStyle(1.5, 0x1e293b);
        });
        
        bg.on('pointerover', () => {
            bg.setStrokeStyle(1.5, 0x38bdf8);
            btnEdit.setStyle({ backgroundColor: '#2563eb' });
        });
        bg.on('pointerout', () => {
            bg.setStrokeStyle(1.5, 0x1e293b);
            btnEdit.setStyle({ backgroundColor: '#1e293b' });
        });

        const openModal = () => {
            window.dispatchEvent(new CustomEvent('open-nickname-modal'));
        };

        bg.on('pointerdown', openModal);
        btnEdit.on('pointerdown', openModal);

        this.nicknameContainer.add([bg, avatarBg, icon, label, this.nicknameDisplayText, btnEdit]);

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
        const cardX = 450;
        const cardY = 375;
        const card = this.add.container(cardX, cardY);

        // Fundo do Card
        const bg = this.add.rectangle(0, 0, 320, 250, 0x0c1322, 0.92)
            .setStrokeStyle(1.5, 0x059669)
            .setInteractive({ useHandCursor: true });

        // Glow circular atrás do ícone
        const glow = this.add.circle(0, -56, 24, 0x10b981, 0.15);

        // Ícone e Textos
        const icon = this.add.text(0, -56, '⚔️', { 
            fontSize: '38px',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 16, bottom: 16, left: 16, right: 16 }
        }).setOrigin(0.5);
        const title = this.add.text(0, -18, 'CRIAR SALA', { 
            fontSize: '18px', fill: '#34d399', fontStyle: 'bold', letterSpacing: 2 
        }).setOrigin(0.5);

        const desc = this.add.text(0, 20, 'Inicie como Jogador 1 (Host).\nCompartilhe o código da sala e\ndesafie seu colega em tempo real.', { 
            fontSize: '12px', fill: '#94a3b8', align: 'center', lineSpacing: 5 
        }).setOrigin(0.5);

        const btnPill = this.add.text(0, 74, '[ + Criar Nova Sala ]', { 
            fontSize: '13px', fill: '#ffffff', backgroundColor: '#059669', 
            padding: { x: 22, y: 9 }, fontStyle: 'bold' 
        }).setOrigin(0.5);

        card.add([bg, glow, icon, title, desc, btnPill]);

        // Efeitos de Hover
        bg.on('pointerover', () => {
            this.tweens.add({ targets: card, scale: 1.03, duration: 120, ease: 'Power1' });
            bg.setStrokeStyle(2, 0x34d399);
            bg.setFillStyle(0x111c30, 0.95);
            btnPill.setStyle({ backgroundColor: '#10b981' });
        });
        bg.on('pointerout', () => {
            this.tweens.add({ targets: card, scale: 1.0, duration: 120, ease: 'Power1' });
            bg.setStrokeStyle(1.5, 0x059669);
            bg.setFillStyle(0x0c1322, 0.92);
            btnPill.setStyle({ backgroundColor: '#059669' });
        });
        bg.on('pointerdown', () => this.createRoom());
    }

    createJoinCard() {
        const cardX = 830;
        const cardY = 375;
        const card = this.add.container(cardX, cardY);

        // Fundo do Card
        const bg = this.add.rectangle(0, 0, 320, 250, 0x0c1322, 0.92)
            .setStrokeStyle(1.5, 0x2563eb)
            .setInteractive({ useHandCursor: true });

        // Glow circular atrás do ícone
        const glow = this.add.circle(0, -56, 24, 0x38bdf8, 0.15);

        // Ícone e Textos
        const icon = this.add.text(0, -56, '📡', { 
            fontSize: '38px',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 16, bottom: 16, left: 16, right: 16 }
        }).setOrigin(0.5);
        const title = this.add.text(0, -18, 'ENTRAR EM SALA', { 
            fontSize: '18px', fill: '#60a5fa', fontStyle: 'bold', letterSpacing: 2 
        }).setOrigin(0.5);

        const desc = this.add.text(0, 20, 'Escolha uma sala aberta na lista\nou digite o código de 4 dígitos\npara disputar o combate.', { 
            fontSize: '12px', fill: '#94a3b8', align: 'center', lineSpacing: 5 
        }).setOrigin(0.5);

        const btnPill = this.add.text(0, 74, '[ Ver Salas / Inserir Código ]', { 
            fontSize: '12px', fill: '#ffffff', backgroundColor: '#2563eb', 
            padding: { x: 16, y: 9 }, fontStyle: 'bold' 
        }).setOrigin(0.5);

        card.add([bg, glow, icon, title, desc, btnPill]);

        // Efeitos de Hover
        bg.on('pointerover', () => {
            this.tweens.add({ targets: card, scale: 1.03, duration: 120, ease: 'Power1' });
            bg.setStrokeStyle(2, 0x60a5fa);
            bg.setFillStyle(0x111c30, 0.95);
            btnPill.setStyle({ backgroundColor: '#3b82f6' });
        });
        bg.on('pointerout', () => {
            this.tweens.add({ targets: card, scale: 1.0, duration: 120, ease: 'Power1' });
            bg.setStrokeStyle(1.5, 0x2563eb);
            bg.setFillStyle(0x0c1322, 0.92);
            btnPill.setStyle({ backgroundColor: '#2563eb' });
        });
        bg.on('pointerdown', () => {
            const overlay = document.getElementById('join-overlay');
            if (overlay && overlay.style.display === 'flex') return;
            this.showJoinOverlay();
        });
    }

    createRulesFooter() {
        const bar = this.add.container(640, 620);
        const bg = this.add.rectangle(0, 0, 1020, 44, 0x090d16, 0.95).setStrokeStyle(1.5, 0x1e293b);

        const getLimit = () => parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;

        this.rulesText = this.add.text(0, 0, `💚 100 HP  •  ⚡ 3 Cargas de Especial  •  💥 Super Golpe & Ultimate K.O.  •  ⏱️ ${getLimit()}s por Questão`, {
            fontSize: '12px', fill: '#cbd5e1', fontStyle: 'bold',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 8, bottom: 8, left: 12, right: 12 }
        }).setOrigin(0.5);

        bar.add([bg, this.rulesText]);

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
                
                
                const lowerNick = nickname.trim().toLowerCase();
                const isDefaultNick = (lowerNick === 'jogador 1' || lowerNick === 'jogador 2');
                const isP1 = (sessionRoomId === targetRoomId && sessionPlayerId === 'p1') || 
                             (!isDefaultNick && data.p1 && data.p1.nickname && data.p1.nickname.trim().toLowerCase() === lowerNick);
                const isP2 = (sessionRoomId === targetRoomId && sessionPlayerId === 'p2') || 
                             (!isDefaultNick && data.p2 && data.p2.nickname && data.p2.nickname.trim().toLowerCase() === lowerNick);
                
                // 1. Reconexão do Jogador 2
                if (isP2) {
                    logEvent('join', `[Reconectado] Jogador "${nickname}" reconectou como P2 na sala "${targetRoomId}".`);
                    sessionStorage.setItem('labcombat_room_id', targetRoomId);
                    sessionStorage.setItem('labcombat_player_id', 'p2');
                    sessionStorage.setItem('labcombat_nickname', nickname);
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
                    if (overlay) overlay.style.display = 'none';
                    resetButton();
                    this.scene.start('CharacterSelectScene', { roomId: targetRoomId, playerId: 'p1', nickname });
                } 
                // 5. Vaga P2 livre (APENAS se P2 NÃO EXISTIR!)
                else if (!data.p2 || !data.p2.nickname) {
                    const p2Ref = ref(db, `rooms/${targetRoomId}/p2`);
                    await set(p2Ref, { 
                        nickname: nickname,
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
