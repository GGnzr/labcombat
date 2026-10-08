import { ensureGuestAuth, isAdminAccount } from '../auth.js';
import Phaser from 'phaser';
import { db } from '../firebase.js';
import { ref, get, set, onDisconnect } from "firebase/database";
import { logEvent } from '../logger.js';
import { drawRoundedRect, createSmoothCard, createSmoothButton, createSmoothBanner } from '../ui/smoothUI.js';
import { SoundManager } from '../audio/SoundManager.js';
import { loadTopLeaderboard, loadMyLeaderboardEntry, getRankForPoints } from '../ranking.js';

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
            const savedNickname = sessionStorage.getItem('labcombat_nickname') || savedPlayer;
            this.registerPlayerSession(savedRoom, savedPlayer, savedNickname);
            this.scene.start('CharacterSelectScene', {
                roomId: savedRoom,
                playerId: savedPlayer,
                nickname: savedNickname
            });
            return;
        }

        // 1. Fundo do Campus Instituto Federal Veranópolis com Overlay Suave
        const width = this.scale.width;
        const centerX = width / 2;

        const bg = this.add.image(centerX, 360, 'menu_bg').setOrigin(0.5);
        bg.setDisplaySize(width, 720);

        // Overlay suave neutro para valorizar a arte do campus sem escurecer como modo noturno
        this.add.rectangle(centerX, 360, width, 720, 0x181e26, 0.20);

        // 2. Cabeçalho / Branding Suave Arcade — lobby totalmente centralizado
        // (o ranking virou um chip compacto expansível, não desloca mais o layout)
        const lobbyCenterX = width / 2;

        const topBadge = this.add.container(lobbyCenterX, 118);
        const topBadgeGfx = this.add.graphics();
        drawRoundedRect(topBadgeGfx, -170, -14, 340, 28, 14, 0x242a35, 0.95, 0x475569, 1.2);
        const topBadgeTxt = this.add.text(0, 0, '⚔️ ARENA DE DUELO 1V1 • MULTIPLAYER ONLINE', { 
            fontSize: '11px', fill: '#f59e0b', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        topBadge.add([topBadgeGfx, topBadgeTxt]);

        const titleText = this.add.text(lobbyCenterX, 172, 'LABCOMBAT', { 
            fontSize: '64px', fill: '#ffffff', fontStyle: 'bold', letterSpacing: 6, resolution: 2,
            fontFamily: '"Impact", "Arial Black", system-ui, sans-serif'
        }).setOrigin(0.5);
        titleText.setShadow(0, 0, '#d97706', 14, false, true);

        this.add.text(lobbyCenterX, 226, 'Batalha de Conhecimento e Algoritmos em Tempo Real', { 
            fontSize: '14px', fill: '#e2e8f0', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);

        // Botão único: Perfil (elo/stats) + Conta (login/visitante) no mesmo modal
        // Apelido atual vira o chip clicável no topo (👤 nick):
        // visitante → edita apelido; conta logada → abre o Perfil
        this.playerNickname = sessionStorage.getItem('labcombat_nickname') || 'Jogador 1';
        this.btnProfileAccount = createSmoothButton(this, 114, 36, 190, 32, `👤 ${this.playerNickname.slice(0, 16)}`, {
            radius: 16,
            fillColor: 0x242a35,
            hoverFillColor: 0x334155,
            strokeColor: 0xa855f7,
            textColor: '#e9d5ff',
            fontSize: '12px',
            fontStyle: 'bold',
            onClick: () => this.openPlayerModal()
        });

        this.handleNicknameChanged = (e) => {
            this.playerNickname = e.detail || 'Jogador 1';
            this.btnProfileAccount?.setText(`👤 ${this.playerNickname.slice(0, 16)}`);
        };
        window.addEventListener('nickname-changed', this.handleNicknameChanged);
        this.handleAccountStateChanged = () => {
            this.btnProfileAccount?.setText(`👤 ${(this.playerNickname || 'Jogador 1').slice(0, 16)}`);
            // login/logout: recarrega o ranking + o card "SEU ELO" ao vivo
            this.refreshLeaderboard?.();
            this.refreshMyRankCard?.();
        };
        window.addEventListener('account-state-changed', this.handleAccountStateChanged);

        const accessMode = sessionStorage.getItem('labcombat_access_mode');
        // Modal de conta obrigatório APENAS na 1ª entrada (sem modo de acesso).
        // Visitante com apelido padrão ("Jogador 1/2") NÃO é forçado de novo:
        // senão, ao sair de uma sala, ele caía no modal de conta em vez do lobby.
        if (!accessMode) {
            this.time.delayedCall(0, () => {
                window.dispatchEvent(new CustomEvent('open-account-modal', { detail: { required: true } }));
            });
        }

        // (Barra de apelido removida — o chip do topo cobre esse papel)
        this.playerNickname = sessionStorage.getItem('labcombat_nickname') || 'Jogador 1';

        // 3. Dock inferior de ações: Criar / Entrar / Ranking / Regras
        this.createDock();

        // 4. Painel de Ranking expandido (oculto; abre pelo botão 🏆 da dock)
        this.createRankingPanel();

        // 4.5. Banner de status/feedback (abaixo dos botões flutuantes)
        this.statusText = createSmoothBanner(this, lobbyCenterX, 656, '', { 
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

        // Aviso de sala encerrada (MainScene/CharacterSelectScene gravam a chave
        // quando a sala some com o jogador dentro — ex.: GM limpou salas).
        const roomNotice = sessionStorage.getItem('labcombat_room_notice');
        if (roomNotice) {
            sessionStorage.removeItem('labcombat_room_notice');
            this.statusText.setText(roomNotice).setStyle({ fill: '#f87171' }).setVisible(true);
            this.time.delayedCall(8000, () => this.statusText?.setVisible(false));
        }
        // 7. Botão discreto de Acesso Professor / GM (Suave)
        this.adminAccessButton = createSmoothButton(this, width - 90, 620, 110, 28, '🛡️ Modo GM', {
            radius: 14,
            fillColor: 0x242a35,
            hoverFillColor: 0x323a48,
            strokeColor: 0x475569,
            textColor: '#cbd5e1',
            fontSize: '11px',
            onClick: () => window.dispatchEvent(new CustomEvent('open-gm-modal'))
        }).setVisible(false);

        this.refreshAdminAccessButton();
        this.handleAdminAccessChanged = (event) => {
            this.adminAccessButton?.setVisible(event.detail === true);
        };
        window.addEventListener('admin-access-changed', this.handleAdminAccessChanged);

        // 9. Botão de Áudio Mudo / Som (🔊 / 🔇) no Canto Superior Direito
        SoundManager.createMuteButton(this, width - 36, 36);

        // Ocultar Overlay do HTML sempre que a cena carregar
        const overlay = document.getElementById('join-overlay');
        if (overlay) overlay.style.display = 'none';

        // Ouvir submissão de código de sala vinda do HTML
        this.handleSubmitRoomCode = this.handleJoinSubmit.bind(this);
        window.addEventListener('submit-room-code', this.handleSubmitRoomCode);

        // Fluxo do modal Multiplayer: o modal DOM já se fechou antes de
        // disparar o evento — aqui só chama a rota certa, sem guardas.
        this.handleMultiplayerCreate = () => this.createRoom();
        this.handleMultiplayerJoin = () => this.showJoinOverlay();
        window.addEventListener('mp-create-room', this.handleMultiplayerCreate);
        window.addEventListener('mp-join-room', this.handleMultiplayerJoin);

        // Listener para Dev Reset de qualquer lugar
        this.handleDevReset = () => {
            sessionStorage.clear();
            window.location.reload();
        };
        window.addEventListener('dev-reset', this.handleDevReset);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('submit-room-code', this.handleSubmitRoomCode);
            window.removeEventListener('dev-reset', this.handleDevReset);
            window.removeEventListener('mp-create-room', this.handleMultiplayerCreate);
            window.removeEventListener('mp-join-room', this.handleMultiplayerJoin);
            window.removeEventListener('admin-access-changed', this.handleAdminAccessChanged);
            if (this.handleNicknameChanged) {
                window.removeEventListener('nickname-changed', this.handleNicknameChanged);
            }
            if (this.handleAccountStateChanged) {
                window.removeEventListener('account-state-changed', this.handleAccountStateChanged);
            }
            if (this.handleDevTimersChanged) {
                window.removeEventListener('dev-set-timers', this.handleDevTimersChanged);
            }
        });
    }

    async refreshAdminAccessButton() {
        try {
            const isAdmin = await isAdminAccount();
            this.adminAccessButton?.setVisible(isAdmin);
        } catch {
            this.adminAccessButton?.setVisible(false);
        }
    }

    // Chip do topo (👤 apelido): conta logada → Perfil; visitante/sem acesso →
    // modal de Conta já na aba "Criar conta" (visitante também pode trocar o
    // apelido ali por "Continuar como visitante")
    openPlayerModal() {
        if (document.body.classList.contains('modal-open')) return; // overlay aberto por cima
        const logged = localStorage.getItem('labcombat_account_uid') && sessionStorage.getItem('labcombat_access_mode') !== 'guest';
        if (logged) window.dispatchEvent(new CustomEvent('open-profile-modal'));
        else window.dispatchEvent(new CustomEvent('open-account-modal', { detail: { register: true } }));
    }

    // Ações do lobby: botões livres NO CANVAS (sem dock de fundo), um pouco acima da base.
    createDock() {
        const width = this.scale.width;
        const dockW = Math.min(width - 60, 1010);
        const dockH = 100;
        const dockY = 720 - 150 - dockH / 2;   // sobe os botões (eram 24px — agora 150px)

        // Container posicionador SEM fundo visível (fillAlpha 0, sem borda)
        const dock = createSmoothCard(this, width / 2, dockY, dockW, dockH, {
            radius: 22,
            fillColor: 0x161c26,
            fillAlpha: 0,
            strokeWidth: 0
        });

        const guard = (fn) => () => {
            if (document.body.classList.contains('modal-open')) return; // overlay aberto por cima
            fn();
        };

        const btnW = 250, btnS = 150, btnH = 88, gap = 22;
        let cx = -(btnW + btnS * 3 + gap * 3) / 2;
        const addBtn = (w, text, opts) => {
            const b = createSmoothButton(this, cx + w / 2, 0, w, btnH, text, opts);
            cx += w + gap;
            dock.add(b);
            return b;
        };

        // 1. Jogar Multiplayer — azul (abre o modal Criar/Entrar, #multiplayer-overlay)
        addBtn(btnW, '⚔️ MULTIPLAYER (2P)', {
            fillColor: 0x1d3a6e,
            hoverFillColor: 0x2563eb,
            strokeColor: 0x3b82f6,
            hoverStrokeColor: 0x93c5fd,
            textColor: '#dbeafe',
            fontSize: '16px',
            onClick: guard(() => window.dispatchEvent(new CustomEvent('open-multiplayer-modal')))
        });

        // 2. 🎯 Modo Treino (solo vs Coringa) — âmbar
        addBtn(btnS, '🎯 TREINO', {
            fillColor: 0x422006,
            hoverFillColor: 0x713f12,
            strokeColor: 0xd97706,
            hoverStrokeColor: 0xfbbf24,
            textColor: '#fde68a',
            fontSize: '13px',
            onClick: guard(() => this.createTrainingRoom())
        });

        // 3. 🏆 Ranking — âmbar, abre o painel expandido (createRankingPanel)
        const btnRank = addBtn(btnS, '🏆 RANKING', {
            fillColor: 0x3a2f14,
            hoverFillColor: 0x59461c,
            strokeColor: 0xf59e0b,
            hoverStrokeColor: 0xfbbf24,
            textColor: '#fde68a',
            fontSize: '13px',
            onClick: guard(() => this.toggleRankingPanel())
        });
        btnRank.label.setY(-13);
        this.rankingDockSub = this.add.text(btnRank.x, 16, 'carregando...', {
            fontSize: '10.5px', fill: '#cbd5e1', resolution: 2
        }).setOrigin(0.5);
        dock.add(this.rankingDockSub);

        // 4. 📜 Regras — abre o modal "Como Jogar" (DOM, #rules-overlay)
        addBtn(btnS, '📜 REGRAS', {
            fillColor: 0x242a35,
            hoverFillColor: 0x334155,
            strokeColor: 0x475569,
            hoverStrokeColor: 0x94a3b8,
            textColor: '#e2e8f0',
            fontSize: '13px',
            onClick: guard(() => window.dispatchEvent(new CustomEvent('open-rules-modal')))
        });
    }

    // Painel de ranking expandido: Top 10 + SEU ELO, oculto por padrão; abre pelo
    // botão 🏆 da dock inferior (layout dock). O resumo do seu elo fica no próprio
    // botão (this.rankingDockSub). Dados: RTDB leaderboard/{uid} (src/ranking.js).
    createRankingPanel() {
        const W = 292;
        const px = this.scale.width - (W / 2) - 16;   // coluna direita, acima da dock
        const py = 330;
        const H = 470;

        const card = createSmoothCard(this, px, py, W, H, {
            radius: 18,
            fillColor: 0x0f172a,
            fillAlpha: 0.97,
            strokeColor: 0xf59e0b,
            strokeWidth: 1.5
        });
        card.setVisible(false);
        this.rankingPanel = card;

        // Botão fechar (✕) no canto do painel
        card.add(this.add.text(W / 2 - 20, -H / 2 + 20, '✕', {
            fontSize: '14px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', function () { this.setStyle({ fill: '#f1f5f9' }); })
            .on('pointerout', function () { this.setStyle({ fill: '#94a3b8' }); })
            .on('pointerdown', () => {
                SoundManager.playClick();
                this.toggleRankingPanel(false);
            })
        );

        card.add(this.add.text(0, -H / 2 + 22, 'RANKING DA ARENA', {
            fontSize: '15px', fill: '#f59e0b', fontStyle: 'bold', letterSpacing: 1, resolution: 2
        }).setOrigin(0.5));
        card.add(this.add.text(0, -H / 2 + 42, 'Top 10 por LabPoints (LP)', {
            fontSize: '10px', fill: '#94a3b8', resolution: 2
        }).setOrigin(0.5));

        // Lista estilo pódio: 🥇 ouro grande, 🥈 prata médio, 🥉 bronze menor, resto normal
        const podiumY = -H / 2 + 58;
        const podiumStyle = [
            { fs: '15.5px', color: '#fbbf24' },   // 1º — ouro
            { fs: '13.5px', color: '#e2e8f0' },   // 2º — prata
            { fs: '12px',   color: '#d68a53' }    // 3º — bronze
        ];
        const podiumTexts = podiumStyle.map((s, i) => this.add.text(-W / 2 + 14, podiumY + [0, 32, 58][i], '', {
            fontSize: s.fs, fill: s.color, fontStyle: 'bold', resolution: 2
        }).setOrigin(0, 0));
        const restText = this.add.text(-W / 2 + 14, podiumY + 84, 'Carregando...', {
            fontSize: '11px', fill: '#cbd5e1', lineSpacing: 8, resolution: 2
        }).setOrigin(0, 0);
        card.add([...podiumTexts, restText]);

        // Divisor + bloco "SEU ELO"
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x334155);
        divider.lineBetween(-W / 2 + 14, 96, W / 2 - 14, 96);
        card.add(divider);

        card.add(this.add.text(0, 112, 'SEU ELO', {
            fontSize: '11px', fill: '#94a3b8', fontStyle: 'bold', letterSpacing: 2, resolution: 2
        }).setOrigin(0.5));
        const youMain = this.add.text(0, 146, '', {
            fontSize: '17px', fill: '#f8fafc', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        const youSub = this.add.text(0, 172, '', {
            fontSize: '11px', fill: '#94a3b8', resolution: 2
        }).setOrigin(0.5);
        card.add([youMain, youSub]);

        // Link para o ranking geral (todas as posições, filtro por elo)
        card.add(this.add.text(0, 205, 'Ver ranking completo ›', {
            fontSize: '11px', fill: '#38bdf8', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', function () { this.setStyle({ fill: '#7dd3fc' }); })
            .on('pointerout', function () { this.setStyle({ fill: '#38bdf8' }); })
            .on('pointerdown', () => {
                if (document.body.classList.contains('modal-open')) return; // overlay aberto por cima
                window.dispatchEvent(new CustomEvent('open-ranking-modal'));
            })
        );

        // Atualizável: login/logout disparam account-state-changed e recarregam
        // o ranking + o card "SEU ELO" (antes ficava preso no estado de quando
        // a cena nasceu — usuário logado após entrar no menu via "Visitante"
        // até dar F5).
        this.refreshLeaderboard = () => {
            const myUid = localStorage.getItem('labcombat_account_uid');
            loadTopLeaderboard(10).then((top) => {
                if (!this.scene.isActive()) return;
                const toLine = (e, i) => {
                    const rank = getRankForPoints(e.points || 0);
                    const pos = ['🥇', '🥈', '🥉'][i] || `${i + 1}º`;
                    const nick = String(e.nickname || 'Jogador'); // nome completo
                    const elo = `${rank.icon}${rank.division ? ' ' + rank.division : ''}`;
                    const line = `${pos} ${nick}  ${elo} ${e.points || 0} LP`;
                    return e.uid === myUid ? `${line} ◄` : line;
                };
                podiumTexts.forEach((t, i) => t.setText(top[i] ? toLine(top[i], i) : ''));
                restText.setText(top.length > 3 ? top.slice(3).map(toLine).join('\n') : (top.length ? '' : 'Ninguém pontuou ainda.\nVença uma partida com conta\npara entrar no ranking! 🚀'));
            }).catch(() => {
                if (!this.scene.isActive()) return;
                restText.setText('Falha ao carregar o ranking.');
            });
        };

        this.refreshMyRankCard = () => {
            const myUid = localStorage.getItem('labcombat_account_uid');
            const isGuest = sessionStorage.getItem('labcombat_access_mode') === 'guest' || !myUid;
            if (isGuest) {
                youMain.setText('🎮 Visitante');
                youSub.setText('Entre com conta p/ pontuar');
                this.rankingDockSub?.setText('🎮 Visitante');
            } else {
                youMain.setText('...');
                this.rankingDockSub?.setText('carregando...');
                loadMyLeaderboardEntry(myUid).then(({ entry, position, total }) => {
                    if (!this.scene.isActive()) return;
                    if (!entry) {
                        youMain.setText('🐣 Sem elo ainda');
                        youSub.setText('Vença a 1ª partida p/ +25 LP');
                        this.rankingDockSub?.setText('🐣 Sem elo ainda');
                        return;
                    }
                    const rank = getRankForPoints(entry.points || 0);
                    const winRate = entry.matches ? Math.round(((entry.wins || 0) / entry.matches) * 100) : 0;
                    youMain.setText(rank.label);
                    youSub.setText(`${entry.points || 0} LP${position ? ` · #${position} de ${total}` : ''} · ${winRate}% wins`);
                    this.rankingDockSub?.setText(`${rank.icon} ${entry.points || 0} LP${position ? ` · #${position}` : ''}`);
                }).catch(() => {
                    if (!this.scene.isActive()) return;
                    youMain.setText('');
                    youSub.setText('');
                    this.rankingDockSub?.setText('toque p/ abrir');
                });
            }
        };

        this.refreshLeaderboard();
        this.refreshMyRankCard();
    }

    // Abre/fecha o painel de ranking (botão 🏆 da dock)
    toggleRankingPanel(force) {
        const show = force !== undefined ? force : !(this.rankingPanel?.visible);
        this.rankingPanel?.setVisible(show);
        SoundManager.playClick();
    }

    async createRoom() {
        const access = await ensureGuestAuth();
        if (!access.success) {
            this.statusText?.setText(`❌ ${access.message}`).setVisible(true);
            return;
        }

        this.statusText.setText('⏳ Gerando sala no Firebase...').setStyle({ 
            fill: '#facc15',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 6, bottom: 6, left: 16, right: 16 }
        }).setVisible(true);

        const roomId = this.generateRoomCode();
        const roomRef = ref(db, `rooms/${roomId}`);
        const ownerUid = access.user.uid;
        
        let devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10);
        if (!devStartDelay || devStartDelay === 30) devStartDelay = 10;
        const devQuestionLimit = parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;

        logEvent('room', `[Criar Sala] Gerando nova sala "${roomId}" para o Host "${this.playerNickname}"...`);

        try {
            await set(roomRef, {
                ownerUid,
                maxHp: parseInt(localStorage.getItem('dev_max_hp'), 10) || 100,
                p1: { 
                    nickname: this.playerNickname,
                    clientId: tabInstanceId,
                    uid: ownerUid,
                    hp: parseInt(localStorage.getItem('dev_max_hp'), 10) || 100,
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
            // onDisconnect: NÃO remover a sala inteira aqui — senão, se o P1
            // cair/atualizar (F5), a sala some de uma vez e o P2 vai direto
            // pro menu sem o aviso de "oponente desconectou". Cada cena
            // registra onDisconnect apenas no NÓ DO PRÓPRIO JOGADOR
            // (rooms/{id}/p1|p2), mantendo o fluxo de reconexão + W.O. por
            // graça de 15s que o oponente exibe.

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
            logEvent('error', `[Erro Criar Sala] Falha ao gravar "${roomId}": ${err.message}`, {
                roomId,
                ownerUid,
                authProvider: access.user.isAnonymous ? 'anonymous' : 'account'
            });
            this.statusText.setText('❌ Erro de conexão com o banco de dados.').setStyle({ fill: '#ef4444' }).setVisible(true);
        }
    }

    // Modo Treino: cria uma sala já com o bot Coringa no slot P2
    // (não entra na lista pública — o isBot não é listável por padrão).
    // A CharacterSelectScene recebe opponentBot pra já exibir o Coringa.
    async createTrainingRoom() {
        const access = await ensureGuestAuth();
        if (!access.success) {
            this.statusText?.setText(`❌ ${access.message}`).setVisible(true);
            return;
        }
        this.statusText.setText('⏳ Preparando sala de treino...').setStyle({ fill: '#facc15' }).setVisible(true);

        const roomId = this.generateRoomCode();
        const roomRef = ref(db, `rooms/${roomId}`);
        const ownerUid = access.user.uid;
        const devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10) || 10;
        const devQuestionLimit = parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;
        const maxHp = parseInt(localStorage.getItem('dev_max_hp'), 10) || 100;

        logEvent('room', `[Treino] Sala de treino "${roomId}" para "${this.playerNickname}" (vs Coringa).`);

        try {
            await set(roomRef, {
                ownerUid,
                maxHp,
                isTraining: true,
                p1: {
                    nickname: this.playerNickname,
                    clientId: tabInstanceId,
                    uid: ownerUid,
                    hp: maxHp,
                    charges: 0, hasShield: false, hasTryCatch: false,
                    lives: 3, streak: 0, answered: false,
                    characterId: 'so', ready: false
                },
                p2: {
                    nickname: '🃏 Professor Coringa',
                    clientId: 'bot-coringa',
                    uid: ownerUid,
                    hp: maxHp,
                    charges: 0, hasShield: false, hasTryCatch: false,
                    lives: 3, streak: 0, answered: false,
                    characterId: 'coringa', ready: false,
                    isBot: true
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

            // Treino: o bot Coringa não reconecta — se o host (único humano) cair
            // ou der F5, a sala deixa de fazer sentido e é removida de vez pelo
            // onDisconnect da sala inteira (multiplayer NÃO faz isso — a sala
            // sobrevive porque o oponente humano pode ainda estar nela).
            try { await onDisconnect(roomRef).remove(); } catch (e) {}

            sessionStorage.setItem('labcombat_room_id', roomId);
            sessionStorage.setItem('labcombat_player_id', 'p1');
            sessionStorage.setItem('labcombat_nickname', this.playerNickname);
            this.registerPlayerSession(roomId, 'p1', this.playerNickname);
            this.registerPlayerSession(roomId, 'p1', this.playerNickname);

            this.scene.start('CharacterSelectScene', {
                roomId,
                playerId: 'p1',
                nickname: this.playerNickname,
                opponentBot: true
            });
        } catch (err) {
            console.error('Erro ao criar sala de treino:', err);
            logEvent('error', `[Erro Treino] Falha ao criar sala "${roomId}": ${err.message}`);
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
            // Visitante também precisa de auth (anônima) — as regras do RTDB
            // identificam os participantes por uid (database.rules.json).
            const access = await ensureGuestAuth();
            if (!access.success) {
                if (errorMsg) errorMsg.textContent = `⚠️ ${access.message}`;
                resetButton();
                return;
            }
            const playerUid = access.user.uid;

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
                        uid: playerUid,
                        // HP inicial respeita o HP máx da sala (ajustável no GM)
                        hp: Number(data.maxHp) || parseInt(localStorage.getItem('dev_max_hp'), 10) || 100,
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
                        uid: playerUid,
                        // HP inicial respeita o HP máx da sala (ajustável no GM)
                        hp: Number(data.maxHp) || parseInt(localStorage.getItem('dev_max_hp'), 10) || 100,
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
