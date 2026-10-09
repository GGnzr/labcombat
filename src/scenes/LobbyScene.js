/**
 * LobbyScene — Lobby multiplayer: lista AO VIVO das salas públicas abertas
 * (1 vaga livre, aguardando oponente), com botões para criar sala pública/
 * privada ou entrar por código. Substituiu o antigo modal ⚔️ MULTIPLAYER (DOM).
 *
 * Fonte de dados: listener onValue em rooms/ (leitura pública — ver
 * database.rules.json). Uma sala aparece na lista quando:
 *   - visibility === 'public' (salas antigas sem o campo contam como públicas)
 *   - tem p1 e NÃO tem p2 (vaga livre), sem bot/treino
 *   - não está em partida nem encerrada (state/round)
 *   - foi criada há menos de 15 min (TTL de exibição)
 * Entrar numa sala da lista ou por código usa joinRoom() de src/rooms.js
 * (mesma lógica do antigo fluxo de código: reconexão, sala cheia etc.).
 */
import Phaser from 'phaser';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase.js';
import { createRoom, joinRoom } from '../rooms.js';
import { drawRoundedRect, createSmoothCard, createSmoothButton, createSmoothBanner } from '../ui/smoothUI.js';
import { SoundManager } from '../audio/SoundManager.js';

const MAX_ROOM_AGE_MS = 15 * 60 * 1000; // salas somem da lista após 15 min
const MAX_ROWS = 9; // grade 3 colunas × 3 linhas

export class LobbyScene extends Phaser.Scene {
    constructor() {
        super('LobbyScene');
    }

    preload() {
        if (!this.textures.exists('menu_bg')) {
            this.load.image('menu_bg', '/assets/campus_veranopolis.jpg');
        }
    }

    create() {
        SoundManager.startMenuBGM();

        const width = this.scale.width;
        const centerX = width / 2;

        const bg = this.add.image(centerX, 360, 'menu_bg').setOrigin(0.5);
        bg.setDisplaySize(width, 720);
        this.add.rectangle(centerX, 360, width, 720, 0x0f172a, 0.62);

        this.playerNickname = sessionStorage.getItem('labcombat_nickname') || 'Jogador';
        this.busy = false;

        // ---- Cabeçalho ----
        this.add.text(centerX, 74, '⚔️ SALAS MULTIPLAYER', {
            fontSize: '34px', fill: '#ffffff', fontStyle: 'bold', letterSpacing: 3, resolution: 2,
            fontFamily: '"Impact", "Arial Black", system-ui, sans-serif'
        }).setOrigin(0.5).setShadow(0, 0, '#2563eb', 12, false, true);

        this.add.text(centerX, 112, 'Entre numa sala aberta com 1 clique, ou crie a sua e desafie um colega', {
            fontSize: '13px', fill: '#cbd5e1', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);

        // ---- Barra de ações ----
        const guard = (fn) => () => {
            if (this.busy) return;
            if (document.body.classList.contains('modal-open')) return; // overlay DOM por cima
            fn();
        };

        createSmoothButton(this, centerX - 320, 158, 200, 44, '🌐 CRIAR PÚBLICA', {
            radius: 14, fillColor: 0x1d3a6e, hoverFillColor: 0x2563eb,
            strokeColor: 0x3b82f6, hoverStrokeColor: 0x93c5fd,
            textColor: '#dbeafe', fontSize: '13px', fontStyle: 'bold',
            onClick: guard(() => this.handleCreateRoom('public'))
        });
        createSmoothButton(this, centerX - 106, 158, 200, 44, '🔒 CRIAR PRIVADA', {
            radius: 14, fillColor: 0x242a35, hoverFillColor: 0x334155,
            strokeColor: 0x64748b, hoverStrokeColor: 0x94a3b8,
            textColor: '#e2e8f0', fontSize: '13px', fontStyle: 'bold',
            onClick: guard(() => this.handleCreateRoom('private'))
        });
        createSmoothButton(this, centerX + 108, 158, 200, 44, '🔑 ENTRAR C/ CÓDIGO', {
            radius: 14, fillColor: 0x261616, hoverFillColor: 0x7f1d1d,
            strokeColor: 0xdc2626, hoverStrokeColor: 0xf87171,
            textColor: '#fecaca', fontSize: '13px', fontStyle: 'bold',
            onClick: guard(() => window.dispatchEvent(new CustomEvent('open-join-modal')))
        });
        createSmoothButton(this, centerX + 320, 158, 200, 44, '← VOLTAR', {
            radius: 14, fillColor: 0x242a35, hoverFillColor: 0x334155,
            strokeColor: 0x475569, hoverStrokeColor: 0x94a3b8,
            textColor: '#cbd5e1', fontSize: '13px', fontStyle: 'bold',
            onClick: guard(() => this.scene.start('MenuScene'))
        });

        // ---- Painel da lista de salas ----
        const listW = Math.min(width - 120, 760);
        const listH = 400;
        const listCard = createSmoothCard(this, centerX, 400, listW, listH, {
            radius: 18, fillColor: 0x0f172a, fillAlpha: 0.95,
            strokeColor: 0x334155, strokeWidth: 1.5
        });

        this.add.text(centerX, 400 - listH / 2 + 26, 'SALAS ABERTAS AGUARDANDO OPONENTE', {
            fontSize: '13px', fill: '#38bdf8', fontStyle: 'bold', letterSpacing: 1.5, resolution: 2
        }).setOrigin(0.5);

        this.rowsContainer = this.add.container(centerX, 400);
        this.emptyText = this.add.text(0, 10, 'Procurando salas...', {
            fontSize: '14px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        this.rowsContainer.add(this.emptyText);
        this.listWidth = listW;

        // ---- Banner de status/erro ----
        this.statusText = createSmoothBanner(this, centerX, 648, '', {
            radius: 14, fillColor: 0x242a35, strokeColor: 0x475569, strokeWidth: 1.5,
            fontSize: '13px', textColor: '#f59e0b', fontStyle: 'bold',
            paddingX: 18, paddingY: 6
        }).setVisible(false);

        // ---- Listener ao vivo das salas ----
        this.roomsRef = ref(db, 'rooms');
        this.roomsUnsubscribe = onValue(this.roomsRef, (snapshot) => {
            this.renderRoomList(this.filterOpenRooms(snapshot.val()));
        }, (err) => {
            console.error('Erro ao listar salas:', err);
            this.emptyText?.setText('❌ Erro ao carregar salas. Verifique sua conexão.');
        });

        // ---- Entrada por código (overlay DOM #join-overlay) ----
        this.handleSubmitRoomCode = (e) => {
            const code = (typeof e.detail === 'object' && e.detail !== null) ? e.detail.roomId : e.detail;
            this.handleJoinRoom(code, { fromCodeOverlay: true });
        };
        window.addEventListener('submit-room-code', this.handleSubmitRoomCode);

        // Esconder o overlay de join se estiver aberto ao entrar na cena
        const overlay = document.getElementById('join-overlay');
        if (overlay) overlay.style.display = 'none';

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (this.roomsUnsubscribe) this.roomsUnsubscribe();
            window.removeEventListener('submit-room-code', this.handleSubmitRoomCode);
        });
    }

    /** Filtra rooms/ → salas públicas com 1 vaga livre, mais recentes primeiro. */
    filterOpenRooms(roomsVal) {
        const now = Date.now();
        return Object.entries(roomsVal || {})
            .filter(([id, r]) => r && typeof r === 'object'
                && r.p1?.nickname && !r.p2?.nickname
                && !r.isTraining && !r.p1?.isBot
                && (r.visibility ?? 'public') === 'public'
                && r.state !== 'in_match' && r.state !== 'closed'
                && !(r.round >= 1)
                && (!r.createdAt || (now - r.createdAt) < MAX_ROOM_AGE_MS))
            .map(([id, r]) => ({ id, host: r.p1.nickname, createdAt: r.createdAt || 0 }))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, MAX_ROWS);
    }

    renderRoomList(rooms) {
        if (!this.rowsContainer) return;
        this.rowsContainer.removeAll(true);

        if (rooms.length === 0) {
            this.emptyText = this.add.text(0, 10, 'Nenhuma sala aberta no momento.\nCrie uma e chame um colega!', {
                fontSize: '14px', fill: '#94a3b8', fontStyle: 'bold', align: 'center',
                lineSpacing: 8, resolution: 2
            }).setOrigin(0.5);
            this.rowsContainer.add(this.emptyText);
            return;
        }

        // Grade de blocos compactos: 3 colunas, ancorada no TOPO do painel
        // (logo abaixo do título da seção), crescendo para baixo.
        const cols = 3;
        const cardW = (this.listWidth - 48 - 2 * 12) / cols; // margem 24/lado + gap 12
        const cardH = 60;
        const gapX = 12;
        const gapY = 10;
        const topY = -(400 / 2) + 50 + cardH / 2; // topo do painel + título + margem

        rooms.forEach((room, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = -((cols * cardW + (cols - 1) * gapX) / 2) + cardW / 2 + col * (cardW + gapX);
            const y = topY + row * (cardH + gapY);

            const ageMin = Math.max(0, Math.floor((Date.now() - room.createdAt) / 60000));
            const ageLabel = ageMin <= 0 ? 'agora' : `há ${ageMin} min`;

            const card = createSmoothButton(this, x, y, cardW, cardH, '', {
                radius: 10, fillColor: 0x16202e, hoverFillColor: 0x1d3a6e,
                strokeColor: 0x334155, hoverStrokeColor: 0x3b82f6,
                textColor: '#e2e8f0', fontSize: '12px', fontStyle: 'bold',
                onClick: () => {
                    if (this.busy || document.body.classList.contains('modal-open')) return;
                    this.handleJoinRoom(room.id);
                }
            });
            card.label?.setText('');

            const hostText = this.add.text(x - cardW / 2 + 12, y - 13, room.host.slice(0, 16), {
                fontSize: '12.5px', fill: '#f8fafc', fontStyle: 'bold', resolution: 2
            }).setOrigin(0, 0.5);
            const subText = this.add.text(x - cardW / 2 + 12, y + 11, `#${room.id}  •  ${ageLabel}`, {
                fontSize: '10.5px', fill: '#94a3b8', resolution: 2
            }).setOrigin(0, 0.5);
            const joinTag = this.add.text(x + cardW / 2 - 10, y, 'ENTRAR ›', {
                fontSize: '11px', fill: '#38bdf8', fontStyle: 'bold', resolution: 2
            }).setOrigin(1, 0.5);

            this.rowsContainer.add([card, hostText, subText, joinTag]);
        });
    }

    showStatus(message, color = '#f59e0b') {
        this.statusText?.setText(message).setStyle({ fill: color }).setVisible(true);
    }

    async handleCreateRoom(visibility) {
        this.busy = true;
        this.showStatus('⏳ Gerando sala no Firebase...', '#facc15');
        const result = await createRoom({ nickname: this.playerNickname, visibility });
        if (!result.success) {
            this.busy = false;
            this.showStatus(`❌ ${result.message}`, '#ef4444');
            return;
        }
        this.scene.start('CharacterSelectScene', {
            roomId: result.roomId,
            playerId: 'p1',
            nickname: this.playerNickname
        });
    }

    async handleJoinRoom(code, { fromCodeOverlay = false } = {}) {
        const errorMsg = document.getElementById('join-error-msg');
        const overlay = document.getElementById('join-overlay');
        const btnSubmitJoin = document.getElementById('btn-submit-join');
        const resetButton = () => {
            if (btnSubmitJoin) {
                btnSubmitJoin.disabled = false;
                btnSubmitJoin.textContent = '🚀 Conectar à Sala';
            }
        };

        this.busy = true;
        this.showStatus(`Buscando sala ${String(code || '').toUpperCase()}...`, '#38bdf8');
        if (fromCodeOverlay && errorMsg) errorMsg.textContent = 'Conectando à sala...';

        const result = await joinRoom({ code, nickname: this.playerNickname });

        this.busy = false;
        if (!result.success) {
            this.showStatus(`❌ ${result.message}`, '#ef4444');
            if (fromCodeOverlay && errorMsg) errorMsg.textContent = `⚠️ ${result.message}`;
            resetButton();
            return;
        }

        if (overlay) overlay.style.display = 'none';
        resetButton();
        this.scene.start('CharacterSelectScene', {
            roomId: result.roomId,
            playerId: result.playerId,
            nickname: this.playerNickname
        });
    }
}
