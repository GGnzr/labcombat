/**
 * SoundManager.js - Sistema de Áudio Procedural para o LabCombat
 * Gera efeitos sonoros arcade e retrô em tempo real via Web Audio API.
 * Não requer arquivos de áudio externos (.mp3/.wav), garantindo carregamento instantâneo.
 */

class SoundManagerClass {
    constructor() {
        this.ctx = null;
        this.masterVolume = 0.5;
        this.muted = localStorage.getItem('labcombat_muted') === 'true';
        this.unlocked = false;

        // Tentar inicializar o AudioContext
        this.initContext();

        // Desbloquear AudioContext com a primeira interação do usuário (política de autoplay)
        this.setupUnlockListeners();
    }

    initContext() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
    }

    setupUnlockListeners() {
        if (typeof window === 'undefined') return;

        const unlock = () => {
            if (!this.ctx) this.initContext();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    this.unlocked = true;
                }).catch(() => {});
            } else if (this.ctx && this.ctx.state === 'running') {
                this.unlocked = true;
            }

            // Remover listeners após primeiro desbloqueio bem sucedido
            if (this.unlocked) {
                window.removeEventListener('pointerdown', unlock);
                window.removeEventListener('keydown', unlock);
                window.removeEventListener('touchstart', unlock);
            }
        };

        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
        window.addEventListener('touchstart', unlock, { passive: true });
    }

    ensureContext() {
        if (!this.ctx) this.initContext();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx && this.ctx.state === 'running';
    }

    isMuted() {
        return this.muted;
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('labcombat_muted', this.muted ? 'true' : 'false');
        
        // Notificar componentes da UI sobre a mudança de estado
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('labcombat-mute-changed', { 
                detail: { muted: this.muted } 
            }));
        }

        // Toca um clique suave ao desmutar
        if (!this.muted) {
            this.playClick();
        }

        return this.muted;
    }

    setMasterVolume(vol) {
        this.masterVolume = Math.max(0, Math.min(1, vol));
        localStorage.setItem('labcombat_volume', this.masterVolume.toString());
    }

    // =========================================================================
    // SÍNTESE PROCEDURAL DE EFEITOS SONOROS (WEB AUDIO API)
    // =========================================================================

    /**
     * Clique tátil de botão na interface (UI Click)
     */
    playClick() {
        if (this.muted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.03);

        const vol = 0.18 * this.masterVolume;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.035);
    }

    /**
     * Hover suave ao passar o cursor sobre botões ou cards
     */
    playHover() {
        if (this.muted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.02);

        const vol = 0.06 * this.masterVolume;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.025);
    }

    /**
     * Som de Resposta Correta (Arpeggio triunfante de Moeda / Power-up 16-bit)
     */
    playCorrect() {
        if (this.muted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Notas da vitória: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            const start = now + (idx * 0.065);
            const dur = 0.16;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            const vol = 0.22 * this.masterVolume;
            gain.gain.setValueAtTime(vol, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + dur + 0.01);
        });
    }

    /**
     * Som de Resposta Errada (Buzzer arcade de erro com leve distorção)
     */
    playWrong() {
        if (this.muted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Dois osciladores em dente de serra levemente desafinados
        const freqs = [155, 162];
        freqs.forEach(baseFreq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.26);

            const vol = 0.18 * this.masterVolume;
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.27);
        });
    }

    /**
     * Bip do Relógio de Questão (Tick nos últimos 5 segundos)
     */
    playTick() {
        if (this.muted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);

        const vol = 0.20 * this.masterVolume;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.045);
    }

    /**
     * Som de Impacto / Soco (Pancada com corpo grave e estalo de ruído)
     */
    playPunch() {
        if (this.muted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // 1. Componente tonal: queda rápida de tom (240Hz -> 40Hz)
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

        const oscVol = 0.35 * this.masterVolume;
        oscGain.gain.setValueAtTime(oscVol, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(oscGain);
        oscGain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.13);

        // 2. Componente de ruído: impacto e textura de golpe físico
        const bufferSize = Math.floor(ctx.sampleRate * 0.08);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(650, now);
        filter.Q.setValueAtTime(1.5, now);

        const noiseGain = ctx.createGain();
        const noiseVol = 0.25 * this.masterVolume;
        noiseGain.gain.setValueAtTime(noiseVol, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        whiteNoise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        whiteNoise.start(now);
        whiteNoise.stop(now + 0.085);
    }

    /**
     * Som de Escudo / Bloqueio / Try-Catch (Deflexão metálica de golpe)
     */
    playShield() {
        if (this.muted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const freqs = [1200, 1680];
        freqs.forEach(f => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(f, now);
            osc.frequency.exponentialRampToValueAtTime(f * 0.7, now + 0.14);

            const vol = 0.14 * this.masterVolume;
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.15);
        });
    }

    /**
     * Som de Golpe Especial / Carga Máxima (Laser riser potente)
     */
    playSpecial() {
        if (this.muted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.42);

        const vol = 0.28 * this.masterVolume;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.43);
    }

    /**
     * Voz do Narrador Arcade usando Web Speech API nativa
     */
    speak(text, pitch = 0.80, rate = 1.05) {
        if (this.muted || typeof window === 'undefined' || !window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.pitch = pitch;
            utterance.rate = rate;
            utterance.volume = Math.min(1.0, this.masterVolume * 1.3);
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn('Speech synthesis unavailable:', e);
        }
    }

    /**
     * Fanfarra de Início de Round (Arcade "FIGHT!" com metais, gong e narrador)
     */
    playFight() {
        if (this.muted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // 1. Voz do Narrador Arcade
        this.speak('FIGHT!', 0.75, 1.1);

        // 2. Gong / Cymbal Crash Metálico (impacto enérgico)
        const crashBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.9), ctx.sampleRate);
        const crashData = crashBuffer.getChannelData(0);
        for (let i = 0; i < crashData.length; i++) {
            crashData[i] = Math.random() * 2 - 1;
        }
        const crashSource = ctx.createBufferSource();
        crashSource.buffer = crashBuffer;

        const crashFilter = ctx.createBiquadFilter();
        crashFilter.type = 'bandpass';
        crashFilter.frequency.setValueAtTime(2400, now);
        crashFilter.Q.setValueAtTime(1.8, now);

        const crashGain = ctx.createGain();
        const crashVol = 0.35 * this.masterVolume;
        crashGain.gain.setValueAtTime(crashVol, now);
        crashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        crashSource.connect(crashFilter);
        crashFilter.connect(crashGain);
        crashGain.connect(ctx.destination);
        crashSource.start(now);
        crashSource.stop(now + 0.9);

        // 3. Brass Fanfare Triunfante (Estilo Street Fighter)
        // Estágio 1: C4 + G4 (Ataque inicial)
        // Estágio 2: E4 + B4 (Ascensão de tensão)
        // Estágio 3: G4 + C5 + E5 + G5 (Acorde Final Sustentado com Brilho)
        const fanfareSequence = [
            { time: now, dur: 0.18, notes: [261.63, 392.00] },
            { time: now + 0.18, dur: 0.20, notes: [329.63, 493.88] },
            { time: now + 0.38, dur: 0.95, notes: [392.00, 523.25, 659.25, 783.99] }
        ];

        fanfareSequence.forEach(step => {
            step.notes.forEach(f => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(f, step.time);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2800, step.time);
                filter.Q.setValueAtTime(2.0, step.time);

                const vol = (step.notes.length > 2 ? 0.30 : 0.24) * this.masterVolume;
                gain.gain.setValueAtTime(vol, step.time);
                gain.gain.exponentialRampToValueAtTime(0.001, step.time + step.dur);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);

                osc.start(step.time);
                osc.stop(step.time + step.dur + 0.05);
            });
        });
    }

    /**
     * Som de K.O. / Finalização de Duelo (Explosão pesada, cadência musical dramática e narrador)
     */
    playKO() {
        if (this.muted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // 1. Voz do Narrador Arcade: K.O.!
        this.speak('K.O.!', 0.70, 0.90);

        // 2. Impacto de Nocaute Pesado (Audível em qualquer alto-falante: 380Hz -> 110Hz)
        const punchOsc = ctx.createOscillator();
        const punchGain = ctx.createGain();
        punchOsc.type = 'triangle';
        punchOsc.frequency.setValueAtTime(380, now);
        punchOsc.frequency.exponentialRampToValueAtTime(110, now + 0.28);

        const punchVol = 0.55 * this.masterVolume;
        punchGain.gain.setValueAtTime(punchVol, now);
        punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        punchOsc.connect(punchGain);
        punchGain.connect(ctx.destination);
        punchOsc.start(now);
        punchOsc.stop(now + 0.3);

        // 3. Estrondo / Crash de Nocaute
        const crashBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.7), ctx.sampleRate);
        const crashData = crashBuffer.getChannelData(0);
        for (let i = 0; i < crashData.length; i++) {
            crashData[i] = Math.random() * 2 - 1;
        }
        const crashSource = ctx.createBufferSource();
        crashSource.buffer = crashBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.Q.setValueAtTime(1.2, now);

        const crashGain = ctx.createGain();
        crashGain.gain.setValueAtTime(0.40 * this.masterVolume, now);
        crashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        crashSource.connect(filter);
        filter.connect(crashGain);
        crashGain.connect(ctx.destination);
        crashSource.start(now);
        crashSource.stop(now + 0.7);

        // 4. Cadência Musical de Fim de Combate (Street Fighter K.O. chimes: G5 -> E5 -> C5 -> F#4)
        const defeatNotes = [
            { f: 783.99, t: now },
            { f: 659.25, t: now + 0.16 },
            { f: 523.25, t: now + 0.32 },
            { f: 369.99, t: now + 0.48 } // Tritono dramático
        ];

        defeatNotes.forEach(item => {
            const bell = ctx.createOscillator();
            const bellGain = ctx.createGain();

            bell.type = 'sawtooth';
            bell.frequency.setValueAtTime(item.f, item.t);

            const bFilter = ctx.createBiquadFilter();
            bFilter.type = 'lowpass';
            bFilter.frequency.setValueAtTime(2200, item.t);

            const bVol = 0.28 * this.masterVolume;
            bellGain.gain.setValueAtTime(bVol, item.t);
            bellGain.gain.exponentialRampToValueAtTime(0.001, item.t + 0.45);

            bell.connect(bFilter);
            bFilter.connect(bellGain);
            bellGain.connect(ctx.destination);

            bell.start(item.t);
            bell.stop(item.t + 0.5);
        });
    }

    /**
     * Cria um botão de controle Mudo/Som (🔊 / 🔇) para ser adicionado em qualquer cena Phaser
     */
    createMuteButton(scene, x, y, options = {}) {
        const radius = options.radius || 16;
        const size = radius * 2;
        const container = scene.add.container(x, y).setDepth(options.depth || 100);

        const bgGfx = scene.add.graphics();
        const renderBg = (hover = false) => {
            bgGfx.clear();
            const fColor = hover ? 0x334155 : 0x1e293b;
            const sColor = hover ? 0x64748b : 0x475569;
            bgGfx.fillStyle(fColor, 0.95);
            bgGfx.fillCircle(0, 0, radius);
            bgGfx.lineStyle(1.5, sColor, 1);
            bgGfx.strokeCircle(0, 0, radius);
        };
        renderBg(false);
        container.add(bgGfx);

        const iconText = scene.add.text(0, 0, this.muted ? '🔇' : '🔊', {
            fontSize: '15px'
        }).setOrigin(0.5);
        container.add(iconText);

        container.setSize(size, size);
        container.setInteractive({ useHandCursor: true });

        container.on('pointerover', () => {
            renderBg(true);
            scene.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 80 });
        });

        container.on('pointerout', () => {
            renderBg(false);
            scene.tweens.add({ targets: container, scaleX: 1.0, scaleY: 1.0, duration: 80 });
        });

        container.on('pointerdown', () => {
            const isMuted = this.toggleMute();
            iconText.setText(isMuted ? '🔇' : '🔊');
        });

        // Ouvir alterações globais de mute (ex: de outras cenas ou abas)
        const onGlobalMute = (e) => {
            if (iconText && iconText.active) {
                iconText.setText(e.detail?.muted ? '🔇' : '🔊');
            }
        };
        window.addEventListener('labcombat-mute-changed', onGlobalMute);

        container.once('destroy', () => {
            window.removeEventListener('labcombat-mute-changed', onGlobalMute);
        });

        return container;
    }
}

export const SoundManager = new SoundManagerClass();
