import Phaser from 'phaser';
import { db } from '../firebase.js';
import { ref, get, set, update, remove, onValue } from "firebase/database";
import { professors, getProfessorById } from '../professors.js';
import { questions } from '../questions.js';
import { logEvent } from '../logger.js';

export class CharacterSelectScene extends Phaser.Scene {
    constructor() {
        super('CharacterSelectScene');
    }

    init(data) {
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        this.nickname = data.nickname || sessionStorage.getItem('labcombat_nickname') || localStorage.getItem('labcombat_nickname') || (this.playerId === 'p1' ? 'Jogador 1' : 'Jogador 2');
        this.selectedProfessorId = data.previousCharacterId || (this.playerId === 'p1' ? 'so' : 'web');
        this.oppProfessorId = this.playerId === 'p1' ? 'web' : 'so';
        this.isLockedIn = false;
        this.hasStarted = false;
        this.cards = [];
        this.countdownTargetTime = null;
        this.isCountingDown = false;
        this.isOpponentConnected = false;
    }

    preload() {
        this.load.image('arena_bg', '/assets/bg.jpg');
        
        professors.forEach(p => {
            this.load.atlas(p.atlasKey, p.atlasImage, p.atlasJson);
            this.load.image(p.portraitKey, p.portraitUrl);
        });
    }

    create() {
        // 1. Fundo da Arena com Overlay Escuro Estilo Fighting Game
        const bg = this.add.image(512, 288, 'arena_bg').setOrigin(0.5);
        bg.setDisplaySize(1024, 576);
        this.add.rectangle(512, 288, 1024, 576, 0x050814, 0.82);

        // Piso cibernético dos lutadores
        this.add.line(512, 355, 0, 0, 1024, 0, 0x1e293b).setLineWidth(2);
        this.add.line(512, 355, 0, 0, 600, 0, 0x38bdf8).setLineWidth(1).setAlpha(0.6);

        // 2. Cabeçalho Superior Arcade
        this.add.rectangle(512, 24, 1024, 48, 0x070c18, 0.95);
        this.add.line(512, 48, 0, 0, 1024, 0, 0x1e293b).setLineWidth(1);

        // Botão Sair
        this.add.text(55, 24, '🚪 Sair', { 
            fontSize: '13px', fill: '#fff', backgroundColor: '#991b1b', 
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 6, bottom: 6, left: 12, right: 12 }, fontStyle: 'bold' 
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', function() { this.setStyle({ backgroundColor: '#b91c1c' }); })
            .on('pointerout', function() { this.setStyle({ backgroundColor: '#991b1b' }); })
            .on('pointerdown', () => this.leaveToMenu());

        // Título Central Arcade
        this.add.text(480, 16, 'SELECT YOUR FIGHTER', { 
            fontSize: '18px', fill: '#38bdf8', fontStyle: 'bold', letterSpacing: 3 
        }).setOrigin(0.5);

        const isHost = this.playerId === 'p1';
        const roleLabel = isHost ? 'HOST (1P)' : 'CHALLENGER (2P)';
        this.add.text(480, 36, `VOCÊ É ${this.nickname.toUpperCase()} • ${roleLabel}`, { 
            fontSize: '11px', fill: isHost ? '#34d399' : '#f87171', fontStyle: 'bold' 
        }).setOrigin(0.5);

        // Badge de Código da Sala (Canto Superior Direito)
        this.createRoomCodeBadge(895, 24);

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
        const badge = this.add.container(x, y);

        const bg = this.add.rectangle(0, 0, 220, 36, 0x0f172a, 0.95)
            .setStrokeStyle(1.5, 0x38bdf8);

        const lbl = this.add.text(-72, 0, '🔑 SALA:', {
            fontSize: '11px', fill: '#94a3b8', fontStyle: 'bold',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif'
        }).setOrigin(0.5);

        const codeText = this.add.text(-22, 0, this.roomId, {
            fontSize: '16px', fill: '#facc15', fontStyle: 'bold', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5);

        const btnCopy = this.add.text(62, 0, '📋 Copiar', {
            fontSize: '11px', fill: '#ffffff', backgroundColor: '#2563eb',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 5, bottom: 5, left: 8, right: 8 }, fontStyle: 'bold'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        btnCopy.on('pointerover', () => {
            if (btnCopy.text.includes('Copiar')) btnCopy.setStyle({ backgroundColor: '#1d4ed8' });
        });
        btnCopy.on('pointerout', () => {
            if (btnCopy.text.includes('Copiar')) btnCopy.setStyle({ backgroundColor: '#2563eb' });
        });

        const doCopy = () => {
            const copySuccess = () => {
                btnCopy.setText('✓ Copiado!');
                btnCopy.setStyle({ backgroundColor: '#16a34a' });
                this.time.delayedCall(2000, () => {
                    if (btnCopy && btnCopy.active) {
                        btnCopy.setText('📋 Copiar');
                        btnCopy.setStyle({ backgroundColor: '#2563eb' });
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

        badge.add([bg, lbl, codeText, btnCopy]);
    }

    createP1Stage() {
        const stageX = 180;

        // Card Consolidado do Jogador 1 (Topo esquerdo do palco, sem sobrepor o lutador)
        this.p1BannerBg = this.add.rectangle(stageX, 100, 340, 98, 0x0c1527, 0.95).setStrokeStyle(1.5, 0x10b981);
        
        // Linha 1: Tag 1P, Nickname e Status
        this.add.rectangle(stageX - 144, 66, 26, 18, 0x10b981).setStrokeStyle(1, 0xffffff);
        this.add.text(stageX - 144, 66, '1P', { fontSize: '11px', fill: '#000000', fontStyle: 'bold' }).setOrigin(0.5);

        this.p1NickText = this.add.text(stageX - 124, 66, 'JOGADOR 1', { 
            fontSize: '12px', fill: '#ffffff', fontStyle: 'bold' 
        }).setOrigin(0, 0.5);

        this.p1StatusBadge = this.add.text(stageX + 152, 66, 'ESCOLHENDO', {
            fontSize: '10px', fill: '#64748b', fontStyle: 'bold'
        }).setOrigin(1, 0.5);

        // Divisória sutil
        this.add.line(stageX, 79, 0, 0, 316, 0, 0x1e293b).setLineWidth(1);

        // Linha 2: Nome do Lutador Escolhido
        this.p1FighterName = this.add.text(stageX, 95, 'SISTEMAS OPERACIONAIS', { 
            fontSize: '14px', fill: '#34d399', fontStyle: 'bold', letterSpacing: 1 
        }).setOrigin(0.5);

        // Linha 3: Disciplina / Especialidade
        this.p1SubjectText = this.add.text(stageX, 115, 'Threads, Processos & Kernel', { 
            fontSize: '11px', fill: '#94a3b8' 
        }).setOrigin(0.5);

        // Linha 4: Golpe Especial / Ultimate
        this.p1UltimateText = this.add.text(stageX, 134, '⚡ KERNEL PANIC (TELA AZUL)', { 
            fontSize: '11px', fill: '#facc15', fontStyle: 'bold' 
        }).setOrigin(0.5);

        // Pedestal e Glow no Piso (Área da Arena Livre)
        this.p1PadGlow = this.add.ellipse(stageX, 355, 140, 26, 0x10b981, 0.25);
        this.p1PadRing = this.add.ellipse(stageX, 355, 130, 20).setStrokeStyle(2, 0x10b981, 0.9);

        // Sprite Estático do Lutador P1 (Pés no pedestal, cabeça abaixo do card superior)
        this.p1Sprite = this.add.image(stageX, 355, 'prof_so_idle')
            .setOrigin(0.5, 1.0)
            .setDisplaySize(110, 185);
    }

    createP2Stage() {
        const stageX = 844;

        // Card Consolidado do Jogador 2 (Topo direito do palco, sem sobrepor o lutador)
        this.p2BannerBg = this.add.rectangle(stageX, 100, 340, 98, 0x0c1527, 0.95).setStrokeStyle(1.5, 0xef4444);

        // Linha 1: Status, Nickname e Tag 2P
        this.p2StatusBadge = this.add.text(stageX - 152, 66, 'AGUARDANDO...', {
            fontSize: '10px', fill: '#64748b', fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        this.p2NickText = this.add.text(stageX + 124, 66, 'AGUARDANDO P2', { 
            fontSize: '12px', fill: '#ffffff', fontStyle: 'bold' 
        }).setOrigin(1, 0.5);

        this.add.rectangle(stageX + 144, 66, 26, 18, 0xef4444).setStrokeStyle(1, 0xffffff);
        this.add.text(stageX + 144, 66, '2P', { fontSize: '11px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        // Divisória sutil
        this.add.line(stageX, 79, 0, 0, 316, 0, 0x1e293b).setLineWidth(1);

        // Linha 2: Nome do Lutador Escolhido
        this.p2FighterName = this.add.text(stageX, 95, 'WEB & MOBILE', { 
            fontSize: '14px', fill: '#f87171', fontStyle: 'bold', letterSpacing: 1 
        }).setOrigin(0.5);

        // Linha 3: Disciplina / Especialidade
        this.p2SubjectText = this.add.text(stageX, 115, 'Frontend, Fullstack & APIs', { 
            fontSize: '11px', fill: '#94a3b8' 
        }).setOrigin(0.5);

        // Linha 4: Golpe Especial / Ultimate
        this.p2UltimateText = this.add.text(stageX, 134, '⚡ 404 NOT FOUND (CORS ERROR)', { 
            fontSize: '11px', fill: '#facc15', fontStyle: 'bold' 
        }).setOrigin(0.5);

        // Pedestal e Glow no Piso (Área da Arena Livre)
        this.p2PadGlow = this.add.ellipse(stageX, 355, 140, 26, 0xef4444, 0.25);
        this.p2PadRing = this.add.ellipse(stageX, 355, 130, 20).setStrokeStyle(2, 0xef4444, 0.9);

        // Sprite Estático do Lutador P2 (Espelhado)
        this.p2Sprite = this.add.image(stageX, 355, 'prof_web_idle')
            .setOrigin(0.5, 1.0)
            .setDisplaySize(110, 185)
            .setFlipX(true);
    }

    createVsEmblem() {
        const vsContainer = this.add.container(512, 195);

        // Anel decorativo pulsante
        const ring = this.add.ellipse(0, 0, 100, 100).setStrokeStyle(2, 0x1e293b, 0.8);
        const innerRing = this.add.ellipse(0, 0, 84, 84, 0x0f172a, 0.9).setStrokeStyle(1.5, 0x334155);

        // Texto VS em tipografia de jogo de luta (centralizado, sem o texto DUELO 1V1 inferior)
        this.vsText = this.add.text(0, 0, 'VS', { 
            fontSize: '44px', fill: '#facc15', fontStyle: 'bold italic' 
        }).setOrigin(0.5);
        this.vsText.setShadow(0, 0, '#ea580c', 16, true, true);

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
        // Container e Moldura do Roster
        this.add.rectangle(512, 420, 680, 96, 0x070c18, 0.92).setStrokeStyle(1.5, 0x1e293b);

        this.add.text(512, 380, 'ROSTER DE LUTADORES • SELECIONE O SEU PROFESSOR', {
            fontSize: '10px', fill: '#64748b', fontStyle: 'bold', letterSpacing: 2
        }).setOrigin(0.5);

        this.cards = [];
        const startX = 247;
        const spacingX = 106;
        const cardY = 428;

        professors.forEach((prof, idx) => {
            const x = startX + (idx * spacingX);
            const container = this.add.container(x, cardY);

            // Moldura do Card do Personagem (88x72)
            const bg = this.add.rectangle(0, 0, 94, 74, 0x0f172a, 0.95)
                .setStrokeStyle(1.5, 0x334155)
                .setInteractive({ useHandCursor: true });

            // Avatar do Professor
            const maskShape = this.add.graphics();
            maskShape.fillRect(x - 47, cardY - 37, 94, 74);
            const portrait = this.add.sprite(0, 20, prof.atlasKey, 'idle').setScale(0.42);
            portrait.setMask(maskShape.createGeometryMask());

            // Nome Curto
            const nameText = this.add.text(0, 24, prof.shortName.toUpperCase(), { 
                fontSize: '9px', fill: '#e2e8f0', fontStyle: 'bold', align: 'center', wordWrap: { width: 90 }
            }).setOrigin(0.5);

            // Tag de Cursor 1P (Canto Superior Esquerdo)
            const tag1P = this.add.container(-35, -26);
            const tag1PBg = this.add.rectangle(0, 0, 20, 14, 0x10b981).setStrokeStyle(1, 0xffffff);
            const tag1PTxt = this.add.text(0, 0, '1P', { fontSize: '8px', fill: '#000000', fontStyle: 'bold' }).setOrigin(0.5);
            tag1P.add([tag1PBg, tag1PTxt]);
            tag1P.setVisible(false);

            // Tag de Cursor 2P (Canto Superior Direito)
            const tag2P = this.add.container(35, -26);
            const tag2PBg = this.add.rectangle(0, 0, 20, 14, 0xef4444).setStrokeStyle(1, 0xffffff);
            const tag2PTxt = this.add.text(0, 0, '2P', { fontSize: '8px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
            tag2P.add([tag2PBg, tag2PTxt]);
            tag2P.setVisible(false);

            container.add([bg, portrait, nameText, tag1P, tag2P]);

            bg.on('pointerover', () => {
                this.tweens.add({ targets: container, scale: 1.05, duration: 80, ease: 'Power1' });
            });
            bg.on('pointerout', () => {
                this.tweens.add({ targets: container, scale: 1.0, duration: 80, ease: 'Power1' });
            });

            bg.on('pointerdown', () => {
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
                    this.tweens.add({
                        targets: targetSprite,
                        scaleX: 1.15,
                        scaleY: 1.15,
                        duration: 70,
                        yoyo: true,
                        ease: 'Power2'
                    });
                }
            });

            this.cards.push({ id: prof.id, container, bg, nameText, tag1P, tag2P, prof });
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
                c.bg.setStrokeStyle(2.5, 0xa855f7); // Destaque roxo se ambos escolherem o mesmo
                c.bg.setFillStyle(0x1e1b4b, 0.95);
                c.nameText.setStyle({ fill: '#c084fc' });
            } else if (isP1) {
                c.bg.setStrokeStyle(2, 0x10b981); // Destaque verde P1
                c.bg.setFillStyle(0x064e3b, 0.7);
                c.nameText.setStyle({ fill: '#34d399' });
            } else if (isP2) {
                c.bg.setStrokeStyle(2, 0xef4444); // Destaque vermelho P2
                c.bg.setFillStyle(0x7f1d1d, 0.7);
                c.nameText.setStyle({ fill: '#f87171' });
            } else {
                c.bg.setStrokeStyle(1.5, 0x334155);
                c.bg.setFillStyle(0x0f172a, 0.95);
                c.nameText.setStyle({ fill: '#94a3b8' });
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
            return clean.length > 12 ? clean.substring(0, 11) + '…' : clean;
        };

        if (side === 'p1') {
            if (this.p1Sprite) {
                this.p1Sprite.setTexture(prof.atlasKey, 'idle');
                this.p1Sprite.setScale(0.55); // Aspect ratio fixed
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
            if (this.p1UltimateText) {
                if (isOnline) {
                    this.p1UltimateText.setText(`⚡ ${prof.ultimateName}`);
                    this.p1UltimateText.setVisible(true);
                } else {
                    this.p1UltimateText.setText('');
                    this.p1UltimateText.setVisible(false);
                }
            }
            if (this.p1NickText) {
                this.p1NickText.setText(formatNick(nickname, isOnline ? 'JOGADOR 1' : 'AGUARDANDO P1'));
            }
            if (this.p1StatusBadge) {
                if (!isOnline) {
                    this.p1StatusBadge.setText('📡 OFFLINE');
                    this.p1StatusBadge.setStyle({ fill: '#ef4444' });
                } else {
                    this.p1StatusBadge.setText(isReady ? '🟢 PRONTO' : '⏳ ESCOLHENDO');
                    this.p1StatusBadge.setStyle({ fill: isReady ? '#34d399' : '#94a3b8' });
                }
            }
            if (this.p1BannerBg) {
                this.p1BannerBg.setStrokeStyle(isReady ? 2.5 : 1.5, isReady ? 0x22c55e : 0x10b981);
            }
        } else {
            if (this.p2Sprite) {
                this.p2Sprite.setTexture(prof.atlasKey, 'idle');
                this.p2Sprite.setScale(0.55); // Aspect ratio fixed
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
            if (this.p2UltimateText) {
                if (isOnline) {
                    this.p2UltimateText.setText(`⚡ ${prof.ultimateName}`);
                    this.p2UltimateText.setVisible(true);
                } else {
                    this.p2UltimateText.setText('⚡ AGUARDANDO OPONENTE');
                    this.p2UltimateText.setVisible(true);
                }
            }
            if (this.p2NickText) {
                this.p2NickText.setText(formatNick(nickname, isOnline ? 'JOGADOR 2' : 'AGUARDANDO P2'));
            }
            if (this.p2StatusBadge) {
                if (!isOnline) {
                    this.p2StatusBadge.setText('📡 OFFLINE');
                    this.p2StatusBadge.setStyle({ fill: '#ef4444' });
                } else {
                    this.p2StatusBadge.setText(isReady ? '🟢 PRONTO' : '⏳ ESCOLHENDO');
                    this.p2StatusBadge.setStyle({ fill: isReady ? '#34d399' : '#94a3b8' });
                }
            }
            if (this.p2BannerBg) {
                this.p2BannerBg.setStrokeStyle(isReady ? 2.5 : 1.5, isReady ? 0x22c55e : 0xef4444);
            }
        }
    }


    createActionFooter() {
        const footY = 516;

        // Botão Principal de Confirmação (Arcade Lock-In)
        this.btnConfirm = this.add.text(512, footY, '⚔️ CONFIRMAR PROFESSOR (LOCK IN)', { 
            fontSize: '15px', fill: '#ffffff', backgroundColor: '#16a34a', 
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 10, bottom: 10, left: 32, right: 32 }, fontStyle: 'bold' 
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => this.btnConfirm.setStyle({ backgroundColor: '#15803d' }))
            .on('pointerout', () => this.btnConfirm.setStyle({ backgroundColor: '#16a34a' }))
            .on('pointerdown', () => this.confirmSelection());

        // Container de Estado Pronto (quando o jogador confirmar)
        this.readyBadgeContainer = this.add.container(430, footY).setVisible(false);
        this.readyBg = this.add.rectangle(0, 0, 310, 38, 0x064e3b, 0.95).setStrokeStyle(1.5, 0x10b981);
        this.readyTxt = this.add.text(0, 0, '🟢 VOCÊ ESTÁ PRONTO!', {
            fontSize: '13px', fill: '#34d399', fontStyle: 'bold',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif'
        }).setOrigin(0.5);
        this.readyBadgeContainer.add([this.readyBg, this.readyTxt]);

        // Botão de Cancelar / Trocar Professor
        this.btnCancel = this.add.text(640, footY, '↩️ Trocar', {
            fontSize: '12px', fill: '#ffffff', backgroundColor: '#991b1b',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 9, bottom: 9, left: 16, right: 16 }, fontStyle: 'bold'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setVisible(false)
            .on('pointerover', () => this.btnCancel.setStyle({ backgroundColor: '#b91c1c' }))
            .on('pointerout', () => this.btnCancel.setStyle({ backgroundColor: '#991b1b' }))
            .on('pointerdown', () => this.cancelSelection());

        // Banner Central de Contagem Regressiva
        this.countdownBanner = this.add.text(512, footY, '', {
            fontSize: '14px', fill: '#facc15', backgroundColor: '#78350f',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 9, bottom: 9, left: 24, right: 24 }, fontStyle: 'bold'
        }).setOrigin(0.5).setVisible(false);

        // Botão Dev Solo (Canto Inferior Direito)
        this.btnSolo = this.add.text(955, 545, '⚡ Iniciar Solo', {
            fontSize: '10px', fill: '#94a3b8', backgroundColor: '#1e293b',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            padding: { top: 5, bottom: 5, left: 8, right: 8 }, fontStyle: 'bold'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => this.btnSolo.setStyle({ backgroundColor: '#334155', fill: '#f1f5f9' }))
            .on('pointerout', () => this.btnSolo.setStyle({ backgroundColor: '#1e293b', fill: '#94a3b8' }))
            .on('pointerdown', () => this.forceStartMatch());
    }

    setupFirebaseSync() {
        const roomRef = ref(db, `rooms/${this.roomId}`);
        
        // Envia a escolha inicial
        this.syncSelectionToFirebase();

        this.roomListener = onValue(roomRef, (snap) => {
            const data = snap.val();
            if (!data || data.state === 'closed') {
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
                if (data.countdownStartTime) {
                    this.countdownTargetTime = data.countdownStartTime;
                    this.isCountingDown = true;
                } else if (isHost) {
                    const countdownDelay = parseInt(localStorage.getItem('dev_start_delay'), 10) || 5;
                    const targetTime = Date.now() + (countdownDelay * 1000);
                    this.countdownTargetTime = targetTime;
                    this.isCountingDown = true;
                    update(roomRef, { countdownStartTime: targetTime }).catch(e => console.error(e));
                }
            } else {
                this.isCountingDown = false;
                this.countdownTargetTime = null;

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
            if (data.round && data.round >= 1 && !this.hasStarted) {
                this.startGame();
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

    forceStartMatch() {
        if (this.hasStarted) return;
        this.hasStarted = true;

        logEvent('game', `[Sala ${this.roomId}] Forçando início de partida solo.`);

        const randomQ = questions[Math.floor(Math.random() * questions.length)];
        const roomRef = ref(db, `rooms/${this.roomId}`);
        
        let devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10);
        if (!devStartDelay || devStartDelay === 30) devStartDelay = 3;
        const devQuestionLimit = parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;

        update(roomRef, {
            [`${this.playerId}/characterId`]: this.selectedProfessorId,
            [`${this.playerId}/nickname`]: this.nickname,
            'p1/hp': 100, 'p1/charges': 0, 'p1/hasShield': false, 'p1/hasTryCatch': false,
            'p1/answered': false, 'p1/answeredAt': null, 'p1/answerCorrect': null,
            'p2/hp': 100, 'p2/charges': 0, 'p2/hasShield': false, 'p2/hasTryCatch': false,
            'p2/answered': false, 'p2/answeredAt': null, 'p2/answerCorrect': null,
            round: 1,
            roundModifier: 'normal',
            roundResolved: false,
            matchStartDelay: devStartDelay,
            questionTimeLimit: devQuestionLimit,
            currentQuestionId: randomQ.id,
            questionStartedAt: Date.now(),
            countdownStartTime: null,
            matchStartTime: null
        }).then(() => {
            this.startGame();
        }).catch(() => {
            this.startGame();
        });
    }

    startGame() {
        if (this.hasStarted) return;
        this.hasStarted = true;

        logEvent('game', `[Sala ${this.roomId}] Batalha iniciada! Carregando arena...`);

        if (typeof this.roomListener === 'function') {
            this.roomListener();
            this.roomListener = null;
        }
        this.scene.start('MainScene', { roomId: this.roomId, playerId: this.playerId, nickname: this.nickname });
    }

    leaveToMenu() {
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

    update() {
        if (this.hasStarted) return;

        if (this.isCountingDown && this.countdownTargetTime) {
            const remaining = Math.ceil((this.countdownTargetTime - Date.now()) / 1000);

            if (remaining > 0) {
                if (this.readyBadgeContainer) this.readyBadgeContainer.setVisible(false);
                if (this.btnConfirm) this.btnConfirm.setVisible(false);
                if (this.countdownBanner) {
                    this.countdownBanner.setText(`⚡ COMBATE INICIA EM: ${remaining}s... PREPARE-SE!`).setVisible(true);
                }
                if (this.btnCancel) this.btnCancel.setVisible(true);
            } else {
                if (this.countdownBanner) {
                    this.countdownBanner.setText('⚔️ LUTEM! CARREGANDO ARENA...').setStyle({ backgroundColor: '#15803d' });
                }
                if (this.btnCancel) this.btnCancel.setVisible(false);

                if (this.playerId === 'p1' && !this.hasStarted) {
                    this.hasStarted = true;
                    const randomQ = questions[Math.floor(Math.random() * questions.length)];
                    const roomRef = ref(db, `rooms/${this.roomId}`);

                    let devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10);
                    if (!devStartDelay || devStartDelay === 30) devStartDelay = 3;
                    const devQuestionLimit = parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;

                    update(roomRef, {
                        'p1/hp': 100, 'p1/charges': 0, 'p1/hasShield': false, 'p1/hasTryCatch': false,
                        'p1/answered': false, 'p1/answeredAt': null, 'p1/answerCorrect': null,
                        'p2/hp': 100, 'p2/charges': 0, 'p2/hasShield': false, 'p2/hasTryCatch': false,
                        'p2/answered': false, 'p2/answeredAt': null, 'p2/answerCorrect': null,
                        round: 1,
                        roundModifier: 'normal',
                        roundResolved: false,
                        matchStartDelay: devStartDelay,
                        questionTimeLimit: devQuestionLimit,
                        currentQuestionId: randomQ.id,
                        questionStartedAt: Date.now(),
                        countdownStartTime: null,
                        matchStartTime: null
                    }).then(() => {
                        this.startGame();
                    }).catch(e => {
                        console.error(e);
                        this.startGame();
                    });
                } else if (this.playerId === 'p2' && !this.hasStarted) {
                    this.time.delayedCall(400, () => {
                        if (!this.hasStarted) this.startGame();
                    });
                }
            }
        }
    }
}
