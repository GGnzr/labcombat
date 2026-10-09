import { isAdminAccount } from '../auth.js';
import Phaser from 'phaser';
import { drawRoundedRect, createSmoothCard, createSmoothButton, createSmoothBanner } from '../ui/smoothUI.js';
import { SoundManager } from '../audio/SoundManager.js';
import { loadTopLeaderboard, loadMyLeaderboardEntry, getRankForPoints } from '../ranking.js';
import { registerPlayerSession, createRoom } from '../rooms.js';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    registerPlayerSession(roomId, playerId, nickname) {
        registerPlayerSession(roomId, playerId, nickname);
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

        // Listener para Dev Reset de qualquer lugar
        this.handleDevReset = () => {
            sessionStorage.clear();
            window.location.reload();
        };
        window.addEventListener('dev-reset', this.handleDevReset);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('dev-reset', this.handleDevReset);
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

        // 1. Jogar Multiplayer — azul (abre a LobbyScene: lista de salas ao vivo)
        addBtn(btnW, '⚔️ MULTIPLAYER (2P)', {
            fillColor: 0x1d3a6e,
            hoverFillColor: 0x2563eb,
            strokeColor: 0x3b82f6,
            hoverStrokeColor: 0x93c5fd,
            textColor: '#dbeafe',
            fontSize: '16px',
            onClick: guard(() => this.scene.start('LobbyScene'))
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
            fontSize: '11.5px', fill: '#cbd5e1', resolution: 2
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
            fontSize: '14px', fill: '#cbd5e1', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', function () { this.setStyle({ fill: '#f1f5f9' }); })
            .on('pointerout', function () { this.setStyle({ fill: '#cbd5e1' }); })
            .on('pointerdown', () => {
                SoundManager.playClick();
                this.toggleRankingPanel(false);
            })
        );

        card.add(this.add.text(0, -H / 2 + 22, 'RANKING DA ARENA', {
            fontSize: '15px', fill: '#f59e0b', fontStyle: 'bold', letterSpacing: 1, resolution: 2
        }).setOrigin(0.5));
        card.add(this.add.text(0, -H / 2 + 42, 'Top 10 por LabPoints (LP)', {
            fontSize: '11.5px', fill: '#cbd5e1', resolution: 2
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
            fontSize: '12px', fill: '#cbd5e1', lineSpacing: 8, resolution: 2
        }).setOrigin(0, 0);
        card.add([...podiumTexts, restText]);

        // Divisor + bloco "SEU ELO"
        const divider = this.add.graphics();
        divider.lineStyle(1, 0x334155);
        divider.lineBetween(-W / 2 + 14, 96, W / 2 - 14, 96);
        card.add(divider);

        card.add(this.add.text(0, 112, 'SEU ELO', {
            fontSize: '12px', fill: '#cbd5e1', fontStyle: 'bold', letterSpacing: 2, resolution: 2
        }).setOrigin(0.5));
        const youMain = this.add.text(0, 146, '', {
            fontSize: '17px', fill: '#f8fafc', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        const youSub = this.add.text(0, 172, '', {
            fontSize: '12px', fill: '#cbd5e1', resolution: 2
        }).setOrigin(0.5);
        card.add([youMain, youSub]);

        // Link para o ranking geral (todas as posições, filtro por elo)
        card.add(this.add.text(0, 205, 'Ver ranking completo ›', {
            fontSize: '12px', fill: '#38bdf8', fontStyle: 'bold', resolution: 2
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

    // Modo Treino: cria uma sala já com o bot Coringa no slot P2
    // (não entra na lista pública do lobby — isTraining/visibility a excluem).
    // A CharacterSelectScene recebe opponentBot pra já exibir o Coringa.
    async createTrainingRoom() {
        this.statusText.setText('⏳ Preparando sala de treino...').setStyle({ fill: '#facc15' }).setVisible(true);
        const result = await createRoom({ nickname: this.playerNickname, training: true });
        if (!result.success) {
            this.statusText.setText(`❌ ${result.message}`).setStyle({ fill: '#ef4444' }).setVisible(true);
            return;
        }
        this.scene.start('CharacterSelectScene', {
            roomId: result.roomId,
            playerId: 'p1',
            nickname: this.playerNickname,
            opponentBot: true
        });
    }
}
