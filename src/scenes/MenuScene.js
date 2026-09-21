import Phaser from 'phaser';
import { db } from '../firebase.js';
import { ref, get, set } from "firebase/database";

export class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    preload() {
        this.load.image('arena_bg', '/assets/bg.jpg');
    }

    create() {
        // Auto-reconnect
        let savedRoom = sessionStorage.getItem('labcombat_room_id');
        let savedPlayer = sessionStorage.getItem('labcombat_player_id');
        
        if (savedRoom && savedPlayer) {
            this.scene.start('MainScene', { roomId: savedRoom, playerId: savedPlayer });
            return;
        }

        // Fundo
        const bg = this.add.image(400, 300, 'arena_bg').setOrigin(0.5);
        bg.setDisplaySize(800, 600);

        this.add.text(400, 150, 'LABCOMBAT', { fontSize: '64px', fill: '#fff', fontStyle: 'bold', backgroundColor: '#000000aa', padding: { x: 20, y: 10 } }).setOrigin(0.5);

        // Botão Criar Sala
        const btnCreate = this.add.text(400, 350, '[ CRIAR SALA ]', { 
            fontSize: '28px', fill: '#0f0', backgroundColor: '#222', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
        btnCreate.on('pointerdown', () => this.createRoom());

        // Botão Entrar em Sala
        const btnJoin = this.add.text(400, 430, '[ ENTRAR EM SALA ]', { 
            fontSize: '28px', fill: '#00f', backgroundColor: '#222', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btnJoin.on('pointerdown', () => this.showJoinOverlay());

        this.statusText = this.add.text(400, 520, '', { fontSize: '20px', fill: '#ff0', backgroundColor: '#000000aa', padding: { x: 10, y: 5 } }).setOrigin(0.5);

        // Ocultar Overlay do HTML sempre que a cena carregar
        document.getElementById('join-overlay').style.display = 'none';

        // Escutar evento do botão "Entrar" do HTML
        window.addEventListener('submit-room-code', this.handleJoinSubmit.bind(this));
    }

    async createRoom() {
        this.statusText.setText('Criando sala...');
        const roomId = this.generateRoomCode();
        const roomRef = ref(db, `rooms/${roomId}`);
        
        await set(roomRef, {
            p1: { lives: 3, streak: 0, answered: false },
            // P2 ainda não existe
            currentQuestionId: null,
            questionStartTime: null
        });

        sessionStorage.setItem('labcombat_room_id', roomId);
        sessionStorage.setItem('labcombat_player_id', 'p1');

        // Inicia o jogo como P1
        this.scene.start('MainScene', { roomId, playerId: 'p1' });
    }

    showJoinOverlay() {
        // Exibe a UI HTML por cima do canvas
        document.getElementById('join-overlay').style.display = 'flex';
        document.getElementById('room-input').focus();
    }

    async handleJoinSubmit(e) {
        const roomId = e.detail.toUpperCase().trim();
        if (!roomId) return;

        this.statusText.setText(`Buscando sala ${roomId}...`);
        document.getElementById('join-overlay').style.display = 'none';

        const roomRef = ref(db, `rooms/${roomId}`);
        const snapshot = await get(roomRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Checa se a vaga do P1 está livre
            if (!data.p1) {
                this.statusText.setText('Vaga P1 encontrada! Conectando...');
                await set(ref(db, `rooms/${roomId}/p1`), { lives: 3, streak: 0, answered: false });
                sessionStorage.setItem('labcombat_room_id', roomId);
                sessionStorage.setItem('labcombat_player_id', 'p1');
                this.scene.start('MainScene', { roomId, playerId: 'p1' });
            } 
            // Checa se a vaga do P2 está livre
            else if (!data.p2) {
                this.statusText.setText('Vaga P2 encontrada! Conectando...');
                await set(ref(db, `rooms/${roomId}/p2`), { lives: 3, streak: 0, answered: false });
                sessionStorage.setItem('labcombat_room_id', roomId);
                sessionStorage.setItem('labcombat_player_id', 'p2');
                this.scene.start('MainScene', { roomId, playerId: 'p2' });
            } 
            // Ambas ocupadas
            else {
                this.statusText.setText('Erro: A sala já está cheia!');
            }
        } else {
            this.statusText.setText('Erro: Sala não encontrada!');
        }
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}
