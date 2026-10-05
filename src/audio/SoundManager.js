/**
 * SoundManager.js - Sistema de Áudio Procedural para o LabCombat
 * Gera efeitos sonoros arcade e retrô em tempo real via Web Audio API.
 * Não requer arquivos de áudio externos (.mp3/.wav), garantindo carregamento instantâneo.
 */

class SoundManagerClass {
    constructor() {
        this.ctx = null;
        const savedVolume = parseFloat(localStorage.getItem('labcombat_volume'));
        const defaultVolume = Number.isFinite(savedVolume) ? savedVolume : 0.5;
        this.effectsVolume = this._readStoredVolume('labcombat_effects_volume', defaultVolume);
        this.musicVolume = this._readStoredVolume('labcombat_music_volume', defaultVolume);
        this.masterVolume = this.effectsVolume;
        this.muted = localStorage.getItem('labcombat_muted') === 'true';
        this.effectsMuted = localStorage.getItem('labcombat_effects_muted') === 'true';
        this.musicMuted = localStorage.getItem('labcombat_music_muted') === 'true';
        this.unlocked = false;
        this._bgmCurrentTrack = null;
        this._bgmRequestedTrack = null;
        this._bgmPlaying = false;

        // Tentar inicializar o AudioContext
        this.initContext();

        // Desbloquear AudioContext com a primeira interação do usuário (política de autoplay)
        this.setupUnlockListeners();
    }

    _readStoredVolume(key, fallback) {
        const stored = parseFloat(localStorage.getItem(key));
        return Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : fallback;
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
                    this._startRequestedBGM();
                    window.removeEventListener('pointerdown', unlock);
                    window.removeEventListener('keydown', unlock);
                    window.removeEventListener('touchstart', unlock);
                }).catch(() => {});
            } else if (this.ctx && this.ctx.state === 'running') {
                this.unlocked = true;
                this._startRequestedBGM();
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
        this.setMusicVolume(this.musicVolume);
        
        // Notificar componentes da UI sobre a mudança de estado
        if (typeof window !== 'undefined') {
            this._notifyMuteChange();
        }

        // Toca um clique suave ao desmutar
        if (!this.muted) {
            this.playClick();
        }

        return this.muted;
    }

    setMasterVolume(vol) {
        this.setEffectsVolume(vol);
        this.setMusicVolume(vol);
    }

    setEffectsVolume(vol) {
        this.effectsVolume = Math.max(0, Math.min(1, vol));
        this.masterVolume = this.effectsVolume;
        localStorage.setItem('labcombat_effects_volume', this.effectsVolume.toString());
        localStorage.setItem('labcombat_volume', this.effectsVolume.toString());
    }

    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        localStorage.setItem('labcombat_music_volume', this.musicVolume.toString());

        if (this._bgmMasterGain && this.ctx) {
            const targetVolume = this.muted || this.musicMuted ? 0 : this._bgmBaseVolume * this.musicVolume;
            this._bgmMasterGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.03);
        }
    }

    _notifyMuteChange() {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('labcombat-mute-changed', {
                detail: {
                    muted: this.muted || (this.effectsMuted && this.musicMuted),
                    effectsMuted: this.effectsMuted,
                    musicMuted: this.musicMuted
                }
            }));
        }
    }

    toggleEffectsMute() {
        this.effectsMuted = !this.effectsMuted;
        localStorage.setItem('labcombat_effects_muted', this.effectsMuted ? 'true' : 'false');
        this._notifyMuteChange();
        return this.effectsMuted;
    }

    toggleMusicMute() {
        this.musicMuted = !this.musicMuted;
        localStorage.setItem('labcombat_music_muted', this.musicMuted ? 'true' : 'false');
        this.setMusicVolume(this.musicVolume);
        this._notifyMuteChange();
        return this.musicMuted;
    }

    // =========================================================================
    // SÍNTESE PROCEDURAL DE EFEITOS SONOROS (WEB AUDIO API)
    // =========================================================================

    /**
     * Clique tátil de botão na interface (UI Click)
     */
    playClick() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.03);

        const vol = 0.18 * this.effectsVolume;
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
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.02);

        const vol = 0.06 * this.effectsVolume;
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
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
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

            const vol = 0.22 * this.effectsVolume;
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
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
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

            const vol = 0.18 * this.effectsVolume;
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
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);

        const vol = 0.20 * this.effectsVolume;
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
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // 1. Componente tonal: queda rápida de tom (240Hz -> 40Hz)
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

        const oscVol = 0.35 * this.effectsVolume;
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
        const noiseVol = 0.25 * this.effectsVolume;
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
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const freqs = [1200, 1680];
        freqs.forEach(f => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(f, now);
            osc.frequency.exponentialRampToValueAtTime(f * 0.7, now + 0.14);

            const vol = 0.14 * this.effectsVolume;
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
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.42);

        const vol = 0.28 * this.effectsVolume;
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
        if (this.muted || this.effectsMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.pitch = pitch;
            utterance.rate = rate;
            utterance.volume = Math.min(1.0, this.effectsVolume * 1.3);
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn('Speech synthesis unavailable:', e);
        }
    }

    /**
     * Fanfarra de Início de Round (Arcade "FIGHT!" com metais, gong e narrador)
     */
    playFight() {
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
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
        const crashVol = 0.35 * this.effectsVolume;
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

                const vol = (step.notes.length > 2 ? 0.30 : 0.24) * this.effectsVolume;
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
        if (this.muted || this.effectsMuted || !this.ensureContext()) return;
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

        const punchVol = 0.55 * this.effectsVolume;
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
        crashGain.gain.setValueAtTime(0.40 * this.effectsVolume, now);
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

            const bVol = 0.28 * this.effectsVolume;
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

        const iconText = scene.add.text(0, 0, this.muted || (this.effectsMuted && this.musicMuted) ? '🔇' : '🔊', {
            fontSize: '15px'
        }).setOrigin(0.5);
        container.add(iconText);

        container.setSize(size, size);
        container.setInteractive({ useHandCursor: true });

        const panelSide = options.panelSide || (x < scene.scale.width / 2 ? 'right' : 'left');
        const panelX = panelSide === 'right' ? x + 20 : x - 155;
        const volumePanel = scene.add.container(panelX, y + 18).setDepth((options.depth || 100) + 1).setVisible(false);
        const panelBg = scene.add.rectangle(75, 102, 150, 204, 0x0f172a, 0.98);
        panelBg.setStrokeStyle(1, 0x475569, 1);
        volumePanel.add(panelBg);

        const createVolumeSlider = (label, value, setter, rowY) => {
            const labelText = scene.add.text(12, rowY - 16, label, {
                fontSize: '11px', fill: '#cbd5e1', fontStyle: 'bold'
            });
            const valueText = scene.add.text(138, rowY - 16, `${Math.round(value * 100)}%`, {
                fontSize: '10px', fill: '#f59e0b', fontStyle: 'bold'
            }).setOrigin(1, 0);
            const track = scene.add.rectangle(75, rowY + 5, 120, 8, 0x334155, 1);
            track.setInteractive({ useHandCursor: true });
            const fill = scene.add.rectangle(15, rowY + 5, 120 * value, 8, 0x38bdf8, 1).setOrigin(0, 0.5);
            const knob = scene.add.circle(15 + (120 * value), rowY + 5, 6, 0xf59e0b, 1);
            volumePanel.add([labelText, valueText, track, fill, knob]);

            let dragging = false;
            const update = (pointer) => {
                const bounds = track.getBounds();
                const nextValue = Math.max(0, Math.min(1, (pointer.x - bounds.left) / bounds.width));
                setter(nextValue);
                fill.width = 120 * nextValue;
                knob.x = 15 + (120 * nextValue);
                valueText.setText(`${Math.round(nextValue * 100)}%`);
            };
            const onPointerMove = (pointer) => {
                if (dragging) update(pointer);
            };
            const onPointerUp = () => {
                dragging = false;
            };

            track.on('pointerdown', (pointer) => {
                dragging = true;
                update(pointer);
            });
            scene.input.on('pointermove', onPointerMove);
            scene.input.on('pointerup', onPointerUp);
            volumePanel.once('destroy', () => {
                scene.input.off('pointermove', onPointerMove);
                scene.input.off('pointerup', onPointerUp);
            });
        };

        createVolumeSlider('Efeitos', this.effectsVolume, (value) => this.setEffectsVolume(value), 32);
        createVolumeSlider('Música', this.musicVolume, (value) => this.setMusicVolume(value), 79);

        const createMuteToggle = (label, rowY, isMuted, toggle) => {
            const button = scene.add.rectangle(75, rowY, 130, 24, 0x1e293b, 1);
            button.setStrokeStyle(1, 0x475569, 1);
            button.setInteractive({ useHandCursor: true });
            const statusText = scene.add.text(75, rowY, '', {
                fontSize: '10px', fill: '#cbd5e1', fontStyle: 'bold'
            }).setOrigin(0.5);
            const updateStatus = (muted) => {
                statusText.setText(`${label}: ${muted ? '🔇 Mudo' : '🔊 Ativo'}`);
                statusText.setColor(muted ? '#f87171' : '#86efac');
            };
            updateStatus(isMuted);
            button.on('pointerover', () => button.setFillStyle(0x334155));
            button.on('pointerout', () => button.setFillStyle(0x1e293b));
            button.on('pointerdown', () => {
                updateStatus(toggle());
                iconText.setText(this.muted || (this.effectsMuted && this.musicMuted) ? '🔇' : '🔊');
            });
            volumePanel.add([button, statusText]);
        };

        createMuteToggle('Efeitos', 122, this.effectsMuted, () => this.toggleEffectsMute());
        createMuteToggle('Música', 151, this.musicMuted, () => this.toggleMusicMute());
        createMuteToggle('Som geral', 180, this.muted, () => this.toggleMute());

        container.on('pointerover', () => {
            renderBg(true);
            scene.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 80 });
        });

        container.on('pointerout', () => {
            renderBg(false);
            scene.tweens.add({ targets: container, scaleX: 1.0, scaleY: 1.0, duration: 80 });
        });

        container.on('pointerdown', () => {
            volumePanel.setVisible(!volumePanel.visible);
        });

        // Ouvir alterações globais de mute (ex: de outras cenas ou abas)
        const onGlobalMute = (e) => {
            if (iconText && iconText.active) {
                const allMuted = e.detail?.muted || (e.detail?.effectsMuted && e.detail?.musicMuted);
                iconText.setText(allMuted ? '🔇' : '🔊');
            }
        };
        window.addEventListener('labcombat-mute-changed', onGlobalMute);

        container.once('destroy', () => {
            window.removeEventListener('labcombat-mute-changed', onGlobalMute);
        });

        return container;
    }

    // =========================================================================
    // SISTEMA DE MÚSICA AMBIENTE PROCEDURAL (BGM - Background Music)
    // Gera música chiptune/arcade em loop infinito via Web Audio API.
    // Dois temas: Menu (chill) e Batalha (agressivo estilo Street Fighter).
    // =========================================================================

    /**
     * Inicia a música de fundo do Menu (tema chill chiptune)
     */
    startMenuBGM() {
        this.startBGM('menu');
    }

    /**
     * Inicia a música de fundo de Batalha (tema arcade agressivo)
     */
    startBattleBGM() {
        this.startBGM('battle');
    }

    /**
     * Inicia um tema de BGM. Se outro tema estiver tocando, faz crossfade.
     * @param {'menu'|'battle'} track - Nome do tema
     */
    startBGM(track) {
        this._bgmRequestedTrack = track;
        if (!this.ensureContext()) return;

        // Se já está tocando o mesmo tema, não reinicia
        if (this._bgmCurrentTrack === track && this._bgmPlaying) return;

        // Para qualquer BGM anterior
        this.stopBGM();

        this._bgmCurrentTrack = track;
        this._bgmPlaying = true;
        this._bgmLoopCount = 0; // contador de variação por loop (acordes/frases)

        if (track === 'menu') {
            this._createMenuBGMLoop();
        } else {
            this._createBattleBGMLoop();
        }
    }

    _startRequestedBGM() {
        if (this._bgmRequestedTrack) {
            this.startBGM(this._bgmRequestedTrack);
        }
    }

    /**
     * Para a música de fundo com fade-out suave
     */
    stopBGM() {
        this._bgmPlaying = false;
        this._bgmCurrentTrack = null;

        const previousMasterGain = this._bgmMasterGain;
        if (previousMasterGain && this.ctx) {
            const now = this.ctx.currentTime;
            previousMasterGain.gain.setValueAtTime(previousMasterGain.gain.value, now);
            previousMasterGain.gain.linearRampToValueAtTime(0, now + 0.5);
        }

        // Limpar schedulers
        if (this._bgmTimeout) {
            clearTimeout(this._bgmTimeout);
            this._bgmTimeout = null;
        }

        // Desconectar nós depois do fade
        setTimeout(() => {
            if (previousMasterGain) {
                try { previousMasterGain.disconnect(); } catch(e) {}
                if (this._bgmMasterGain === previousMasterGain) {
                    this._bgmMasterGain = null;
                }
            }
        }, 600);
    }

    /**
     * Verifica se a BGM está tocando
     */
    isBGMPlaying() {
        return this._bgmPlaying === true;
    }

    // ---- TEMA DO MENU (Chiptune Lo-Fi Chill) ----
    // Progressão: Am → F → C → G (i → VI → III → VII em Lá menor)
    // BPM: 100, compasso 4/4, loop de 8 compassos

    _createMenuBGMLoop() {
        const ctx = this.ctx;
        if (!ctx) return;

        // Master gain para BGM
        this._bgmBaseVolume = 0.18;
        this._bgmMasterGain = ctx.createGain();
        this._bgmMasterGain.gain.setValueAtTime(0, ctx.currentTime);
        this._bgmMasterGain.gain.linearRampToValueAtTime(
            this.muted || this.musicMuted ? 0 : this._bgmBaseVolume * this.musicVolume,
            ctx.currentTime + 1.0
        );
        this._bgmMasterGain.connect(ctx.destination);

        const BPM = 100;
        const beatDur = 60 / BPM;
        const barDur = beatDur * 4;
        const loopDur = barDur * 8;

        // Progressões alternantes (2 compassos por acorde) — trocam a cada loop
        const chordSets = [
            [ { root: 220.00, notes: [220.00, 261.63, 329.63] },  // Am
              { root: 174.61, notes: [174.61, 220.00, 261.63] },  // F
              { root: 261.63, notes: [261.63, 329.63, 392.00] },  // C
              { root: 196.00, notes: [196.00, 246.94, 293.66] }], // G
            [ { root: 220.00, notes: [220.00, 261.63, 329.63] },  // Am
              { root: 164.81, notes: [164.81, 196.00, 246.94] },  // Em
              { root: 174.61, notes: [174.61, 220.00, 261.63] },  // F
              { root: 196.00, notes: [196.00, 246.94, 293.66] }], // G
            [ { root: 261.63, notes: [261.63, 329.63, 392.00] },  // C
              { root: 196.00, notes: [196.00, 246.94, 293.66] },  // G
              { root: 220.00, notes: [220.00, 261.63, 329.63] },  // Am
              { root: 174.61, notes: [174.61, 220.00, 261.63] }], // F
        ];

        // Melodia em frases de 2 compassos; cada loop remonta numa ordem diferente
        const phrases = [
            [523.25, 493.88, 440.00, 392.00, 440.00, 493.88, 523.25, 0,
             587.33, 523.25, 493.88, 440.00, 392.00, 440.00, 0, 0],
            [349.23, 392.00, 440.00, 523.25, 493.88, 440.00, 392.00, 0,
             349.23, 329.63, 293.66, 349.23, 392.00, 440.00, 0, 0],
            [523.25, 587.33, 659.25, 523.25, 493.88, 440.00, 523.25, 0,
             659.25, 587.33, 523.25, 493.88, 523.25, 587.33, 0, 0],
            [493.88, 440.00, 392.00, 440.00, 493.88, 523.25, 587.33, 0,
             493.88, 440.00, 392.00, 329.63, 293.66, 329.63, 0, 0],
        ];
        const structures = [ [0,1,2,3], [1,2,0,3], [0,3,1,2], [2,0,3,1] ];

        const scheduleLoop = () => {
            if (!this._bgmPlaying) return;
            const now = ctx.currentTime;

            // Variação por loop: outra progressão, outra ordem de frases
            const loopIdx = this._bgmLoopCount++;
            const chords = chordSets[loopIdx % chordSets.length];
            const melody = structures[loopIdx % structures.length].flatMap(pi => phrases[pi]);
            const walkBass = loopIdx % 2 === 1; // loops ímpares: baixo caminha pela quinta

            if (this._bgmMasterGain) {
                const targetVol = this.muted || this.musicMuted ? 0 : this._bgmBaseVolume * this.musicVolume;
                this._bgmMasterGain.gain.setValueAtTime(this._bgmMasterGain.gain.value, now);
                this._bgmMasterGain.gain.linearRampToValueAtTime(targetVol, now + 0.3);
            }

            // === BAIXO (square wave, oitava baixa) ===
            chords.forEach((chord, ci) => {
                for (let beat = 0; beat < 8; beat++) {
                    const t = now + (ci * barDur * 2) + (beat * beatDur);
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(chord.root / 2, t);
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
                    g.gain.setValueAtTime(0.12, t + beatDur * 0.4);
                    g.gain.linearRampToValueAtTime(0, t + beatDur * 0.5);
                    osc.connect(g);
                    g.connect(this._bgmMasterGain);
                    osc.start(t);
                    osc.stop(t + beatDur * 0.55);
                }
            });

            // === ACORDES PAD (triangle wave, suave) ===
            chords.forEach((chord, ci) => {
                const t = now + (ci * barDur * 2);
                const dur = barDur * 2 - 0.1;
                chord.notes.forEach(freq => {
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, t);
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.06, t + 0.3);
                    g.gain.setValueAtTime(0.06, t + dur - 0.5);
                    g.gain.linearRampToValueAtTime(0, t + dur);
                    osc.connect(g);
                    g.connect(this._bgmMasterGain);
                    osc.start(t);
                    osc.stop(t + dur + 0.05);
                });
            });

            // === MELODIA LEAD (square wave chiptune) ===
            const noteDur = beatDur / 2;
            melody.forEach((freq, i) => {
                if (freq === 0) return;
                const t = now + (i * noteDur);
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.09, t + 0.01);
                g.gain.setValueAtTime(0.09, t + noteDur * 0.7);
                g.gain.linearRampToValueAtTime(0, t + noteDur * 0.95);
                osc.connect(g);
                g.connect(this._bgmMasterGain);
                osc.start(t);
                osc.stop(t + noteDur);
            });

            // === PERCUSSÃO ===
            for (let beat = 0; beat < 32; beat++) {
                const t = now + (beat * beatDur);

                // Hi-hat (a cada tempo; nos loops ímpares, dobra p/ colcheias)
                const hatOffsets = walkBass ? [0, 0.5] : [0];
                hatOffsets.forEach((subOff) => {
                    const ht = t + (subOff * beatDur);
                    const hhBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
                    const hhData = hhBuffer.getChannelData(0);
                    for (let s = 0; s < hhData.length; s++) hhData[s] = Math.random() * 2 - 1;
                    const hh = ctx.createBufferSource();
                    hh.buffer = hhBuffer;
                    const hhF = ctx.createBiquadFilter();
                    hhF.type = 'highpass';
                    hhF.frequency.setValueAtTime(8000, ht);
                    const hhG = ctx.createGain();
                    hhG.gain.setValueAtTime(subOff ? 0.05 : 0.08, ht);
                    hhG.gain.exponentialRampToValueAtTime(0.001, ht + 0.03);
                    hh.connect(hhF);
                    hhF.connect(hhG);
                    hhG.connect(this._bgmMasterGain);
                    hh.start(ht);
                    hh.stop(ht + 0.035);
                });

                // Kick (1 e 3)
                if (beat % 4 === 0 || beat % 4 === 2) {
                    const kick = ctx.createOscillator();
                    const kickG = ctx.createGain();
                    kick.type = 'sine';
                    kick.frequency.setValueAtTime(160, t);
                    kick.frequency.exponentialRampToValueAtTime(50, t + 0.08);
                    kickG.gain.setValueAtTime(0.18, t);
                    kickG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                    kick.connect(kickG);
                    kickG.connect(this._bgmMasterGain);
                    kick.start(t);
                    kick.stop(t + 0.12);
                }

                // Snare (2 e 4)
                if (beat % 4 === 1 || beat % 4 === 3) {
                    const snBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
                    const snData = snBuffer.getChannelData(0);
                    for (let s = 0; s < snData.length; s++) snData[s] = Math.random() * 2 - 1;
                    const sn = ctx.createBufferSource();
                    sn.buffer = snBuffer;
                    const snF = ctx.createBiquadFilter();
                    snF.type = 'bandpass';
                    snF.frequency.setValueAtTime(3000, t);
                    snF.Q.setValueAtTime(0.8, t);
                    const snG = ctx.createGain();
                    snG.gain.setValueAtTime(0.10, t);
                    snG.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                    sn.connect(snF);
                    snF.connect(snG);
                    snG.connect(this._bgmMasterGain);
                    sn.start(t);
                    sn.stop(t + 0.065);
                }
            }

            this._bgmTimeout = setTimeout(() => scheduleLoop(), (loopDur - 0.5) * 1000);
        };

        scheduleLoop();
    }

    // ---- TEMA DE BATALHA (Arcade Fighter Agressivo) ----
    // Progressão: Em → C → D → B7 (i → VI → VII → V7 em Mi menor)
    // BPM: 140, intenso, estilo Street Fighter II / KOF

    _createBattleBGMLoop() {
        const ctx = this.ctx;
        if (!ctx) return;

        this._bgmBaseVolume = 0.20;
        this._bgmMasterGain = ctx.createGain();
        this._bgmMasterGain.gain.setValueAtTime(0, ctx.currentTime);
        this._bgmMasterGain.gain.linearRampToValueAtTime(
            this.muted || this.musicMuted ? 0 : this._bgmBaseVolume * this.musicVolume,
            ctx.currentTime + 0.8
        );
        this._bgmMasterGain.connect(ctx.destination);

        const BPM = 140;
        const beatDur = 60 / BPM;
        const barDur = beatDur * 4;
        const loopDur = barDur * 8;

        // Progressões alternantes de batalha (Em menor, estilo KOF)
        const chordSets = [
            [ { root: 164.81, notes: [164.81, 196.00, 246.94] },  // Em
              { root: 130.81, notes: [130.81, 164.81, 196.00] },  // C
              { root: 146.83, notes: [146.83, 185.00, 220.00] },  // D
              { root: 123.47, notes: [123.47, 155.56, 185.00, 220.00] } ], // B7
            [ { root: 164.81, notes: [164.81, 196.00, 246.94] },  // Em
              { root: 196.00, notes: [196.00, 246.94, 293.66] },  // G
              { root: 146.83, notes: [146.83, 185.00, 220.00] },  // D
              { root: 220.00, notes: [220.00, 277.18, 329.63] } ], // A
        ];

        // Riffs de 2 compassos; a ordem muda a cada loop (mantém a identidade do tema)
        const phrases = [
            [659.25, 622.25, 587.33, 659.25, 0, 523.25, 587.33, 0,
             659.25, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 0],
            [523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 0,
             523.25, 493.88, 440.00, 523.25, 587.33, 659.25, 0, 0],
            [587.33, 659.25, 739.99, 880.00, 0, 783.99, 739.99, 659.25,
             587.33, 659.25, 739.99, 587.33, 523.25, 587.33, 0, 0],
            [493.88, 587.33, 659.25, 739.99, 880.00, 987.77, 880.00, 739.99,
             659.25, 587.33, 493.88, 440.00, 493.88, 587.33, 659.25, 0],
        ];
        const structures = [ [0,1,2,3], [1,2,0,3], [0,3,1,2], [3,0,2,1] ];

        const scheduleLoop = () => {
            if (!this._bgmPlaying) return;
            const now = ctx.currentTime;

            // Variação por loop: outra progressão e outra ordem de riffs
            const loopIdx = this._bgmLoopCount++;
            const chords = chordSets[loopIdx % chordSets.length];
            const melody = structures[loopIdx % structures.length].flatMap(pi => phrases[pi]);
            const doubleKick = loopIdx % 2 === 1; // loops ímpares: kick extra no contratempo

            if (this._bgmMasterGain) {
                const targetVol = this.muted || this.musicMuted ? 0 : this._bgmBaseVolume * this.musicVolume;
                this._bgmMasterGain.gain.setValueAtTime(this._bgmMasterGain.gain.value, now);
                this._bgmMasterGain.gain.linearRampToValueAtTime(targetVol, now + 0.3);
            }

            // === BAIXO SINCOPADO (sawtooth) ===
            chords.forEach((chord, ci) => {
                const pattern = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5];
                pattern.forEach(beatOff => {
                    const t = now + (ci * barDur * 2) + (beatOff * beatDur);
                    const isOff = (beatOff % 1 !== 0);
                    const dur = isOff ? beatDur * 0.3 : beatDur * 0.4;
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    const f = ctx.createBiquadFilter();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(chord.root / 2, t);
                    f.type = 'lowpass';
                    f.frequency.setValueAtTime(800, t);
                    f.Q.setValueAtTime(2, t);
                    const vol = isOff ? 0.10 : 0.14;
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(vol, t + 0.01);
                    g.gain.setValueAtTime(vol, t + dur * 0.7);
                    g.gain.linearRampToValueAtTime(0, t + dur);
                    osc.connect(f);
                    f.connect(g);
                    g.connect(this._bgmMasterGain);
                    osc.start(t);
                    osc.stop(t + dur + 0.02);
                });
            });

            // === POWER CHORDS (sawtooth, tempos fortes) ===
            chords.forEach((chord, ci) => {
                for (let bar = 0; bar < 2; bar++) {
                    [0, 2].forEach(beat => {
                        const t = now + (ci * barDur * 2) + (bar * barDur) + (beat * beatDur);
                        const dur = beatDur * 1.2;
                        chord.notes.forEach(freq => {
                            const osc = ctx.createOscillator();
                            const g = ctx.createGain();
                            const f = ctx.createBiquadFilter();
                            osc.type = 'sawtooth';
                            osc.frequency.setValueAtTime(freq, t);
                            f.type = 'lowpass';
                            f.frequency.setValueAtTime(1800, t);
                            f.Q.setValueAtTime(1.5, t);
                            g.gain.setValueAtTime(0, t);
                            g.gain.linearRampToValueAtTime(0.05, t + 0.01);
                            g.gain.setValueAtTime(0.05, t + dur * 0.5);
                            g.gain.linearRampToValueAtTime(0, t + dur);
                            osc.connect(f);
                            f.connect(g);
                            g.connect(this._bgmMasterGain);
                            osc.start(t);
                            osc.stop(t + dur + 0.02);
                        });
                    });
                }
            });

            // === MELODIA LEAD (square wave arcade) ===
            const noteDur = beatDur / 2;
            melody.forEach((freq, i) => {
                if (freq === 0) return;
                const t = now + (i * noteDur);
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                const f = ctx.createBiquadFilter();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, t);
                f.type = 'lowpass';
                f.frequency.setValueAtTime(3500, t);
                f.Q.setValueAtTime(1.0, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.08, t + 0.008);
                g.gain.setValueAtTime(0.08, t + noteDur * 0.6);
                g.gain.linearRampToValueAtTime(0, t + noteDur * 0.9);
                osc.connect(f);
                f.connect(g);
                g.connect(this._bgmMasterGain);
                osc.start(t);
                osc.stop(t + noteDur + 0.01);
            });

            // === PERCUSSÃO PESADA ===
            const totalBeats = 32;
            for (let beat = 0; beat < totalBeats; beat++) {
                const t = now + (beat * beatDur);

                // Hi-hat em semicolcheias
                for (let sub = 0; sub < 2; sub++) {
                    const ht = t + (sub * beatDur / 2);
                    const hhBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.025), ctx.sampleRate);
                    const hhData = hhBuffer.getChannelData(0);
                    for (let s = 0; s < hhData.length; s++) hhData[s] = Math.random() * 2 - 1;
                    const hh = ctx.createBufferSource();
                    hh.buffer = hhBuffer;
                    const hhF = ctx.createBiquadFilter();
                    hhF.type = 'highpass';
                    hhF.frequency.setValueAtTime(9000, ht);
                    const hhG = ctx.createGain();
                    hhG.gain.setValueAtTime(sub === 0 ? 0.09 : 0.05, ht);
                    hhG.gain.exponentialRampToValueAtTime(0.001, ht + 0.025);
                    hh.connect(hhF);
                    hhF.connect(hhG);
                    hhG.connect(this._bgmMasterGain);
                    hh.start(ht);
                    hh.stop(ht + 0.03);
                }

                // Kick pesado (1 e 3) — loops ímpares: chute extra no contratempo
                if (beat % 4 === 0 || beat % 4 === 2 || (doubleKick && beat % 4 === 3)) {
                    const kt = (doubleKick && beat % 4 === 3) ? t + beatDur / 2 : t;
                    const kick = ctx.createOscillator();
                    const kickG = ctx.createGain();
                    kick.type = 'sine';
                    kick.frequency.setValueAtTime(200, kt);
                    kick.frequency.exponentialRampToValueAtTime(45, kt + 0.1);
                    kickG.gain.setValueAtTime(0.25, kt);
                    kickG.gain.exponentialRampToValueAtTime(0.001, kt + 0.12);
                    kick.connect(kickG);
                    kickG.connect(this._bgmMasterGain);
                    kick.start(kt);
                    kick.stop(kt + 0.13);
                }

                // Snare potente (2 e 4)
                if (beat % 4 === 1 || beat % 4 === 3) {
                    const snOsc = ctx.createOscillator();
                    const snOscG = ctx.createGain();
                    snOsc.type = 'triangle';
                    snOsc.frequency.setValueAtTime(220, t);
                    snOsc.frequency.exponentialRampToValueAtTime(130, t + 0.04);
                    snOscG.gain.setValueAtTime(0.12, t);
                    snOscG.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                    snOsc.connect(snOscG);
                    snOscG.connect(this._bgmMasterGain);
                    snOsc.start(t);
                    snOsc.stop(t + 0.07);

                    const snBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.07), ctx.sampleRate);
                    const snData = snBuffer.getChannelData(0);
                    for (let s = 0; s < snData.length; s++) snData[s] = Math.random() * 2 - 1;
                    const sn = ctx.createBufferSource();
                    sn.buffer = snBuffer;
                    const snF = ctx.createBiquadFilter();
                    snF.type = 'bandpass';
                    snF.frequency.setValueAtTime(4000, t);
                    snF.Q.setValueAtTime(1.0, t);
                    const snG = ctx.createGain();
                    snG.gain.setValueAtTime(0.14, t);
                    snG.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
                    sn.connect(snF);
                    snF.connect(snG);
                    snG.connect(this._bgmMasterGain);
                    sn.start(t);
                    sn.stop(t + 0.075);
                }
            }

            this._bgmTimeout = setTimeout(() => scheduleLoop(), (loopDur - 0.5) * 1000);
        };

        scheduleLoop();
    }
}

export const SoundManager = new SoundManagerClass();

