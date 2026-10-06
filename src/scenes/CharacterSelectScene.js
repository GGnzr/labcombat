import Phaser from 'phaser';
import { db } from '../firebase.js';
import { ref, get, set, update, remove, onValue, serverTimestamp } from "firebase/database";
import { professors, getProfessorById } from '../professors.js';
import { logEvent } from '../logger.js';
import { drawRoundedRect, createSmoothCard, createSmoothButton } from '../ui/smoothUI.js';
import { getRandomArena } from '../arenas.js';
import { loadQuestionBanks } from '../questionBank.js';
import { loadMyLeaderboardEntry, getRankForPoints } from '../ranking.js';
import { SoundManager } from '../audio/SoundManager.js';

export class CharacterSelectScene extends Phaser.Scene {
    constructor() {
        super('CharacterSelectScene');
    }

    init(data) {
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        this.nickname = data.nickname || sessionStorage.getItem('labcombat_nickname') || (this.playerId === 'p1' ? 'Jogador 1' : 'Jogador 2');
        this.selectedProfessorId = data.previousCharacterId || (this.playerId === 'p1' ? 'so' : 'web');
        this.oppProfessorId = this.playerId === 'p1' ? 'web' : 'so';
        this.isLockedIn = false;
        this.hasStarted = false;
        this.isStartingMatch = false;
        this.cards = [];
        this.countdownTargetTime = null;
        this.isCountingDown = false;
        this.isOpponentConnected = false;
        this.serverTimeOffset = 0;
        this.serverOffsetUnsubscribe = null;
    }

    // "Agora" alinhado ao relógio do servidor Firebase,
    // para a contagem regressiva ser sincronizada entre os dois jogadores.
    nowMs() {
        return Date.now() + (this.serverTimeOffset || 0);
    }

    preload() {
        this.load.image('menu_bg', '/assets/campus_veranopolis.jpg');
        
        professors.forEach(p => {
            this.load.atlas(p.atlasKey, p.atlasImage, p.atlasJson);
            this.load.image(p.portraitKey, p.portraitUrl);
        });
    }

    create() {
        SoundManager.startMenuBGM();

        // 1. Fundo do Campus IF Veranópolis com enquadramento focado no pátio dos lutadores
        const width = this.scale.width;
        const centerX = width / 2;

        const bg = this.add.image(centerX, 360, 'menu_bg').setOrigin(0.5);
        const bgScale = Math.max(width / bg.width, 720 / bg.height);
        bg.setScale(bgScale);

        // Overlay suave neutro para manter a luz diurna natural do pátio
        this.add.rectangle(centerX, 360, width, 720, 0x181e26, 0.22);

        // 2. Cabeçalho Superior Arcade Neutro
        this.add.rectangle(centerX, 28, width, 56, 0x242a35, 0.96);
        this.add.line(centerX, 56, 0, 0, width, 0, 0x475569).setLineWidth(1);

        // Botão Sair Suave Arcade
        createSmoothButton(this, 65, 28, 88, 32, '🚪 Sair', {
            radius: 16,
            fillColor: 0x7f1d1d,
            hoverFillColor: 0x991b1b,
            strokeColor: 0xb91c1c,
            fontSize: '12px',
            onClick: () => this.leaveToMenu()
        });

        // Botão de Áudio Mudo / Som (🔊 / 🔇)
        SoundManager.createMuteButton(this, 126, 28);

        // Título Central Arcade
        this.add.text(centerX, 20, 'SELECT YOUR FIGHTER', { 
            fontSize: '20px', fill: '#f59e0b', fontStyle: 'bold', letterSpacing: 3, resolution: 2 
        }).setOrigin(0.5);

        const isHost = this.playerId === 'p1';
        const roleLabel = isHost ? 'HOST (1P)' : 'CHALLENGER (2P)';
        this.add.text(centerX, 42, `VOCÊ É ${this.nickname.toUpperCase()} • ${roleLabel}`, { 
            fontSize: '11px', fill: isHost ? '#60a5fa' : '#f87171', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);

        // Badge de Código da Sala (Canto Superior Direito)
        this.createRoomCodeBadge(width - 145, 28);

        // 3. Palco do Lutador 1 (P1 - Esquerda)
        this.createP1Stage();

        // 4. Emblema Central VS
        this.createVsEmblem();

        // 5. Palco do Lutador 2 (P2 - Direita)
        this.createP2Stage();

        // 6. Roster de Seleção Arcade (Grid Horizontal Inferior)
        this.createArcadeRoster();

        // 7. Rodapé de Ações
        this.createActionFooter();

        // Shutdown cleanup
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (typeof this.roomListener === 'function') {
                this.roomListener();
                this.roomListener = null;
            }
        });

        // 8. Sincronização em Tempo Real com o Firebase
        this.setupFirebaseSync();

        // Inicializa visuais dos dois lutadores
        this.refreshFighterDisplay('p1', isHost ? this.selectedProfessorId : this.oppProfessorId, isHost ? this.nickname : 'Jogador 1', false);
        this.refreshFighterDisplay('p2', !isHost ? this.selectedProfessorId : this.oppProfessorId, !isHost ? this.nickname : 'Aguardando...', false);
        this.updateRosterCursors();
    }

    createRoomCodeBadge(x, y) {
        const badge = createSmoothCard(this, x, y, 226, 36, {
            radius: 18,
            fillColor: 0x242a35,
            fillAlpha: 0.96,
            strokeColor: 0x475569,
            strokeWidth: 1.5
        });

        const lbl = this.add.text(-74, 0, '🔑 SALA:', {
            fontSize: '11px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);

        const codeText = this.add.text(-22, 0, this.roomId, {
            fontSize: '15px', fill: '#f59e0b', fontStyle: 'bold', fontFamily: 'monospace', letterSpacing: 2, resolution: 2
        }).setOrigin(0.5);

        const btnCopy = createSmoothButton(this, 66, 0, 78, 26, '📋 Copiar', {
            radius: 13,
            fillColor: 0x323a48,
            hoverFillColor: 0x3e4758,
            strokeColor: 0x526075,
            textColor: '#f59e0b',
            fontSize: '11px'
        });

        const doCopy = () => {
            const copySuccess = () => {
                btnCopy.setText('✓ Copiado!');
                btnCopy.setColors(0x16a34a, 0x22c55e);
                this.time.delayedCall(2000, () => {
                    if (btnCopy && btnCopy.active) {
                        btnCopy.setText('📋 Copiar');
                        btnCopy.setColors(0x2563eb, 0x38bdf8);
                    }
                });
            };

            const fallbackCopy = (text) => {
                try {
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-999999px";
                    textArea.style.top = "-999999px";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    if (success) copySuccess();
                    else window.prompt('Copie o código da sala (Ctrl+C):', text);
                } catch {
                    window.prompt('Copie o código da sala (Ctrl+C):', text);
                }
            };

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(this.roomId)
                    .then(() => copySuccess())
                    .catch(() => fallbackCopy(this.roomId));
            } else {
                fallbackCopy(this.roomId);
            }
        };

        btnCopy.on('pointerdown', doCopy);
        codeText.setInteractive({ useHandCursor: true }).on('pointerdown', doCopy);

        badge.add([lbl, codeText, btnCopy]);
    }

    createP1Stage() {
        const width = this.scale.width;
        const centerX = width / 2;
        const stageX = Math.max(220, Math.min(centerX - 240, width * 0.20));

        // Card Consolidado do Jogador 1 (com cantos arredondados suaves)
        this.p1BannerBg = createSmoothCard(this, stageX, 120, 380, 108, {
            radius: 16,
            fillColor: 0x242a35,
            fillAlpha: 0.96,
            strokeColor: 0x2563eb,
            strokeWidth: 1.5
        });
        
        // Linha 1: Tag 1P, Nickname e Status
        const tag1PContainer = this.add.container(stageX - 160, 80);
        const tag1PGfx = this.add.graphics();
        drawRoundedRect(tag1PGfx, -13, -9, 26, 18, 5, 0x2563eb, 1, 0xffffff, 1);
        const tag1PTxt = this.add.text(0, 0, '1P', { fontSize: '11px', fill: '#ffffff', fontStyle: 'bold', resolution: 2 }).setOrigin(0.5);
        tag1PContainer.add([tag1PGfx, tag1PTxt]);

        this.p1NickText = this.add.text(stageX - 138, 80, 'JOGADOR 1', { 
            fontSize: '12px', fill: '#ffffff', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0, 0.5);

        this.p1StatusBadge = this.add.text(stageX + 165, 80, 'ESCOLHENDO', {
            fontSize: '10px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2
        }).setOrigin(1, 0.5);

        // Divisória sutil
        this.add.line(stageX, 95, 0, 0, 350, 0, 0x334155).setLineWidth(1);

        // Linha 2: Nome do Lutador Escolhido
        this.p1FighterName = this.add.text(stageX, 114, 'SISTEMAS OPERACIONAIS', { 
            fontSize: '14px', fill: '#60a5fa', fontStyle: 'bold', letterSpacing: 1, resolution: 2 
        }).setOrigin(0.5);

        // Linha 3: Disciplina / Especialidade
        this.p1SubjectText = this.add.text(stageX, 136, 'Threads, Processos & Kernel', { 
            fontSize: '11px', fill: '#94a3b8', resolution: 2 
        }).setOrigin(0.5);

        // Linha 4: Golpe Especial / Ultimate
        this.p1UltimateText = this.add.text(stageX, 158, '', { 
            fontSize: '11px', fill: '#f59e0b', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);

        // Pedestal e Sombra do Lutador no Chão do Pátio Aberto
        const fighterX = centerX - Math.min(235, Math.max(180, width * 0.18));
        const fighterY = 460;
        this.p1Shadow = this.add.ellipse(fighterX, fighterY, 130, 24, 0x000000, 0.45);
        this.p1PadGlow = this.add.ellipse(fighterX, fighterY, 140, 24, 0x2563eb, 0.22);
        this.p1PadRing = this.add.ellipse(fighterX, fighterY, 140, 20).setStrokeStyle(2, 0x2563eb, 0.9);

        // Sprite Estático do Lutador P1 (Pés plantados no chão de pedra do pátio aberto)
        const p1Prof = getProfessorById(this.selectedProfessorId || 'so');
        this.p1Sprite = this.add.sprite(fighterX, fighterY, p1Prof.atlasKey, 'idle')
            .setOrigin(0.5, 1.0)
            .setScale(p1Prof.scale || 0.65);
    }

    createP2Stage() {
        const width = this.scale.width;
        const centerX = width / 2;
        const stageX = Math.min(width - 220, Math.max(centerX + 240, width * 0.80));

        // Card Consolidado do Jogador 2 (com cantos arredondados suaves)
        this.p2BannerBg = createSmoothCard(this, stageX, 120, 380, 108, {
            radius: 16,
            fillColor: 0x242a35,
            fillAlpha: 0.96,
            strokeColor: 0xdc2626,
            strokeWidth: 1.5
        });

        // Linha 1: Status, Nickname e Tag 2P
        this.p2StatusBadge = this.add.text(stageX - 165, 80, 'AGUARDANDO...', {
            fontSize: '10px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2
        }).setOrigin(0, 0.5);

        this.p2NickText = this.add.text(stageX + 138, 80, 'AGUARDANDO P2', { 
            fontSize: '12px', fill: '#ffffff', fontStyle: 'bold', resolution: 2 
        }).setOrigin(1, 0.5);

        const tag2PContainer = this.add.container(stageX + 160, 80);
        const tag2PGfx = this.add.graphics();
        drawRoundedRect(tag2PGfx, -13, -9, 26, 18, 5, 0xdc2626, 1, 0xffffff, 1);
        const tag2PTxt = this.add.text(0, 0, '2P', { fontSize: '11px', fill: '#ffffff', fontStyle: 'bold', resolution: 2 }).setOrigin(0.5);
        tag2PContainer.add([tag2PGfx, tag2PTxt]);

        // Divisória sutil
        this.add.line(stageX, 95, 0, 0, 350, 0, 0x334155).setLineWidth(1);

        // Linha 2: Nome do Lutador Escolhido
        this.p2FighterName = this.add.text(stageX, 114, 'WEB & MOBILE', { 
            fontSize: '14px', fill: '#f87171', fontStyle: 'bold', letterSpacing: 1, resolution: 2 
        }).setOrigin(0.5);

        // Linha 3: Disciplina / Especialidade
        this.p2SubjectText = this.add.text(stageX, 136, 'Frontend, Fullstack & APIs', { 
            fontSize: '11px', fill: '#94a3b8', resolution: 2 
        }).setOrigin(0.5);

        // Linha 4: Golpe Especial / Ultimate
        this.p2UltimateText = this.add.text(stageX, 158, '', { 
            fontSize: '11px', fill: '#f59e0b', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);

        // Pedestal e Sombra do Lutador no Chão do Pátio Aberto
        const fighterX = centerX + Math.min(235, Math.max(180, width * 0.18));
        const fighterY = 460;
        this.p2Shadow = this.add.ellipse(fighterX, fighterY, 130, 24, 0x000000, 0.45);
        this.p2PadGlow = this.add.ellipse(fighterX, fighterY, 140, 24, 0xdc2626, 0.22);
        this.p2PadRing = this.add.ellipse(fighterX, fighterY, 140, 20).setStrokeStyle(2, 0xdc2626, 0.9);

        // Sprite Estático do Lutador P2 (Espelhado, pés plantados no chão de pedra do pátio aberto)
        const p2Prof = getProfessorById(this.oppProfessorId || 'web');
        this.p2Sprite = this.add.sprite(fighterX, fighterY, p2Prof.atlasKey, 'idle')
            .setOrigin(0.5, 1.0)
            .setScale(p2Prof.scale || 0.65)
            .setFlipX(true);
    }

    createVsEmblem() {
        const vsContainer = this.add.container(this.scale.width / 2, 240);

        // Anel decorativo pulsante
        const ring = this.add.ellipse(0, 0, 100, 100).setStrokeStyle(2, 0x1e293b, 0.8);
        const innerRing = this.add.ellipse(0, 0, 84, 84, 0x0f172a, 0.9).setStrokeStyle(1.5, 0x334155);

        // Texto VS em tipografia de jogo de luta (centralizado, sem o texto DUELO 1V1 inferior)
        this.vsText = this.add.text(0, 0, 'VS', { 
            fontSize: '44px', fill: '#f59e0b', fontStyle: 'bold italic', resolution: 2
        }).setOrigin(0.5);
        this.vsText.setShadow(0, 0, '#b45309', 16, true, true);

        vsContainer.add([ring, innerRing, this.vsText]);

        // Pulso suave do VS
        this.tweens.add({
            targets: this.vsText,
            scale: 1.08,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }


    createArcadeRoster() {
        // Container e Moldura do Roster com Cantos Arredondados
        const width = this.scale.width;
        const centerX = width / 2;
        const rosterWidth = Math.min(width - 40, 1040);
        
        const rosterFrame = this.add.graphics();
        drawRoundedRect(rosterFrame, centerX - rosterWidth / 2, 545 - 54, rosterWidth, 108, 18, 0x242a35, 0.95, 0x475569, 1.5);

        this.add.text(centerX, 485, 'ROSTER DE LUTADORES • SELECIONE O SEU PROFESSOR', {
            fontSize: '10px', fill: '#94a3b8', fontStyle: 'bold', letterSpacing: 2, resolution: 2
        }).setOrigin(0.5);

        this.cards = [];
        const spacingX = 174;
        const startX = centerX - (2.5 * spacingX);
        const cardY = 545;

        professors.forEach((prof, idx) => {
            const x = startX + (idx * spacingX);
            const container = this.add.container(x, cardY);

            // Moldura do Card do Personagem (Cantos arredondados suaves radius: 12px)
            const bgGfx = this.add.graphics();
            const drawCardBg = (fColor, fAlpha, sColor, sWidth) => {
                bgGfx.clear();
                drawRoundedRect(bgGfx, -77, -44, 154, 88, 12, fColor, fAlpha, sColor, sWidth);
            };
            drawCardBg(0x2d3544, 0.95, 0x475569, 1.5);

            // Avatar do Professor (Retrato recortado)
            const pScale = prof.portraitScale || 1.0;
            const pOffY = prof.portraitOffsetY || 0;
            const portrait = this.add.image(0, -10 + pOffY, prof.portraitKey).setDisplaySize(56 * pScale, 56 * pScale);

            // Nome Curto
            const nameText = this.add.text(0, 27, prof.shortName.toUpperCase(), { 
                fontSize: '10px', fill: '#cbd5e1', fontStyle: 'bold', align: 'center', wordWrap: { width: 140 }, resolution: 2
            }).setOrigin(0.5);

            // Tag de Cursor 1P (Canto Superior Esquerdo)
            const tag1P = this.add.container(-62, -32);
            const tag1PBg = this.add.graphics();
            drawRoundedRect(tag1PBg, -10, -7, 20, 14, 5, 0x2563eb, 1, 0xffffff, 1);
            const tag1PTxt = this.add.text(0, 0, '1P', { fontSize: '8px', fill: '#ffffff', fontStyle: 'bold', resolution: 2 }).setOrigin(0.5);
            tag1P.add([tag1PBg, tag1PTxt]);
            tag1P.setVisible(false);

            // Tag de Cursor 2P (Canto Superior Direito)
            const tag2P = this.add.container(62, -32);
            const tag2PBg = this.add.graphics();
            drawRoundedRect(tag2PBg, -10, -7, 20, 14, 5, 0xdc2626, 1, 0xffffff, 1);
            const tag2PTxt = this.add.text(0, 0, '2P', { fontSize: '8px', fill: '#ffffff', fontStyle: 'bold', resolution: 2 }).setOrigin(0.5);
            tag2P.add([tag2PBg, tag2PTxt]);
            tag2P.setVisible(false);

            container.add([bgGfx, portrait, nameText, tag1P, tag2P]);

            container.setSize(154, 88);
            container.setInteractive({ useHandCursor: true });

            container.on('pointerover', () => {
                SoundManager.playHover();
                this.tweens.add({ targets: container, scale: 1.05, duration: 80, ease: 'Power1' });
            });
            container.on('pointerout', () => {
                this.tweens.add({ targets: container, scale: 1.0, duration: 80, ease: 'Power1' });
            });

            container.on('pointerdown', () => {
                SoundManager.playClick();
                if (this.isLockedIn) {
                    this.cancelSelection();
                }
                this.selectedProfessorId = prof.id;
                this.updateRosterCursors();
                
                const isHost = this.playerId === 'p1';
                this.refreshFighterDisplay(isHost ? 'p1' : 'p2', prof.id, this.nickname, false);
                this.syncSelectionToFirebase();

                // Punchy visual kick ao trocar de personagem
                const targetSprite = isHost ? this.p1Sprite : this.p2Sprite;
                if (targetSprite) {
                    const baseFighterScale = prof.scale || 0.65;
                    this.tweens.add({
                        targets: targetSprite,
                        scaleX: baseFighterScale * 1.15,
                        scaleY: baseFighterScale * 1.15,
                        duration: 70,
                        yoyo: true,
                        ease: 'Power2',
                        onComplete: () => {
                            targetSprite.setScale(baseFighterScale);
                        }
                    });
                }
            });

            this.cards.push({ id: prof.id, container, drawCardBg, nameText, tag1P, tag2P, prof });
        });

        this.updateRosterCursors();
    }

    updateRosterCursors() {
        const isHost = this.playerId === 'p1';
        const p1Id = isHost ? this.selectedProfessorId : this.oppProfessorId;
        const p2Id = isHost ? this.oppProfessorId : this.selectedProfessorId;

        this.cards.forEach(c => {
            const isP1 = c.id === p1Id;
            const isP2 = c.id === p2Id;

            c.tag1P.setVisible(isP1);
            c.tag2P.setVisible(isP2);

            if (isP1 && isP2) {
                c.drawCardBg(0x4c1d95, 0.95, 0xa855f7, 2);
                c.nameText.setStyle({ fill: '#e9d5ff' });
            } else if (isP1) {
                c.drawCardBg(0x1e3a8a, 0.92, 0x3b82f6, 2);
                c.nameText.setStyle({ fill: '#bfdbfe' });
            } else if (isP2) {
                c.drawCardBg(0x7f1d1d, 0.92, 0xef4444, 2);
                c.nameText.setStyle({ fill: '#fecaca' });
            } else {
                c.drawCardBg(0x2d3544, 0.95, 0x475569, 1.5);
                c.nameText.setStyle({ fill: '#cbd5e1' });
            }
        });
    }

    refreshFighterDisplay(side, profId, nickname, isReady) {
        const prof = getProfessorById(profId);
        if (!prof) return;

        const isMe = (side === this.playerId);
        // O jogador local está sempre online no seu próprio cliente;
        // O oponente depende do status de conexão remota (isOpponentConnected)
        const isOnline = isMe ? true : this.isOpponentConnected;

        const formatNick = (nick, fallback) => {
            if (!nick) return fallback;
            const clean = nick.toUpperCase();
            return clean.length > 16 ? clean.substring(0, 15) + '…' : clean;
        };

        if (side === 'p1') {
            if (this.p1Sprite) {
                this.p1Sprite.setTexture(prof.atlasKey, 'idle');
                this.p1Sprite.setScale(prof.scale || 0.65); // Aspect ratio fixed
                if (isOnline) {
                    this.p1Sprite.setAlpha(1);
                    this.p1Sprite.clearTint();
                } else {
                    this.p1Sprite.setAlpha(0.35);
                    this.p1Sprite.setTint(0x000000);
                }
            }
            if (this.p1FighterName) {
                this.p1FighterName.setText(isOnline ? prof.shortName.toUpperCase() : 'OPONENTE 1P');
                this.p1FighterName.setStyle({ fill: isOnline ? prof.color : '#64748b' });
            }
            if (this.p1SubjectText) {
                if (isOnline) {
                    this.p1SubjectText.setText(prof.subject);
                    this.p1SubjectText.setStyle({ fill: '#94a3b8' });
                } else {
                    this.p1SubjectText.setText('Aguardando Host...');
                    this.p1SubjectText.setStyle({ fill: '#64748b' });
                }
            }
            // Especial: nome não é mais exibido na seleção (design pedido)
            if (this.p1UltimateText) {
                this.p1UltimateText.setText('');
                this.p1UltimateText.setVisible(false);
            }
            if (this.p1NickText) {
                const badge = isOnline ? this.rankLabels?.p1 : null;
                const plain = formatNick(nickname, isOnline ? 'JOGADOR 1' : 'AGUARDANDO P1');
                this.p1NickText.setText(badge ? `${badge} ${plain}` : plain);
            }
            if (this.p1StatusBadge) {
                if (!isOnline) {
                    this.p1StatusBadge.setText('📡 OFFLINE');
                    this.p1StatusBadge.setStyle({ fill: '#ef4444' });
                } else {
                    this.p1StatusBadge.setText(isReady ? '🟢 PRONTO' : '⏳ ESCOLHENDO');
                    this.p1StatusBadge.setStyle({ fill: isReady ? '#4ade80' : '#94a3b8' });
                }
            }
            if (this.p1BannerBg) {
                this.p1BannerBg.setStrokeStyle(isReady ? 2.5 : 1.5, isReady ? 0x16a34a : 0x2563eb);
            }
        } else {
            if (this.p2Sprite) {
                this.p2Sprite.setTexture(prof.atlasKey, 'idle');
                this.p2Sprite.setScale(prof.scale || 0.65); // Aspect ratio fixed
                this.p2Sprite.setFlipX(true);
                if (isOnline) {
                    this.p2Sprite.setAlpha(1);
                    this.p2Sprite.clearTint();
                } else {
                    this.p2Sprite.setAlpha(0.35);
                    this.p2Sprite.setTint(0x000000);
                }
            }
            if (this.p2FighterName) {
                this.p2FighterName.setText(isOnline ? prof.shortName.toUpperCase() : 'OPONENTE 2P');
                this.p2FighterName.setStyle({ fill: isOnline ? prof.color : '#64748b' });
            }
            if (this.p2SubjectText) {
                if (isOnline) {
                    this.p2SubjectText.setText(prof.subject);
                    this.p2SubjectText.setStyle({ fill: '#94a3b8' });
                } else {
                    this.p2SubjectText.setText(`Código da Sala: ${this.roomId}`);
                    this.p2SubjectText.setStyle({ fill: '#64748b' });
                }
            }
            // Especial: nome não é mais exibido na seleção (design pedido)
            if (this.p2UltimateText) {
                this.p2UltimateText.setText('');
                this.p2UltimateText.setVisible(false);
            }
            if (this.p2NickText) {
                const badge = isOnline ? this.rankLabels?.p2 : null;
                const plain = formatNick(nickname, isOnline ? 'JOGADOR 2' : 'AGUARDANDO P2');
                this.p2NickText.setText(badge ? `${badge} ${plain}` : plain);
            }
            if (this.p2StatusBadge) {
                if (!isOnline) {
                    this.p2StatusBadge.setText('📡 OFFLINE');
                    this.p2StatusBadge.setStyle({ fill: '#ef4444' });
                } else {
                    this.p2StatusBadge.setText(isReady ? '🟢 PRONTO' : '⏳ ESCOLHENDO');
                    this.p2StatusBadge.setStyle({ fill: isReady ? '#4ade80' : '#94a3b8' });
                }
            }
            if (this.p2BannerBg && typeof this.p2BannerBg.setCardStyle === 'function') {
                this.p2BannerBg.setCardStyle(0x242a35, 0.96, isReady ? 0x16a34a : 0xdc2626, isReady ? 2.5 : 1.5);
            }
        }
    }


    createActionFooter() {
        const width = this.scale.width;
        const centerX = width / 2;
        const footY = 665;

        // Botão Principal de Confirmação (Arcade Lock-In) - Cápsula Suave
        this.btnConfirm = createSmoothButton(this, centerX, footY, 360, 44, '⚔️ CONFIRMAR PROFESSOR (LOCK IN)', {
            radius: 22,
            fillColor: 0x16a34a,
            hoverFillColor: 0x15803d,
            strokeColor: 0x22c55e,
            strokeWidth: 2,
            fontSize: '14px',
            onClick: () => this.confirmSelection()
        });

        // Container de Estado Pronto (quando o jogador confirmar)
        this.readyBadgeContainer = createSmoothCard(this, centerX - 70, footY, 320, 42, {
            radius: 21,
            fillColor: 0x064e3b,
            fillAlpha: 0.95,
            strokeColor: 0x16a34a,
            strokeWidth: 1.5
        }).setVisible(false);
        this.readyTxt = this.add.text(0, 0, '🟢 VOCÊ ESTÁ PRONTO!', {
            fontSize: '13px', fill: '#4ade80', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        this.readyBadgeContainer.add(this.readyTxt);

        // Botão de Cancelar / Trocar Professor (Posicionado sem sobrepor o banner)
        this.btnCancel = createSmoothButton(this, centerX + 180, footY, 130, 42, '↩️ Trocar', {
            radius: 21,
            fillColor: 0x991b1b,
            hoverFillColor: 0xb91c1c,
            strokeColor: 0xef4444,
            strokeWidth: 1.5,
            fontSize: '12px',
            onClick: () => this.cancelSelection()
        }).setVisible(false);

        // Banner Central de Contagem Regressiva (Posicionado sem sobrepor o botão trocar)
        this.countdownBanner = createSmoothCard(this, centerX - 70, footY, 360, 42, {
            radius: 21,
            fillColor: 0x78350f,
            fillAlpha: 0.95,
            strokeColor: 0xf59e0b,
            strokeWidth: 1.5
        }).setVisible(false);
        this.countdownTxt = this.add.text(0, 0, '', {
            fontSize: '13px', fill: '#f59e0b', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        this.countdownBanner.add(this.countdownTxt);

        // Botão Dev Solo (Canto Inferior Direito)
        this.btnSolo = createSmoothButton(this, width - 95, 665, 115, 32, '⚡ Iniciar Solo', {
            radius: 16,
            fillColor: 0x323a48,
            hoverFillColor: 0x3e4758,
            strokeColor: 0x526075,
            textColor: '#cbd5e1',
            fontSize: '11px',
            onClick: () => this.forceStartMatch()
        });
    }

    setupFirebaseSync() {
        const roomRef = ref(db, `rooms/${this.roomId}`);
        
        // Envia a escolha inicial
        this.syncSelectionToFirebase();

        // Badge de elo na seleção: grava MINHA etiqueta de elo no nó da sala
        // para o oponente ver (só contas logadas aparecem no ranking)
        const myUid = localStorage.getItem('labcombat_account_uid');
        if (myUid && sessionStorage.getItem('labcombat_access_mode') !== 'guest') {
            loadMyLeaderboardEntry(myUid).then(({ entry }) => {
                if (!entry) return;
                const rank = getRankForPoints(entry.points || 0);
                update(ref(db, `rooms/${this.roomId}/${this.playerId}`), {
                    rankLabel: `${rank.icon}${rank.division ? ' ' + rank.division : ''}`
                }).catch(() => {});
            }).catch(() => {});
        }

        // Offset do relógio do servidor para sincronizar a contagem de início da partida
        this.serverOffsetUnsubscribe = onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
            this.serverTimeOffset = snap.val() || 0;
        });

        this.roomListener = onValue(roomRef, (snap) => {
            const data = snap.val();
            if (!data || data.state === 'closed') {
                if (typeof this.serverOffsetUnsubscribe === 'function') {
                    this.serverOffsetUnsubscribe();
                    this.serverOffsetUnsubscribe = null;
                }
                if (typeof this.roomListener === 'function') {
                    this.roomListener();
                    this.roomListener = null;
                }
                sessionStorage.removeItem('labcombat_room_id');
                sessionStorage.removeItem('labcombat_player_id');
                this.scene.start('MenuScene');
                return;
            }

            const isHost = this.playerId === 'p1';
            const oppKey = isHost ? 'p2' : 'p1';
            const oppData = data[oppKey];
            const myKey = this.playerId;
            const myData = data[myKey];

            this.isOpponentConnected = !!oppData;
            // Etiquetas de elo (quando os jogadores têm conta ranqueada)
            this.rankLabels = { p1: data.p1?.rankLabel || null, p2: data.p2?.rankLabel || null };

            if (oppData) {
                this.oppProfessorId = oppData.characterId || (oppKey === 'p1' ? 'so' : 'web');
                const oppNick = oppData.nickname || (oppKey === 'p1' ? 'Jogador 1' : 'Jogador 2');
                this.refreshFighterDisplay(oppKey, this.oppProfessorId, oppNick, !!oppData.ready);
            } else {
                this.refreshFighterDisplay(oppKey, oppKey === 'p1' ? 'so' : 'web', 'Aguardando...', false);
            }

            if (myData) {
                const myNick = myData.nickname || this.nickname;
                this.refreshFighterDisplay(myKey, this.selectedProfessorId, myNick, !!myData.ready);
            }

            this.updateRosterCursors();

            // Gerenciamento de Contagem Regressiva Sincronizada
            const p1Ready = data.p1 && data.p1.ready;
            const p2Ready = data.p2 && data.p2.ready;

            if (p1Ready && p2Ready) {
                // PRÉ-CARREGA o catálogo assim que os dois dão pronto (por
                // professor — trocar personagem muda os ids e aquece outros
                // bancos; o cache de questionBank.js é por banco, não por sala)
                if (!this.catalogPreloadStarted) {
                    this.catalogPreloadStarted = true;
                    this.getQuestionPool().catch(() => {});
                }
                if (data.countdownStartTime) {
                    this.countdownTargetTime = data.countdownStartTime;
                    this.isCountingDown = true;
                } else if (isHost) {
                    const countdownDelay = parseInt(localStorage.getItem('dev_start_delay'), 10) || 10;
                    const targetTime = this.nowMs() + (countdownDelay * 1000);
                    this.countdownTargetTime = targetTime;
                    this.isCountingDown = true;
                    update(roomRef, { countdownStartTime: targetTime }).catch(e => console.error(e));
                }
            } else {
                this.isCountingDown = false;
                this.countdownTargetTime = null;
                this.catalogPreloadStarted = false;

                if (data.countdownStartTime && isHost) {
                    update(roomRef, { countdownStartTime: null }).catch(() => {});
                }

                if (this.countdownBanner) this.countdownBanner.setVisible(false);

                if (this.isLockedIn) {
                    if (this.readyBadgeContainer) this.readyBadgeContainer.setVisible(true);
                    if (this.btnCancel) this.btnCancel.setVisible(true);
                    if (this.btnConfirm) this.btnConfirm.setVisible(false);
                }
            }

            // Iniciar combate se rodada ativa for criada
            if (data.state !== 'character_select' && data.round && data.round >= 1 && !this.hasStarted) {
                this.startGame(data.arenaId);
            }
        });
    }

    syncSelectionToFirebase() {
        if (!this.roomId || !this.playerId) return;
        const playerRef = ref(db, `rooms/${this.roomId}/${this.playerId}`);
        update(playerRef, {
            characterId: this.selectedProfessorId,
            nickname: this.nickname
        }).catch(e => console.error(e));
    }

    confirmSelection() {
        if (this.isLockedIn) return;
        this.isLockedIn = true;
        SoundManager.playClick();

        logEvent('game', `[Sala ${this.roomId}] ${this.nickname} (${this.playerId.toUpperCase()}) marcou PRONTO!`);

        this.btnConfirm.setVisible(false);
        if (this.readyBadgeContainer) this.readyBadgeContainer.setVisible(true);
        if (this.btnCancel) this.btnCancel.setVisible(true);

        const playerRef = ref(db, `rooms/${this.roomId}/${this.playerId}`);
        update(playerRef, {
            characterId: this.selectedProfessorId,
            nickname: this.nickname,
            ready: true
        }).catch(e => console.error(e));
    }

    cancelSelection() {
        if (!this.isLockedIn) return;
        this.isLockedIn = false;
        this.isCountingDown = false;
        this.countdownTargetTime = null;
        SoundManager.playClick();

        logEvent('game', `[Sala ${this.roomId}] ${this.nickname} (${this.playerId.toUpperCase()}) cancelou prontidão.`);

        if (this.countdownBanner) this.countdownBanner.setVisible(false);
        if (this.readyBadgeContainer) this.readyBadgeContainer.setVisible(false);
        if (this.btnCancel) this.btnCancel.setVisible(false);
        if (this.btnConfirm) this.btnConfirm.setVisible(true);

        const playerRef = ref(db, `rooms/${this.roomId}/${this.playerId}`);
        const roomRef = ref(db, `rooms/${this.roomId}`);

        update(playerRef, { ready: false }).catch(e => console.error(e));
        update(roomRef, { countdownStartTime: null }).catch(e => console.error(e));
    }

    async getQuestionPool() {
        const professorIds = [this.selectedProfessorId, this.oppProfessorId].filter(Boolean);
        return loadQuestionBanks(professorIds);
    }

    async forceStartMatch() {
        if (this.hasStarted || this.isStartingMatch) return;
        this.isStartingMatch = true;

        logEvent('game', `[Sala ${this.roomId}] Forçando início de partida solo.`);

        const questionPool = await this.getQuestionPool();
        if (questionPool.length === 0) {
            this.isStartingMatch = false;
            this.statusText?.setText('❌ O GM ainda não publicou questões para estes professores.').setVisible(true);
            return;
        }
        const randomQ = questionPool[Math.floor(Math.random() * questionPool.length)];
        const roomRef = ref(db, `rooms/${this.roomId}`);
        
        let devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10);
        if (!devStartDelay || devStartDelay === 30) devStartDelay = 10;
        const devQuestionLimit = parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;

        const randomArena = getRandomArena();
        update(roomRef, {
            arenaId: randomArena.id,
            [`${this.playerId}/characterId`]: this.selectedProfessorId,
            [`${this.playerId}/nickname`]: this.nickname,
            'p1/hp': 100, 'p1/charges': 0, 'p1/hasShield': false, 'p1/hasTryCatch': false,
            'p1/answered': false, 'p1/answeredAt': null, 'p1/answerCorrect': null,
            'p2/hp': 100, 'p2/charges': 0, 'p2/hasShield': false, 'p2/hasTryCatch': false,
            'p2/answered': false, 'p2/answeredAt': null, 'p2/answerCorrect': null,
            state: 'in_match',
            round: 1,
            roundModifier: 'normal',
            roundResolved: false,
            matchStartDelay: devStartDelay,
            questionTimeLimit: devQuestionLimit,
            currentQuestionId: randomQ.id,
            questionStartedAt: serverTimestamp(),
            countdownStartTime: null,
            matchStartTime: null
        }).then(() => {
            this.startGame(randomArena.id);
        }).catch(() => {
            this.startGame(randomArena.id);
        });
    }

    startGame(arenaId = null) {
        if (this.hasStarted) return;
        this.hasStarted = true;
        this.isStartingMatch = true;

        logEvent('game', `[Sala ${this.roomId}] Batalha iniciada! Carregando arena...`);

        if (typeof this.serverOffsetUnsubscribe === 'function') {
            this.serverOffsetUnsubscribe();
            this.serverOffsetUnsubscribe = null;
        }
        if (typeof this.roomListener === 'function') {
            this.roomListener();
            this.roomListener = null;
        }
        const chosenArena = arenaId || getRandomArena().id;
        this.scene.start('MainScene', { 
            roomId: this.roomId, 
            playerId: this.playerId, 
            nickname: this.nickname,
            arenaId: chosenArena
        });
    }

    leaveToMenu() {
        if (typeof this.serverOffsetUnsubscribe === 'function') {
            this.serverOffsetUnsubscribe();
            this.serverOffsetUnsubscribe = null;
        }
        if (typeof this.roomListener === 'function') {
            this.roomListener();
            this.roomListener = null;
        }
        if (this.roomId) {
            if (this.playerId === 'p1') {
                logEvent('room', `[Sala ${this.roomId}] Host abandonou a seleção. Sala removida do Firebase.`);
                remove(ref(db, `rooms/${this.roomId}`)).catch(() => {});
            } else {
                logEvent('room', `[Sala ${this.roomId}] Jogador 2 abandonou a seleção.`);
                remove(ref(db, `rooms/${this.roomId}/p2`)).catch(() => {});
                update(ref(db, `rooms/${this.roomId}`), { countdownStartTime: null }).catch(() => {});
            }
        }
        sessionStorage.removeItem('labcombat_room_id');
        sessionStorage.removeItem('labcombat_player_id');
        this.scene.start('MenuScene');
    }

    async update() {
        if (this.hasStarted) return;

        if (this.isCountingDown && this.countdownTargetTime) {
            const remaining = Math.ceil((this.countdownTargetTime - this.nowMs()) / 1000);
            const centerX = this.scale.width / 2;
            const footY = 665;

            if (remaining > 0) {
                if (this.lastCountdownRemaining !== remaining) {
                    this.lastCountdownRemaining = remaining;
                    SoundManager.playTick();
                }
                if (this.readyBadgeContainer) this.readyBadgeContainer.setVisible(false);
                if (this.btnConfirm) this.btnConfirm.setVisible(false);
                if (this.countdownBanner) {
                    this.countdownBanner.setPosition(centerX - 70, footY);
                    this.countdownTxt.setText(`⚡ COMBATE INICIA EM: ${remaining}s... PREPARE-SE!`);
                    this.countdownBanner.setVisible(true);
                }
                if (this.btnCancel) {
                    this.btnCancel.setPosition(centerX + 180, footY);
                    this.btnCancel.setVisible(true);
                }
            } else {
                if (this.lastCountdownRemaining !== 0) {
                    this.lastCountdownRemaining = 0;
                    SoundManager.playFight();
                }
                if (this.btnCancel) this.btnCancel.setVisible(false);
                if (this.countdownBanner) {
                    this.countdownBanner.setPosition(centerX, footY);
                    this.countdownTxt.setText('⚔️ LUTEM! CARREGANDO ARENA...');
                    if (typeof this.countdownBanner.setCardStyle === 'function') {
                        this.countdownBanner.setCardStyle(0x15803d, 0.95, 0x22c55e, 1.5);
                    }
                }
                if (this.playerId === 'p1' && !this.isStartingMatch) {
                    this.isStartingMatch = true;
                    const questionPool = await this.getQuestionPool();
                    if (questionPool.length === 0) {
                        this.isStartingMatch = false;
                        this.statusText?.setText('❌ O GM ainda não publicou questões para estes professores.').setVisible(true);
                        return;
                    }
                    const randomQ = questionPool[Math.floor(Math.random() * questionPool.length)];
                    const randomArena = getRandomArena();
                    const roomRef = ref(db, `rooms/${this.roomId}`);

                    let devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10);
                    if (!devStartDelay || devStartDelay === 30) devStartDelay = 10;
                    const devQuestionLimit = parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;

                    update(roomRef, {
                        'p1/hp': 100, 'p1/charges': 0, 'p1/hasShield': false, 'p1/hasTryCatch': false,
                        'p1/answered': false, 'p1/answeredAt': null, 'p1/answerCorrect': null,
                        'p2/hp': 100, 'p2/charges': 0, 'p2/hasShield': false, 'p2/hasTryCatch': false,
                        'p2/answered': false, 'p2/answeredAt': null, 'p2/answerCorrect': null,
                        state: 'in_match',
                        round: 1,
                        roundModifier: 'normal',
                        roundResolved: false,
                        matchStartDelay: devStartDelay,
                        questionTimeLimit: devQuestionLimit,
                        currentQuestionId: randomQ.id,
                        questionStartedAt: Date.now(),
                        countdownStartTime: null,
                        matchStartTime: null,
                        arenaId: randomArena.id
                    }).then(() => {
                        this.startGame(randomArena.id);
                    }).catch(e => {
                        console.error(e);
                        this.startGame(randomArena.id);
                    });
                }
            }
        }
    }
}
