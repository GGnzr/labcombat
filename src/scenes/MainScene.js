import Phaser from 'phaser';
import { ref, set, onValue, get, update } from 'firebase/database';
import { db } from '../firebase.js';
import { questions } from '../questions.js';

export class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.QUESTION_TIME_LIMIT = 15;
        this.MATCH_START_DELAY = 30;
    }

    preload() {
        this.load.image('arena_bg', '/assets/bg.jpg');
    }

    init(data) {
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        this.isWaitingForOpponent = true;
        
        // Reset flags so they don't leak between reconnects
        this.isGameOver = false;
        this.hasAnsweredLocal = false;
        this.currentQuestionData = null;
        this.optionButtons = [];
        this.isLeaving = false;
        this.localQuestionStartTime = null;
        this.localMatchStartTime = null;
        this.lastProcessedQuestionId = null;
        this.lastProcessedMatchSignal = null;
        this.previousData = null;
    }

    create() {
        // Fundo (Background Image)
        const bg = this.add.image(400, 300, 'arena_bg').setOrigin(0.5);
        bg.setDisplaySize(800, 600); // Ajusta a imagem para cobrir a tela 800x600

        this.add.text(400, 30, 'LabCombat - Arena de Batalha', { fontSize: '24px', fill: '#fff', backgroundColor: '#000000aa', padding: {x: 10, y: 5} }).setOrigin(0.5);

        this.statusText = this.add.text(400, 60, 'Conectando...', { fontSize: '18px', fill: '#fff', backgroundColor: '#000000aa', padding: {x: 10, y: 2} }).setOrigin(0.5);

        // Vidas ajustadas para não baterem na barra de progresso!
        this.p1Text = this.add.text(200, 70, 'P1 Vidas: ❤️❤️❤️', { fontSize: '18px', fill: '#fff', backgroundColor: '#00000088', padding: {x: 5, y: 2} }).setOrigin(0.5);
        this.p2Text = this.add.text(600, 70, 'P2 Vidas: ❤️❤️❤️', { fontSize: '18px', fill: '#fff', backgroundColor: '#00000088', padding: {x: 5, y: 2} }).setOrigin(0.5);

        this.add.text(20, 20, '[ Sair da Sala ]', { fontSize: '16px', fill: '#fff', backgroundColor: '#900', padding: { x: 10, y: 5 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.leaveRoom());

        this.p1Thermometer = this.add.graphics();
        this.p2Thermometer = this.add.graphics();

        this.fighterP1 = this.add.container(200, 220);
        const p1Body = this.add.rectangle(0, 0, 50, 100, 0x00aa00);
        const p1Eye = this.add.rectangle(12, -20, 10, 10, 0x000000); 
        this.fighterP1.add([p1Body, p1Eye]);
        this.fighterP1.originalX = 200;

        this.fighterP2 = this.add.container(600, 220);
        const p2Body = this.add.rectangle(0, 0, 50, 100, 0xaa0000);
        const p2Eye = this.add.rectangle(-12, -20, 10, 10, 0x000000); 
        this.fighterP2.add([p2Body, p2Eye]);
        this.fighterP2.originalX = 600;

        this.add.rectangle(400, 465, 760, 250, 0x111122, 0.9).setStrokeStyle(2, 0x444488);

        this.questionText = this.add.text(400, 375, '', { 
            fontSize: '18px', fill: '#fff', align: 'center', wordWrap: { width: 720 } 
        }).setOrigin(0.5);

        // Limpa explicitamente caso a scene reinicie
        this.optionButtons = [];
        for (let i = 0; i < 4; i++) {
            let btn = this.add.text(400, 430 + (i * 42), '', { 
                fontSize: '16px', fill: '#fff', backgroundColor: '#333',
                fixedWidth: 700,
                padding: { x: 15, y: 10 }, align: 'left'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            
            btn.on('pointerdown', () => this.handleAnswer(i));
            this.optionButtons.push(btn);
        }

        this.timerText = this.add.text(400, 335, 'Tempo: --', { fontSize: '20px', fill: '#fff', fontStyle: 'bold', backgroundColor: '#00000088', padding: {x: 5, y: 2} }).setOrigin(0.5);

        this.setupFirebase();

        this.gameOverPanel = this.add.container(400, 300).setDepth(10).setVisible(false);
        const goBg = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.85);
        this.gameOverTitle = this.add.text(0, -50, '', { fontSize: '48px', fontStyle: 'bold' }).setOrigin(0.5);
        const btnRestart = this.add.text(0, 50, '[ Jogar Novamente ]', { fontSize: '24px', backgroundColor: '#333', padding: { x: 20, y: 10 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', async () => {
                sessionStorage.clear();
                await set(ref(db, `rooms/${this.roomId}`), null);
                window.location.reload();
            });
        this.gameOverPanel.add([goBg, this.gameOverTitle, btnRestart]);

        this.pausePanel = this.add.container(400, 300).setDepth(15).setVisible(false);
        const pauseBg = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.85);
        this.pauseTitle = this.add.text(0, -50, 'AGUARDANDO OPONENTE...', { fontSize: '48px', fontStyle: 'bold', fill: '#ffcc00' }).setOrigin(0.5);
        this.pauseSub = this.add.text(0, 20, `Código da Sala: ${this.roomId}`, { fontSize: '32px', fill: '#00ff00', fontStyle: 'bold' }).setOrigin(0.5);
        const pauseLeaveBtn = this.add.text(0, 100, '[ Fechar / Sair da Sala ]', { fontSize: '24px', backgroundColor: '#900', padding: { x: 20, y: 10 } })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.leaveRoom());

        this.pausePanel.add([pauseBg, this.pauseTitle, this.pauseSub, pauseLeaveBtn]);

        window.addEventListener('dev-reset', async () => {
            sessionStorage.clear();
            await set(ref(db, `rooms/${this.roomId}`), null);
            window.location.reload();
        });
    }

    async leaveRoom() {
        this.isLeaving = true;
        if (this.roomId) {
            try {
                await set(ref(db, `rooms/${this.roomId}`), null); 
            } catch(e) {
                console.error(e);
            }
        }
        sessionStorage.removeItem('labcombat_room_id');
        sessionStorage.removeItem('labcombat_player_id');
        window.location.reload();
    }

    async setupFirebase() {
        const roomRef = ref(db, `rooms/${this.roomId}`);
        
        if (this.playerId === 'p1') {
            this.statusText.setText('Você é o Jogador 1. Aguardando P2...');
        } else {
            this.statusText.setText('Você é o Jogador 2.');
        }

        onValue(roomRef, (snap) => {
            if (this.isLeaving) return;
            const data = snap.val();
            if (data) {
                this.updateState(data);
            } else {
                alert('A sala foi fechada porque um dos jogadores saiu.');
                sessionStorage.removeItem('labcombat_room_id');
                sessionStorage.removeItem('labcombat_player_id');
                window.location.reload();
            }
        });
    }

    playAttack(fighter, direction) {
        this.tweens.add({ targets: fighter, x: fighter.originalX + (120 * direction), duration: 150, yoyo: true, ease: 'Power2' });
    }

    playDamage(fighter) {
        this.tweens.add({ targets: fighter, x: fighter.originalX + 15, duration: 50, yoyo: true, repeat: 4 });
        this.tweens.add({ targets: fighter, alpha: 0.2, duration: 100, yoyo: true, repeat: 2 });
    }

    drawThermometer(graphics, x, y, streak) {
        graphics.clear();
        const blockWidth = 18;
        const blockHeight = 15;
        const spacing = 4;
        const startX = x - (9 * (blockWidth + spacing)) / 2;

        for (let i = -3; i <= 5; i++) {
            let color = 0x555555;
            if (i < 0) color = 0xff3333;
            else if (i === 0) color = 0xcccccc;
            else if (i > 0 && i < 5) color = 0x33ff33;
            else if (i === 5) color = 0xffcc00;

            let isFilled = false;
            if (streak >= 0 && i >= 0 && i <= streak) isFilled = true;
            if (streak < 0 && i <= 0 && i >= streak) isFilled = true;

            const currentX = startX + (i + 3) * (blockWidth + spacing);

            graphics.fillStyle(isFilled ? color : 0x222222, 1);
            graphics.lineStyle(1, 0xffffff, 0.3);
            graphics.strokeRect(currentX, y, blockWidth, blockHeight);
            graphics.fillRect(currentX, y, blockWidth, blockHeight);
            
            if (i === streak) {
                graphics.lineStyle(2, 0xffffff, 1);
                graphics.strokeRect(currentX - 1, y - 1, blockWidth + 2, blockHeight + 2);
            }
        }
    }

    clearQuestion() {
        this.currentQuestionData = null;
        this.localQuestionStartTime = null;
        this.lastProcessedQuestionId = null;
        this.questionText.setText('');
        this.optionButtons.forEach(btn => {
            btn.setText('');
            btn.setStyle({ fill: '#fff', backgroundColor: '#333' });
            btn.disableInteractive();
        });
        this.timerText.setText('Tempo: --');
    }

    updateState(data) {
        const hasP1 = !!data.p1;
        const hasP2 = !!data.p2;

        if (!hasP1 || !hasP2) {
            this.isWaitingForOpponent = true;
            this.clearQuestion();
            this.statusText.setText('Aguardando conexão do oponente...');
            this.timerText.setText('Tempo: PAUSADO');
            this.pauseTitle.setText('AGUARDANDO OPONENTE...');
            this.pauseSub.setText(`Código da Sala: ${this.roomId}`);
            this.pausePanel.setVisible(true);
            this.localMatchStartTime = null;
        } else {
            if (this.isWaitingForOpponent) {
                this.isWaitingForOpponent = false;
                
                // Trata nulos adequadamente (Firebase pode retornar undefined ou null)
                if (data.currentQuestionId != null) {
                    this.pausePanel.setVisible(false);
                } else {
                    this.pausePanel.setVisible(true);
                    this.pauseTitle.setText('O COMBATE VAI COMEÇAR EM:');
                    this.pauseSub.setText('30s');
                    
                    if (this.playerId === 'p1') {
                        update(ref(db, `rooms/${this.roomId}`), {
                            matchStartSignal: Date.now()
                        });
                    }
                }
            }
        }

        if (data.matchStartSignal != null && data.matchStartSignal !== this.lastProcessedMatchSignal) {
            this.lastProcessedMatchSignal = data.matchStartSignal;
            this.localMatchStartTime = Date.now();
        }

        if (this.previousData) {
            if (data.p1 && this.previousData.p1 && data.p1.streak > this.previousData.p1.streak) {
                this.playAttack(this.fighterP1, 1);
            }
            if (data.p1 && this.previousData.p1 && data.p1.lives < this.previousData.p1.lives) {
                this.playDamage(this.fighterP1);
            }

            if (data.p2 && this.previousData.p2 && data.p2.streak > this.previousData.p2.streak) {
                this.playAttack(this.fighterP2, -1);
            }
            if (data.p2 && this.previousData.p2 && data.p2.lives < this.previousData.p2.lives) {
                this.playDamage(this.fighterP2);
            }
        }
        this.previousData = data; 

        if (data.p1) {
            this.p1Text.setText(`P1 Vidas: ${'❤️'.repeat(Math.max(0, data.p1.lives))}`);
            if (this.playerId === 'p1') {
                this.p1Text.setStyle({ fill: '#fff', fontStyle: 'bold' });
                this.hasAnsweredLocal = data.p1.answered;
            }
            this.drawThermometer(this.p1Thermometer, 200, 105, data.p1.streak);
        }
        if (data.p2) {
            this.p2Text.setText(`P2 Vidas: ${'❤️'.repeat(Math.max(0, data.p2.lives))}`);
            if (this.playerId === 'p2') {
                this.p2Text.setStyle({ fill: '#fff', fontStyle: 'bold' });
                this.hasAnsweredLocal = data.p2.answered;
            }
            this.drawThermometer(this.p2Thermometer, 600, 105, data.p2.streak);
        }

        if (data.p1 && data.p1.lives === 3 && data.p2 && data.p2.lives === 3) {
            this.isGameOver = false;
            this.gameOverPanel.setVisible(false);
        }

        if (data.p1 && data.p2 && (data.p1.lives <= 0 || data.p2.lives <= 0)) {
            this.handleGameOver(data.p1.lives, data.p2.lives);
            return; 
        }

        if (data.currentQuestionId != null && data.currentQuestionId !== this.lastProcessedQuestionId) {
            this.lastProcessedQuestionId = data.currentQuestionId;
            this.localQuestionStartTime = Date.now();
            this.renderQuestion(data.currentQuestionId);
        }

        if (data.p1 && data.p2 && data.p1.answered && data.p2.answered && !this.isGameOver) {
            this.localQuestionStartTime = null;
            if (this.playerId === 'p1') {
                this.statusText.setText('Ambos responderam! Carregando próxima...');
                setTimeout(() => {
                    if (!this.isGameOver) this.pickNextQuestion();
                }, 3000);
            } else {
                this.statusText.setText('Aguardando próxima rodada...');
            }
        }
    }

    renderQuestion(qId) {
        const q = questions.find(q => q.id == qId);
        if (!q) return;

        this.hasAnsweredLocal = false;
        this.currentQuestionData = q;
        this.questionText.setText(q.text);

        for (let i = 0; i < 4; i++) {
            this.optionButtons[i].setText(`${String.fromCharCode(65 + i)}) ${q.options[i]}`);
            this.optionButtons[i].setStyle({ backgroundColor: '#333' }); 
            if (!this.hasAnsweredLocal && !this.isGameOver) {
                this.optionButtons[i].setInteractive(); 
            }
        }

        this.statusText.setText('Valendo!');
    }

    handleAnswer(selectedIndex = null, isTimeout = false) {
        if (!this.playerId || !this.currentQuestionData || this.hasAnsweredLocal || this.isGameOver || this.isWaitingForOpponent) return;

        this.hasAnsweredLocal = true;
        this.optionButtons.forEach(btn => btn.disableInteractive());

        let isCorrect = false;

        if (isTimeout) {
            this.statusText.setText('TEMPO ESGOTADO!');
            this.optionButtons.forEach(btn => btn.setStyle({ backgroundColor: '#555' }));
        } else {
            isCorrect = (selectedIndex === this.currentQuestionData.correctIndex);
            this.optionButtons[selectedIndex].setStyle({ backgroundColor: isCorrect ? '#0a0' : '#a00' });
            if (!isCorrect) {
                this.optionButtons[this.currentQuestionData.correctIndex].setStyle({ backgroundColor: '#0a0' });
            }
        }

        const playerRef = ref(db, `rooms/${this.roomId}/${this.playerId}`);
        get(playerRef).then((snap) => {
            let data = snap.val();
            if (!data) return;

            let newStreak = data.streak;
            let newLives = data.lives;

            if (isTimeout) {
                newStreak = Math.max(-3, newStreak - 1);
            } else if (isCorrect) {
                newStreak = Math.min(5, newStreak + 1);
            } else {
                newStreak = Math.max(-3, newStreak - 1);
            }

            if (newStreak === -3) {
                newLives -= 1;
                newStreak = 0;
            }

            update(playerRef, {
                streak: newStreak,
                lives: newLives,
                answered: true
            }).then(() => {
                if (newStreak === 5) {
                    this.statusText.setText('ULTIMATE ACERTOU! DANO NO OPONENTE!');
                    const opponentId = this.playerId === 'p1' ? 'p2' : 'p1';
                    const oppRef = ref(db, `rooms/${this.roomId}/${opponentId}`);
                    get(oppRef).then((oppSnap) => {
                        let oppData = oppSnap.val();
                        if (oppData && oppData.lives > 0) {
                            update(oppRef, { lives: oppData.lives - 1 });
                        }
                    });
                    update(playerRef, { streak: 0 });
                }
            });
        });
    }

    handleGameOver(p1Lives, p2Lives) {
        if (p1Lives <= 0 && p2Lives <= 0) {
            this.showGameOver(false); 
        } else if (p1Lives <= 0) {
            this.showGameOver(this.playerId === 'p2');
        } else if (p2Lives <= 0) {
            this.showGameOver(this.playerId === 'p1');
        }
    }

    showGameOver(isWinner) {
        this.isGameOver = true;
        this.gameOverPanel.setVisible(true);
        this.gameOverTitle.setText(isWinner ? 'VITÓRIA!' : 'DERROTA...');
        this.gameOverTitle.setStyle({ fill: isWinner ? '#0f0' : '#f00' });
        this.timerText.setText('Fim de Jogo');
    }

    pickNextQuestion() {
        const randomQ = questions[Math.floor(Math.random() * questions.length)];
        const roomRef = ref(db, `rooms/${this.roomId}`);
        
        update(roomRef, {
            currentQuestionId: randomQ.id,
            'p1/answered': false,
            'p2/answered': false
        });
    }

    update() {
        if (this.isGameOver) return; 

        // SAFETY CHECK: Se por algum motivo bizarro do Phaser as respostas sumirem, força a re-renderização
        if (this.currentQuestionData && this.optionButtons[0] && this.optionButtons[0].text === '') {
            this.renderQuestion(this.currentQuestionData.id);
        }

        if (this.pausePanel.visible && this.localMatchStartTime) {
            const elapsed = Math.floor((Date.now() - this.localMatchStartTime) / 1000);
            const remaining = this.MATCH_START_DELAY - elapsed;
            
            if (remaining > 0) {
                this.pauseSub.setText(`${remaining}s`);
            } else {
                this.pausePanel.setVisible(false);
                this.localMatchStartTime = null;
                this.localQuestionStartTime = null; 

                if (this.playerId === 'p1') {
                    update(ref(db, `rooms/${this.roomId}`), {
                        'p1/lives': 3, 'p1/streak': 0, 'p1/answered': false,
                        'p2/lives': 3, 'p2/streak': 0, 'p2/answered': false,
                        currentQuestionId: null,
                        matchStartSignal: null
                    }).then(() => {
                        this.pickNextQuestion();
                    });
                }
            }
        }

        if (this.isWaitingForOpponent) return;

        if (this.localQuestionStartTime && !this.hasAnsweredLocal) {
            const elapsed = Math.floor((Date.now() - this.localQuestionStartTime) / 1000);
            const remaining = this.QUESTION_TIME_LIMIT - elapsed;
            
            if (remaining > 0) {
                this.timerText.setText(`Tempo: ${remaining}s`);
                if (remaining <= 5) {
                    this.timerText.setStyle({ fill: '#ff0000' });
                } else {
                    this.timerText.setStyle({ fill: '#ffffff' });
                }
            } else {
                this.timerText.setText('Tempo: 0s');
                this.handleAnswer(null, true);
            }
        } else if (this.hasAnsweredLocal) {
            this.timerText.setText(`-- aguardando --`);
            this.timerText.setStyle({ fill: '#aaaaaa' });
        }
    }
}
