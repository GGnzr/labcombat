import Phaser from 'phaser';
import { ref, set, onValue, get, update, remove } from 'firebase/database';
import { db } from '../firebase.js';
import { questions } from '../questions.js';
import { professors, getProfessorById } from '../professors.js';
import { arenas, getArenaById, getRandomArena } from '../arenas.js';
import { drawRoundedRect, createSmoothCard, createSmoothButton, createSmoothBanner } from '../ui/smoothUI.js';
import { SoundManager } from '../audio/SoundManager.js';

export class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        let devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10);
        if (!devStartDelay || devStartDelay === 30) devStartDelay = 3;
        const devQuestionLimit = parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;
        this.QUESTION_TIME_LIMIT = devQuestionLimit;
        this.MATCH_START_DELAY = devStartDelay;
    }

    preload() {
        arenas.forEach(a => {
            this.load.image(a.key, a.image);
        });
        professors.forEach(p => {
            this.load.atlas(p.atlasKey, p.atlasImage, p.atlasJson);
            this.load.image(p.portraitKey, p.portraitUrl);
        });
    }

    init(data) {
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        this.nickname = data.nickname || sessionStorage.getItem('labcombat_nickname') || localStorage.getItem('labcombat_nickname') || (this.playerId === 'p1' ? 'Jogador 1' : 'Jogador 2');
        this.arenaId = data?.arenaId || getRandomArena().id;
        this.currentArenaId = this.arenaId;
        this.isWaitingForOpponent = true;
        
        // Reset flags so they don't leak between reconnects
        this.isGameOver = false;
        this.hasAnsweredLocal = false;
        this.currentQuestionData = null;
        this.optionButtons = [];
        this.isLeaving = false;
        this.localQuestionStartTime = null;
        this.targetMatchStartTime = null;
        this.lastProcessedQuestionId = null;
        this.lastProcessedRound = null;
        this.previousData = null;
        this.isAdvancingQuestion = false;
        this.currentRound = 0;
        this.roomUnsubscribe = null;

        // Propriedades do Novo Sistema de Combate
        this.p1CurrentHp = 100;
        this.p2CurrentHp = 100;
        this.p1CurrentCharges = 0;
        this.p2CurrentCharges = 0;
        this.currentRoundModifier = 'normal';
        this.isResolvingRound = false;
        this.isExecutingFinisher = false;

        // Flags de áudio: garantem que FIGHT e K.O. toquem exatamente uma vez por partida
        this.hasPlayedFightFanfare = false;
        this.hasPlayedKOSound = false;

        const devQuestionLimit = parseInt(localStorage.getItem('dev_question_limit'), 10) || 15;
        this.QUESTION_TIME_LIMIT = devQuestionLimit;
        const devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10);
        this.MATCH_START_DELAY = (devStartDelay && devStartDelay !== 30) ? devStartDelay : 3;

        if (this.nextQuestionTimeout) {
            clearTimeout(this.nextQuestionTimeout);
            this.nextQuestionTimeout = null;
        }
    }

    create() {
        // 0. Base de cor sólida cobrindo todo o canvas 1024x576
        const width = this.scale.width;
        const centerX = width / 2;

        this.add.rectangle(centerX, 360, width, 720, 0x181e26);

        // 1. Fundo da Arena (RESTRITO EXCLUSIVAMENTE à parte superior onde ficam os personagens: y=0 a y=330)
        // NÃO fica atrás das questões de forma alguma!
        const currentArena = getArenaById(this.arenaId);
        const arenaBg = this.add.image(centerX, 215, currentArena.key);
        arenaBg.setDisplaySize(width, 720);
        this.arenaBg = arenaBg;
        
        // Máscara geométrica para confinar o fundo da arena rigorosamente na área dos personagens
        const arenaMaskGfx = this.make.graphics();
        arenaMaskGfx.fillStyle(0xffffff);
        arenaMaskGfx.fillRect(0, 0, width, 430);
        const arenaMask = arenaMaskGfx.createGeometryMask();
        arenaBg.setMask(arenaMask);

        // Overlay suave para integrar o fundo da arena
        const arenaOverlay = this.add.rectangle(centerX, 215, width, 430, 0x000000, 0.15);
        arenaOverlay.setMask(arenaMask);

        // 2. Barra Superior Unificada (HUD Header Neutro Arcade)
        this.add.rectangle(centerX, 28, width, 56, 0x242a35, 0.96);
        this.add.line(centerX, 56, 0, 0, width, 0, 0x475569).setLineWidth(1);

        // Botão Sair da Sala Retrô Suave
        createSmoothButton(this, 65, 28, 88, 32, '🚪 Sair', {
            radius: 16,
            fillColor: 0x7f1d1d,
            hoverFillColor: 0x991b1b,
            strokeColor: 0xb91c1c,
            fontSize: '12px',
            onClick: () => this.leaveRoom()
        });

        // Botão de Áudio Mudo / Som (🔊 / 🔇)
        SoundManager.createMuteButton(this, 126, 28);

        // Título centralizado Arcade Gold
        this.add.text(centerX, 20, 'LABCOMBAT', { 
            fontSize: '17px', fill: '#f59e0b', fontStyle: 'bold', letterSpacing: 2, resolution: 2
        }).setOrigin(0.5);

        // Status da partida
        this.statusText = this.add.text(centerX, 43, 'Conectando...', { 
            fontSize: '11px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);

        // 3. Painéis dos Jogadores - Fighter HUD Cards (P1 à esquerda, P2 à direita)
        // 3. Painéis dos Jogadores - Fighter HUD Cards Responsivos (P1 à esquerda, P2 à direita)
        // Largura adaptativa: garante que em telas 4:3, 16:9 ou ultrawide os cards NUNCA se sobreponham
        const maxCardWidth = Math.min(540, Math.floor((width - 40) / 2));
        const cardWidth = Math.max(360, maxCardWidth);
        const p1CardX = Math.min(centerX - cardWidth / 2 - 10, Math.max(16 + cardWidth / 2, centerX - 345));
        const p2CardX = Math.max(centerX + cardWidth / 2 + 10, Math.min(width - 16 - cardWidth / 2, centerX + 345));

        const p1Left = p1CardX - cardWidth / 2;
        const p1Right = p1CardX + cardWidth / 2;
        const p1ContentX = p1Left + 84;

        const p2Left = p2CardX - cardWidth / 2;
        const p2Right = p2CardX + cardWidth / 2;
        const p2ContentX = p2Right - 84;

        this.hpBarFullWidth = cardWidth - 102;

        // === CARD P1 (JOGADOR 1 - ESQUERDA) ===
        this.p1PanelBg = createSmoothCard(this, p1CardX, 110, cardWidth, 92, {
            radius: 18,
            fillColor: 0x242a35,
            fillAlpha: 0.96,
            strokeColor: 0x2563eb,
            strokeWidth: 1.5
        });
        
        // Avatar / Retrato do Professor P1 (Posicionado diretamente sobre o card, sem borda interna)
        this.p1Portrait = this.add.image(p1Left + 42, 110, getProfessorById(this.p1Data?.characterId || 'so').portraitKey).setDisplaySize(64, 64);

        // Linha 1: Nickname, Disciplina e HP Numérico (y = 82)
        this.p1NickText = this.add.text(p1ContentX, 82, 'JOGADOR 1', { 
            fontSize: '13px', fill: '#ffffff', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0, 0.5);

        this.p1ProfText = this.add.text(p1ContentX + 120, 82, '• SISTEMAS OP.', { 
            fontSize: '11px', fill: '#93c5fd', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0, 0.5);

        this.p1HpText = this.add.text(p1Right - 15, 82, '100 HP', {
            fontSize: '12px', fill: '#4ade80', fontStyle: 'bold', resolution: 2
        }).setOrigin(1, 0.5);

        // Linha 2: Barra de HP P1 (y = 105)
        this.p1HpBarBg = this.add.rectangle(p1ContentX, 105, this.hpBarFullWidth, 14, 0x1e2430).setStrokeStyle(1, 0x475569).setOrigin(0, 0.5);
        this.p1HpBarFill = this.add.rectangle(p1ContentX, 105, this.hpBarFullWidth, 14, 0x16a34a).setOrigin(0, 0.5);

        // Linha 3: Medidor de Cargas e Buffs P1 (y = 130)
        this.p1ChargeSlots = [];
        this.p1SlotTexts = [];
        for (let s = 0; s < 3; s++) {
            const slotBg = this.add.rectangle(p1ContentX + 14 + (s * 36), 130, 28, 16, 0x1e2430).setStrokeStyle(1, 0x475569);
            const slotTxt = this.add.text(p1ContentX + 14 + (s * 36), 130, '⚡', {
                fontSize: '10px', fill: '#64748b', fontStyle: 'bold', resolution: 2
            }).setOrigin(0.5);
            this.p1ChargeSlots.push(slotBg);
            this.p1SlotTexts.push(slotTxt);
        }
        this.p1ChargeLabel = this.add.text(p1ContentX + 120, 130, 'ESPECIAL: 0/3', {
            fontSize: '10px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2
        }).setOrigin(0, 0.5);
        this.p1BuffIcons = this.add.text(p1Right - 15, 130, '', {
            fontSize: '11px', fontStyle: 'bold', resolution: 2
        }).setOrigin(1, 0.5);

        // Aliases para compatibilidade
        this.p1NameText = this.p1NickText;
        this.p1HeartsText = this.p1HpText;
        this.p1Text = this.p1NickText;
        this.p1Thermometer = this.add.graphics();


        // === CARD P2 (JOGADOR 2 - DIREITA) ===
        this.p2PanelBg = createSmoothCard(this, p2CardX, 110, cardWidth, 92, {
            radius: 18,
            fillColor: 0x242a35,
            fillAlpha: 0.96,
            strokeColor: 0xdc2626,
            strokeWidth: 1.5
        });

        // Avatar / Retrato do Professor P2 (Posicionado diretamente sobre o card, espelhado, sem borda interna)
        this.p2Portrait = this.add.image(p2Right - 42, 110, getProfessorById(this.p2Data?.characterId || 'web').portraitKey).setDisplaySize(64, 64).setFlipX(true);

        // Linha 1: HP Numérico, Disciplina e Nickname (y = 82)
        this.p2HpText = this.add.text(p2Left + 15, 82, '100 HP', {
            fontSize: '12px', fill: '#f87171', fontStyle: 'bold', resolution: 2
        }).setOrigin(0, 0.5);

        this.p2ProfText = this.add.text(p2ContentX - 120, 82, 'WEB & MOBILE •', { 
            fontSize: '11px', fill: '#fca5a5', fontStyle: 'bold', resolution: 2 
        }).setOrigin(1, 0.5);

        this.p2NickText = this.add.text(p2ContentX, 82, 'JOGADOR 2', { 
            fontSize: '13px', fill: '#ffffff', fontStyle: 'bold', resolution: 2 
        }).setOrigin(1, 0.5);

        // Linha 2: Barra de HP P2 (y = 105)
        this.p2HpBarBg = this.add.rectangle(p2ContentX, 105, this.hpBarFullWidth, 14, 0x1e2430).setStrokeStyle(1, 0x475569).setOrigin(1, 0.5);
        this.p2HpBarFill = this.add.rectangle(p2ContentX, 105, this.hpBarFullWidth, 14, 0x16a34a).setOrigin(1, 0.5);

        // Linha 3: Buffs, Label de Especial e Medidor de Cargas P2 (y = 130)
        this.p2BuffIcons = this.add.text(p2Left + 15, 130, '', {
            fontSize: '11px', fontStyle: 'bold', resolution: 2
        }).setOrigin(0, 0.5);

        this.p2ChargeLabel = this.add.text(p2ContentX - 120, 130, 'ESPECIAL: 0/3', {
            fontSize: '10px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2
        }).setOrigin(1, 0.5);

        this.p2ChargeSlots = [];
        this.p2SlotTexts = [];
        for (let s = 0; s < 3; s++) {
            const slotBg = this.add.rectangle(p2ContentX - 14 - (s * 36), 130, 28, 16, 0x1e2430).setStrokeStyle(1, 0x475569);
            const slotTxt = this.add.text(p2ContentX - 14 - (s * 36), 130, '⚡', {
                fontSize: '10px', fill: '#64748b', fontStyle: 'bold', resolution: 2
            }).setOrigin(0.5);
            this.p2ChargeSlots.push(slotBg);
            this.p2SlotTexts.push(slotTxt);
        }

        // Aliases para compatibilidade
        this.p2NameText = this.p2NickText;
        this.p2HeartsText = this.p2HpText;
        this.p2Text = this.p2NickText;
        this.p2Thermometer = this.add.graphics();

        // 4. Personagens e Bases de Combate (Ficam firmes no piso da arena superior)
        // P1 Fighter
        const fighter1X = Math.max(280, centerX - 320);
        this.fighterP1 = this.add.container(fighter1X, 340);
        const p1Shadow = this.add.ellipse(0, 68, 130, 28, 0x000000, 0.5);
        const p1PadRing = this.add.ellipse(0, 68, 120, 24).setStrokeStyle(2, 0x2563eb, 0.9);
        const p1PadGlow = this.add.ellipse(0, 68, 105, 20, 0x2563eb, 0.25);
        
        // Sprite Estático do Professor P1 (sem animação)
        const p1Prof = getProfessorById(this.p1Data?.characterId || 'so');
        this.fighterP1Sprite = this.add.sprite(0, 68, p1Prof.atlasKey, 'idle')
            .setOrigin(0.5, 1.0)
            .setScale(p1Prof.scale || 0.65);

        this.fighterP1.add([p1Shadow, p1PadRing, p1PadGlow, this.fighterP1Sprite]);
        this.fighterP1.originalX = fighter1X;

        // P2 Fighter
        const fighter2X = Math.min(width - 280, centerX + 320);
        this.fighterP2 = this.add.container(fighter2X, 340);
        const p2Shadow = this.add.ellipse(0, 68, 130, 28, 0x000000, 0.5);
        const p2PadRing = this.add.ellipse(0, 68, 120, 24).setStrokeStyle(2, 0xdc2626, 0.9);
        const p2PadGlow = this.add.ellipse(0, 68, 105, 20, 0xdc2626, 0.25);

        // Sprite Estático do Professor P2 (sem animação, espelhado para encarar o P1)
        const p2Prof = getProfessorById(this.p2Data?.characterId || 'web');
        this.fighterP2Sprite = this.add.sprite(0, 68, p2Prof.atlasKey, 'idle')
            .setOrigin(0.5, 1.0)
            .setScale(p2Prof.scale || 0.65)
            .setFlipX(true);

        this.fighterP2.add([p2Shadow, p2PadRing, p2PadGlow, this.fighterP2Sprite]);
        this.fighterP2.originalX = fighter2X;

        // 5. Linha Divisória de Alta Tecnologia entre a Arena e o Terminal
        // A arena fica restrita acima de y=330. O terminal fica em y=330 a 576 com fundo 100% SÓLIDO!
        this.add.rectangle(centerX, 430, width, 4, 0x181e26);
        this.add.line(centerX, 430, 0, 0, width, 0, 0x475569).setLineWidth(2);

        // Fundo 100% SÓLIDO do Terminal de Questões (NENHUMA parte do fundo da arena fica atrás!)
        this.add.rectangle(centerX, 575, width, 290, 0x1a202c);

        // Moldura interna do Terminal Arcade Neutro com cantos arredondados suaves
        const termWidth = width - 32;
        const termGfx = this.add.graphics();
        drawRoundedRect(termGfx, centerX - termWidth / 2, 437, termWidth, 276, 18, 0x242a35, 0.98, 0x475569, 1.5);

        // Faixa de cabeçalho do terminal
        const termHeaderGfx = this.add.graphics();
        drawRoundedRect(termHeaderGfx, centerX - termWidth / 2, 437, termWidth, 34, 14, 0x2d3544, 0.95, 0x475569, 1);

        this.add.text(35, 454, '💻 TERMINAL DE COMBATE', { 
            fontSize: '11px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2,
            padding: { top: 4, bottom: 4, left: 6, right: 6 }
        }).setOrigin(0, 0.5);

        // Cronômetro integrado perfeitamente ao cabeçalho (Cápsula Suave)
        const timerContainer = createSmoothCard(this, centerX, 454, 160, 26, {
            radius: 13,
            fillColor: 0x1e2430,
            strokeColor: 0xf59e0b,
            strokeWidth: 1.2
        });
        this.timerText = this.add.text(0, 0, '⏱️ Tempo: --', { 
            fontSize: '12px', fill: '#f59e0b', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5);
        timerContainer.add(this.timerText);

        this.arenaIndicatorText = this.add.text(width - 45, 454, `🏟️ ${currentArena.name.toUpperCase()}`, {
            fontSize: '10px', fill: '#94a3b8', fontStyle: 'bold', resolution: 2
        }).setOrigin(1, 0.5);

        // Badge Modificador de Questão (Topo da Pergunta - Suave e Arredondado)
        this.roundModifierBadge = createSmoothBanner(this, centerX, 480, '', {
            radius: 12,
            fontSize: '11px',
            textColor: '#f59e0b',
            fontStyle: 'bold',
            paddingX: 14,
            paddingY: 4
        }).setVisible(false);

        // Enunciado da questão (centralizado com leitura nítida e sem fundo poluído)
        this.questionText = this.add.text(centerX, 506, '', { 
            fontSize: '15px', fill: '#f8fafc', align: 'center', 
            wordWrap: { width: Math.min(width - 80, 1180) }, fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);

        // Botões de opções modernos e suaves com cantos arredondados
        const btnWidth = Math.min(width - 60, 1210);
        const btnHeight = 36;
        this.optionButtons = [];
        for (let i = 0; i < 4; i++) {
            const btn = this.add.container(centerX, 548 + (i * 40));
            
            // Fundo arredondado suave (radius: 12px)
            const bgGfx = this.add.graphics();
            const drawBtnBg = (fColor = 0x2d3544, sColor = 0x475569, sWidth = 1.5) => {
                bgGfx.clear();
                drawRoundedRect(bgGfx, -btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 12, fColor, 0.96, sColor, sWidth);
            };
            drawBtnBg(0x2d3544, 0x475569, 1.5);

            // Badge com letra A, B, C, D com cantos arredondados
            const badgeGfx = this.add.graphics();
            drawRoundedRect(badgeGfx, -btnWidth / 2 + 10, -11, 24, 22, 6, 0x202734, 1, 0x475569, 1);
            const badgeTxt = this.add.text(-btnWidth / 2 + 22, 0, String.fromCharCode(65 + i), {
                fontSize: '11px', fill: '#f59e0b', fontStyle: 'bold', resolution: 2
            }).setOrigin(0.5);

            // Texto da opção
            const labelTxt = this.add.text(-btnWidth / 2 + 44, 0, '', {
                fontSize: '13px', fill: '#ffffff', fontStyle: 'bold', resolution: 2
            }).setOrigin(0, 0.5);

            btn.add([bgGfx, badgeGfx, badgeTxt, labelTxt]);

            btn.setSize(btnWidth, btnHeight);
            btn.setInteractive({ useHandCursor: true });

            btn.text = '';
            btn.setText = (txt) => {
                btn.text = txt;
                let cleanTxt = txt;
                if (/^[A-D]\)\s*/.test(txt)) {
                    cleanTxt = txt.replace(/^[A-D]\)\s*/, '');
                }
                labelTxt.setText(cleanTxt);
                return btn;
            };

            btn.setStyle = (styleObj) => {
                if (styleObj.fill) labelTxt.setStyle({ fill: styleObj.fill });
                if (styleObj.backgroundColor) {
                    const bg = styleObj.backgroundColor;
                    if (bg === '#16a34a' || bg === 0x16a34a) {
                        drawBtnBg(0x14532d, 0x22c55e, 2);
                        badgeGfx.clear();
                        drawRoundedRect(badgeGfx, -btnWidth / 2 + 10, -11, 24, 22, 6, 0x16a34a, 1, 0x22c55e, 1);
                        badgeTxt.setStyle({ fill: '#ffffff' });
                    } else if (bg === '#dc2626' || bg === '#ef4444' || bg === 0xdc2626) {
                        drawBtnBg(0x7f1d1d, 0xef4444, 2);
                        badgeGfx.clear();
                        drawRoundedRect(badgeGfx, -btnWidth / 2 + 10, -11, 24, 22, 6, 0xdc2626, 1, 0xef4444, 1);
                        badgeTxt.setStyle({ fill: '#ffffff' });
                    } else if (bg === '#374151' || bg === '#334155') {
                        drawBtnBg(0x2d3544, 0xd97706, 2);
                    } else {
                        drawBtnBg(0x2d3544, 0x475569, 1.5);
                        badgeGfx.clear();
                        drawRoundedRect(badgeGfx, -btnWidth / 2 + 10, -11, 24, 22, 6, 0x202734, 1, 0x475569, 1);
                        badgeTxt.setStyle({ fill: '#f59e0b' });
                    }
                }
                return btn;
            };

            btn.on('pointerover', () => {
                if (!this.hasAnsweredLocal && !this.isGameOver && btn.input && btn.input.enabled) {
                    drawBtnBg(0x374151, 0x60a5fa, 2);
                    this.tweens.add({ targets: btn, scaleX: 1.01, scaleY: 1.01, duration: 80, ease: 'Power1' });
                }
            });
            btn.on('pointerout', () => {
                if (!this.hasAnsweredLocal && !this.isGameOver && btn.input && btn.input.enabled) {
                    drawBtnBg(0x2d3544, 0x475569, 1.5);
                    this.tweens.add({ targets: btn, scaleX: 1.0, scaleY: 1.0, duration: 80, ease: 'Power1' });
                }
            });
            btn.on('pointerdown', () => this.handleAnswer(i));

            this.optionButtons.push(btn);
        }

        // Banner Central de Notificações de Combate (Suave e Arredondado)
        this.combatAlertBanner = createSmoothBanner(this, centerX, 220, '', {
            radius: 18,
            fillColor: 0x030712,
            fillAlpha: 0.94,
            strokeColor: 0xd97706,
            strokeWidth: 1.5,
            fontSize: '14px',
            textColor: '#ffffff',
            paddingX: 24,
            paddingY: 9
        }).setVisible(false).setDepth(120);

        // Overlay de Ultimate Finisher Cinematográfico
        this.ultimateOverlay = this.add.container(centerX, 360).setDepth(260).setVisible(false);
        this.ultBackdrop = this.add.rectangle(0, 0, width, 720, 0x030712, 0.94);
        this.ultFlash = this.add.rectangle(0, 0, width, 720, 0xffffff, 0);
        this.ultPortrait = this.add.sprite(0, -60, getProfessorById(this.p1Data?.characterId || 'so').atlasKey, 'idle').setScale(0.85);
        this.ultHeader = this.add.text(0, 55, '⚡ ULTIMATE FINISHER! ⚡', {
            fontSize: '20px', fill: '#facc15', fontStyle: 'bold', letterSpacing: 2
        }).setOrigin(0.5);
        this.ultMoveName = this.add.text(0, 90, 'KERNEL PANIC', {
            fontSize: '26px', fill: '#ef4444', fontStyle: 'bold', letterSpacing: 2
        }).setOrigin(0.5);
        this.ultQuote = this.add.text(0, 126, '"Processo encerrado com código de erro fatal."', {
            fontSize: '13px', fill: '#e2e8f0', fontStyle: 'italic'
        }).setOrigin(0.5);
        this.ultimateOverlay.add([this.ultBackdrop, this.ultFlash, this.ultPortrait, this.ultHeader, this.ultMoveName, this.ultQuote]);

        // 6. Painel Game Over (Reformulado, Perfeitamente Centralizado e com Múltiplas Opções)
        this.gameOverPanel = this.add.container(centerX, 360).setDepth(200).setVisible(false);

        // Backdrop escuro que bloqueia interações com a tela de combate de fundo
        const goBackdrop = this.add.rectangle(0, 0, width, 720, 0x181e26, 0.88)
            .setInteractive();

        // Card Central de Alta Fidelidade (Glow + Fundo + Borda Temática Suave Arredondada)
        this.goCardGlow = this.add.graphics();
        this.goCardBg = this.add.graphics();

        this.updateGameOverTheme = (themeColor = 0xd97706) => {
            this.goCardGlow.clear();
            drawRoundedRect(this.goCardGlow, -305, -220, 610, 440, 24, themeColor, 0.22);
            this.goCardBg.clear();
            drawRoundedRect(this.goCardBg, -300, -215, 600, 430, 20, 0x242a35, 0.98, themeColor, 2);
        };
        this.updateGameOverTheme(0xd97706);

        // Fallback handlers para chamadas legadas
        this.goCardGlow.setFillStyle = (color) => {
            let col = color;
            if (typeof col === 'string') col = parseInt(col.replace('#', '0x'), 16);
            this.updateGameOverTheme(col);
            return this.goCardGlow;
        };
        this.goCardBg.setStrokeStyle = (w, color) => {
            let col = color;
            if (typeof col === 'string') col = parseInt(col.replace('#', '0x'), 16);
            this.updateGameOverTheme(col);
            return this.goCardBg;
        };

        // Faixa de Cabeçalho do Card (com cantos arredondados)
        const goCardHeader = this.add.graphics();
        drawRoundedRect(goCardHeader, -290, -205, 580, 65, 14, 0x2d3544, 0.95, 0x475569, 1);
        const goHeaderLine = this.add.line(0, -135, -280, 0, 280, 0, 0x475569).setLineWidth(1);

        // Ícone e Títulos
        this.goIconText = this.add.text(0, -182, '🏆', { 
            fontSize: '34px'
        }).setOrigin(0.5);

        this.goTitleText = this.add.text(0, -145, 'VITÓRIA ACADÊMICA!', { 
            fontSize: '26px', fontStyle: 'bold', fill: '#4ade80', resolution: 2
        }).setOrigin(0.5);

        this.goSubText = this.add.text(0, -108, 'Parabéns! Você dominou o duelo.', { 
            fontSize: '14px', fill: '#e2e8f0', fontStyle: 'bold',
            align: 'center', resolution: 2
        }).setOrigin(0.5);

        // Resumo / Placar da Partida (Stats Box Centralizado Suave)
        const statsBoxBg = this.add.graphics();
        drawRoundedRect(statsBoxBg, -270, -74, 540, 92, 14, 0x1e2430, 0.95, 0x475569, 1.5);

        // Coluna P1
        this.goP1Nick = this.add.text(-170, -52, 'P1: JOGADOR 1', { 
            fontSize: '13px', fill: '#60a5fa', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);
        this.goP1Prof = this.add.text(-170, -32, '[ SISTEMAS OP. ]', { 
            fontSize: '11px', fill: '#94a3b8', resolution: 2 
        }).setOrigin(0.5);
        this.goP1Hearts = this.add.text(-170, -8, '100 HP', { 
            fontSize: '13px', fill: '#4ade80', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);

        // Separador Central (VS & Rodadas)
        const vsBadge = this.add.text(0, -50, 'VS', { 
            fontSize: '14px', fill: '#f59e0b', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);
        this.goRoundsText = this.add.text(0, -30, '🎯 4 Rodadas', { 
            fontSize: '12px', fill: '#cbd5e1', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);
        const modeBadge = this.add.text(0, -10, 'Duelo 1v1', { 
            fontSize: '10px', fill: '#64748b', resolution: 2 
        }).setOrigin(0.5);

        // Coluna P2
        this.goP2Nick = this.add.text(170, -52, 'P2: JOGADOR 2', { 
            fontSize: '13px', fill: '#f87171', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);
        this.goP2Prof = this.add.text(170, -32, '[ WEB & MOBILE ]', { 
            fontSize: '11px', fill: '#94a3b8', resolution: 2 
        }).setOrigin(0.5);
        this.goP2Hearts = this.add.text(170, -8, '💀 0 HP (K.O.)', { 
            fontSize: '13px', fill: '#ef4444', fontStyle: 'bold', resolution: 2 
        }).setOrigin(0.5);

        // Banner temporário de recusa de solicitação (Suave e Arredondado)
        this.requestDeclinedBanner = createSmoothBanner(this, 0, 22, '', { 
            radius: 14,
            fillColor: 0x450a0a,
            strokeColor: 0xef4444,
            strokeWidth: 1.5,
            fontSize: '12px',
            textColor: '#f87171',
            paddingX: 18,
            paddingY: 6
        }).setVisible(false);

        // --- GRUPO 1: Botões de Ação Padrão (Suaves e Arredondados) ---
        // Botão 1 (Principal): Jogar Novamente (Revanche na Mesma Sala)
        this.btnRematch = createSmoothButton(this, 0, 56, 460, 42, '⚔️ Jogar Novamente (Revanche)', {
            radius: 21,
            fillColor: 0x16a34a,
            hoverFillColor: 0x22c55e,
            strokeColor: 0x34d399,
            strokeWidth: 1.5,
            fontSize: '15px',
            onClick: () => this.handleRematch()
        });

        // Botão 2: Trocar Personagem (Volta para a Seleção mantendo a sala)
        this.btnChangeProf = createSmoothButton(this, -125, 118, 210, 38, '🔄 Trocar Personagem', {
            radius: 19,
            fillColor: 0x323a48,
            hoverFillColor: 0x3e4758,
            strokeColor: 0x526075,
            strokeWidth: 1.5,
            textColor: '#f59e0b',
            fontSize: '12px',
            onClick: () => this.handleChangeProfessor()
        });

        // Botão 3: Menu Principal (Limpa e Sai)
        this.btnMainMenu = createSmoothButton(this, 125, 118, 210, 38, '🏠 Menu Principal', {
            radius: 19,
            fillColor: 0x7f1d1d,
            hoverFillColor: 0x991b1b,
            strokeColor: 0xb91c1c,
            strokeWidth: 1.5,
            textColor: '#fca5a5',
            fontSize: '12px',
            onClick: () => this.leaveToMenu()
        });

        // --- GRUPO 2: Painel de Espera (Para quem ENVIOU a solicitação) ---
        this.waitingBox = createSmoothCard(this, 0, 94, 520, 92, {
            radius: 14,
            fillColor: 0x1e2430,
            fillAlpha: 0.96,
            strokeColor: 0xd97706,
            strokeWidth: 1.5
        }).setVisible(false);

        this.waitingText = this.add.text(0, 74, '', { 
            fontSize: '13px', fill: '#f59e0b', fontStyle: 'bold', align: 'center',
            wordWrap: { width: 480 }, resolution: 2
        }).setOrigin(0.5).setVisible(false);

        this.btnCancelRequest = createSmoothButton(this, 0, 116, 200, 34, '✕ Cancelar Solicitação', {
            radius: 17,
            fillColor: 0x323a48,
            hoverFillColor: 0x3e4758,
            strokeColor: 0x526075,
            strokeWidth: 1.5,
            textColor: '#cbd5e1',
            fontSize: '12px',
            onClick: () => this.cancelPostMatchRequest()
        }).setVisible(false);

        // --- GRUPO 3: Painel de Decisão (Para quem RECEBEU a solicitação) ---
        this.promptBox = createSmoothCard(this, 0, 94, 520, 102, {
            radius: 14,
            fillColor: 0x1e2430,
            fillAlpha: 0.96,
            strokeColor: 0xd97706,
            strokeWidth: 2
        }).setVisible(false);

        this.promptTitle = this.add.text(0, 64, '', { 
            fontSize: '14px', fill: '#f59e0b', fontStyle: 'bold', resolution: 2
        }).setOrigin(0.5).setVisible(false);

        this.promptSub = this.add.text(0, 86, '', { 
            fontSize: '11px', fill: '#94a3b8', resolution: 2
        }).setOrigin(0.5).setVisible(false);

        this.btnAcceptRequest = createSmoothButton(this, -165, 120, 145, 34, '✓ Aceitar', {
            radius: 17,
            fillColor: 0x16a34a,
            hoverFillColor: 0x22c55e,
            strokeColor: 0x34d399,
            strokeWidth: 1.5,
            fontSize: '12px',
            onClick: () => this.acceptPostMatchRequest()
        }).setVisible(false);

        this.btnPromptChangeProf = createSmoothButton(this, 0, 120, 155, 34, '🔄 Trocar Personagem', {
            radius: 17,
            fillColor: 0x2563eb,
            hoverFillColor: 0x1d4ed8,
            strokeColor: 0x60a5fa,
            strokeWidth: 1.5,
            fontSize: '12px',
            onClick: () => this.executeChangeProfessorDirectly()
        }).setVisible(false);

        this.btnDeclineRequest = createSmoothButton(this, 165, 120, 145, 34, '✕ Recusar (Encerrar)', {
            radius: 17,
            fillColor: 0x7f1d1d,
            hoverFillColor: 0x991b1b,
            strokeColor: 0xf87171,
            strokeWidth: 1.5,
            textColor: '#fca5a5',
            fontSize: '12px',
            onClick: () => this.declinePostMatchRequest()
        }).setVisible(false);

        // Rodapé do Card
        this.goFooterHint = this.add.text(0, 172, `Código da Sala: ${this.roomId} • Duelo Finalizado`, {
            fontSize: '11px', fill: '#64748b', fontStyle: 'normal'
        }).setOrigin(0.5);

        this.gameOverPanel.add([
            goBackdrop, this.goCardGlow, this.goCardBg, goCardHeader, goHeaderLine,
            this.goIconText, this.goTitleText, this.goSubText,
            statsBoxBg,
            this.goP1Nick, this.goP1Prof, this.goP1Hearts,
            vsBadge, this.goRoundsText, modeBadge,
            this.goP2Nick, this.goP2Prof, this.goP2Hearts,
            this.requestDeclinedBanner,
            this.btnRematch, this.btnChangeProf, this.btnMainMenu,
            this.waitingBox, this.waitingText, this.btnCancelRequest,
            this.promptBox, this.promptTitle, this.promptSub, this.btnAcceptRequest, this.btnPromptChangeProf, this.btnDeclineRequest,
            this.goFooterHint
        ]);

        // 7. Painel de Contagem Inicial
        this.pausePanel = this.add.container(centerX, 360).setDepth(15).setVisible(false);
        const pauseBg = this.add.rectangle(0, 0, width, 720, 0x000000, 0.88);
        this.pauseTitle = this.add.text(0, -50, 'AGUARDANDO OPONENTE...', { 
            fontSize: '36px', fontStyle: 'bold', fill: '#facc15' 
        }).setOrigin(0.5);
        this.pauseSub = this.add.text(0, 20, `Código da Sala: ${this.roomId}`, { 
            fontSize: '28px', fill: '#34d399', fontStyle: 'bold',
            fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", sans-serif'
        }).setOrigin(0.5);
        const pauseLeaveBtn = createSmoothButton(this, 0, 100, 240, 44, '🚪 Sair da Sala', {
            radius: 22,
            fillColor: 0x991b1b,
            hoverFillColor: 0xef4444,
            strokeColor: 0xf87171,
            strokeWidth: 1.5,
            fontSize: '16px',
            onClick: () => this.leaveToMenu()
        });

        this.pausePanel.add([pauseBg, this.pauseTitle, this.pauseSub, pauseLeaveBtn]);

        // Setup dos Listeners da Dev Tool
        this.setupDevListeners();

        // 8. Iniciar conexão e sincronização com o Firebase (após todos os painéis criados!)
        this.setupFirebase();
    }

    async handleRematch() {
        if (!this.roomId) return;
        const hasP2 = !!(this.latestData?.p2 && this.latestData.p2.nickname);
        if (!hasP2) {
            // Modo solo: reinicia imediatamente sem pedir confirmação
            return this.executeRematchDirectly();
        }

        // Modo 1v1: envia solicitação de revanche para o oponente
        try {
            await update(ref(db, `rooms/${this.roomId}`), {
                postMatchRequest: {
                    type: 'rematch',
                    from: this.playerId,
                    fromNick: this.nickname,
                    timestamp: Date.now()
                }
            });
        } catch (err) {
            console.error('Erro ao solicitar revanche:', err);
        }
    }

    async handleChangeProfessor() {
        if (!this.roomId) return;
        return this.executeChangeProfessorDirectly();
    }

    async acceptPostMatchRequest() {
        const req = this.latestData?.postMatchRequest;
        if (!req || !this.roomId) return;
        
        if (req.type === 'rematch') {
            await this.executeRematchDirectly();
        } else if (req.type === 'change_prof') {
            await this.executeChangeProfessorDirectly();
        }
    }

    async declinePostMatchRequest() {
        const req = this.latestData?.postMatchRequest;
        if (!this.roomId) return;
        try {
            await update(ref(db, `rooms/${this.roomId}`), {
                state: 'closed',
                postMatchRequest: {
                    status: 'declined',
                    declinedBy: this.playerId,
                    declinedNick: this.nickname,
                    type: req?.type || 'rematch',
                    timestamp: Date.now()
                }
            });
        } catch (err) {
            console.error('Erro ao recusar pedido:', err);
        }
    }

    async cancelPostMatchRequest() {
        if (!this.roomId) return;
        try {
            await update(ref(db, `rooms/${this.roomId}`), {
                postMatchRequest: null
            });
        } catch (err) {
            console.error('Erro ao cancelar pedido:', err);
        }
    }

    async executeRematchDirectly() {
        if (!this.roomId) return;
        try {
            // Reset de estado para nova partida
            this.hasPlayedFightFanfare = false;
            this.hasPlayedKOSound = false;
            this.isGameOver = false;
            this.hasPlayedUltimateFinisher = false;
            this.currentQuestionData = null;
            this.lastProcessedQuestionId = null;
            this.lastProcessedRound = null;

            const devStartDelay = parseInt(localStorage.getItem('dev_start_delay'), 10) || 3;
            const newArena = getRandomArena();
            this.setArena(newArena.id);
            await update(ref(db, `rooms/${this.roomId}`), {
                postMatchRequest: null,
                arenaId: newArena.id,
                'p1/hp': 100,
                'p1/charges': 0,
                'p1/hasShield': false,
                'p1/hasTryCatch': false,
                'p1/lives': 3,
                'p1/streak': 0,
                'p1/answered': false,
                'p1/answeredAt': null,
                'p1/answerCorrect': null,
                'p2/hp': 100,
                'p2/charges': 0,
                'p2/hasShield': false,
                'p2/hasTryCatch': false,
                'p2/lives': 3,
                'p2/streak': 0,
                'p2/answered': false,
                'p2/answeredAt': null,
                'p2/answerCorrect': null,
                round: 0,
                roundModifier: 'normal',
                roundResolved: false,
                currentQuestionId: null,
                questionStartTime: null,
                state: 'in_match',
                matchStartTime: Date.now() + (devStartDelay * 1000)
            });
        } catch (err) {
            console.error('Erro na revanche:', err);
        }
    }

    async executeChangeProfessorDirectly() {
        if (!this.roomId) return;
        try {
            await update(ref(db, `rooms/${this.roomId}`), {
                postMatchRequest: null,
                state: 'character_select',
                'p1/ready': false,
                'p2/ready': false,
                'p1/hp': 100,
                'p1/charges': 0,
                'p1/hasShield': false,
                'p1/hasTryCatch': false,
                'p1/lives': 3,
                'p2/hp': 100,
                'p2/charges': 0,
                'p2/hasShield': false,
                'p2/hasTryCatch': false,
                'p2/lives': 3,
                'p1/streak': 0,
                'p2/streak': 0,
                'p1/answered': false,
                'p2/answered': false,
                round: 0,
                roundModifier: 'normal',
                roundResolved: false,
                currentQuestionId: null,
                countdownStartTime: null,
                matchStartTime: null
            });
        } catch (err) {
            console.error('Erro ao trocar professor:', err);
        }
    }

    updatePostMatchRequestUI(req, data) {
        if (!this.gameOverPanel || !this.gameOverPanel.visible) return;

        // Caso 1: Nenhuma solicitação ativa
        if (!req) {
            if (this.waitingBox) this.waitingBox.setVisible(false);
            if (this.waitingText) this.waitingText.setVisible(false);
            if (this.btnCancelRequest) this.btnCancelRequest.setVisible(false);

            if (this.promptBox) this.promptBox.setVisible(false);
            if (this.promptTitle) this.promptTitle.setVisible(false);
            if (this.promptSub) this.promptSub.setVisible(false);
            if (this.btnAcceptRequest) this.btnAcceptRequest.setVisible(false);
            if (this.btnPromptChangeProf) this.btnPromptChangeProf.setVisible(false);
            if (this.btnDeclineRequest) this.btnDeclineRequest.setVisible(false);

            if (this.btnRematch) this.btnRematch.setVisible(true);
            if (this.btnChangeProf) this.btnChangeProf.setVisible(true);
            if (this.btnMainMenu) {
                this.btnMainMenu.setPosition(125, 118);
                this.btnMainMenu.setText('🏠 Menu Principal');
                this.btnMainMenu.setStyle({ fixedWidth: 210, backgroundColor: '#450a0a', fill: '#fca5a5' });
                this.btnMainMenu.setVisible(true);
            }
            return;
        }

        // Caso 2: Solicitação foi RECUSADA -> A SALA É FINALIZADA!
        if (req.status === 'declined' || data.state === 'closed') {
            if (this.waitingBox) this.waitingBox.setVisible(false);
            if (this.waitingText) this.waitingText.setVisible(false);
            if (this.btnCancelRequest) this.btnCancelRequest.setVisible(false);

            if (this.promptBox) this.promptBox.setVisible(false);
            if (this.promptTitle) this.promptTitle.setVisible(false);
            if (this.promptSub) this.promptSub.setVisible(false);
            if (this.btnAcceptRequest) this.btnAcceptRequest.setVisible(false);
            if (this.btnPromptChangeProf) this.btnPromptChangeProf.setVisible(false);
            if (this.btnDeclineRequest) this.btnDeclineRequest.setVisible(false);

            if (this.btnRematch) this.btnRematch.setVisible(false);
            if (this.btnChangeProf) this.btnChangeProf.setVisible(false);

            const declinedNick = req.declinedNick || (req.declinedBy === 'p1' ? data.p1?.nickname : data.p2?.nickname) || 'O oponente';
            const actionLabel = req.type === 'change_prof' ? 'a troca de professor' : 'a revanche';

            if (this.requestDeclinedBanner) {
                this.requestDeclinedBanner.setPosition(0, 58);
                this.requestDeclinedBanner.setText(`❌ ${declinedNick} recusou ${actionLabel}.\n🚪 A sala foi finalizada. Retornando ao menu...`);
                this.requestDeclinedBanner.setStyle({
                    align: 'center',
                    fontSize: '13px',
                    lineSpacing: 5,
                    padding: { top: 8, bottom: 8, left: 18, right: 18 },
                    backgroundColor: '#450a0a',
                    fill: '#fca5a5'
                });
                this.requestDeclinedBanner.setVisible(true);
            }

            if (this.btnMainMenu) {
                this.btnMainMenu.setPosition(0, 122);
                this.btnMainMenu.setText('🏠 Voltar ao Menu Principal Agora');
                this.btnMainMenu.setStyle({ fixedWidth: 360, backgroundColor: '#991b1b', fill: '#ffffff' });
                this.btnMainMenu.setVisible(true);
            }

            // Redireciona ambos para o menu após 3 segundos
            if (!this.autoLeaveTimeout) {
                this.autoLeaveTimeout = setTimeout(() => {
                    this.leaveToMenu();
                }, 3000);
            }
            return;
        }

        // Oculta banner de recusa se houver
        if (this.requestDeclinedBanner) this.requestDeclinedBanner.setVisible(false);

        // Caso 3: Este jogador foi quem ENVIOU a solicitação
        if (req.from === this.playerId) {
            if (this.btnRematch) this.btnRematch.setVisible(false);
            if (this.btnChangeProf) this.btnChangeProf.setVisible(false);
            if (this.btnMainMenu) {
                this.btnMainMenu.setPosition(125, 118);
                this.btnMainMenu.setText('🏠 Menu Principal');
                this.btnMainMenu.setStyle({ fixedWidth: 210, backgroundColor: '#450a0a', fill: '#fca5a5' });
                this.btnMainMenu.setVisible(true);
            }

            if (this.promptBox) this.promptBox.setVisible(false);
            if (this.promptTitle) this.promptTitle.setVisible(false);
            if (this.promptSub) this.promptSub.setVisible(false);
            if (this.btnAcceptRequest) this.btnAcceptRequest.setVisible(false);
            if (this.btnPromptChangeProf) this.btnPromptChangeProf.setVisible(false);
            if (this.btnDeclineRequest) this.btnDeclineRequest.setVisible(false);

            const otherNick = (this.playerId === 'p1' ? data.p2?.nickname : data.p1?.nickname) || 'oponente';
            
            if (this.waitingBox) this.waitingBox.setVisible(true);
            if (this.waitingText) {
                this.waitingText.setText(`⏳ Solicitação de revanche enviada!\nAguardando ${otherNick} aceitar...`).setVisible(true);
            }
            if (this.btnCancelRequest) this.btnCancelRequest.setVisible(true);
            return;
        }

        // Caso 4: Este jogador foi quem RECEBEU a solicitação
        if (req.from !== this.playerId) {
            if (this.btnRematch) this.btnRematch.setVisible(false);
            if (this.btnChangeProf) this.btnChangeProf.setVisible(false);
            if (this.btnMainMenu) this.btnMainMenu.setVisible(false);

            if (this.waitingBox) this.waitingBox.setVisible(false);
            if (this.waitingText) this.waitingText.setVisible(false);
            if (this.btnCancelRequest) this.btnCancelRequest.setVisible(false);

            const senderNick = req.fromNick || (this.playerId === 'p1' ? data.p2?.nickname : data.p1?.nickname) || 'O oponente';

            if (this.promptBox) this.promptBox.setVisible(true);
            if (this.promptTitle) {
                this.promptTitle.setText(`⚔️ ${senderNick} propôs uma REVANCHE!`).setVisible(true);
            }
            if (this.promptSub) {
                this.promptSub.setText('Deseja um novo duelo com os mesmos personagens? (Ou troque de professor)').setVisible(true);
            }
            if (this.btnAcceptRequest) {
                this.btnAcceptRequest.setText('✓ Aceitar Revanche').setVisible(true);
            }
            if (this.btnPromptChangeProf) {
                this.btnPromptChangeProf.setVisible(true);
            }
            if (this.btnDeclineRequest) {
                this.btnDeclineRequest.setText('✕ Recusar (Encerrar Sala)').setVisible(true);
            }
        }
    }

    async leaveToMenu() {
        this.isLeaving = true;
        if (this.autoLeaveTimeout) {
            clearTimeout(this.autoLeaveTimeout);
            this.autoLeaveTimeout = null;
        }
        if (this.declinedBannerTimeout) {
            clearTimeout(this.declinedBannerTimeout);
            this.declinedBannerTimeout = null;
        }
        if (typeof this.roomUnsubscribe === 'function') {
            this.roomUnsubscribe();
            this.roomUnsubscribe = null;
        }
        if (this.nextQuestionTimeout) {
            clearTimeout(this.nextQuestionTimeout);
            this.nextQuestionTimeout = null;
        }
        if (this.roomId) {
            try {
                if (this.playerId === 'p1') {
                    await remove(ref(db, `rooms/${this.roomId}`));
                } else {
                    await remove(ref(db, `rooms/${this.roomId}/p2`));
                }
            } catch (err) {
                console.error('Erro ao sair da sala:', err);
            }
        }
        sessionStorage.removeItem('labcombat_room_id');
        sessionStorage.removeItem('labcombat_player_id');
        this.scene.start('MenuScene');
    }

    leaveRoom() {
        return this.leaveToMenu();
    }

    setupDevListeners() {
        this.handleDevReset = async () => {
            sessionStorage.clear();
            if (this.roomId) {
                try {
                    await set(ref(db, `rooms/${this.roomId}`), null);
                } catch(e) {
                    console.error('Erro ao resetar sala:', e);
                }
            }
            window.location.reload();
        };

        this.onDevStreak = (e) => {
            const delta = e.detail || 0;
            this.handleDevStreak(delta);
        };

        this.onDevNextQuestion = () => {
            this.handleDevNextQuestion();
        };

        this.onDevSetTimers = (e) => {
            const { matchStartDelay, questionTimeLimit } = e.detail || {};
            if (matchStartDelay) this.MATCH_START_DELAY = matchStartDelay;
            if (questionTimeLimit) this.QUESTION_TIME_LIMIT = questionTimeLimit;

            if (this.playerId === 'p1' && this.roomId) {
                update(ref(db, `rooms/${this.roomId}`), {
                    matchStartDelay: this.MATCH_START_DELAY,
                    questionTimeLimit: this.QUESTION_TIME_LIMIT
                }).catch(err => console.error('Erro ao salvar tempos dev:', err));
            }
        };

        window.addEventListener('dev-reset', this.handleDevReset);
        window.addEventListener('dev-streak', this.onDevStreak);
        window.addEventListener('dev-next-question', this.onDevNextQuestion);
        window.addEventListener('dev-set-timers', this.onDevSetTimers);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('dev-reset', this.handleDevReset);
            window.removeEventListener('dev-streak', this.onDevStreak);
            window.removeEventListener('dev-next-question', this.onDevNextQuestion);
            window.removeEventListener('dev-set-timers', this.onDevSetTimers);
            if (this.autoLeaveTimeout) {
                clearTimeout(this.autoLeaveTimeout);
                this.autoLeaveTimeout = null;
            }
            if (this.declinedBannerTimeout) {
                clearTimeout(this.declinedBannerTimeout);
                this.declinedBannerTimeout = null;
            }
            if (this.nextQuestionTimeout) {
                clearTimeout(this.nextQuestionTimeout);
                this.nextQuestionTimeout = null;
            }
            if (typeof this.roomUnsubscribe === 'function') {
                this.roomUnsubscribe();
                this.roomUnsubscribe = null;
            }
        });
    }

    handleDevStreak(delta) {
        if (!this.roomId || !this.playerId || this.isGameOver) return;
        const playerRef = ref(db, `rooms/${this.roomId}/${this.playerId}`);
        get(playerRef).then((snap) => {
            const data = snap.val();
            if (!data) return;

            let newCharges = Math.max(0, Math.min(3, (data.charges || 0) + delta));
            update(playerRef, {
                charges: newCharges
            });
        });
    }

    handleDevNextQuestion() {
        if (!this.roomId || this.isGameOver || this.isWaitingForOpponent) return;
        if (this.nextQuestionTimeout) {
            clearTimeout(this.nextQuestionTimeout);
            this.nextQuestionTimeout = null;
        }
        this.isAdvancingQuestion = false;
        this.pickNextQuestion();
    }

    async setupFirebase() {
        const roomRef = ref(db, `rooms/${this.roomId}`);
        
        if (this.playerId === 'p1') {
            this.statusText.setText('Você é o Jogador 1. Aguardando P2...');
        } else {
            this.statusText.setText('Você é o Jogador 2.');
        }

        this.roomUnsubscribe = onValue(roomRef, (snap) => {
            if (this.isLeaving) return;
            const data = snap.val();
            if (data) {
                this.updateState(data);
            } else {
                if (typeof this.roomUnsubscribe === 'function') {
                    this.roomUnsubscribe();
                    this.roomUnsubscribe = null;
                }
                sessionStorage.removeItem('labcombat_room_id');
                sessionStorage.removeItem('labcombat_player_id');
                this.scene.start('MenuScene');
            }
        });
    }

    playAttack(fighter, direction) {
        SoundManager.playPunch();
        this.tweens.add({ targets: fighter, x: fighter.originalX + (110 * direction), duration: 150, yoyo: true, ease: 'Power2' });
    }

    playDamage(fighter, isBlocked = false) {
        if (isBlocked) {
            SoundManager.playShield();
        } else {
            SoundManager.playPunch();
        }
        this.tweens.add({ targets: fighter, x: fighter.originalX + 12, duration: 50, yoyo: true, repeat: 4 });
        this.tweens.add({ targets: fighter, alpha: 0.3, duration: 100, yoyo: true, repeat: 2 });
    }

    setArena(arenaId) {
        if (!arenaId || arenaId === this.currentArenaId) return;
        const arena = getArenaById(arenaId);
        if (!arena) return;
        this.currentArenaId = arena.id;
        this.arenaId = arena.id;
        if (this.arenaBg && this.textures.exists(arena.key)) {
            this.arenaBg.setTexture(arena.key);
            this.arenaBg.setDisplaySize(this.scale.width, 720);
        }
        if (this.arenaIndicatorText) {
            this.arenaIndicatorText.setText(`🏟️ ${arena.name.toUpperCase()}`);
        }
    }

    clearQuestion() {
        this.currentQuestionData = null;
        this.localQuestionStartTime = null;
        this.lastProcessedQuestionId = null;
        this.lastProcessedRound = null;
        this.questionText.setText('');
        this.optionButtons.forEach(btn => {
            btn.setText('');
            btn.setStyle({ fill: '#fff', backgroundColor: '#1e293b' });
            btn.disableInteractive();
        });
        if (this.roundModifierBadge) {
            this.roundModifierBadge.setVisible(false);
        }
        this.timerText.setText('⏱️ Tempo: --');
        this.timerText.setStyle({ fill: '#38bdf8', backgroundColor: '#1e293b' });
    }

    showCombatAlert(text, color = '#facc15') {
        if (!this.combatAlertBanner) return;
        this.combatAlertBanner.setText(text).setStyle({ fill: color }).setVisible(true).setAlpha(0).setScale(0.9);
        this.tweens.killTweensOf(this.combatAlertBanner);
        this.tweens.add({
            targets: this.combatAlertBanner,
            alpha: 1,
            scale: 1,
            duration: 200,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.time.delayedCall(2400, () => {
                    this.tweens.add({
                        targets: this.combatAlertBanner,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => {
                            this.combatAlertBanner.setVisible(false);
                        }
                    });
                });
            }
        });
    }

    triggerUltimateFinisher(winnerProf, loserProf, callback) {
        if (this.isExecutingFinisher) return;
        this.isExecutingFinisher = true;

        if (winnerProf) {
            if (true) {
                this.ultPortrait.setTexture(winnerProf.atlasKey, 'idle');
            } else {
                this.ultPortrait.setTexture(winnerProf.atlasKey, 'idle');
            }
            this.ultMoveName.setText(winnerProf.ultimateName ? winnerProf.ultimateName.toUpperCase() : 'GOLPE FATAL');
            this.ultQuote.setText(winnerProf.ultimateQuote ? `"${winnerProf.ultimateQuote}"` : '"Duelo encerrado com perfeição."');
            this.ultHeader.setText(`⚡ ULTIMATE FINISHER • ${winnerProf.shortName.toUpperCase()} ⚡`);
        }

        this.ultimateOverlay.setVisible(true).setAlpha(0);
        this.cameras.main.shake(700, 0.03);
        this.cameras.main.flash(450, 255, 255, 255);
        SoundManager.playSpecial();
        this.hasPlayedKOSound = true;
        SoundManager.playKO();

        this.tweens.add({
            targets: this.ultimateOverlay,
            alpha: 1,
            duration: 250,
            ease: 'Power2',
            onComplete: () => {
                this.time.delayedCall(2600, () => {
                    this.tweens.add({
                        targets: this.ultimateOverlay,
                        alpha: 0,
                        duration: 400,
                        onComplete: () => {
                            this.ultimateOverlay.setVisible(false);
                            this.isExecutingFinisher = false;
                            if (typeof callback === 'function') callback();
                        }
                    });
                });
            }
        });
    }

    resolveRound(data) {
        if (this.playerId !== 'p1' || this.isResolvingRound || data.roundResolved) return;
        this.isResolvingRound = true;

        const p1 = data.p1 || {};
        const p2 = data.p2 || {};

        let p1Hp = p1.hp != null ? p1.hp : 100;
        let p2Hp = p2.hp != null ? p2.hp : 100;
        let p1Charges = p1.charges || 0;
        let p2Charges = p2.charges || 0;
        let p1Shield = !!p1.hasShield;
        let p2Shield = !!p2.hasShield;
        let p1TryCatch = !!p1.hasTryCatch;
        let p2TryCatch = !!p2.hasTryCatch;

        const modifier = data.roundModifier || 'normal';

        const p1Correct = !!p1.answerCorrect;
        const p2Correct = !!p2.answerCorrect;
        const p1Time = p1.answeredAt || 9999999999999;
        const p2Time = p2.answeredAt || 9999999999999;
        const p1Nick = (p1.nickname || 'Jogador 1').toUpperCase();
        const p2Nick = (p2.nickname || 'Jogador 2').toUpperCase();

        let alertMessage = '';
        let ultimateWinner = null;

        // CASO 1: AMBOS OS JOGADORES ERRARAM
        if (!p1Correct && !p2Correct) {
            if (p1TryCatch) {
                p1TryCatch = false;
            } else {
                p1Charges = Math.max(0, p1Charges - 1);
            }

            if (p2TryCatch) {
                p2TryCatch = false;
            } else {
                p2Charges = Math.max(0, p2Charges - 1);
            }

            alertMessage = '⚠️ AMBOS ERRARAM! (-1 CARGA CADA)';
        }
        // CASO 2: AMBOS OS JOGADORES ACERTARAM (Disputa de Velocidade)
        else if (p1Correct && p2Correct) {
            const p1IsFaster = p1Time <= p2Time;
            const fastKey = p1IsFaster ? 'p1' : 'p2';
            const slowKey = p1IsFaster ? 'p2' : 'p1';
            const fastNick = p1IsFaster ? p1Nick : p2Nick;
            const slowNick = p1IsFaster ? p2Nick : p1Nick;

            let extraCharge = 0;
            if (modifier === 'charge') extraCharge = 1;
            if (modifier === 'shield') {
                if (fastKey === 'p1') p1Shield = true;
                else p2Shield = true;
            }
            if (modifier === 'heal') {
                if (fastKey === 'p1') p1Hp = Math.min(100, p1Hp + 10);
                else p2Hp = Math.min(100, p2Hp + 10);
            }
            if (modifier === 'try_catch') {
                if (fastKey === 'p1') p1TryCatch = true;
                else p2TryCatch = true;
            }

            if (fastKey === 'p1') {
                p1Charges = Math.min(3, p1Charges + 1 + extraCharge);
            } else {
                p2Charges = Math.min(3, p2Charges + 1 + extraCharge);
            }

            alertMessage = `⚡ ${fastNick} FOI MAIS RÁPIDO! (+BÔNUS) • ${slowNick} SE DEFENDEU!`;
        }
        // CASO 3: APENAS UM ACERTOU
        else {
            const winnerKey = p1Correct ? 'p1' : 'p2';
            const loserKey = p1Correct ? 'p2' : 'p1';
            const winnerNick = p1Correct ? p1Nick : p2Nick;
            const loserNick = p1Correct ? p2Nick : p1Nick;

            let winnerCharges = winnerKey === 'p1' ? p1Charges : p2Charges;
            let loserHp = loserKey === 'p1' ? p1Hp : p2Hp;
            let loserShield = loserKey === 'p1' ? p1Shield : p2Shield;
            let loserTryCatch = loserKey === 'p1' ? p1TryCatch : p2TryCatch;

            const hadUltimateReady = (winnerCharges >= 3);

            let extraCharge = 0;
            if (modifier === 'charge') extraCharge = 1;
            if (modifier === 'shield') {
                if (winnerKey === 'p1') p1Shield = true;
                else p2Shield = true;
            }
            if (modifier === 'heal') {
                if (winnerKey === 'p1') p1Hp = Math.min(100, p1Hp + 10);
                else p2Hp = Math.min(100, p2Hp + 10);
            }
            if (modifier === 'try_catch') {
                if (winnerKey === 'p1') p1TryCatch = true;
                else p2TryCatch = true;
            }

            if (loserTryCatch) {
                loserTryCatch = false;
                winnerCharges = Math.min(3, winnerCharges + 1 + extraCharge);
                alertMessage = `🪲 TRY-CATCH ABSORVEU O ERRO DE ${loserNick}! (0 DANO)`;
            } else if (hadUltimateReady) {
                if (loserShield) {
                    loserShield = false;
                    winnerCharges = 0;
                    alertMessage = `🛡️ FIREWALL ABSORVEU A ULTIMATE! ${loserNick} SOBREVIVEU!`;
                } else {
                    if (loserHp <= 33) {
                        loserHp = 0;
                        ultimateWinner = winnerKey;
                        alertMessage = `💥 ULTIMATE FINISHER! K.O. DE ${winnerNick}!`;
                    } else {
                        loserHp = Math.max(0, loserHp - 28);
                        winnerCharges = 0;
                        alertMessage = `⚡ SUPER GOLPE DE ${winnerNick}! (-28 HP)`;
                    }
                }
            } else {
                winnerCharges = Math.min(3, winnerCharges + 1 + extraCharge);
                if (loserShield) {
                    loserShield = false;
                    alertMessage = `🛡️ FIREWALL DE ${loserNick} ABSORVEU O ATAQUE!`;
                } else {
                    loserHp = Math.max(0, loserHp - 15);
                    alertMessage = `💥 GOLPE DE ${winnerNick}! (-15 HP)`;
                }
            }

            if (winnerKey === 'p1') {
                p1Charges = winnerCharges;
                p2Hp = loserHp;
                p2Shield = loserShield;
                p2TryCatch = loserTryCatch;
            } else {
                p2Charges = winnerCharges;
                p1Hp = loserHp;
                p1Shield = loserShield;
                p1TryCatch = loserTryCatch;
            }
        }

        const updates = {
            'p1/hp': p1Hp,
            'p1/charges': p1Charges,
            'p1/hasShield': p1Shield,
            'p1/hasTryCatch': p1TryCatch,
            'p2/hp': p2Hp,
            'p2/charges': p2Charges,
            'p2/hasShield': p2Shield,
            'p2/hasTryCatch': p2TryCatch,
            roundResolved: true,
            roundAlert: alertMessage,
            ultimateWinner: ultimateWinner
        };

        update(ref(db, `rooms/${this.roomId}`), updates).finally(() => {
            this.isResolvingRound = false;
        });
    }

    updateState(data) {
        if (!data) return;
        this.latestData = data;

        // Se a partida foi reiniciada para a tela de seleção de professores (ex: Revanche / Trocar Professor)
        if (data.state === 'character_select') {
            if (this.autoLeaveTimeout) {
                clearTimeout(this.autoLeaveTimeout);
                this.autoLeaveTimeout = null;
            }
            if (this.declinedBannerTimeout) {
                clearTimeout(this.declinedBannerTimeout);
                this.declinedBannerTimeout = null;
            }
            if (typeof this.roomUnsubscribe === 'function') {
                this.roomUnsubscribe();
                this.roomUnsubscribe = null;
            }
            if (this.nextQuestionTimeout) {
                clearTimeout(this.nextQuestionTimeout);
                this.nextQuestionTimeout = null;
            }
            this.scene.start('CharacterSelectScene', {
                roomId: this.roomId,
                playerId: this.playerId,
                nickname: this.nickname,
                previousCharacterId: this.playerId === 'p1' ? data.p1?.characterId : data.p2?.characterId
            });
            return;
        }

        const hasP1 = !!data.p1;
        const hasP2 = !!data.p2;

        if (data.matchStartDelay) {
            this.MATCH_START_DELAY = data.matchStartDelay;
        }
        if (data.questionTimeLimit) {
            this.QUESTION_TIME_LIMIT = data.questionTimeLimit;
        }
        if (data.round != null) {
            this.currentRound = data.round;
        }

        // Sincronizar Arena da Partida
        if (data.arenaId && data.arenaId !== this.currentArenaId) {
            this.setArena(data.arenaId);
        }

        // 1. Atualizar Visual dos Lutadores, HP, Cargas e Buffs
        const p1Hp = data.p1?.hp != null ? data.p1.hp : 100;
        const p2Hp = data.p2?.hp != null ? data.p2.hp : 100;
        const p1Charges = data.p1?.charges || 0;
        const p2Charges = data.p2?.charges || 0;

        if (data.p1) {
            const p1Prof = getProfessorById(data.p1.characterId || 'so');
            const p1Nick = data.p1.nickname || 'Jogador 1';
            if (this.fighterP1Sprite) {
                this.fighterP1Sprite.setTexture(p1Prof.atlasKey, 'idle');
                this.fighterP1Sprite.setScale(p1Prof.scale || 0.65);
            }
            
            // Retrato do Professor P1 no Card
            if (this.p1Portrait) {
                this.p1Portrait.setTexture(p1Prof.portraitKey);
                const pScale = p1Prof.portraitScale || 1.0;
                this.p1Portrait.setDisplaySize(58 * pScale, 58 * pScale);
            }

            // Nickname e Disciplina P1
            if (this.p1NickText) {
                let displayNick = p1Nick.toUpperCase();
                if (displayNick.length > 12) displayNick = displayNick.slice(0, 10) + '..';
                this.p1NickText.setText(displayNick);
            }
            if (this.p1ProfText) {
                let displayProf = `• ${p1Prof.shortName}`;
                if (displayProf.length > 18) displayProf = `• ${p1Prof.shortName.slice(0, 15)}..`;
                this.p1ProfText.setText(displayProf);
            }

            // Barra de HP P1 (356px de largura)
            const p1Ratio = Math.max(0, Math.min(1, p1Hp / 100));
            let p1Color = 0x10b981;
            let p1Hex = '#34d399';
            if (p1Hp <= 33) {
                p1Color = 0xef4444;
                p1Hex = '#ef4444';
            } else if (p1Hp <= 66) {
                p1Color = 0xeab308;
                p1Hex = '#facc15';
            }

            if (this.p1HpBarFill) {
                this.p1HpBarFill.setSize((this.hpBarFullWidth || 438) * p1Ratio, 14);
                this.p1HpBarFill.setFillStyle(p1Color, 1);
            }
            if (this.p1HpText) {
                this.p1HpText.setText(`${p1Hp} HP`).setStyle({ fill: p1Hex });
            }

            // Cargas P1 (3 slots energizados)
            for (let s = 0; s < 3; s++) {
                if (this.p1ChargeSlots && this.p1ChargeSlots[s]) {
                    if (s < p1Charges) {
                        this.p1ChargeSlots[s].setFillStyle(0xfacc15, 1);
                        this.p1ChargeSlots[s].setStrokeStyle(1.5, 0xffffff);
                        if (this.p1SlotTexts && this.p1SlotTexts[s]) {
                            this.p1SlotTexts[s].setStyle({ fill: '#000000' });
                        }
                    } else {
                        this.p1ChargeSlots[s].setFillStyle(0x1e2430, 1);
                        this.p1ChargeSlots[s].setStrokeStyle(1, 0x475569);
                        if (this.p1SlotTexts && this.p1SlotTexts[s]) {
                            this.p1SlotTexts[s].setStyle({ fill: '#64748b' });
                        }
                    }
                }
            }
            if (this.p1ChargeLabel) {
                if (p1Charges >= 3) {
                    if (p2Hp <= 33) {
                        this.p1ChargeLabel.setText('⚡ ULTIMATE PRONTA!').setStyle({ fill: '#ef4444' });
                    } else {
                        this.p1ChargeLabel.setText('⚡ SUPER GOLPE!').setStyle({ fill: '#facc15' });
                    }
                } else {
                    this.p1ChargeLabel.setText(`ESPECIAL: ${p1Charges}/3`).setStyle({ fill: '#64748b' });
                }
            }

            // Buffs P1
            const p1Buffs = [];
            if (data.p1.hasShield) p1Buffs.push('🛡️ FIREWALL');
            if (data.p1.hasTryCatch) p1Buffs.push('🪲 TRY-CATCH');
            if (this.p1BuffIcons) {
                this.p1BuffIcons.setText(p1Buffs.join(' ')).setStyle({ fill: '#38bdf8' });
            }

            if (this.playerId === 'p1') {
                this.hasAnsweredLocal = !!data.p1.answered;
            }
        }

        if (data.p2) {
            const p2Prof = getProfessorById(data.p2.characterId || 'web');
            const p2Nick = data.p2.nickname || 'Jogador 2';
            if (this.fighterP2Sprite) {
                this.fighterP2Sprite.setTexture(p2Prof.atlasKey, 'idle');
                this.fighterP2Sprite.setScale(p2Prof.scale || 0.65);
                this.fighterP2Sprite.setFlipX(true);
            }
            
            // Retrato do Professor P2 no Card
            if (this.p2Portrait) {
                this.p2Portrait.setTexture(p2Prof.portraitKey);
                const pScale = p2Prof.portraitScale || 1.0;
                this.p2Portrait.setDisplaySize(58 * pScale, 58 * pScale);
            }

            // Nickname e Disciplina P2
            if (this.p2NickText) {
                let displayNick = p2Nick.toUpperCase();
                if (displayNick.length > 12) displayNick = displayNick.slice(0, 10) + '..';
                this.p2NickText.setText(displayNick);
            }
            if (this.p2ProfText) {
                let displayProf = `${p2Prof.shortName} •`;
                if (displayProf.length > 18) displayProf = `${p2Prof.shortName.slice(0, 15)}.. •`;
                this.p2ProfText.setText(displayProf);
            }

            // Barra de HP P2 (356px de largura)
            const p2Ratio = Math.max(0, Math.min(1, p2Hp / 100));
            let p2Color = 0x10b981;
            let p2Hex = '#34d399';
            if (p2Hp <= 33) {
                p2Color = 0xef4444;
                p2Hex = '#ef4444';
            } else if (p2Hp <= 66) {
                p2Color = 0xeab308;
                p2Hex = '#facc15';
            }

            if (this.p2HpBarFill) {
                this.p2HpBarFill.setSize((this.hpBarFullWidth || 438) * p2Ratio, 14);
                this.p2HpBarFill.setFillStyle(p2Color, 1);
            }
            if (this.p2HpText) {
                this.p2HpText.setText(`${p2Hp} HP`).setStyle({ fill: p2Hex });
            }

            // Cargas P2 (3 slots energizados)
            for (let s = 0; s < 3; s++) {
                if (this.p2ChargeSlots && this.p2ChargeSlots[s]) {
                    if (s < p2Charges) {
                        this.p2ChargeSlots[s].setFillStyle(0xfacc15, 1);
                        this.p2ChargeSlots[s].setStrokeStyle(1.5, 0xffffff);
                        if (this.p2SlotTexts && this.p2SlotTexts[s]) {
                            this.p2SlotTexts[s].setStyle({ fill: '#000000' });
                        }
                    } else {
                        this.p2ChargeSlots[s].setFillStyle(0x1e2430, 1);
                        this.p2ChargeSlots[s].setStrokeStyle(1, 0x475569);
                        if (this.p2SlotTexts && this.p2SlotTexts[s]) {
                            this.p2SlotTexts[s].setStyle({ fill: '#64748b' });
                        }
                    }
                }
            }
            if (this.p2ChargeLabel) {
                if (p2Charges >= 3) {
                    if (p1Hp <= 33) {
                        this.p2ChargeLabel.setText('⚡ ULTIMATE PRONTA!').setStyle({ fill: '#ef4444' });
                    } else {
                        this.p2ChargeLabel.setText('⚡ SUPER GOLPE!').setStyle({ fill: '#facc15' });
                    }
                } else {
                    this.p2ChargeLabel.setText(`ESPECIAL: ${p2Charges}/3`).setStyle({ fill: '#64748b' });
                }
            }

            // Buffs P2
            const p2Buffs = [];
            if (data.p2.hasShield) p2Buffs.push('🛡️ FIREWALL');
            if (data.p2.hasTryCatch) p2Buffs.push('🪲 TRY-CATCH');
            if (this.p2BuffIcons) {
                this.p2BuffIcons.setText(p2Buffs.join(' ')).setStyle({ fill: '#38bdf8' });
            }

            if (this.playerId === 'p2') {
                this.hasAnsweredLocal = !!data.p2.answered;
            }
        }

        // Modificador de Questão da Rodada
        if (this.roundModifierBadge) {
            if (data.roundModifier && data.roundModifier !== 'normal') {
                this.roundModifierBadge.setVisible(true);
                switch (data.roundModifier) {
                    case 'charge':
                        this.roundModifierBadge.setText('⚡ OVERCLOCK: +1 CARGA EXTRA AO ACERTAR PRIMEIRO')
                            .setStyle({ fill: '#fef08a', backgroundColor: '#854d0e' });
                        break;
                    case 'shield':
                        this.roundModifierBadge.setText('🛡️ FIREWALL: GANHA ESCUDO QUE ANULA PRÓXIMO ATAQUE/ULTIMATE')
                            .setStyle({ fill: '#bae6fd', backgroundColor: '#075985' });
                        break;
                    case 'heal':
                        this.roundModifierBadge.setText('💚 BACKUP: RESTAURA +10 HP AO ACERTAR PRIMEIRO')
                            .setStyle({ fill: '#bbf7d0', backgroundColor: '#166534' });
                        break;
                    case 'try_catch':
                        this.roundModifierBadge.setText('🪲 TRY-CATCH: ANULA O PRÓXIMO ERRO SEM SOFRER DANO')
                            .setStyle({ fill: '#f5d0fe', backgroundColor: '#86198f' });
                        break;
                    default:
                        this.roundModifierBadge.setVisible(false);
                }
            } else {
                this.roundModifierBadge.setVisible(false);
            }
        }

        // Banner de Alerta de Combate
        if (data.roundAlert && data.roundAlert !== this.lastDisplayedAlert) {
            this.lastDisplayedAlert = data.roundAlert;
            this.showCombatAlert(data.roundAlert);
        }

        // Animações de Ataque / Dano se houve alteração de HP ou Cargas
        if (this.previousData) {
            const prevP1Hp = this.previousData.p1?.hp != null ? this.previousData.p1.hp : 100;
            const prevP2Hp = this.previousData.p2?.hp != null ? this.previousData.p2.hp : 100;
            const prevP1Charges = this.previousData.p1?.charges || 0;
            const prevP2Charges = this.previousData.p2?.charges || 0;

            if (p1Hp < prevP1Hp) {
                this.playDamage(this.fighterP1);
                this.cameras.main.shake(120, 0.008);
            }
            if (p2Hp < prevP2Hp) {
                this.playDamage(this.fighterP2);
                this.cameras.main.shake(120, 0.008);
            }
            if (p1Charges > prevP1Charges) {
                this.playAttack(this.fighterP1, 1);
            }
            if (p2Charges > prevP2Charges) {
                this.playAttack(this.fighterP2, -1);
            }
        }
        this.previousData = data;

        // 2. Checagem de Fim de Jogo (HP <= 0)
        if (p1Hp === 100 && p2Hp === 100) {
            this.isGameOver = false;
            this.hasPlayedUltimateFinisher = false;
            if (this.gameOverPanel) this.gameOverPanel.setVisible(false);
            if (this.declinedBannerTimeout) clearTimeout(this.declinedBannerTimeout);
        }

        if (data.p1 && data.p2 && (p1Hp <= 0 || p2Hp <= 0)) {
            if (this.nextQuestionTimeout) {
                clearTimeout(this.nextQuestionTimeout);
                this.nextQuestionTimeout = null;
            }

            if (data.ultimateWinner && !this.hasPlayedUltimateFinisher) {
                this.hasPlayedUltimateFinisher = true;
                const winKey = data.ultimateWinner;
                const loseKey = winKey === 'p1' ? 'p2' : 'p1';
                const winProf = getProfessorById(data[winKey]?.characterId || (winKey === 'p1' ? 'so' : 'web'));
                const loseProf = getProfessorById(data[loseKey]?.characterId || (loseKey === 'p1' ? 'so' : 'web'));
                this.triggerUltimateFinisher(winProf, loseProf, () => {
                    this.handleGameOver(p1Hp, p2Hp, data);
                    this.updatePostMatchRequestUI(data.postMatchRequest, data);
                });
                return;
            }

            if (!this.isExecutingFinisher) {
                this.handleGameOver(p1Hp, p2Hp, data);
                this.updatePostMatchRequestUI(data.postMatchRequest, data);
            }
            return;
        }

        // 3. Controle de Conexão e Início de Partida
        if (!hasP1 || !hasP2) {
            this.isWaitingForOpponent = true;
            this.clearQuestion();
            this.statusText.setText('Aguardando conexão do oponente...');
            this.timerText.setText('Tempo: PAUSADO');
            if (this.pauseTitle) this.pauseTitle.setText('AGUARDANDO OPONENTE...');
            if (this.pauseSub) this.pauseSub.setText(`Código da Sala: ${this.roomId}`);
            if (this.pausePanel) this.pausePanel.setVisible(true);
            this.targetMatchStartTime = null;
            return;
        }

        this.isWaitingForOpponent = false;

        // Se já há questão ativa, esconde imediatamente o painel de contagem inicial
        if (data.currentQuestionId != null) {
            if (this.pausePanel) this.pausePanel.setVisible(false);
        } else {
            // Contagem regressiva antes da 1ª questão
            if (this.pausePanel) {
                this.pausePanel.setVisible(true);
                this.pauseTitle.setText('O COMBATE VAI COMEÇAR EM:');
            }

            if (data.matchStartTime) {
                this.targetMatchStartTime = data.matchStartTime;
            } else if (this.playerId === 'p1') {
                const startAt = Date.now() + (this.MATCH_START_DELAY * 1000);
                this.targetMatchStartTime = startAt;
                update(ref(db, `rooms/${this.roomId}`), {
                    matchStartTime: startAt
                }).catch(e => console.error(e));
            }
        }

        // 4. Detecta início de nova rodada
        const isNewRound = (data.round != null && data.round !== this.lastProcessedRound) ||
                           (data.currentQuestionId != null && data.currentQuestionId !== this.lastProcessedQuestionId);

        if (isNewRound && data.currentQuestionId != null) {
            this.lastProcessedRound = data.round != null ? data.round : data.currentQuestionId;
            this.lastProcessedQuestionId = data.currentQuestionId;
            this.isAdvancingQuestion = false;

            if (this.pausePanel) this.pausePanel.setVisible(false);

            if (this.nextQuestionTimeout) {
                clearTimeout(this.nextQuestionTimeout);
                this.nextQuestionTimeout = null;
            }

            this.localQuestionStartTime = data.questionStartedAt || Date.now();
            this.renderQuestion(data.currentQuestionId);
        }

        // 5. Se ambos responderam: resolução da rodada e avanço sincronizado
        if (data.p1 && data.p2 && data.p1.answered && data.p2.answered && !this.isGameOver) {
            this.localQuestionStartTime = null;

            if (this.playerId === 'p1' && !data.roundResolved && !this.isResolvingRound) {
                this.resolveRound(data);
            }

            if (this.playerId === 'p1') {
                this.statusText.setText('Rodada resolvida! Carregando próxima...');
                if (!this.isAdvancingQuestion) {
                    this.isAdvancingQuestion = true;
                    if (this.nextQuestionTimeout) clearTimeout(this.nextQuestionTimeout);
                    this.nextQuestionTimeout = setTimeout(() => {
                        this.nextQuestionTimeout = null;
                        if (!this.isGameOver) {
                            this.pickNextQuestion();
                        }
                    }, 2600);
                }
            } else {
                this.statusText.setText('Aguardando próxima rodada...');
                // Fallback para P2 caso o P1 congele ou desconecte
                if (!this.isAdvancingQuestion) {
                    if (this.nextQuestionTimeout) clearTimeout(this.nextQuestionTimeout);
                    this.nextQuestionTimeout = setTimeout(() => {
                        this.nextQuestionTimeout = null;
                        if (!this.isGameOver && !this.isWaitingForOpponent) {
                            this.pickNextQuestion();
                        }
                    }, 5200);
                }
            }
        }
    }

    renderQuestion(qId) {
        const q = questions.find(q => q.id == qId);
        if (!q) {
            console.error('Questão não encontrada para o ID:', qId);
            return;
        }

        if (this.pausePanel) this.pausePanel.setVisible(false);
        this.isWaitingForOpponent = false;

        // Tocar fanfarra de FIGHT! na primeira questão de cada partida
        if (!this.hasPlayedFightFanfare) {
            this.hasPlayedFightFanfare = true;
            SoundManager.playFight();
        }

        this.hasAnsweredLocal = false;
        this.currentQuestionData = q;
        this.questionText.setText(q.text);

        for (let i = 0; i < 4; i++) {
            this.optionButtons[i].setText(`${String.fromCharCode(65 + i)}) ${q.options[i]}`);
            this.optionButtons[i].setStyle({ backgroundColor: '#2d3544', fill: '#ffffff' }); 
            if (!this.isGameOver) {
                this.optionButtons[i].setInteractive(); 
            }
        }

        this.statusText.setText('Valendo!');
        this.statusText.setStyle({ fill: '#22c55e' });
    }

    handleAnswer(selectedIndex = null, isTimeout = false) {
        if (!this.roomId || !this.playerId || !this.currentQuestionData || this.hasAnsweredLocal || this.isGameOver || this.isWaitingForOpponent) return;

        this.hasAnsweredLocal = true;
        this.optionButtons.forEach(btn => btn.disableInteractive());

        let isCorrect = false;

        if (isTimeout) {
            SoundManager.playWrong();
            this.statusText.setText('TEMPO ESGOTADO!');
            this.statusText.setStyle({ fill: '#ef4444' });
            this.optionButtons.forEach(btn => btn.setStyle({ backgroundColor: '#374151' }));
        } else {
            isCorrect = (selectedIndex === this.currentQuestionData.correctIndex);
            if (isCorrect) {
                SoundManager.playCorrect();
            } else {
                SoundManager.playWrong();
            }
            this.optionButtons[selectedIndex].setStyle({ backgroundColor: isCorrect ? '#16a34a' : '#dc2626' });
            if (!isCorrect) {
                this.optionButtons[this.currentQuestionData.correctIndex].setStyle({ backgroundColor: '#16a34a' });
            }
        }

        const playerRef = ref(db, `rooms/${this.roomId}/${this.playerId}`);
        update(playerRef, {
            answered: true,
            answeredAt: Date.now(),
            answerCorrect: isCorrect,
            answeredChoice: selectedIndex != null ? selectedIndex : -1
        }).catch(err => console.error('Erro ao enviar resposta:', err));
    }

    forceTimeoutUnanswered() {
        if (this.playerId !== 'p1' || this.isGameOver || this.isWaitingForOpponent) return;
        const roomRef = ref(db, `rooms/${this.roomId}`);
        get(roomRef).then((snap) => {
            const data = snap.val();
            if (!data || this.isGameOver) return;
            const updates = {};
            const now = Date.now();
            
            if (data.p1 && !data.p1.answered) {
                updates['p1/answered'] = true;
                updates['p1/answeredAt'] = now;
                updates['p1/answerCorrect'] = false;
                updates['p1/answeredChoice'] = -1;
            }

            if (data.p2 && !data.p2.answered) {
                updates['p2/answered'] = true;
                updates['p2/answeredAt'] = now;
                updates['p2/answerCorrect'] = false;
                updates['p2/answeredChoice'] = -1;
            }

            if (Object.keys(updates).length > 0) {
                update(roomRef, updates);
            }
        }).catch(err => console.error('Erro no timeout forçado:', err));
    }

    handleGameOver(p1Hp, p2Hp, data = null) {
        const roomData = data || this.latestData || this.previousData || {};
        const p1Nick = (roomData.p1?.nickname || 'Jogador 1').toUpperCase();
        const p2Nick = (roomData.p2?.nickname || 'Jogador 2').toUpperCase();

        if (p1Hp <= 0 && p2Hp <= 0) {
            this.showGameOver(false, null, true, roomData); 
        } else if (p1Hp <= 0) {
            this.showGameOver(this.playerId === 'p2', p2Nick, false, roomData);
        } else if (p2Hp <= 0) {
            this.showGameOver(this.playerId === 'p1', p1Nick, false, roomData);
        }
    }

    showGameOver(isWinner, winnerNick, isTie = false, roomData = null) {
        if (!this.isGameOver && !this.hasPlayedKOSound) {
            this.hasPlayedKOSound = true;
            SoundManager.playKO();
        }
        this.isGameOver = true;
        this.gameOverPanel.setVisible(true);

        const data = roomData || this.latestData || this.previousData || {};
        const p1 = data.p1 || {};
        const p2 = data.p2 || {};
        const p1Prof = getProfessorById(p1.characterId || 'so');
        const p2Prof = getProfessorById(p2.characterId || 'web');

        // Configuração visual conforme Vitória, Derrota ou Empate
        if (isTie) {
            this.goCardGlow.setFillStyle(0xfacc15, 0.25);
            this.goCardBg.setStrokeStyle(2, 0xfacc15);
            this.goIconText.setText('🤝');
            this.goTitleText.setText('EMPATE DUPLO!').setStyle({ fill: '#facc15' });
            this.goSubText.setText('Ambos os combatentes esgotaram o HP simultaneamente!').setStyle({ fill: '#fde047' });
        } else if (isWinner) {
            this.goCardGlow.setFillStyle(0x10b981, 0.25);
            this.goCardBg.setStrokeStyle(2, 0x10b981);
            this.goIconText.setText('🏆');
            this.goTitleText.setText('VITÓRIA ACADÊMICA!').setStyle({ fill: '#34d399' });
            this.goSubText.setText(`Parabéns, ${winnerNick}! Você dominou o duelo de TI!`).setStyle({ fill: '#e2e8f0' });
        } else {
            this.goCardGlow.setFillStyle(0xef4444, 0.25);
            this.goCardBg.setStrokeStyle(2, 0xef4444);
            this.goIconText.setText('💀');
            this.goTitleText.setText('DERROTA NO COMBATE...').setStyle({ fill: '#f87171' });
            this.goSubText.setText(`Vitória de ${winnerNick}! Revise os conceitos e peça revanche!`).setStyle({ fill: '#cbd5e1' });
        }

        // Atualizar Placar / Resumo da Partida
        const p1Name = (p1.nickname || 'Jogador 1').toUpperCase();
        const p2Name = (p2.nickname || 'Jogador 2').toUpperCase();
        const p1Hp = p1.hp != null ? p1.hp : 0;
        const p2Hp = p2.hp != null ? p2.hp : 0;

        this.goP1Nick.setText(`P1: ${p1Name}`);
        this.goP1Prof.setText(`[ ${p1Prof.shortName.toUpperCase()} ]`);
        this.goP1Hearts.setText(p1Hp > 0 ? `${p1Hp} HP` : '💀 0 HP (K.O.)');
        this.goP1Hearts.setStyle({ fill: p1Hp > 0 ? '#34d399' : '#ef4444' });

        this.goP2Nick.setText(`P2: ${p2Name}`);
        this.goP2Prof.setText(`[ ${p2Prof.shortName.toUpperCase()} ]`);
        this.goP2Hearts.setText(p2Hp > 0 ? `${p2Hp} HP` : '💀 0 HP (K.O.)');
        this.goP2Hearts.setStyle({ fill: p2Hp > 0 ? '#34d399' : '#ef4444' });

        const roundsPlayed = data.round || this.currentRound || 1;
        this.goRoundsText.setText(`🎯 ${roundsPlayed} Rodada${roundsPlayed > 1 ? 's' : ''}`);

        this.btnRematch.setText('⚔️ Jogar Novamente (Revanche)');
        this.btnChangeProf.setText('🔄 Trocar Personagem');

        if (this.goFooterHint) {
            this.goFooterHint.setText(`Código da Sala: ${this.roomId} • Duelo Finalizado`);
        }

        this.timerText.setText('Fim de Jogo');
        this.timerText.setStyle({ fill: '#94a3b8', backgroundColor: '#1e293b' });

        this.updatePostMatchRequestUI(data.postMatchRequest, data);

        // Animação de entrada suave
        this.gameOverPanel.setScale(0.92);
        this.tweens.add({
            targets: this.gameOverPanel,
            scale: 1.0,
            duration: 180,
            ease: 'Back.easeOut'
        });
    }

    pickNextQuestion() {
        if (this.isGameOver) return;

        const currentId = this.currentQuestionData ? this.currentQuestionData.id : null;
        const available = questions.filter(q => q.id !== currentId);
        const pool = available.length > 0 ? available : questions;
        const randomQ = pool[Math.floor(Math.random() * pool.length)];

        // Sorteio de Modificador da Rodada (~30% de chance de modificador especial, ~70% normal)
        let selectedModifier = 'normal';
        const modRoll = Math.random();
        if (modRoll < 0.30) {
            const modifiers = ['charge', 'shield', 'heal', 'try_catch'];
            selectedModifier = modifiers[Math.floor(Math.random() * modifiers.length)];
        }

        const nextRound = (this.currentRound || 0) + 1;
        const roomRef = ref(db, `rooms/${this.roomId}`);
        
        update(roomRef, {
            round: nextRound,
            currentQuestionId: randomQ.id,
            questionStartedAt: Date.now(),
            roundModifier: selectedModifier,
            roundResolved: false,
            roundAlert: null,
            ultimateWinner: null,
            'p1/answered': false,
            'p1/answeredAt': null,
            'p1/answerCorrect': null,
            'p1/answeredChoice': null,
            'p2/answered': false,
            'p2/answeredAt': null,
            'p2/answerCorrect': null,
            'p2/answeredChoice': null,
            matchStartTime: null
        }).catch(err => {
            console.error('Erro ao atualizar próxima questão no Firebase:', err);
            this.isAdvancingQuestion = false;
        });
    }

    update() {
        if (this.isGameOver) return; 

        // Recuperação de segurança caso os botões fiquem vazios
        if (this.currentQuestionData && this.optionButtons[0] && this.optionButtons[0].text === '') {
            this.renderQuestion(this.currentQuestionData.id);
        }

        // Contagem regressiva antes da 1ª questão
        if (this.pausePanel && this.pausePanel.visible) {
            if (this.currentQuestionData != null) {
                this.pausePanel.setVisible(false);
            } else if (this.targetMatchStartTime) {
                const remaining = Math.ceil((this.targetMatchStartTime - Date.now()) / 1000);
                if (remaining > 0) {
                    this.pauseSub.setText(`${remaining}s`);
                    if (this.lastStartRemaining !== remaining) {
                        this.lastStartRemaining = remaining;
                        SoundManager.playTick();
                    }
                } else {
                    if (this.lastStartRemaining !== 0) {
                        this.lastStartRemaining = 0;
                        SoundManager.playFight();
                    }
                    this.pauseSub.setText('⚔️ LUTEM!');
                    this.pausePanel.setVisible(false);
                    this.targetMatchStartTime = null;

                    if (this.playerId === 'p1' && !this.isAdvancingQuestion) {
                        this.isAdvancingQuestion = true;
                        update(ref(db, `rooms/${this.roomId}`), {
                            'p1/hp': 100, 'p1/charges': 0, 'p1/hasShield': false, 'p1/hasTryCatch': false, 'p1/answered': false,
                            'p2/hp': 100, 'p2/charges': 0, 'p2/hasShield': false, 'p2/hasTryCatch': false, 'p2/answered': false,
                            round: 0,
                            roundModifier: 'normal',
                            roundResolved: false,
                            matchStartTime: null
                        }).then(() => {
                            this.pickNextQuestion();
                        }).catch(e => {
                            console.error(e);
                            this.pickNextQuestion();
                        });
                    }
                }
            }
        }

        if (this.isWaitingForOpponent) return;

        // Controle do tempo da questão
        if (this.localQuestionStartTime) {
            const elapsed = Math.floor((Date.now() - this.localQuestionStartTime) / 1000);
            const remaining = this.QUESTION_TIME_LIMIT - elapsed;
            
            if (!this.hasAnsweredLocal) {
                if (remaining > 0) {
                    this.timerText.setText(`⏱️ Tempo: ${remaining}s`);
                    if (remaining <= 5) {
                        this.timerText.setStyle({ fill: '#ef4444', backgroundColor: '#450a0a' });
                        if (this.lastQuestionTick !== remaining) {
                            this.lastQuestionTick = remaining;
                            SoundManager.playTick();
                        }
                    } else {
                        this.timerText.setStyle({ fill: '#38bdf8', backgroundColor: '#1e293b' });
                    }
                } else {
                    this.timerText.setText('⏱️ Tempo: 0s');
                    this.handleAnswer(null, true);
                }
            } else {
                if (remaining > 0) {
                    this.timerText.setText(`⏳ Aguardando (${remaining}s)`);
                    this.timerText.setStyle({ fill: '#94a3b8', backgroundColor: '#1e293b' });
                } else {
                    this.timerText.setText('⏳ Processando...');
                }
            }

            // Fallback autoritativo do Host (P1)
            if (this.playerId === 'p1' && remaining <= -2 && !this.isAdvancingQuestion && !this.isGameOver) {
                this.forceTimeoutUnanswered();
            }
        }
    }
}
